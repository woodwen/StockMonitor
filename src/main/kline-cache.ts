import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { app } from 'electron'
import type { NetworkProxySettings } from '../preload/stock-api'
import type {
  IntervalType,
  KlineCachedDatasetResult,
  KlineCacheClearRequest,
  KlineCacheDateRange,
  KlineCacheJob,
  KlineCacheJobRow,
  KlineCacheLastError,
  KlineCacheRefreshRequest,
  KlineCacheRequestQuery,
  KlineCacheSeriesRequestItem,
  KlineCacheStatusRequest,
  KlineCacheStatusRow,
  StockCandle,
  StockDataSourceMeta,
  StockDataset,
  StockMeta,
  StockQuery
} from '../renderer/features/stock-workspace/models/stock-types'
import {
  createKlineCacheRowId,
  expandKlineCacheStockQueries,
  filterKlineCacheCandlesByRange,
  getKlineCacheCandleRange,
  getKlineCacheRequestError,
  mergeKlineCacheRanges,
  normalizeKlineCacheAdjust,
  normalizeKlineCacheCandles,
  normalizeKlineCachePeriod,
  normalizeKlineCacheRange,
  normalizeKlineCacheRequestQuery,
  normalizeKlineCacheSourceId,
  subtractKlineCacheRanges,
  validateKlineCacheSourceCapability
} from '../renderer/features/stock-workspace/models/kline-cache'
import { normalizeWatchlistName, normalizeWatchlistSymbol } from '../renderer/features/stock-workspace/models/watchlist'
import { fetchRemoteStockDataset, getStockDataSourceMetas } from './remote-stock-sources'
import { getSettings } from './store'

interface KlineCacheFile {
  version: 1
  seriesKey: string
  query: {
    sourceId: StockQuery['sourceId']
    symbol: string
    period: StockQuery['period']
    adjust: StockQuery['adjust']
  }
  meta: StockMeta
  interval: IntervalType
  columns: string[]
  candles: StockCandle[]
  coveredRanges: KlineCacheDateRange[]
  lastRefreshedAt?: number
  lastError?: KlineCacheLastError
  sourceId?: StockQuery['sourceId']
  sourceName?: string
  sourceUrl?: string
  adjust?: StockQuery['adjust']
}

interface KlineCacheServiceOptions {
  cacheRoot: string
  fetchDataset?: KlineCacheDatasetFetcher
  getSources?: () => StockDataSourceMeta[]
  getProxy?: () => NetworkProxySettings
  now?: () => number
}

type KlineCacheDatasetFetcher = (
  query: StockQuery,
  context: { proxy: NetworkProxySettings }
) => Promise<StockDataset>

interface InternalKlineCacheJob extends KlineCacheJob {
  cancelled: boolean
}

type CacheReadResult =
  | { status: 'missing'; cacheBytes?: number }
  | { status: 'corrupt'; message: string; cacheBytes?: number }
  | { status: 'ready'; file: KlineCacheFile; cacheBytes?: number }

const KLINE_CACHE_JOB_RETENTION_MS = 10 * 60_000
const KLINE_CACHE_MAX_RETAINED_JOBS = 20

let defaultService: KlineCacheService | undefined

export class KlineCacheService {
  private readonly jobs = new Map<string, InternalKlineCacheJob>()
  private readonly jobCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private readonly seriesLocks = new Map<string, Promise<void>>()
  private readonly fetchDataset: KlineCacheDatasetFetcher
  private readonly getSources: () => StockDataSourceMeta[]
  private readonly getProxy: () => NetworkProxySettings
  private readonly now: () => number

  constructor(private readonly options: KlineCacheServiceOptions) {
    this.fetchDataset = options.fetchDataset ?? fetchRemoteStockDataset
    this.getSources = options.getSources ?? getStockDataSourceMetas
    this.getProxy = options.getProxy ?? (() => getSettings().networkProxy)
    this.now = options.now ?? Date.now
  }

  async getStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]> {
    this.assertValidRequestQuery(request.query)
    const items = expandKlineCacheStockQueries(request.query, request.items)
    const rows = await Promise.all(
      items.map(async (item) => this.getStatusRow(item.query, item.name))
    )
    return rows
  }

  startRefresh(request: KlineCacheRefreshRequest): KlineCacheJob {
    this.assertValidRequestQuery(request.query)
    const rows = this.getRequestRows(request).map((item) =>
      this.createJobRow(item.query, item.symbol, item.name, 'pending')
    )
    const job: InternalKlineCacheJob = {
      id: randomUUID(),
      status: rows.length > 0 ? 'queued' : 'completed',
      total: rows.length,
      completed: rows.length > 0 ? 0 : rows.length,
      rows,
      startedAt: this.now(),
      finishedAt: rows.length > 0 ? undefined : this.now(),
      cancelled: false
    }

    this.jobs.set(job.id, job)
    if (rows.length > 0) {
      void this.runRefreshJob(job)
    } else {
      this.scheduleJobCleanup(job)
    }
    return cloneJob(job)
  }

  getJob(jobId: string): KlineCacheJob | null {
    const job = this.jobs.get(jobId)
    return job ? cloneJob(job) : null
  }

  cancelJob(jobId: string): KlineCacheJob | null {
    const job = this.jobs.get(jobId)
    if (!job) {
      return null
    }
    if (job.status === 'queued' || job.status === 'running') {
      job.cancelled = true
      if (!job.currentSymbol) {
        this.cancelPendingRows(job)
        job.status = 'cancelled'
        job.finishedAt = this.now()
        this.scheduleJobCleanup(job)
      }
    }
    return cloneJob(job)
  }

  async getCachedDataset(query: StockQuery): Promise<KlineCachedDatasetResult> {
    const range = normalizeKlineCacheRange(query)
    if (!range) {
      throw new Error('缓存日期范围无效')
    }
    const normalizedSymbol = normalizeWatchlistSymbol(query.symbol)
    if (!normalizedSymbol) {
      throw new Error('证券代码无效')
    }
    const normalizedQuery = {
      ...query,
      ...range,
      symbol: normalizedSymbol
    }
    const row = await this.getStatusRow(normalizedQuery, '')
    if (row.status !== 'complete') {
      return {
        status: row.status,
        query: normalizedQuery,
        missingRanges: row.missingRanges,
        message: row.message,
        lastError: row.lastError
      }
    }

    const cached = await this.readCacheFile(normalizedQuery)
    if (cached.status !== 'ready') {
      return {
        status: cached.status === 'corrupt' ? 'error' : 'empty',
        query: normalizedQuery,
        missingRanges: [range],
        message: cached.status === 'corrupt' ? cached.message : '缓存不存在'
      }
    }

    return {
      status: 'complete',
      query: normalizedQuery,
      dataset: this.createDatasetFromCache(cached.file, normalizedQuery),
      missingRanges: []
    }
  }

  async clear(request: KlineCacheClearRequest): Promise<KlineCacheStatusRow[]> {
    this.assertValidRequestQuery(request.query)

    const rows = this.getRequestRows(request)
    await Promise.all(rows.map(async (item) => rm(this.getCacheFilePath(item.query), { force: true })))
    return Promise.all(rows.map(async (item) => this.getStatusRow(item.query, item.name)))
  }

  private async runRefreshJob(job: InternalKlineCacheJob): Promise<void> {
    job.status = 'running'

    for (const row of job.rows) {
      if (job.cancelled) {
        this.cancelPendingRows(job)
        break
      }
      if (row.status !== 'pending') {
        job.completed += 1
        continue
      }

      row.status = 'running'
      row.startedAt = this.now()
      job.currentRowId = row.id
      job.currentSymbol = row.symbol

      const capabilityError = this.validateQuery(row.query)
      if (capabilityError) {
        row.status = 'unsupported'
        row.message = capabilityError
        row.missingRanges = [{ startDate: row.query.startDate, endDate: row.query.endDate }]
        row.finishedAt = this.now()
        job.completed += 1
        job.currentRowId = undefined
        job.currentSymbol = undefined
        continue
      }

      try {
        const dataset = await this.fetchDataset(row.query, { proxy: this.getProxy() })
        await this.writeDataset(row.query, dataset)
        const statusRow = await this.getStatusRow(row.query, row.name)
        row.status = 'success'
        row.recordCount = statusRow.recordCount
        row.missingRanges = statusRow.missingRanges
      } catch (error) {
        const message = formatErrorMessage(error)
        await this.recordError(row.query, message)
        row.status = 'error'
        row.message = message
      } finally {
        row.finishedAt = this.now()
        job.completed += 1
        job.currentRowId = undefined
        job.currentSymbol = undefined
      }
    }

    this.finishJob(job, job.cancelled ? 'cancelled' : 'completed')
  }

  private cancelPendingRows(job: InternalKlineCacheJob): void {
    job.rows.forEach((row) => {
      if (row.status === 'pending') {
        row.status = 'cancelled'
        row.finishedAt = this.now()
        job.completed += 1
      }
    })
  }

  private async getStatusRow(query: StockQuery, name: string): Promise<KlineCacheStatusRow> {
    const range = normalizeKlineCacheRange(query)
    if (!range) {
      throw new Error('缓存日期范围无效')
    }

    const capabilityError = this.validateQuery(query)
    if (capabilityError) {
      return {
        symbol: query.symbol,
        id: createKlineCacheRowId(query),
        name,
        query,
        status: 'unsupported',
        recordCount: 0,
        coveredRanges: [],
        missingRanges: [range],
        message: capabilityError
      }
    }

    const cached = await this.readCacheFile(query)
    if (cached.status === 'missing') {
      return {
        symbol: query.symbol,
        id: createKlineCacheRowId(query),
        name,
        query,
        status: 'empty',
        recordCount: 0,
        coveredRanges: [],
        missingRanges: [range],
        cacheBytes: cached.cacheBytes
      }
    }
    if (cached.status === 'corrupt') {
      return {
        symbol: query.symbol,
        id: createKlineCacheRowId(query),
        name,
        query,
        status: 'error',
        recordCount: 0,
        coveredRanges: [],
        missingRanges: [range],
        message: cached.message,
        cacheBytes: cached.cacheBytes
      }
    }

    return this.createStatusRowFromFile(query, name, cached.file, cached.cacheBytes)
  }

  private createStatusRowFromFile(
    query: StockQuery,
    name: string,
    file: KlineCacheFile,
    cacheBytes?: number
  ): KlineCacheStatusRow {
    const range = normalizeKlineCacheRange(query)
    if (!range) {
      throw new Error('缓存日期范围无效')
    }

    const coveredRanges = mergeKlineCacheRanges(file.coveredRanges)
    const candles = filterKlineCacheCandlesByRange(file.candles, range)
    const missingRanges = subtractKlineCacheRanges(range, coveredRanges)
    const candleRange = getKlineCacheCandleRange(candles)
    const hasRequestedCoverage = coveredRanges.some((coveredRange) =>
      rangesOverlap(range, coveredRange)
    )
    if (missingRanges.length === 0 && candles.length === 0) {
      return {
        symbol: query.symbol,
        id: createKlineCacheRowId(query),
        name: name || file.meta.name,
        query,
        status: 'error',
        recordCount: 0,
        coveredRanges,
        missingRanges: [range],
        cachedStartDate: candleRange?.startDate,
        cachedEndDate: candleRange?.endDate,
        lastRefreshedAt: file.lastRefreshedAt,
        lastError: file.lastError,
        cacheBytes,
        message: '缓存覆盖范围内没有有效 K 线记录'
      }
    }
    const status =
      missingRanges.length === 0 && candles.length > 0
        ? 'complete'
        : hasRequestedCoverage
          ? 'partial'
          : 'empty'

    return {
      symbol: query.symbol,
      id: createKlineCacheRowId(query),
      name: name || file.meta.name,
      query,
      status,
      recordCount: candles.length,
      coveredRanges,
      missingRanges: status === 'empty' && missingRanges.length === 0 ? [range] : missingRanges,
      cachedStartDate: candleRange?.startDate,
      cachedEndDate: candleRange?.endDate,
      lastRefreshedAt: file.lastRefreshedAt,
      lastError: file.lastError,
      cacheBytes
    }
  }

  private async writeDataset(query: StockQuery, dataset: StockDataset): Promise<void> {
    await this.withSeriesLock(query, async () => {
      const cached = await this.readCacheFile(query)
      const existing = cached.status === 'ready' ? cached.file : undefined
      const candles = normalizeKlineCacheCandles([...(existing?.candles ?? []), ...dataset.candles])
      const coveredRanges = mergeKlineCacheRanges([
        ...(existing?.coveredRanges ?? []),
        {
          startDate: query.startDate,
          endDate: query.endDate
        }
      ])
      const file: KlineCacheFile = {
        version: 1,
        seriesKey: getSeriesKey(query),
        query: getSeriesQuery(query),
        meta: dataset.meta,
        interval: dataset.interval,
        columns: dataset.columns,
        candles,
        coveredRanges,
        lastRefreshedAt: this.now(),
        sourceId: dataset.sourceId,
        sourceName: dataset.sourceName,
        sourceUrl: dataset.sourceUrl,
        adjust: dataset.adjust
      }
      await this.writeCacheFile(query, file)
    })
  }

  private async recordError(query: StockQuery, message: string): Promise<void> {
    await this.withSeriesLock(query, async () => {
      const cached = await this.readCacheFile(query)
      const lastError = {
        message,
        occurredAt: this.now()
      }
      const file: KlineCacheFile =
        cached.status === 'ready'
          ? {
              ...cached.file,
              lastError
            }
          : {
              version: 1,
              seriesKey: getSeriesKey(query),
              query: getSeriesQuery(query),
              meta: {
                lineType: query.period,
                symbol: query.symbol,
                name: query.symbol
              },
              interval: intervalFromPeriod(query.period),
              columns: [],
              candles: [],
              coveredRanges: [],
              lastError,
              sourceId: query.sourceId,
              adjust: query.adjust
            }
      await this.writeCacheFile(query, file)
    })
  }

  private createDatasetFromCache(file: KlineCacheFile, query: StockQuery): StockDataset {
    const range = normalizeKlineCacheRange(query)
    if (!range) {
      throw new Error('缓存日期范围无效')
    }
    return {
      meta: file.meta,
      interval: file.interval,
      columns: file.columns,
      candles: filterKlineCacheCandlesByRange(file.candles, range),
      sourceId: file.sourceId,
      sourceName: file.sourceName,
      sourceUrl: file.sourceUrl,
      adjust: file.adjust,
      sourcePath: this.getCacheFilePath(query),
      encoding: 'utf-8'
    }
  }

  private async readCacheFile(query: StockQuery): Promise<CacheReadResult> {
    const cachePath = this.getCacheFilePath(query)
    const cacheBytes = await getFileSize(cachePath)
    try {
      const content = await readFile(cachePath, 'utf8')
      const parsed = JSON.parse(content) as Partial<KlineCacheFile>
      const file = normalizeCacheFile(parsed, query)
      if (!file) {
        return {
          status: 'corrupt',
          message: '缓存文件格式无效',
          cacheBytes
        }
      }
      return {
        status: 'ready',
        file,
        cacheBytes
      }
    } catch (error) {
      if (isNotFoundError(error)) {
        return {
          status: 'missing',
          cacheBytes
        }
      }
      return {
        status: 'corrupt',
        message: '缓存文件无法解析',
        cacheBytes
      }
    }
  }

  private async writeCacheFile(query: StockQuery, file: KlineCacheFile): Promise<void> {
    const cachePath = this.getCacheFilePath(query)
    const tempPath = `${cachePath}.${randomUUID()}.tmp`
    await mkdir(dirname(cachePath), { recursive: true })
    try {
      await writeFile(tempPath, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
      await rename(tempPath, cachePath)
    } catch (error) {
      await rm(tempPath, { force: true })
      throw error
    }
  }

  private validateQuery(query: StockQuery): string {
    return validateKlineCacheSourceCapability(
      this.getSources().find((source) => source.id === query.sourceId),
      query
    )
  }

  private assertValidRequestQuery(query: KlineCacheRequestQuery): void {
    const error = getKlineCacheRequestError(query)
    if (error) {
      throw new Error(error)
    }
  }

  private getRequestRows(
    request: KlineCacheStatusRequest | KlineCacheRefreshRequest | KlineCacheClearRequest
  ): KlineCacheSeriesRequestItem[] {
    if ('rows' in request && request.rows) {
      return normalizeRequestRows(request.rows, request.query)
    }
    return expandKlineCacheStockQueries(request.query, request.items)
  }

  private createJobRow(
    query: StockQuery,
    symbol: string,
    name: string,
    status: KlineCacheJobRow['status'],
    message?: string
  ): KlineCacheJobRow {
    return {
      id: createKlineCacheRowId(query),
      symbol,
      name,
      query,
      status,
      message
    }
  }

  private getCacheFilePath(query: StockQuery): string {
    const cacheRoot = resolve(this.options.cacheRoot)
    const cachePath = resolve(cacheRoot, `${getSeriesKey(query)}.json`)
    const relativePath = relative(cacheRoot, cachePath)
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new Error('缓存路径无效')
    }
    return cachePath
  }

  private async withSeriesLock<T>(query: StockQuery, action: () => Promise<T>): Promise<T> {
    const key = getSeriesKey(query)
    const previous = this.seriesLocks.get(key) ?? Promise.resolve()
    const next = previous.catch(() => undefined).then(action)
    const guarded = next.then(
      () => undefined,
      () => undefined
    )
    this.seriesLocks.set(key, guarded)
    try {
      return await next
    } finally {
      if (this.seriesLocks.get(key) === guarded) {
        this.seriesLocks.delete(key)
      }
    }
  }

  private finishJob(job: InternalKlineCacheJob, status: KlineCacheJob['status']): void {
    job.currentRowId = undefined
    job.currentSymbol = undefined
    job.status = status
    job.finishedAt = this.now()
    this.scheduleJobCleanup(job)
  }

  private scheduleJobCleanup(job: InternalKlineCacheJob): void {
    const existing = this.jobCleanupTimers.get(job.id)
    if (existing) {
      clearTimeout(existing)
    }
    const timer = setTimeout(() => {
      this.deleteJobIfTerminal(job.id)
    }, KLINE_CACHE_JOB_RETENTION_MS)
    timer.unref?.()
    this.jobCleanupTimers.set(job.id, timer)
    this.enforceJobRetentionLimit()
  }

  private enforceJobRetentionLimit(): void {
    const terminalJobs = Array.from(this.jobs.values())
      .filter((job) => !isActiveJob(job))
      .sort((left, right) => (left.finishedAt ?? 0) - (right.finishedAt ?? 0))
    const excess = terminalJobs.length - KLINE_CACHE_MAX_RETAINED_JOBS
    if (excess <= 0) {
      return
    }
    terminalJobs.slice(0, excess).forEach((job) => this.deleteJob(job.id))
  }

  private deleteJobIfTerminal(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job || isActiveJob(job)) {
      return
    }
    this.deleteJob(jobId)
  }

  private deleteJob(jobId: string): void {
    const timer = this.jobCleanupTimers.get(jobId)
    if (timer) {
      clearTimeout(timer)
      this.jobCleanupTimers.delete(jobId)
    }
    this.jobs.delete(jobId)
  }
}

export function createKlineCacheService(options: KlineCacheServiceOptions): KlineCacheService {
  return new KlineCacheService(options)
}

export async function getKlineCacheStatus(
  request: KlineCacheStatusRequest
): Promise<KlineCacheStatusRow[]> {
  return getDefaultService().getStatus(request)
}

export function startKlineCacheRefresh(request: KlineCacheRefreshRequest): KlineCacheJob {
  return getDefaultService().startRefresh(request)
}

export function getKlineCacheJob(jobId: string): KlineCacheJob | null {
  return getDefaultService().getJob(jobId)
}

export function cancelKlineCacheJob(jobId: string): KlineCacheJob | null {
  return getDefaultService().cancelJob(jobId)
}

export async function getCachedKlineDataset(
  query: StockQuery
): Promise<KlineCachedDatasetResult> {
  return getDefaultService().getCachedDataset(query)
}

export async function clearKlineCache(
  request: KlineCacheClearRequest
): Promise<KlineCacheStatusRow[]> {
  return getDefaultService().clear(request)
}

function getDefaultService(): KlineCacheService {
  if (!defaultService) {
    defaultService = new KlineCacheService({
      cacheRoot: join(app.getPath('userData'), 'kline-cache', 'v1')
    })
  }
  return defaultService
}

function normalizeCacheFile(
  file: Partial<KlineCacheFile>,
  query: StockQuery
): KlineCacheFile | null {
  if (file.version !== 1 || file.seriesKey !== getSeriesKey(query) || !file.meta) {
    return null
  }

  return {
    version: 1,
    seriesKey: getSeriesKey(query),
    query: getSeriesQuery(query),
    meta: file.meta,
    interval: file.interval ?? intervalFromPeriod(query.period),
    columns: Array.isArray(file.columns) ? file.columns.filter(isString) : [],
    candles: normalizeKlineCacheCandles(Array.isArray(file.candles) ? file.candles : []),
    coveredRanges: mergeKlineCacheRanges(
      Array.isArray(file.coveredRanges) ? file.coveredRanges : []
    ),
    lastRefreshedAt: isFiniteNumber(file.lastRefreshedAt) ? file.lastRefreshedAt : undefined,
    lastError: normalizeLastError(file.lastError),
    sourceId: file.sourceId,
    sourceName: isString(file.sourceName) ? file.sourceName : undefined,
    sourceUrl: isString(file.sourceUrl) ? file.sourceUrl : undefined,
    adjust: file.adjust
  }
}

function normalizeLastError(value: unknown): KlineCacheLastError | undefined {
  const error = value as Partial<KlineCacheLastError> | undefined
  if (!error || !isString(error.message) || !isFiniteNumber(error.occurredAt)) {
    return undefined
  }
  return {
    message: error.message,
    occurredAt: error.occurredAt
  }
}

function rangesOverlap(left: KlineCacheDateRange, right: KlineCacheDateRange): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate
}

function isActiveJob(job: KlineCacheJob): boolean {
  return job.status === 'queued' || job.status === 'running'
}

function getSeriesKey(query: StockQuery): string {
  return [query.sourceId, query.symbol, query.period, query.adjust].join('__')
}

function getSeriesQuery(query: StockQuery): KlineCacheFile['query'] {
  return {
    sourceId: query.sourceId,
    symbol: query.symbol,
    period: query.period,
    adjust: query.adjust
  }
}

function normalizeRequestRows(
  rows: KlineCacheSeriesRequestItem[],
  requestQuery: KlineCacheRequestQuery
): KlineCacheSeriesRequestItem[] {
  const normalizedRequestQuery = normalizeKlineCacheRequestQuery(requestQuery)
  if (!normalizedRequestQuery) {
    return []
  }
  const allowedPeriods = new Set(normalizedRequestQuery.periods)
  const allowedAdjusts = new Set(normalizedRequestQuery.adjusts)
  const seen = new Set<string>()
  const normalizedRows: KlineCacheSeriesRequestItem[] = []
  rows.forEach((row) => {
    const sourceId = normalizeKlineCacheSourceId(row.query.sourceId)
    const period = normalizeKlineCachePeriod(row.query.period)
    const adjust = normalizeKlineCacheAdjust(row.query.adjust)
    const symbol = normalizeWatchlistSymbol(row.query.symbol || row.symbol)
    const range = normalizeKlineCacheRange(row.query)
    if (
      !sourceId ||
      !period ||
      !adjust ||
      !symbol ||
      !range ||
      sourceId !== normalizedRequestQuery.sourceId ||
      !allowedPeriods.has(period) ||
      !allowedAdjusts.has(adjust) ||
      range.startDate !== normalizedRequestQuery.startDate ||
      range.endDate !== normalizedRequestQuery.endDate
    ) {
      return
    }
    const query: StockQuery = {
      sourceId,
      symbol,
      period,
      adjust,
      ...range
    }
    const id = createKlineCacheRowId(query)
    if (seen.has(id)) {
      return
    }
    seen.add(id)
    normalizedRows.push({
      id,
      symbol,
      name: normalizeWatchlistName(row.name),
      query
    })
  })
  return normalizedRows
}

async function getFileSize(filePath: string): Promise<number | undefined> {
  try {
    return (await stat(filePath)).size
  } catch (error) {
    return isNotFoundError(error) ? undefined : undefined
  }
}

function cloneJob(job: KlineCacheJob): KlineCacheJob {
  return {
    id: job.id,
    status: job.status,
    total: job.total,
    completed: job.completed,
    currentRowId: job.currentRowId,
    currentSymbol: job.currentSymbol,
    rows: job.rows.map((row) => ({
      ...row,
      query: { ...row.query },
      missingRanges: row.missingRanges?.map((range) => ({ ...range }))
    })),
    startedAt: job.startedAt,
    finishedAt: job.finishedAt
  }
}

function intervalFromPeriod(period: StockQuery['period']): IntervalType {
  if (period === '5' || period === '15' || period === '30' || period === '60') {
    return 'minute'
  }
  return period
}

function isNotFoundError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
