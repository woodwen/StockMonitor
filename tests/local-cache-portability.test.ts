import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../src/preload/stock-api'
import type {
  StockDataset,
  StockQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'
import { createDefaultTradeProfitSettings } from '../src/renderer/features/trade-profit-calculator/models/trade-profit'
import { createDefaultAiConnectorSettings } from '../src/renderer/features/stock-workspace/models/ai-models'

const aiCredentialMocks = vi.hoisted(() => ({
  clearAiApiKey: vi.fn(async () => 'missing')
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => tmpdir(),
    getVersion: () => '0.1.8'
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
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

vi.mock('electron-log/main', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    initialize: vi.fn(),
    transports: {
      console: { level: 'debug' },
      file: { level: 'info' }
    },
    warn: vi.fn()
  }
}))

vi.mock('../src/main/ai-credentials', () => ({
  clearAiApiKey: aiCredentialMocks.clearAiApiKey
}))

import { createKlineCacheService, type KlineCacheFile } from '../src/main/kline-cache'
import { createLocalCachePortabilityService } from '../src/main/local-cache-portability'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  aiCredentialMocks.clearAiApiKey.mockClear()
})

describe('LocalCachePortabilityService', () => {
  it('exports settings and valid kline cache entries while skipping corrupt cache files', async () => {
    const cacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'backup.stock-monitor-backup.json')
    await writeFile(
      join(cacheRoot, 'eastmoney__sh600519__day__qfq.json'),
      `${JSON.stringify(createCacheFile(stockQuery('sh600519')))}\n`,
      'utf8'
    )
    await writeFile(join(cacheRoot, 'eastmoney__sz000001__day__qfq.json'), '{broken', 'utf8')
    const service = createTestService(cacheRoot)

    const result = await service.exportBackupToPath(backupPath)
    const backup = JSON.parse(await readFile(backupPath, 'utf8')) as {
      schemaVersion: number
      appId: string
      settings: AppSettings
      klineCache: { entries: KlineCacheFile[] }
    }

    expect(result.status).toBe('success')
    expect(result.summary).toMatchObject({
      settingsSections: [
        'checkUpdatesOnStartup',
        'networkProxy',
        'workspace',
        'tradeProfit',
        'aiConnector'
      ],
      includesNetworkProxy: true,
      klineCacheEntryCount: 1,
      skippedCount: 1
    })
    expect(backup.schemaVersion).toBe(1)
    expect(backup.appId).toBe('com.stockmonitor.desktop')
    expect(backup.settings.networkProxy.host).toBe('127.0.0.1')
    expect(backup.klineCache.entries[0].seriesKey).toBe('eastmoney__sh600519__day__qfq')
  })

  it('exports a valid backup when no kline cache directory exists', async () => {
    const backupPath = join(await createTempRoot(), 'empty.stock-monitor-backup.json')
    const service = createTestService(await createTempRoot())

    const result = await service.exportBackupToPath(backupPath)

    expect(result.status).toBe('success')
    expect(result.summary).toMatchObject({
      klineCacheEntryCount: 0,
      skippedCount: 0
    })
  })

  it('rejects incompatible backup files before import', async () => {
    const backupPath = join(await createTempRoot(), 'bad.stock-monitor-backup.json')
    await writeFile(
      backupPath,
      JSON.stringify({
        schemaVersion: 1,
        appId: 'other-app',
        sections: ['settings', 'klineCache'],
        settings: {},
        klineCache: { version: 1, entries: [] }
      }),
      'utf8'
    )
    const service = createTestService(await createTempRoot())

    const result = await service.inspectBackupFile(backupPath)

    expect(result).toMatchObject({
      status: 'error',
      message: '备份文件不属于 Stock Monitor'
    })
  })

  it('rejects backup files missing required top-level fields before import', async () => {
    const backupPath = join(await createTempRoot(), 'missing-fields.stock-monitor-backup.json')
    await writeFile(
      backupPath,
      JSON.stringify({
        schemaVersion: 1,
        appId: 'com.stockmonitor.desktop',
        sections: ['settings', 'klineCache'],
        settings: {},
        klineCache: { version: 1, entries: [] }
      }),
      'utf8'
    )
    const service = createTestService(await createTempRoot())

    const result = await service.inspectBackupFile(backupPath)

    expect(result).toMatchObject({
      status: 'error',
      message: '备份文件缺少必需顶层字段'
    })
  })

  it('imports with merge strategy and preserves local cache series not in the backup', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'merge.stock-monitor-backup.json')
    await writeFile(
      join(targetCacheRoot, 'eastmoney__sz000001__day__qfq.json'),
      `${JSON.stringify(createCacheFile(stockQuery('sz000001')))}\n`,
      'utf8'
    )
    await writeBackup(backupPath, [createCacheFile(stockQuery('sh600519'))])
    let savedSettings: AppSettings | undefined
    const service = createTestService(targetCacheRoot, {
      setSettings: (settings) => {
        savedSettings = settings as AppSettings
        return savedSettings
      }
    })

    const inspected = await service.inspectBackupFile(backupPath)
    expect(inspected.status).toBe('ready')
    const imported = await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'merge'
    })

    expect(imported.status).toBe('success')
    expect(imported.summary).toMatchObject({
      strategy: 'merge',
      importedKlineCacheEntryCount: 1,
      removedKlineCacheEntryCount: 0
    })
    expect(savedSettings?.workspace.query.symbol).toBe('sh600519')
    await expect(readFile(join(targetCacheRoot, 'eastmoney__sh600519__day__qfq.json'), 'utf8')).resolves.toContain('贵州茅台')
    await expect(readFile(join(targetCacheRoot, 'eastmoney__sz000001__day__qfq.json'), 'utf8')).resolves.toContain('平安银行')
  })

  it('imports partial settings with merge strategy without resetting missing local settings sections', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'partial-settings.stock-monitor-backup.json')
    await writeBackup(
      backupPath,
      [],
      {
        workspace: {
          ...createDefaultSettings().workspace,
          query: stockQuery('sz000001')
        }
      }
    )
    const localSettings: AppSettings = {
      ...createDefaultSettings(),
      checkUpdatesOnStartup: false,
      networkProxy: {
        enabled: true,
        protocol: 'http',
        host: '10.0.0.8',
        port: 8080
      }
    }
    let savedSettings: AppSettings | undefined
    const service = createTestService(targetCacheRoot, {
      getSettings: () => localSettings,
      setSettings: (settings) => {
        savedSettings = settings as AppSettings
        return savedSettings
      }
    })

    const inspected = await service.inspectBackupFile(backupPath)
    const imported = await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'merge'
    })

    expect(imported.status).toBe('success')
    expect(savedSettings?.workspace.query.symbol).toBe('sz000001')
    expect(savedSettings?.networkProxy).toEqual(localSettings.networkProxy)
    expect(savedSettings?.checkUpdatesOnStartup).toBe(false)
  })

  it('clears imported HTTP provider credential state so the API key must be re-entered', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'ai-http-settings.stock-monitor-backup.json')
    await writeBackup(backupPath, [], {
      ...createDefaultSettings(),
      aiConnector: {
        ...createDefaultAiConnectorSettings(),
        enabled: true,
        kind: 'http-provider',
        displayName: 'DeepSeek',
        model: 'deepseek-chat',
        httpProvider: {
          presetId: 'deepseek',
          baseUrl: 'https://api.deepseek.com',
          customHeaders: []
        }
      }
    })
    const service = createTestService(targetCacheRoot)

    const inspected = await service.inspectBackupFile(backupPath)
    await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'replace'
    })

    expect(aiCredentialMocks.clearAiApiKey).toHaveBeenCalledWith('default-ai-connector:deepseek')
  })

  it('imports with replace strategy, removes missing local series, and reports skipped entries', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'replace.stock-monitor-backup.json')
    await writeFile(
      join(targetCacheRoot, 'eastmoney__sz000001__day__qfq.json'),
      `${JSON.stringify(createCacheFile(stockQuery('sz000001')))}\n`,
      'utf8'
    )
    const validEntry = createCacheFile(stockQuery('sh600519'))
    await writeBackup(backupPath, [validEntry, { broken: true }, validEntry])
    const service = createTestService(targetCacheRoot)

    const inspected = await service.inspectBackupFile(backupPath)
    const imported = await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'replace'
    })

    expect(imported.status).toBe('success')
    expect(imported.summary).toMatchObject({
      strategy: 'replace',
      importedKlineCacheEntryCount: 1,
      removedKlineCacheEntryCount: 1,
      skippedCount: 2
    })
    await expect(readFile(join(targetCacheRoot, 'eastmoney__sh600519__day__qfq.json'), 'utf8')).resolves.toContain('贵州茅台')
    await expect(readFile(join(targetCacheRoot, 'eastmoney__sz000001__day__qfq.json'), 'utf8')).rejects.toThrow()
  })

  it('skips invalid same-series kline entries without overwriting existing valid cache', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'invalid-same-series.stock-monitor-backup.json')
    const localEntry = createCacheFile(stockQuery('sh600519'))
    await writeFile(
      join(targetCacheRoot, 'eastmoney__sh600519__day__qfq.json'),
      `${JSON.stringify(localEntry)}\n`,
      'utf8'
    )
    const invalidEntry = {
      ...createCacheFile(stockQuery('sh600519')),
      candles: [
        {
          ...candle('20260801', 1),
          close: Number.NaN
        }
      ],
      coveredRanges: [{ startDate: '20260810', endDate: '20260801' }]
    }
    await writeBackup(backupPath, [invalidEntry])
    const service = createTestService(targetCacheRoot)

    const inspected = await service.inspectBackupFile(backupPath)
    const imported = await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'replace'
    })
    const preserved = await readFile(join(targetCacheRoot, 'eastmoney__sh600519__day__qfq.json'), 'utf8')

    expect(imported.status).toBe('success')
    expect(imported.summary).toMatchObject({
      importedKlineCacheEntryCount: 0,
      removedKlineCacheEntryCount: 0,
      skippedCount: 1
    })
    expect(preserved).toContain('贵州茅台')
  })

  it('reports an import error when settings persistence fails after cache import', async () => {
    const targetCacheRoot = await createTempRoot()
    const backupPath = join(await createTempRoot(), 'settings-failure.stock-monitor-backup.json')
    await writeBackup(backupPath, [createCacheFile(stockQuery('sh600519'))])
    const service = createTestService(targetCacheRoot, {
      setSettings: () => {
        throw new Error('settings unavailable')
      }
    })

    const inspected = await service.inspectBackupFile(backupPath)
    const imported = await service.importBackup({
      importToken: inspected.importToken ?? '',
      strategy: 'merge'
    })

    expect(imported).toMatchObject({
      status: 'error',
      message: 'settings unavailable',
      summary: {
        importedKlineCacheEntryCount: 1
      }
    })
  })
})

async function createTempRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'stock-monitor-local-cache-'))
  tempDirs.push(dir)
  return dir
}

function createTestService(
  cacheRoot: string,
  options: {
    getSettings?: () => AppSettings
    setSettings?: (settings: Partial<AppSettings> | undefined) => AppSettings
  } = {}
) {
  return createLocalCachePortabilityService({
    getSettings: options.getSettings ?? createDefaultSettings,
    setSettings: options.setSettings ?? ((settings) => settings as AppSettings),
    klineCacheService: createKlineCacheService({ cacheRoot }),
    getAppVersion: () => '0.1.8',
    now: () => new Date('2026-08-14T00:00:00.000Z')
  })
}

async function writeBackup(
  filePath: string,
  entries: unknown[],
  settings: Partial<AppSettings> = createDefaultSettings()
): Promise<void> {
  await writeFile(
    filePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        appId: 'com.stockmonitor.desktop',
        createdAt: '2026-08-14T00:00:00.000Z',
        appVersion: '0.1.8',
        sections: ['settings', 'klineCache'],
        settings,
        klineCache: {
          version: 1,
          entries
        }
      },
      null,
      2
    )}\n`,
    'utf8'
  )
}

function createDefaultSettings(): AppSettings {
  return {
    checkUpdatesOnStartup: true,
    networkProxy: {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    workspace: {
      viewMode: 'kline',
      timeshareSourceId: 'eastmoney',
      query: stockQuery('sh600519'),
      watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
    },
    tradeProfit: createDefaultTradeProfitSettings(),
    aiConnector: createDefaultAiConnectorSettings()
  }
}

function stockQuery(symbol: string): StockQuery {
  return {
    sourceId: 'eastmoney',
    symbol,
    period: 'day',
    adjust: 'qfq',
    startDate: '20260801',
    endDate: '20260810'
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
    candles: dataset.candles,
    coveredRanges: [{ startDate: query.startDate, endDate: query.endDate }],
    lastRefreshedAt: 1,
    sourceId: query.sourceId,
    sourceName: dataset.sourceName,
    sourceUrl: dataset.sourceUrl,
    adjust: query.adjust
  }
}

function createDataset(query: StockQuery): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: query.symbol,
      name: query.symbol === 'sz000001' ? '平安银行' : '贵州茅台'
    },
    interval: 'day',
    columns: ['时间', '开盘价', '最高价', '最低价', '收盘价', '成交量', '成交额'],
    candles: [
      candle(query.startDate, 1),
      candle(query.endDate, 2)
    ],
    sourceId: query.sourceId,
    sourceName: '东方财富',
    sourceUrl: 'https://example.com/kline',
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
