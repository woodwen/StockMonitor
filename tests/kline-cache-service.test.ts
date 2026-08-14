import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NetworkProxySettings } from '../src/preload/stock-api'
import type {
  KlineCacheRefreshRequest,
  KlineCacheStatusRequest,
  KlineCacheRequestQuery,
  IntervalType,
  StockDataSourceMeta,
  StockDataset,
  StockQuery,
  WatchlistItem
} from '../src/renderer/features/stock-workspace/models/stock-types'
import type { KlineCacheFile } from '../src/main/kline-cache'

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir()
  }
}))

vi.mock('electron-store', () => ({
  default: class TestStore {
    private readonly values = new Map<string, unknown>()

    constructor(options?: { defaults?: Record<string, unknown> }) {
      Object.entries(options?.defaults ?? {}).forEach(([key, value]) => {
        this.values.set(key, value)
      })
    }

    get(key: string): unknown {
      return this.values.get(key)
    }

    set(key: string, value: unknown): void {
      this.values.set(key, value)
    }
  }
}))

import { createKlineCacheService, type KlineCacheService } from '../src/main/kline-cache'

const tempDirs: string[] = []

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('KlineCacheService', () => {
  it('stores successful refreshes and restores status from disk', async () => {
    const cacheRoot = await createTempRoot()
    const fetchDataset = vi.fn(async (query: StockQuery) => createDataset(query))
    const service = createTestService(cacheRoot, { fetchDataset })

    expect(await service.getStatus(createRequest())).toMatchObject([
      {
        symbol: 'sh600519',
        status: 'empty',
        missingRanges: [{ startDate: '20260801', endDate: '20260810' }]
      }
    ])

    const startedJob = service.startRefresh(createRequest())
    const completedJob = await waitForJob(service, startedJob.id)

    expect(completedJob?.status).toBe('completed')
    expect(completedJob?.rows[0]).toMatchObject({
      symbol: 'sh600519',
      status: 'success',
      recordCount: 2
    })

    const restoredService = createTestService(cacheRoot)
    const status = await restoredService.getStatus(createRequest())
    expect(status[0]).toMatchObject({
      symbol: 'sh600519',
      status: 'complete',
      recordCount: 2,
      cachedStartDate: '20260801',
      cachedEndDate: '20260810',
      missingRanges: []
    })

    const cachedDataset = await restoredService.getCachedDataset(
      createStockQuery(createRequest().query, 'sh600519')
    )
    expect(cachedDataset.status).toBe('complete')
    expect(cachedDataset.dataset?.candles.map((candle) => candle.timeKey)).toEqual([
      '20260801',
      '20260810'
    ])
  })

  it('keeps old cache coverage and records lastError when a later refresh fails', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const shortRequest = createRequest({
      query: {
        ...createRequest().query,
        endDate: '20260805'
      }
    })

    const firstJob = service.startRefresh(shortRequest)
    await waitForJob(service, firstJob.id)

    const failingService = createTestService(cacheRoot, {
      fetchDataset: vi.fn(async () => {
        throw new Error('source unavailable')
      }),
      now: () => 12345
    })
    const secondJob = failingService.startRefresh(createRequest())
    await waitForJob(failingService, secondJob.id)

    const status = await failingService.getStatus(createRequest())
    expect(status[0]).toMatchObject({
      status: 'partial',
      coveredRanges: [{ startDate: '20260801', endDate: '20260805' }],
      missingRanges: [{ startDate: '20260806', endDate: '20260810' }],
      lastError: {
        message: 'source unavailable',
        occurredAt: 12345
      }
    })
  })

  it('reports partial coverage even when the covered segment has no valid candles', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot, {
      fetchDataset: vi.fn(async (query: StockQuery) => ({
        ...createDataset(query),
        candles: []
      }))
    })
    const shortRequest = createRequest({
      query: {
        ...createRequest().query,
        endDate: '20260805'
      }
    })

    const job = service.startRefresh(shortRequest)
    await waitForJob(service, job.id)

    const status = await service.getStatus(createRequest())
    expect(status[0]).toMatchObject({
      status: 'partial',
      recordCount: 0,
      coveredRanges: [{ startDate: '20260801', endDate: '20260805' }],
      missingRanges: [{ startDate: '20260806', endDate: '20260810' }]
    })
  })

  it('reports an error when full coverage has no valid candles', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot, {
      fetchDataset: vi.fn(async (query: StockQuery) => ({
        ...createDataset(query),
        candles: []
      }))
    })

    const job = service.startRefresh(createRequest())
    await waitForJob(service, job.id)

    const status = await service.getStatus(createRequest())
    expect(status[0]).toMatchObject({
      status: 'error',
      recordCount: 0,
      coveredRanges: [{ startDate: '20260801', endDate: '20260810' }],
      missingRanges: [{ startDate: '20260801', endDate: '20260810' }],
      message: '缓存覆盖范围内没有有效 K 线记录'
    })

    const cachedDataset = await service.getCachedDataset(
      createStockQuery(createRequest().query, 'sh600519')
    )
    expect(cachedDataset).toMatchObject({
      status: 'error',
      missingRanges: [{ startDate: '20260801', endDate: '20260810' }],
      message: '缓存覆盖范围内没有有效 K 线记录'
    })
  })

  it('expands selected periods and adjusts into independent cache rows', async () => {
    const cacheRoot = await createTempRoot()
    const fetchDataset = vi.fn(async (query: StockQuery) => createDataset(query))
    const service = createTestService(cacheRoot, { fetchDataset })
    const request = createRequest({
      query: {
        ...createRequest().query,
        periods: ['day', 'week'],
        adjusts: ['qfq', 'none']
      }
    })

    const status = await service.getStatus(request)
    expect(status.map((row) => row.id)).toEqual([
      'eastmoney__sh600519__day__qfq',
      'eastmoney__sh600519__day__none',
      'eastmoney__sh600519__week__qfq',
      'eastmoney__sh600519__week__none'
    ])

    const job = service.startRefresh(request)
    const completedJob = await waitForJob(service, job.id)
    expect(completedJob?.total).toBe(4)
    expect(completedJob?.rows.map((row) => row.status)).toEqual([
      'success',
      'success',
      'success',
      'success'
    ])
    expect(fetchDataset).toHaveBeenCalledTimes(4)
  })

  it('isolates corrupt cache files from other symbols', async () => {
    const cacheRoot = await createTempRoot()
    await writeFile(join(cacheRoot, 'eastmoney__sh600519__day__qfq.json'), '{broken', 'utf8')
    const service = createTestService(cacheRoot)

    const status = await service.getStatus(
      createRequest({
        items: [
          item('sh600519', '贵州茅台'),
          item('sz000001', '平安银行')
        ]
      })
    )

    expect(status[0]).toMatchObject({
      symbol: 'sh600519',
      status: 'error',
      message: '缓存文件无法解析'
    })
    expect(status[1]).toMatchObject({
      symbol: 'sz000001',
      status: 'empty'
    })
  })

  it('cancels remaining rows after the current refresh finishes', async () => {
    const cacheRoot = await createTempRoot()
    let resolveFetch: (() => void) | undefined
    const fetchDataset = vi.fn(
      (query: StockQuery) =>
        new Promise<StockDataset>((resolve) => {
          resolveFetch = () => resolve(createDataset(query))
        })
    )
    const service = createTestService(cacheRoot, { fetchDataset })

    const startedJob = service.startRefresh(
      createRequest({
        items: [
          item('sh600519', '贵州茅台'),
          item('sz000001', '平安银行')
        ]
      })
    )
    await waitForJobState(service, startedJob.id, 'running')
    service.cancelJob(startedJob.id)
    resolveFetch?.()

    const completedJob = await waitForJob(service, startedJob.id)
    expect(completedJob?.status).toBe('cancelled')
    expect(completedJob?.rows.map((row) => row.status)).toEqual(['success', 'cancelled'])
    expect(fetchDataset).toHaveBeenCalledTimes(1)
  })

  it('uses source capabilities and saved proxy settings for refreshes', async () => {
    const cacheRoot = await createTempRoot()
    const proxy: NetworkProxySettings = {
      enabled: true,
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080
    }
    const fetchDataset = vi.fn(async (query: StockQuery, context: { proxy: NetworkProxySettings }) => {
      expect(query.sourceId).toBe('eastmoney')
      expect(context.proxy).toEqual(proxy)
      return createDataset(query)
    })
    const service = createTestService(cacheRoot, { fetchDataset, getProxy: () => proxy })

    const job = service.startRefresh(createRequest())
    await waitForJob(service, job.id)

    expect(fetchDataset).toHaveBeenCalledTimes(1)

    const failingSourceFetch = vi.fn(async (query: StockQuery) => {
      if (query.sourceId === 'eastmoney') {
        throw new Error('eastmoney failed')
      }
      return createDataset(query)
    })
    const noFallbackService = createTestService(await createTempRoot(), {
      fetchDataset: failingSourceFetch,
      sources: [eastmoneySource, tencentSource]
    })
    const failedJob = noFallbackService.startRefresh(createRequest())
    const finishedFailedJob = await waitForJob(noFallbackService, failedJob.id)

    expect(finishedFailedJob?.rows[0]).toMatchObject({
      status: 'error',
      message: 'eastmoney failed'
    })
    expect(failingSourceFetch).toHaveBeenCalledTimes(1)
    expect(failingSourceFetch.mock.calls[0][0]).toMatchObject({
      sourceId: 'eastmoney',
      symbol: 'sh600519'
    })

    const unsupportedService = createTestService(cacheRoot, {
      fetchDataset,
      sources: [neteaseSource]
    })
    const unsupportedJob = unsupportedService.startRefresh(
      createRequest({
        query: {
          ...createRequest().query,
          sourceId: 'netease163',
          periods: ['week'],
          adjusts: ['none']
        }
      })
    )
    const finishedUnsupportedJob = await waitForJob(unsupportedService, unsupportedJob.id)

    expect(finishedUnsupportedJob?.rows[0]).toMatchObject({
      status: 'unsupported',
      message: '网易财经 163 暂不支持 周线'
    })
    expect(fetchDataset).toHaveBeenCalledTimes(1)
  })

  it('clears selected symbols only for the current query dimension', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const dayJob = service.startRefresh(createRequest())
    await waitForJob(service, dayJob.id)
    const weekJob = service.startRefresh(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )
    await waitForJob(service, weekJob.id)

    const clearedRows = await service.clear(createRequest())
    const weekRows = await service.getStatus(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )

    expect(clearedRows[0].status).toBe('empty')
    expect(weekRows[0].status).toBe('complete')
  })

  it('ignores unsafe selected rows instead of deleting outside the cache root', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const siblingPath = join(cacheRoot, '..', 'outside__sh600519__day__qfq.json')
    await writeFile(siblingPath, 'keep', 'utf8')

    try {
      const rows = await service.clear({
        ...createRequest(),
        rows: [
          {
            id: 'outside__sh600519__day__qfq',
            symbol: 'sh600519',
            name: '贵州茅台',
            query: {
              sourceId: '../outside' as StockQuery['sourceId'],
              symbol: 'sh600519',
              period: 'day',
              adjust: 'qfq',
              startDate: '20260801',
              endDate: '20260810'
            }
          }
        ]
      })

      expect(rows).toEqual([])
      await expect(readFile(siblingPath, 'utf8')).resolves.toBe('keep')
    } finally {
      await rm(siblingPath, { force: true })
    }
  })

  it('drops terminal jobs after the retention window', async () => {
    vi.useFakeTimers()
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)

    const job = service.startRefresh(
      createRequest({
        items: []
      })
    )

    expect(service.getJob(job.id)).not.toBeNull()

    await vi.advanceTimersByTimeAsync(10 * 60_000)

    expect(service.getJob(job.id)).toBeNull()
  })

  it('exports valid cache entries and skips corrupt files', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const job = service.startRefresh(createRequest())
    await waitForJob(service, job.id)
    await writeFile(join(cacheRoot, 'eastmoney__sz000001__day__qfq.json'), '{broken', 'utf8')

    const exported = await service.exportEntries()

    expect(exported.entries.map((entry) => entry.seriesKey)).toEqual([
      'eastmoney__sh600519__day__qfq'
    ])
    expect(exported.skippedEntries).toEqual([
      {
        fileName: 'eastmoney__sz000001__day__qfq.json',
        reason: '缓存文件无法解析'
      }
    ])
    expect(exported.totalBytes).toBeGreaterThan(0)
  })

  it('imports entries with merge strategy while preserving unrelated local series', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const localWeekJob = service.startRefresh(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )
    await waitForJob(service, localWeekJob.id)

    const importedEntry = createCacheFile(createStockQuery(createRequest().query, 'sh600519'))
    const result = await service.importEntries([importedEntry], 'merge')
    const dayRows = await service.getStatus(createRequest())
    const weekRows = await service.getStatus(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )

    expect(result).toMatchObject({
      importedCount: 1,
      removedCount: 0,
      skippedEntries: []
    })
    expect(dayRows[0]).toMatchObject({
      status: 'complete',
      recordCount: 2
    })
    expect(weekRows[0].status).toBe('complete')
  })

  it('imports entries with replace strategy and removes series not in the backup', async () => {
    const cacheRoot = await createTempRoot()
    const service = createTestService(cacheRoot)
    const localWeekJob = service.startRefresh(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )
    await waitForJob(service, localWeekJob.id)

    const importedEntry = createCacheFile(createStockQuery(createRequest().query, 'sh600519'))
    const result = await service.importEntries([importedEntry, { broken: true }, importedEntry], 'replace')
    const dayRows = await service.getStatus(createRequest())
    const weekRows = await service.getStatus(
      createRequest({
        query: {
          ...createRequest().query,
          periods: ['week']
        }
      })
    )

    expect(result.importedCount).toBe(1)
    expect(result.removedSeriesKeys).toEqual(['eastmoney__sh600519__week__qfq'])
    expect(result.skippedEntries.map((entry) => entry.reason)).toEqual([
      '第 2 条 K 线缓存格式无效',
      '第 3 条 K 线缓存与前序条目重复'
    ])
    expect(dayRows[0].status).toBe('complete')
    expect(weekRows[0].status).toBe('empty')
  })

  it('rejects imports while a refresh job is active', async () => {
    const cacheRoot = await createTempRoot()
    let resolveFetch: (() => void) | undefined
    const service = createTestService(cacheRoot, {
      fetchDataset: vi.fn(
        (query: StockQuery) =>
          new Promise<StockDataset>((resolve) => {
            resolveFetch = () => resolve(createDataset(query))
          })
      )
    })
    const job = service.startRefresh(createRequest())

    await expect(
      service.importEntries([createCacheFile(createStockQuery(createRequest().query, 'sh600519'))], 'merge')
    ).rejects.toThrow('K 线缓存刷新仍在进行')

    resolveFetch?.()
    await waitForJob(service, job.id)
  })
})

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'stock-monitor-kline-cache-'))
  tempDirs.push(dir)
  return dir
}

function createTestService(
  cacheRoot: string,
  options: {
    fetchDataset?: (query: StockQuery, context: { proxy: NetworkProxySettings }) => Promise<StockDataset>
    getProxy?: () => NetworkProxySettings
    sources?: StockDataSourceMeta[]
    now?: () => number
  } = {}
): KlineCacheService {
  return createKlineCacheService({
    cacheRoot,
    fetchDataset: options.fetchDataset ?? (async (query) => createDataset(query)),
    getSources: () => options.sources ?? [eastmoneySource, neteaseSource],
    getProxy: options.getProxy ?? (() => defaultProxy),
    now: options.now
  })
}

function createRequest(patch: Partial<KlineCacheStatusRequest> = {}): KlineCacheRefreshRequest {
  return {
    query: {
      sourceId: 'eastmoney',
      periods: ['day'],
      adjusts: ['qfq'],
      startDate: '20260801',
      endDate: '20260810',
      ...patch.query
    },
    items: patch.items ?? [item('sh600519', '贵州茅台')]
  }
}

function createStockQuery(
  query: KlineCacheRequestQuery,
  symbol: string,
  period: StockQuery['period'] = query.periods[0] ?? 'day',
  adjust: StockQuery['adjust'] = query.adjusts[0] ?? 'qfq'
): StockQuery {
  return {
    sourceId: query.sourceId,
    symbol,
    period,
    adjust,
    startDate: query.startDate,
    endDate: query.endDate
  }
}

function item(symbol: string, name: string): WatchlistItem {
  return {
    symbol,
    name,
    createdAt: 1
  }
}

function createDataset(query: StockQuery): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: query.symbol,
      name: stockNameBySymbol[query.symbol] ?? query.symbol
    },
    interval: intervalFromPeriod(query.period),
    columns: ['时间', '开盘价', '最高价', '最低价', '收盘价', '成交量', '成交额'],
    candles: [
      candle(query.startDate, 1),
      candle(query.endDate, 2),
      candle(query.startDate, 3)
    ],
    sourceId: query.sourceId,
    sourceName: sourceNameById[query.sourceId],
    sourceUrl: 'https://example.com/kline',
    adjust: query.adjust
  }
}

function createCacheFile(query: StockQuery): KlineCacheFile {
  const dataset = createDataset(query)
  return {
    version: 1,
    seriesKey: [query.sourceId, query.symbol, query.period, query.adjust].join('__'),
    query: {
      sourceId: query.sourceId,
      symbol: query.symbol,
      period: query.period,
      adjust: query.adjust
    },
    meta: dataset.meta,
    interval: dataset.interval,
    columns: dataset.columns,
    candles: dataset.candles.slice(0, 2),
    coveredRanges: [{ startDate: query.startDate, endDate: query.endDate }],
    lastRefreshedAt: 1,
    sourceId: query.sourceId,
    sourceName: dataset.sourceName,
    sourceUrl: dataset.sourceUrl,
    adjust: query.adjust
  }
}

function candle(timeKey: string, close: number) {
  return {
    timeKey,
    timestamp: Date.UTC(
      Number(timeKey.slice(0, 4)),
      Number(timeKey.slice(4, 6)) - 1,
      Number(timeKey.slice(6, 8))
    ),
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: close * 100,
    turnover: close * 1000
  }
}

function intervalFromPeriod(period: StockQuery['period']): IntervalType {
  if (period === '5' || period === '15' || period === '30' || period === '60') {
    return 'minute'
  }
  return period
}

async function waitForJob(service: KlineCacheService, jobId: string) {
  for (let index = 0; index < 30; index += 1) {
    const job = service.getJob(jobId)
    if (job?.status === 'completed' || job?.status === 'cancelled') {
      return job
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return service.getJob(jobId)
}

async function waitForJobState(
  service: KlineCacheService,
  jobId: string,
  status: 'queued' | 'running' | 'completed' | 'cancelled'
) {
  for (let index = 0; index < 30; index += 1) {
    const job = service.getJob(jobId)
    if (job?.status === status) {
      return job
    }
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  return service.getJob(jobId)
}

const eastmoneySource: StockDataSourceMeta = {
  id: 'eastmoney',
  name: '东方财富',
  capabilities: {
    periods: ['day', 'week', 'month', '5', '15', '30', '60'],
    adjusts: ['none', 'qfq', 'hfq'],
    markets: ['stock', 'etf', 'index'],
    timeshare: true
  }
}

const neteaseSource: StockDataSourceMeta = {
  id: 'netease163',
  name: '网易财经 163',
  capabilities: {
    periods: ['day'],
    adjusts: ['none'],
    markets: ['stock'],
    timeshare: false
  }
}

const tencentSource: StockDataSourceMeta = {
  id: 'tencent',
  name: '腾讯/QQ 财经',
  capabilities: {
    periods: ['day', 'week', 'month'],
    adjusts: ['none', 'qfq', 'hfq'],
    markets: ['stock', 'etf', 'index'],
    timeshare: true
  }
}

const stockNameBySymbol: Record<string, string> = {
  sh600519: '贵州茅台',
  sz000001: '平安银行'
}

const sourceNameById: Record<StockQuery['sourceId'], string> = {
  eastmoney: '东方财富',
  sina: '新浪财经',
  netease163: '网易财经 163',
  tencent: '腾讯/QQ 财经'
}

const defaultProxy: NetworkProxySettings = {
  enabled: false,
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 7890
}
