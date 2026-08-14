import type {
  KlineCacheDateRange,
  KlineCacheRequestQuery,
  KlineCacheSeriesRequestItem,
  SourceCapabilities,
  StockCandle,
  StockDataSourceMeta,
  StockAdjust,
  StockMarketScope,
  StockPeriod,
  StockQuery,
  StockSourceId,
  WatchlistItem
} from './stock-types'
import { normalizeWatchlistSymbol } from './watchlist'

export const KLINE_CACHE_PERIOD_OPTIONS: StockPeriod[] = ['day', 'week', 'month']
export const KLINE_CACHE_ADJUST_OPTIONS: StockAdjust[] = ['qfq', 'none', 'hfq']
export const DEFAULT_KLINE_CACHE_REQUEST_PERIODS: StockPeriod[] = ['day']
export const DEFAULT_KLINE_CACHE_REQUEST_ADJUSTS: StockAdjust[] = ['qfq']

export function createKlineCacheRequestQuery(query: StockQuery): KlineCacheRequestQuery {
  return {
    sourceId: query.sourceId,
    periods: [...DEFAULT_KLINE_CACHE_REQUEST_PERIODS],
    adjusts: [...DEFAULT_KLINE_CACHE_REQUEST_ADJUSTS],
    startDate: query.startDate,
    endDate: query.endDate
  }
}

export function createKlineCacheStockQuery(
  query: KlineCacheRequestQuery,
  symbol: string,
  period: StockPeriod,
  adjust: StockAdjust
): StockQuery | null {
  const sourceId = normalizeKlineCacheSourceId(query.sourceId)
  const normalizedSymbol = normalizeWatchlistSymbol(symbol)
  const range = normalizeKlineCacheRange(query)
  if (!sourceId || !normalizedSymbol || !range) {
    return null
  }
  return {
    sourceId,
    period,
    adjust,
    ...range,
    symbol: normalizedSymbol
  }
}

export function expandKlineCacheStockQueries(
  query: KlineCacheRequestQuery,
  items: WatchlistItem[]
): KlineCacheSeriesRequestItem[] {
  const normalizedQuery = normalizeKlineCacheRequestQuery(query)
  if (!normalizedQuery) {
    return []
  }
  const rows: KlineCacheSeriesRequestItem[] = []
  normalizeKlineCacheItems(items).forEach((item) => {
    normalizedQuery.periods.forEach((period) => {
      normalizedQuery.adjusts.forEach((adjust) => {
        const stockQuery = createKlineCacheStockQuery(normalizedQuery, item.symbol, period, adjust)
        if (!stockQuery) {
          return
        }
        rows.push({
          id: createKlineCacheRowId(stockQuery),
          symbol: stockQuery.symbol,
          name: item.name,
          query: stockQuery
        })
      })
    })
  })
  return rows
}

export function normalizeKlineCacheRequestQuery(
  query: KlineCacheRequestQuery
): KlineCacheRequestQuery | null {
  const sourceId = normalizeKlineCacheSourceId(query.sourceId)
  const range = normalizeKlineCacheRange(query)
  const periods = normalizeKlineCachePeriods(query.periods)
  const adjusts = normalizeKlineCacheAdjusts(query.adjusts)
  if (!sourceId || !range || periods.length === 0 || adjusts.length === 0) {
    return null
  }
  return {
    sourceId,
    periods,
    adjusts,
    ...range
  }
}

export function getKlineCacheRequestError(query: KlineCacheRequestQuery): string {
  if (!normalizeKlineCacheSourceId(query.sourceId)) {
    return `未知数据源：${String(query.sourceId)}`
  }
  if (!normalizeKlineCacheRange(query)) {
    return '缓存日期范围无效'
  }
  if (normalizeKlineCachePeriods(query.periods).length === 0) {
    return '请至少选择一个周期'
  }
  if (normalizeKlineCacheAdjusts(query.adjusts).length === 0) {
    return '请至少选择一种复权'
  }
  return ''
}

export function normalizeKlineCacheSourceId(value: unknown): StockSourceId | null {
  if (
    value === 'eastmoney' ||
    value === 'sina' ||
    value === 'netease163' ||
    value === 'tencent'
  ) {
    return value
  }
  return null
}

export function normalizeKlineCachePeriod(value: unknown): StockPeriod | null {
  return isStockPeriod(value) ? value : null
}

export function normalizeKlineCacheAdjust(value: unknown): StockAdjust | null {
  return isStockAdjust(value) ? value : null
}

export function normalizeKlineCachePeriods(values: unknown): StockPeriod[] {
  if (!Array.isArray(values)) {
    return []
  }
  return uniqueValues(values.filter(isStockPeriod))
}

export function normalizeKlineCacheAdjusts(values: unknown): StockAdjust[] {
  if (!Array.isArray(values)) {
    return []
  }
  return uniqueValues(values.filter(isStockAdjust))
}

export function createKlineCacheRowId(query: StockQuery): string {
  return [query.sourceId, query.symbol, query.period, query.adjust].join('__')
}

export function normalizeKlineCacheItems(items: WatchlistItem[]): WatchlistItem[] {
  const seen = new Set<string>()
  const normalized: WatchlistItem[] = []
  items.forEach((item) => {
    const symbol = normalizeWatchlistSymbol(item.symbol)
    if (!symbol || seen.has(symbol)) {
      return
    }
    seen.add(symbol)
    normalized.push({
      ...item,
      symbol,
      name: item.name.trim()
    })
  })
  return normalized
}

export function normalizeKlineCacheRange(
  range: Partial<KlineCacheDateRange> | undefined
): KlineCacheDateRange | null {
  const startDate = normalizeKlineCacheDateKey(range?.startDate)
  const endDate = normalizeKlineCacheDateKey(range?.endDate)
  if (!startDate || !endDate || startDate > endDate) {
    return null
  }
  return { startDate, endDate }
}

export function normalizeKlineCacheDateKey(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const dateKey = value.replace(/\D/g, '').slice(0, 8)
  if (!/^\d{8}$/.test(dateKey)) {
    return null
  }

  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6))
  const day = Number(dateKey.slice(6, 8))
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return dateKey
}

export function mergeKlineCacheRanges(ranges: KlineCacheDateRange[]): KlineCacheDateRange[] {
  const normalized = ranges
    .map((range) => normalizeKlineCacheRange(range))
    .filter((range): range is KlineCacheDateRange => range !== null)
    .sort((left, right) => left.startDate.localeCompare(right.startDate))

  const merged: KlineCacheDateRange[] = []
  normalized.forEach((range) => {
    const previous = merged.at(-1)
    if (!previous) {
      merged.push({ ...range })
      return
    }

    if (range.startDate <= addDays(previous.endDate, 1)) {
      previous.endDate = maxDateKey(previous.endDate, range.endDate)
      return
    }
    merged.push({ ...range })
  })
  return merged
}

export function subtractKlineCacheRanges(
  requestedRange: KlineCacheDateRange,
  coveredRanges: KlineCacheDateRange[]
): KlineCacheDateRange[] {
  const target = normalizeKlineCacheRange(requestedRange)
  if (!target) {
    return []
  }

  let cursor = target.startDate
  const missing: KlineCacheDateRange[] = []
  const normalizedCoveredRanges = mergeKlineCacheRanges(coveredRanges)

  normalizedCoveredRanges.forEach((range) => {
    if (range.endDate < cursor || range.startDate > target.endDate) {
      return
    }

    if (range.startDate > cursor) {
      missing.push({
        startDate: cursor,
        endDate: addDays(range.startDate, -1)
      })
    }
    if (range.endDate >= cursor) {
      cursor = addDays(range.endDate, 1)
    }
  })

  if (cursor <= target.endDate) {
    missing.push({
      startDate: cursor,
      endDate: target.endDate
    })
  }

  return missing.filter((range) => range.startDate <= range.endDate)
}

export function normalizeKlineCacheCandles(candles: StockCandle[]): StockCandle[] {
  const byTimeKey = new Map<string, StockCandle>()
  candles.forEach((candle) => {
    const timeKey = typeof candle.timeKey === 'string' ? candle.timeKey.replace(/\D/g, '') : ''
    if (!/^\d{8}(\d{4})?$/.test(timeKey) || !Number.isFinite(candle.timestamp)) {
      return
    }
    byTimeKey.set(timeKey, {
      timeKey,
      timestamp: candle.timestamp,
      open: finiteNumber(candle.open),
      high: finiteNumber(candle.high),
      low: finiteNumber(candle.low),
      close: finiteNumber(candle.close),
      volume: finiteNumber(candle.volume),
      turnover: finiteNumber(candle.turnover)
    })
  })

  return Array.from(byTimeKey.values()).sort((left, right) => {
    if (left.timestamp !== right.timestamp) {
      return left.timestamp - right.timestamp
    }
    return left.timeKey.localeCompare(right.timeKey)
  })
}

export function filterKlineCacheCandlesByRange(
  candles: StockCandle[],
  range: KlineCacheDateRange
): StockCandle[] {
  return normalizeKlineCacheCandles(candles).filter((candle) => {
    const dateKey = candle.timeKey.slice(0, 8)
    return dateKey >= range.startDate && dateKey <= range.endDate
  })
}

export function getKlineCacheCandleRange(candles: StockCandle[]): KlineCacheDateRange | null {
  const normalizedCandles = normalizeKlineCacheCandles(candles)
  const first = normalizedCandles[0]?.timeKey.slice(0, 8)
  const last = normalizedCandles.at(-1)?.timeKey.slice(0, 8)
  if (!first || !last) {
    return null
  }
  return {
    startDate: first,
    endDate: last
  }
}

export function validateKlineCacheSourceCapability(
  source: StockDataSourceMeta | undefined,
  query: StockQuery
): string {
  if (!source) {
    return `未知数据源：${query.sourceId}`
  }
  if (!source.capabilities.periods.includes(query.period)) {
    return `${source.name} 暂不支持 ${periodLabel(query.period)}`
  }
  if (!source.capabilities.adjusts.includes(query.adjust)) {
    return `${source.name} 暂不支持 ${adjustLabel(query.adjust)}`
  }
  const marketScope = inferKlineCacheMarketScope(query.symbol)
  if (!source.capabilities.markets.includes(marketScope)) {
    return `${source.name} 暂不支持${marketScopeLabel(marketScope)}`
  }
  return ''
}

export function inferKlineCacheMarketScope(symbol: string): StockMarketScope {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol) ?? symbol.trim().toLowerCase()
  const prefix = normalizedSymbol.slice(0, 2)
  const code = normalizedSymbol.slice(2)
  if (prefix === 'bj') {
    return 'stock'
  }
  if (
    (prefix === 'sh' && code.startsWith('000')) ||
    (prefix === 'sz' && code.startsWith('399'))
  ) {
    return 'index'
  }
  if ((prefix === 'sh' && /^(5|588)/.test(code)) || (prefix === 'sz' && /^(15|16|18)/.test(code))) {
    return 'etf'
  }
  return 'stock'
}

export function addDays(dateKey: string, amount: number): string {
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6))
  const day = Number(dateKey.slice(6, 8))
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('')
}

function finiteNumber(value: number): number {
  return Number.isFinite(value) ? value : 0
}

function maxDateKey(left: string, right: string): string {
  return left >= right ? left : right
}

function periodLabel(period: StockQuery['period']): string {
  const labels: Record<StockQuery['period'], string> = {
    day: '日线',
    week: '周线',
    month: '月线',
    '5': '5分钟',
    '15': '15分钟',
    '30': '30分钟',
    '60': '60分钟'
  }
  return labels[period] ?? period
}

function adjustLabel(adjust: StockQuery['adjust']): string {
  const labels: Record<StockQuery['adjust'], string> = {
    none: '不复权',
    qfq: '前复权',
    hfq: '后复权'
  }
  return labels[adjust] ?? adjust
}

function marketScopeLabel(scope: SourceCapabilities['markets'][number]): string {
  const labels: Record<SourceCapabilities['markets'][number], string> = {
    stock: '股票',
    etf: 'ETF',
    index: '指数'
  }
  return labels[scope] ?? scope
}

function uniqueValues<T extends string>(values: T[]): T[] {
  const seen = new Set<T>()
  const result: T[] = []
  values.forEach((value) => {
    if (seen.has(value)) {
      return
    }
    seen.add(value)
    result.push(value)
  })
  return result
}

function isStockPeriod(value: unknown): value is StockPeriod {
  return (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === '5' ||
    value === '15' ||
    value === '30' ||
    value === '60'
  )
}

function isStockAdjust(value: unknown): value is StockAdjust {
  return value === 'none' || value === 'qfq' || value === 'hfq'
}
