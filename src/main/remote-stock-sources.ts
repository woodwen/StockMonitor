import iconv from 'iconv-lite'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { NetworkProxySettings } from '../preload/stock-api'
import type {
  IntervalType,
  SourceCapabilities,
  StockAdjust,
  StockCandle,
  StockDataSourceMeta,
  StockDataset,
  StockPeriod,
  StockQuery,
  StockSourceId,
  StockTimeshareAdvancedContext,
  StockTimeshareDataset,
  StockTimesharePoint,
  StockTimeshareQuery,
  TimeshareAdvancedCapabilities,
  TimeshareAdvancedContextKey,
  TimeshareCapitalFlowAggregate,
  TimeshareHistoricalVolumeBaseline,
  TimeshareInOutVolumeAggregate,
  TimeshareOrderBookSnapshot
} from '../renderer/features/stock-workspace/models/stock-types'
import { getElectronProxyRules, getHttpProxyUrl } from './network-proxy'

interface StockDataSource {
  meta: StockDataSourceMeta
  fetchDataset(query: StockQuery, context: StockRequestContext): Promise<StockDataset>
  fetchTimeshare?(
    query: StockTimeshareQuery,
    context: StockRequestContext
  ): Promise<StockTimeshareDataset>
}

interface StockHttpResponse {
  ok: boolean
  status: number
  text(): Promise<string>
  arrayBuffer(): Promise<ArrayBuffer>
}

interface StockRequestInit {
  headers: Record<string, string>
}

interface StockRequestContext {
  proxy: NetworkProxySettings
}

interface SecurityCode {
  code: string
  prefix: 'sh' | 'sz' | 'bj'
  prefixed: string
  secid: string
}

const DEFAULT_COLUMNS = ['时间', '开盘价', '最高价', '最低价', '收盘价', '成交量', '成交额']
const EASTMONEY_TIMESHARE_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com'] as const
const EASTMONEY_HISTORY_SAMPLE_DAYS = 5
const ASHARE_TRADING_MINUTES = 240
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'

const unsupportedTimeshareAdvancedCapabilities: TimeshareAdvancedCapabilities = {
  minuteOhlc: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持分钟 OHLC'
  },
  historicalVolume: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持历史成交量基准'
  },
  floatShares: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持流通股本'
  },
  orderBook: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持盘口档位'
  },
  tradeDirection: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持逐笔方向或内外盘聚合'
  },
  capitalFlow: {
    status: 'unsupported',
    markets: [],
    reason: '暂不支持资金流聚合'
  }
}

const EASTMONEY_TIMESHARE_ADVANCED_CAPABILITIES: TimeshareAdvancedCapabilities = {
  minuteOhlc: {
    status: 'supported',
    markets: ['stock', 'etf', 'index']
  },
  historicalVolume: {
    status: 'supported',
    markets: ['stock']
  },
  floatShares: {
    status: 'supported',
    markets: ['stock']
  },
  orderBook: {
    status: 'supported',
    markets: ['stock']
  },
  tradeDirection: {
    status: 'supported',
    markets: ['stock']
  },
  capitalFlow: {
    status: 'supported',
    markets: ['stock']
  }
}

const TENCENT_TIMESHARE_ADVANCED_CAPABILITIES: TimeshareAdvancedCapabilities = {
  ...unsupportedTimeshareAdvancedCapabilities,
  minuteOhlc: {
    status: 'unknown',
    markets: ['stock', 'etf', 'index'],
    reason: '腾讯高级分时上下文尚未作为第一版支持源确认'
  }
}

const EASTMONEY_META: StockDataSourceMeta = {
  id: 'eastmoney',
  name: '东方财富',
  capabilities: {
    periods: ['day', 'week', 'month', '5', '15', '30', '60'],
    adjusts: ['none', 'qfq', 'hfq'],
    markets: ['stock', 'etf', 'index'],
    timeshare: true,
    timeshareAdvanced: EASTMONEY_TIMESHARE_ADVANCED_CAPABILITIES
  }
}

const SINA_META: StockDataSourceMeta = {
  id: 'sina',
  name: '新浪财经',
  capabilities: {
    periods: ['day', 'week', 'month', '5', '15', '30', '60'],
    adjusts: ['none'],
    markets: ['stock', 'etf', 'index'],
    timeshare: false,
    timeshareAdvanced: unsupportedTimeshareAdvancedCapabilities
  }
}

const NETEASE_META: StockDataSourceMeta = {
  id: 'netease163',
  name: '网易财经 163',
  capabilities: {
    periods: ['day'],
    adjusts: ['none'],
    markets: ['stock'],
    timeshare: false,
    timeshareAdvanced: unsupportedTimeshareAdvancedCapabilities
  }
}

const TENCENT_META: StockDataSourceMeta = {
  id: 'tencent',
  name: '腾讯/QQ 财经',
  capabilities: {
    periods: ['day', 'week', 'month'],
    adjusts: ['none', 'qfq', 'hfq'],
    markets: ['stock', 'etf', 'index'],
    timeshare: true,
    timeshareAdvanced: TENCENT_TIMESHARE_ADVANCED_CAPABILITIES
  }
}

const sources: Record<StockSourceId, StockDataSource> = {
  eastmoney: {
    meta: EASTMONEY_META,
    fetchDataset: fetchEastmoneyDataset,
    fetchTimeshare: fetchEastmoneyTimeshareDataset
  },
  sina: {
    meta: SINA_META,
    fetchDataset: fetchSinaDataset
  },
  netease163: {
    meta: NETEASE_META,
    fetchDataset: fetchNeteaseDataset
  },
  tencent: {
    meta: TENCENT_META,
    fetchDataset: fetchTencentDataset,
    fetchTimeshare: fetchTencentTimeshareDataset
  }
}

const eastmoneyHistoricalVolumeCache = new Map<string, Promise<TimeshareHistoricalVolumeBaseline>>()
const eastmoneyFloatSharesCache = new Map<string, number>()

export function getStockDataSourceMetas(): StockDataSourceMeta[] {
  return Object.values(sources).map((source) => source.meta)
}

export function clearRemoteStockSourceCachesForTest(): void {
  eastmoneyHistoricalVolumeCache.clear()
  eastmoneyFloatSharesCache.clear()
}

const DIRECT_PROXY: NetworkProxySettings = {
  enabled: false,
  protocol: 'socks5',
  host: '127.0.0.1',
  port: 7890
}

export async function fetchRemoteStockDataset(
  query: StockQuery,
  context: StockRequestContext = { proxy: DIRECT_PROXY }
): Promise<StockDataset> {
  const source = sources[query.sourceId]
  if (!source) {
    throw new Error(`未知数据源：${query.sourceId}`)
  }

  validateQuery(source.meta, query)
  return source.fetchDataset(query, context)
}

export async function fetchRemoteStockTimeshareDataset(
  query: StockTimeshareQuery,
  context: StockRequestContext = { proxy: DIRECT_PROXY }
): Promise<StockTimeshareDataset> {
  const source = sources[query.sourceId]
  if (!source) {
    throw new Error(`未知数据源：${query.sourceId}`)
  }

  validateTimeshareQuery(source.meta, query)
  if (!source.fetchTimeshare) {
    throw new Error(`${source.meta.name} 暂不支持分时`)
  }
  return source.fetchTimeshare(query, context)
}

async function fetchEastmoneyDataset(
  query: StockQuery,
  context: StockRequestContext
): Promise<StockDataset> {
  const source = EASTMONEY_META
  const security = normalizeSecurityCode(query.symbol)
  const periodMap: Record<StockPeriod, string> = {
    day: '101',
    week: '102',
    month: '103',
    '5': '5',
    '15': '15',
    '30': '30',
    '60': '60'
  }
  const adjustMap: Record<StockAdjust, string> = {
    none: '0',
    qfq: '1',
    hfq: '2'
  }
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116')
  url.searchParams.set('ut', '7eea3edcaed734bea9cbfc24409ed989')
  url.searchParams.set('klt', periodMap[query.period])
  url.searchParams.set('fqt', adjustMap[query.adjust])
  url.searchParams.set('secid', security.secid)
  url.searchParams.set('beg', query.startDate)
  url.searchParams.set('end', query.endDate)

  const json = await requestJson<EastmoneyResponse>(url, source.name, context, {
    Referer: 'https://quote.eastmoney.com/'
  })
  const data = json.data
  const klines = data?.klines ?? []
  const candles = klines.map((line) => parseCommaKline(line, query.period))

  return buildDataset({
    source,
    query,
    security,
    sourceUrl: url.toString(),
    name: data?.name,
    candles
  })
}

async function fetchEastmoneyTimeshareDataset(
  query: StockTimeshareQuery,
  context: StockRequestContext
): Promise<StockTimeshareDataset> {
  const source = EASTMONEY_META
  const security = normalizeSecurityCode(query.symbol)
  const errors: string[] = []

  for (const host of EASTMONEY_TIMESHARE_HOSTS) {
    const url = createEastmoneyTimeshareUrl(host, security)
    try {
      const json = await requestJson<EastmoneyTimeshareResponse>(url, source.name, context, {
        Referer: 'https://quote.eastmoney.com/'
      })
      const dataset = buildEastmoneyTimeshareDataset(source, security, url, json.data)
      return await attachEastmoneyTimeshareAdvancedContext(dataset, security, context)
    } catch (error) {
      errors.push(`${host}：${formatErrorMessage(error)}`)
    }
  }

  throw new Error(`${source.name} 分时请求失败：${errors.join('；')}`)
}

function createEastmoneyTimeshareUrl(host: string, security: SecurityCode): URL {
  const url = new URL(`https://${host}/api/qt/stock/trends2/get`)
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58')
  url.searchParams.set('ut', 'fa5fd1943c7b386f172d6893dbfba10b')
  url.searchParams.set('ndays', '1')
  url.searchParams.set('iscr', '0')
  url.searchParams.set('iscca', '0')
  url.searchParams.set('secid', security.secid)
  url.searchParams.set('_', String(Date.now()))
  return url
}

function buildEastmoneyTimeshareDataset(
  source: StockDataSourceMeta,
  security: SecurityCode,
  sourceUrl: URL,
  data: EastmoneyTimeshareResponse['data']
): StockTimeshareDataset {
  const points = (data?.trends ?? [])
    .map(parseEastmoneyTimesharePoint)
    .filter((point): point is StockTimesharePoint => point !== null)
    .sort((left, right) => left.timestamp - right.timestamp)

  if (points.length === 0) {
    throw new Error('没有返回有效分时数据')
  }

  const previousClose = getEastmoneyPreviousClose(data, points)

  return {
    meta: {
      lineType: '分时',
      symbol: security.prefixed,
      name: data?.name || security.prefixed
    },
    previousClose,
    points,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: sourceUrl.toString()
  }
}

async function attachEastmoneyTimeshareAdvancedContext(
  dataset: StockTimeshareDataset,
  security: SecurityCode,
  context: StockRequestContext
): Promise<StockTimeshareDataset> {
  const tradeDate = inferTimeshareTradeDate(dataset)
  const advanced: StockTimeshareAdvancedContext = {
    tradeDate,
    unavailableReasons: {}
  }
  const unavailableReasons = advanced.unavailableReasons as Partial<
    Record<TimeshareAdvancedContextKey, string>
  >

  if (!hasMinuteOhlc(dataset.points)) {
    unavailableReasons.minuteOhlc = '东方财富分时响应缺少分钟 OHLC'
  }

  if (inferMarketScope(security) !== 'stock') {
    const reason = '第一版高级上下文优先支持 A 股股票'
    unavailableReasons.historicalVolume = reason
    unavailableReasons.floatShares = reason
    unavailableReasons.orderBook = reason
    unavailableReasons.tradeDirection = reason
    unavailableReasons.capitalFlow = reason
    return {
      ...dataset,
      advanced
    }
  }

  const [historicalVolume, quote] = await Promise.allSettled([
    getEastmoneyHistoricalVolumeBaseline(security, tradeDate, context),
    fetchEastmoneyQuoteAdvancedContext(security, tradeDate, context)
  ])

  if (historicalVolume.status === 'fulfilled') {
    advanced.historicalVolumeBaseline = historicalVolume.value
  } else {
    unavailableReasons.historicalVolume = formatErrorMessage(historicalVolume.reason)
  }

  if (quote.status === 'fulfilled') {
    const cachedFloatShares = eastmoneyFloatSharesCache.get(createAdvancedCacheKey(security, tradeDate))
    const floatShares = cachedFloatShares ?? quote.value.floatShares
    if (floatShares && Number.isFinite(floatShares) && floatShares > 0) {
      advanced.floatShares = floatShares
      eastmoneyFloatSharesCache.set(createAdvancedCacheKey(security, tradeDate), floatShares)
    } else {
      unavailableReasons.floatShares = '东方财富未返回有效流通股本'
    }
    if (quote.value.orderBook) {
      advanced.orderBook = quote.value.orderBook
    } else {
      unavailableReasons.orderBook = '东方财富未返回有效买卖前 5 档'
    }
    if (quote.value.inOutVolume) {
      advanced.inOutVolume = quote.value.inOutVolume
    } else {
      unavailableReasons.tradeDirection = '东方财富未返回逐笔方向或内外盘聚合字段'
    }
    if (quote.value.capitalFlow) {
      advanced.capitalFlow = quote.value.capitalFlow
    } else {
      unavailableReasons.capitalFlow = '东方财富未返回总流入、总流出和净流入'
    }
  } else {
    const reason = formatErrorMessage(quote.reason)
    const cachedFloatShares = eastmoneyFloatSharesCache.get(createAdvancedCacheKey(security, tradeDate))
    if (cachedFloatShares) {
      advanced.floatShares = cachedFloatShares
    } else {
      unavailableReasons.floatShares = reason
    }
    unavailableReasons.orderBook = reason
    unavailableReasons.tradeDirection = reason
    unavailableReasons.capitalFlow = reason
  }

  return {
    ...dataset,
    advanced
  }
}

function inferTimeshareTradeDate(dataset: StockTimeshareDataset): string {
  const timeKey = dataset.points[0]?.timeKey
  return /^\d{12}$/.test(timeKey ?? '') ? (timeKey as string).slice(0, 8) : formatDateKey(new Date())
}

function hasMinuteOhlc(points: StockTimesharePoint[]): boolean {
  return (
    points.length > 0 &&
    points.every(
      (point) =>
        Number.isFinite(point.open) &&
        Number.isFinite(point.high) &&
        Number.isFinite(point.low) &&
        Number.isFinite(point.close ?? point.price)
    )
  )
}

function getEastmoneyHistoricalVolumeBaseline(
  security: SecurityCode,
  tradeDate: string,
  context: StockRequestContext
): Promise<TimeshareHistoricalVolumeBaseline> {
  const cacheKey = createAdvancedCacheKey(security, tradeDate)
  const cached = eastmoneyHistoricalVolumeCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const promise = fetchEastmoneyHistoricalVolumeBaseline(security, tradeDate, context).catch(
    (error) => {
      eastmoneyHistoricalVolumeCache.delete(cacheKey)
      throw error
    }
  )
  eastmoneyHistoricalVolumeCache.set(cacheKey, promise)
  return promise
}

async function fetchEastmoneyHistoricalVolumeBaseline(
  security: SecurityCode,
  tradeDate: string,
  context: StockRequestContext
): Promise<TimeshareHistoricalVolumeBaseline> {
  const url = createEastmoneyDailyHistoryUrl(security, offsetDateKey(tradeDate, -45), tradeDate)
  const json = await requestJson<EastmoneyResponse>(url, EASTMONEY_META.name, context, {
    Referer: 'https://quote.eastmoney.com/'
  })
  const candles = (json.data?.klines ?? [])
    .map((line) => parseCommaKline(line, 'day'))
    .filter((candle) => candle.timeKey < tradeDate && candle.volume > 0)
    .sort((left, right) => left.timestamp - right.timestamp)
    .slice(-EASTMONEY_HISTORY_SAMPLE_DAYS)

  if (candles.length < EASTMONEY_HISTORY_SAMPLE_DAYS) {
    throw new Error('东方财富历史成交量有效样本不足 5 个交易日')
  }

  const averageMinuteVolume =
    candles.reduce((sum, candle) => sum + candle.volume, 0) /
    candles.length /
    ASHARE_TRADING_MINUTES

  if (!Number.isFinite(averageMinuteVolume) || averageMinuteVolume <= 0) {
    throw new Error('东方财富历史成交量基准无效')
  }

  return {
    basis: 'fiveDayAverageMinuteVolume',
    averageMinuteVolume,
    tradeDays: candles.length,
    sampleStartDate: candles[0].timeKey,
    sampleEndDate: candles[candles.length - 1].timeKey,
    source: EASTMONEY_META.name
  }
}

function createEastmoneyDailyHistoryUrl(
  security: SecurityCode,
  beginDate: string,
  endDate: string
): URL {
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get')
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6')
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f116')
  url.searchParams.set('ut', '7eea3edcaed734bea9cbfc24409ed989')
  url.searchParams.set('klt', '101')
  url.searchParams.set('fqt', '0')
  url.searchParams.set('secid', security.secid)
  url.searchParams.set('beg', beginDate)
  url.searchParams.set('end', endDate)
  return url
}

async function fetchEastmoneyQuoteAdvancedContext(
  security: SecurityCode,
  tradeDate: string,
  context: StockRequestContext
): Promise<{
  floatShares?: number
  orderBook?: TimeshareOrderBookSnapshot
  inOutVolume?: TimeshareInOutVolumeAggregate
  capitalFlow?: TimeshareCapitalFlowAggregate
}> {
  const url = createEastmoneyQuoteUrl(security)
  const json = await requestJson<EastmoneyQuoteResponse>(url, EASTMONEY_META.name, context, {
    Referer: 'https://quote.eastmoney.com/'
  })
  const data = json.data
  if (!data) {
    throw new Error('东方财富未返回报价上下文')
  }

  const timestamp = Date.now()
  const cacheKey = createAdvancedCacheKey(security, tradeDate)
  const floatShares = parsePositiveNumber(data.f85)
  if (floatShares) {
    eastmoneyFloatSharesCache.set(cacheKey, floatShares)
  }

  return {
    floatShares: floatShares ?? eastmoneyFloatSharesCache.get(cacheKey),
    orderBook: parseEastmoneyOrderBook(data, timestamp),
    inOutVolume: parseEastmoneyInOutVolume(data, timestamp),
    capitalFlow: parseEastmoneyCapitalFlow(data, timestamp)
  }
}

function createEastmoneyQuoteUrl(security: SecurityCode): URL {
  const url = new URL('https://push2.eastmoney.com/api/qt/stock/get')
  url.searchParams.set('secid', security.secid)
  url.searchParams.set(
    'fields',
    [
      'f43',
      'f57',
      'f58',
      'f85',
      'f11',
      'f12',
      'f13',
      'f14',
      'f15',
      'f16',
      'f17',
      'f18',
      'f19',
      'f20',
      'f31',
      'f32',
      'f33',
      'f34',
      'f35',
      'f36',
      'f37',
      'f38',
      'f39',
      'f40',
      'f49',
      'f50',
      'f161',
      'f162',
      'f163',
      'f164'
    ].join(',')
  )
  return url
}

function parseEastmoneyOrderBook(
  data: EastmoneyQuoteData,
  timestamp: number
): TimeshareOrderBookSnapshot | undefined {
  const bidLevels = parseOrderBookLevels(data, [
    ['f19', 'f20'],
    ['f17', 'f18'],
    ['f15', 'f16'],
    ['f13', 'f14'],
    ['f11', 'f12']
  ])
  const askLevels = parseOrderBookLevels(data, [
    ['f39', 'f40'],
    ['f37', 'f38'],
    ['f35', 'f36'],
    ['f33', 'f34'],
    ['f31', 'f32']
  ])
  const bidVolume = sumVolumes(bidLevels)
  const askVolume = sumVolumes(askLevels)
  if (bidVolume + askVolume <= 0) {
    return undefined
  }
  return {
    bidLevels,
    askLevels,
    bidVolume,
    askVolume,
    timestamp,
    source: EASTMONEY_META.name
  }
}

function parseOrderBookLevels(
  data: EastmoneyQuoteData,
  pairs: Array<[string, string]>
): TimeshareOrderBookSnapshot['bidLevels'] {
  return pairs
    .map((pair): TimeshareOrderBookSnapshot['bidLevels'][number] | null => {
      const [priceKey, volumeKey] = pair
      const volume = parseNonNegativeNumber(data[volumeKey])
      if (volume === null || volume <= 0) {
        return null
      }
      const price = parsePositiveNumber(data[priceKey])
      return {
        ...(price ? { price } : {}),
        volume
      }
    })
    .filter((level): level is TimeshareOrderBookSnapshot['bidLevels'][number] => level !== null)
}

function parseEastmoneyInOutVolume(
  data: EastmoneyQuoteData,
  timestamp: number
): TimeshareInOutVolumeAggregate | undefined {
  const inwardVolume = parseNonNegativeNumber(data.inwardVolume)
  const outwardVolume = parseNonNegativeNumber(data.outwardVolume)
  if (inwardVolume === null || outwardVolume === null) {
    return undefined
  }
  return {
    inwardVolume,
    outwardVolume,
    source: 'sourceAggregate',
    timestamp
  }
}

function parseEastmoneyCapitalFlow(
  data: EastmoneyQuoteData,
  timestamp: number
): TimeshareCapitalFlowAggregate | undefined {
  const totalInflow = parseNonNegativeNumber(data.totalInflow)
  const totalOutflow = parseNonNegativeNumber(data.totalOutflow)
  const explicitNetInflow = parseNullableNumber(data.netInflow)
  if (totalInflow === null || totalOutflow === null) {
    return undefined
  }
  return {
    totalInflow,
    totalOutflow,
    netInflow: explicitNetInflow ?? totalInflow - totalOutflow,
    source: 'sourceAggregate',
    timestamp
  }
}

async function fetchTencentDataset(
  query: StockQuery,
  context: StockRequestContext
): Promise<StockDataset> {
  const source = TENCENT_META
  const security = normalizeSecurityCode(query.symbol)
  const periodMap: Partial<Record<StockPeriod, string>> = {
    day: 'day',
    week: 'week',
    month: 'month'
  }
  const period = periodMap[query.period]
  if (!period) {
    throw new Error(`${source.name} 暂不支持 ${periodLabel(query.period)}`)
  }

  const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get')
  const paramParts = [
    security.prefixed,
    period,
    toDashDate(query.startDate),
    toDashDate(query.endDate),
    String(limitForPeriod(query.period)),
    query.adjust === 'none' ? '' : query.adjust
  ]
  url.searchParams.set('param', paramParts.join(','))

  const json = await requestJson<TencentResponse>(url, source.name, context, {
    Referer: 'https://gu.qq.com/'
  })
  const data = json.data?.[security.prefixed]
  const klineKey = findTencentKlineKey(data, period, query.adjust)
  const rows = klineKey && data ? getTencentRows(data, klineKey) : []
  const candles = rows.map((row) => parseTencentKline(row, query.period))
  const name = data?.qt?.[security.prefixed]?.[1]

  return buildDataset({
    source,
    query,
    security,
    sourceUrl: url.toString(),
    name,
    candles
  })
}

async function fetchTencentTimeshareDataset(
  query: StockTimeshareQuery,
  context: StockRequestContext
): Promise<StockTimeshareDataset> {
  const source = TENCENT_META
  const security = normalizeSecurityCode(query.symbol)
  const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/minute/query')
  url.searchParams.set('code', security.prefixed)

  const json = await requestJson<TencentTimeshareResponse>(url, source.name, context, {
    Referer: 'https://gu.qq.com/'
  })
  const data = json.data?.[security.prefixed]
  const quote = data?.qt?.[security.prefixed]
  const tradeDate = normalizeTencentTimeshareDate(data?.data?.date, query.tradeDate)
  const points = parseTencentTimesharePoints(data?.data?.data ?? [], tradeDate).sort(
    (left, right) => left.timestamp - right.timestamp
  )

  if (points.length === 0) {
    throw new Error(`${source.name} 没有返回有效分时数据`)
  }

  const previousClose = parseNullableNumber(quote?.[4])
  if (!previousClose || previousClose <= 0) {
    throw new Error(`${source.name} 没有返回昨收价`)
  }

  return {
    meta: {
      lineType: '分时',
      symbol: security.prefixed,
      name: quote?.[1] || security.prefixed
    },
    previousClose,
    points,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: url.toString()
  }
}

async function fetchSinaDataset(
  query: StockQuery,
  context: StockRequestContext
): Promise<StockDataset> {
  const source = SINA_META
  const security = normalizeSecurityCode(query.symbol)
  const scaleMap: Record<StockPeriod, string> = {
    day: '240',
    week: '1200',
    month: '4800',
    '5': '5',
    '15': '15',
    '30': '30',
    '60': '60'
  }
  const url = new URL(
    'https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData'
  )
  url.searchParams.set('symbol', security.prefixed)
  url.searchParams.set('scale', scaleMap[query.period])
  url.searchParams.set('ma', 'no')
  url.searchParams.set('datalen', String(limitForPeriod(query.period)))

  const rows = await requestJson<SinaKlineRow[]>(url, source.name, context, {
    Referer: 'https://finance.sina.com.cn/'
  })
  const candles = rows.map((row) => parseSinaKline(row, query.period)).filter((candle) => {
    const dateKey = candle.timeKey.slice(0, 8)
    return dateKey >= query.startDate && dateKey <= query.endDate
  })

  return buildDataset({
    source,
    query,
    security,
    sourceUrl: url.toString(),
    name: security.prefixed,
    candles
  })
}

async function fetchNeteaseDataset(
  query: StockQuery,
  context: StockRequestContext
): Promise<StockDataset> {
  const source = NETEASE_META
  const security = normalizeSecurityCode(query.symbol)
  const url = new URL('http://quotes.money.163.com/service/chddata.html')
  url.searchParams.set('code', toNeteaseCode(security))
  url.searchParams.set('start', query.startDate)
  url.searchParams.set('end', query.endDate)
  url.searchParams.set('fields', 'TCLOSE;HIGH;LOW;TOPEN;LCLOSE;CHG;PCHG;TURNOVER;VOTURNOVER;VATURNOVER')

  const csvText = await requestGbkText(url, source.name, context)
  const rows = parseCsv(csvText)
  const headers = rows[0]?.map((header) => header.replace(/^\uFEFF/, '')) ?? []
  const dataRows = rows.slice(1)
  const indexes = {
    date: requiredColumn(headers, '日期'),
    name: requiredColumn(headers, '名称'),
    close: requiredColumn(headers, '收盘价'),
    high: requiredColumn(headers, '最高价'),
    low: requiredColumn(headers, '最低价'),
    open: requiredColumn(headers, '开盘价'),
    volume: requiredColumn(headers, '成交量'),
    turnover: requiredColumn(headers, '成交金额')
  }
  const candles = dataRows
    .filter((row) => row.length > indexes.turnover)
    .map((row) => ({
      timeKey: row[indexes.date].replaceAll('-', ''),
      timestamp: parseRemoteTimestamp(row[indexes.date], 'day'),
      open: parseFiniteNumber(row[indexes.open]),
      high: parseFiniteNumber(row[indexes.high]),
      low: parseFiniteNumber(row[indexes.low]),
      close: parseFiniteNumber(row[indexes.close]),
      volume: parseFiniteNumber(row[indexes.volume]),
      turnover: parseFiniteNumber(row[indexes.turnover])
    }))
  const name = dataRows[0]?.[indexes.name]

  return buildDataset({
    source,
    query,
    security,
    sourceUrl: url.toString(),
    name,
    candles
  })
}

function buildDataset(options: {
  source: StockDataSourceMeta
  query: StockQuery
  security: SecurityCode
  sourceUrl: string
  name?: string
  candles: StockCandle[]
}): StockDataset {
  const candles = options.candles
    .filter((candle) => Number.isFinite(candle.timestamp))
    .sort((left, right) => left.timestamp - right.timestamp)

  if (candles.length === 0) {
    throw new Error(`${options.source.name} 没有返回有效行情数据`)
  }

  return {
    meta: {
      lineType: periodLabel(options.query.period),
      symbol: options.security.prefixed,
      name: options.name || options.security.prefixed
    },
    interval: intervalFromPeriod(options.query.period),
    columns: DEFAULT_COLUMNS,
    candles,
    sourceId: options.source.id,
    sourceName: options.source.name,
    sourceUrl: options.sourceUrl,
    adjust: options.query.adjust
  }
}

function validateQuery(source: StockDataSourceMeta, query: StockQuery): void {
  if (!source.capabilities.periods.includes(query.period)) {
    throw new Error(`${source.name} 暂不支持 ${periodLabel(query.period)}`)
  }
  if (!source.capabilities.adjusts.includes(query.adjust)) {
    throw new Error(`${source.name} 暂不支持 ${adjustLabel(query.adjust)}`)
  }
  if (!/^\d{8}$/.test(query.startDate) || !/^\d{8}$/.test(query.endDate)) {
    throw new Error('日期格式应为 YYYYMMDD')
  }
  if (query.startDate > query.endDate) {
    throw new Error('开始日期不能晚于结束日期')
  }
  const security = normalizeSecurityCode(query.symbol)
  const marketScope = inferMarketScope(security)
  if (!source.capabilities.markets.includes(marketScope)) {
    throw new Error(`${source.name} 暂不支持${marketScopeLabel(marketScope)}`)
  }
}

function validateTimeshareQuery(source: StockDataSourceMeta, query: StockTimeshareQuery): void {
  if (!source.capabilities.timeshare) {
    throw new Error(`${source.name} 暂不支持分时`)
  }
  if (query.tradeDate && !/^\d{8}$/.test(query.tradeDate)) {
    throw new Error('交易日期格式应为 YYYYMMDD')
  }
  if (query.tradeDate && query.tradeDate !== formatDateKey(new Date())) {
    throw new Error('第一版仅支持当日分时')
  }
  const security = normalizeSecurityCode(query.symbol)
  const marketScope = inferMarketScope(security)
  if (!source.capabilities.markets.includes(marketScope)) {
    throw new Error(`${source.name} 暂不支持${marketScopeLabel(marketScope)}`)
  }
}

function normalizeSecurityCode(symbol: string): SecurityCode {
  const trimmed = symbol.trim().toLowerCase()
  const prefixedMatch = /^(sh|sz|bj)(\d{6})$/.exec(trimmed)
  const matchedPrefix = prefixedMatch?.[1] as SecurityCode['prefix'] | undefined
  const prefix = matchedPrefix ?? inferMarketPrefix(trimmed)
  const code = prefixedMatch?.[2] ?? trimmed

  if (!/^\d{6}$/.test(code)) {
    throw new Error('证券代码应为 6 位数字，或带 sh/sz/bj 前缀')
  }

  const eastmoneyMarket = prefix === 'sh' ? '1' : '0'
  return {
    code,
    prefix,
    prefixed: `${prefix}${code}`,
    secid: `${eastmoneyMarket}.${code}`
  }
}

function inferMarketPrefix(code: string): SecurityCode['prefix'] {
  if (/^[65]/.test(code)) {
    return 'sh'
  }
  if (/^(4|8|9)/.test(code)) {
    return 'bj'
  }
  return 'sz'
}

function inferMarketScope(security: SecurityCode): SourceCapabilities['markets'][number] {
  if (security.prefix === 'bj') {
    return 'stock'
  }
  if (
    (security.prefix === 'sh' && security.code.startsWith('000')) ||
    (security.prefix === 'sz' && security.code.startsWith('399'))
  ) {
    return 'index'
  }
  if (
    (security.prefix === 'sh' && /^(5|588)/.test(security.code)) ||
    (security.prefix === 'sz' && /^(15|16|18)/.test(security.code))
  ) {
    return 'etf'
  }
  return 'stock'
}

function parseCommaKline(line: string, period: StockPeriod): StockCandle {
  const cells = line.split(',')
  const timeKey = normalizeTimeKey(cells[0], period)
  return {
    timeKey,
    timestamp: parseRemoteTimestamp(cells[0], intervalFromPeriod(period)),
    open: parseFiniteNumber(cells[1]),
    close: parseFiniteNumber(cells[2]),
    high: parseFiniteNumber(cells[3]),
    low: parseFiniteNumber(cells[4]),
    volume: parseFiniteNumber(cells[5]),
    turnover: parseFiniteNumber(cells[6])
  }
}

function parseTencentKline(row: string[], period: StockPeriod): StockCandle {
  const timeKey = normalizeTimeKey(row[0], period)
  return {
    timeKey,
    timestamp: parseRemoteTimestamp(row[0], intervalFromPeriod(period)),
    open: parseFiniteNumber(row[1]),
    close: parseFiniteNumber(row[2]),
    high: parseFiniteNumber(row[3]),
    low: parseFiniteNumber(row[4]),
    volume: parseFiniteNumber(row[5]),
    turnover: 0
  }
}

function parseSinaKline(row: SinaKlineRow, period: StockPeriod): StockCandle {
  const timeKey = normalizeTimeKey(row.day, period)
  return {
    timeKey,
    timestamp: parseRemoteTimestamp(row.day, intervalFromPeriod(period)),
    open: parseFiniteNumber(row.open),
    high: parseFiniteNumber(row.high),
    low: parseFiniteNumber(row.low),
    close: parseFiniteNumber(row.close),
    volume: parseFiniteNumber(row.volume),
    turnover: parseFiniteNumber(row.amount)
  }
}

function parseEastmoneyTimesharePoint(line: string): StockTimesharePoint | null {
  const cells = line.split(',')
  const timestamp = parseRemoteTimestamp(cells[0], 'minute')
  const price = parseNullableNumber(cells[2]) ?? parseNullableNumber(cells[1])
  if (!Number.isFinite(timestamp) || !price || price <= 0) {
    return null
  }
  const avgPrice = parseNullableNumber(cells[7]) ?? price

  return {
    timeKey: normalizeTimeshareTimeKey(cells[0]),
    timestamp,
    price,
    avgPrice,
    volume: parseFiniteNumber(cells[5]),
    turnover: parseFiniteNumber(cells[6]),
    open: parsePositiveNumber(cells[1]),
    high: parsePositiveNumber(cells[3]),
    low: parsePositiveNumber(cells[4]),
    close: price
  }
}

function getEastmoneyPreviousClose(
  data: EastmoneyTimeshareResponse['data'],
  points: StockTimesharePoint[]
): number {
  return (
    parseNullableNumber(data?.preClose) ??
    parseNullableNumber(data?.prePrice) ??
    parseNullableNumber(data?.yc) ??
    points[0]?.price ??
    0
  )
}

function parseTencentTimesharePoints(rows: string[], tradeDate: string): StockTimesharePoint[] {
  const points: StockTimesharePoint[] = []
  const rawPoints = rows
    .map((row) => parseTencentTimeshareRawPoint(row, tradeDate))
    .filter((point): point is NonNullable<typeof point> =>
      Boolean(point && isAshareTradingMinute(point.hhmm))
    )
    .sort((left, right) => left.timestamp - right.timestamp)
  let previousVolume: number | null = null
  let previousTurnover: number | null = null

  rawPoints.forEach((point) => {
    const volume = cumulativeDelta(point.cumulativeVolume, previousVolume)
    const turnover = cumulativeDelta(point.cumulativeTurnover, previousTurnover)
    previousVolume = point.cumulativeVolume
    previousTurnover = point.cumulativeTurnover

    points.push({
      timeKey: point.timeKey,
      timestamp: point.timestamp,
      price: point.price,
      avgPrice: calculateTencentAveragePrice(point) ?? point.price,
      volume,
      turnover
    })
  })

  return points
}

function parseTencentTimeshareRawPoint(
  row: string,
  tradeDate: string
): {
  hhmm: string
  timeKey: string
  timestamp: number
  price: number
  cumulativeVolume: number
  cumulativeTurnover: number
} | null {
  const cells = row.trim().split(/\s+/)
  const hhmm = cells[0]
  const price = parseNullableNumber(cells[1])
  const cumulativeVolume = parseFiniteNumber(cells[2])
  const cumulativeTurnover = parseFiniteNumber(cells[3])
  if (!/^\d{4}$/.test(hhmm) || !price || price <= 0) {
    return null
  }

  const timestamp = parseRemoteTimestamp(
    `${tradeDate} ${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}`,
    'minute'
  )
  if (!Number.isFinite(timestamp)) {
    return null
  }

  return {
    hhmm,
    timeKey: `${tradeDate}${hhmm}`,
    timestamp,
    price,
    cumulativeVolume,
    cumulativeTurnover
  }
}

function calculateTencentAveragePrice(point: {
  price: number
  cumulativeVolume: number
  cumulativeTurnover: number
}): number | null {
  if (point.cumulativeVolume <= 0 || point.cumulativeTurnover <= 0) {
    return null
  }

  const averagePrice = point.cumulativeTurnover / point.cumulativeVolume / 100
  if (!Number.isFinite(averagePrice)) {
    return null
  }

  const lowerBound = point.price * 0.5
  const upperBound = point.price * 1.5
  return averagePrice >= lowerBound && averagePrice <= upperBound ? averagePrice : null
}

function cumulativeDelta(current: number, previous: number | null): number {
  if (!Number.isFinite(current) || current <= 0) {
    return 0
  }
  if (previous === null) {
    return current
  }
  const delta = current - previous
  return delta >= 0 ? delta : current
}

function normalizeTencentTimeshareDate(value: unknown, fallback?: string): string {
  const dateKey = String(value ?? fallback ?? '')
    .replace(/\D/g, '')
    .slice(0, 8)
  return dateKey.length === 8 ? dateKey : formatDateKey(new Date())
}

function isAshareTradingMinute(hhmm: string): boolean {
  const minute = Number(hhmm)
  return (minute >= 930 && minute <= 1130) || (minute >= 1300 && minute <= 1500)
}

async function requestJson<T>(
  url: URL,
  sourceName: string,
  context: StockRequestContext,
  headers: Record<string, string> = {}
): Promise<T> {
  const text = await requestText(url, sourceName, context, headers)
  try {
    return JSON.parse(stripJsonp(text)) as T
  } catch {
    throw new Error(`${sourceName} 返回的数据不是有效 JSON`)
  }
}

async function requestText(
  url: URL,
  sourceName: string,
  context: StockRequestContext,
  headers: Record<string, string> = {}
): Promise<string> {
  const response = await fetchRemote(
    url,
    {
      headers: {
        'User-Agent': USER_AGENT,
        ...headers
      }
    },
    context
  )
  if (!response.ok) {
    throw new Error(`${sourceName} 请求失败：HTTP ${response.status}`)
  }
  return response.text()
}

async function requestGbkText(
  url: URL,
  sourceName: string,
  context: StockRequestContext
): Promise<string> {
  const response = await fetchRemote(
    url,
    {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'http://quotes.money.163.com/'
      }
    },
    context
  )
  if (!response.ok) {
    throw new Error(`${sourceName} 请求失败：HTTP ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const text = iconv.decode(buffer, 'gbk')
  if (text.trimStart().startsWith('<')) {
    throw new Error(`${sourceName} 返回了无效页面`)
  }
  return text
}

async function fetchRemote(
  url: URL,
  init: StockRequestInit,
  context: StockRequestContext
): Promise<StockHttpResponse> {
  const errors: string[] = []
  const proxyUrl = getHttpProxyUrl(context.proxy)

  if (proxyUrl) {
    try {
      return (await undiciFetch(url.toString(), {
        ...init,
        dispatcher: new ProxyAgent(proxyUrl)
      })) as unknown as StockHttpResponse
    } catch (error) {
      errors.push(`代理请求失败${formatErrorCause(error)}`)
    }
  }

  if (context.proxy.enabled) {
    try {
      const electronFetch = await getElectronFetch(context.proxy)
      if (!electronFetch) {
        throw new Error('Electron session fetch 不可用')
      }
      return await electronFetch(url.toString(), init)
    } catch (error) {
      errors.push(`Electron 代理请求失败${formatErrorCause(error)}`)
      throw new Error(`网络请求失败：${errors.join('；')}`)
    }
  }

  try {
    return (await fetch(url.toString(), init)) as StockHttpResponse
  } catch (error) {
    errors.push(`Node 直连请求失败${formatErrorCause(error)}`)
  }

  try {
    const electronFetch = await getElectronFetch(context.proxy)
    if (!electronFetch) {
      throw new Error('Electron session fetch 不可用')
    }
    return await electronFetch(url.toString(), init)
  } catch (error) {
    errors.push(`Electron 请求失败${formatErrorCause(error)}`)
    throw new Error(`网络请求失败：${errors.join('；')}`)
  }
}

async function getElectronFetch(proxy: NetworkProxySettings): Promise<
  ((input: string, init: StockRequestInit) => Promise<StockHttpResponse>) | null
> {
  try {
    const electron = (await import('electron')) as unknown as {
      session?: {
        defaultSession?: {
          fetch?: (input: string, init: StockRequestInit) => Promise<StockHttpResponse>
          setProxy?: (config: { proxyRules: string }) => Promise<void>
        }
      }
    }
    const defaultSession = electron.session?.defaultSession
    const proxyRules = getElectronProxyRules(proxy)
    if (defaultSession?.setProxy) {
      await defaultSession.setProxy({ proxyRules })
    }
    return defaultSession?.fetch?.bind(defaultSession) ?? null
  } catch {
    return null
  }
}

function formatErrorCause(error: unknown): string {
  if (!(error instanceof Error)) {
    return `：${String(error)}`
  }

  const cause = error.cause instanceof Error ? error.cause : null
  return cause ? `：${cause.message}` : `：${error.message}`
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function stripJsonp(text: string): string {
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return trimmed
  }
  const start = Math.min(
    ...['{', '[']
      .map((token) => trimmed.indexOf(token))
      .filter((index) => index >= 0)
  )
  const end = Math.max(trimmed.lastIndexOf('}'), trimmed.lastIndexOf(']'))
  if (!Number.isFinite(start) || end < start) {
    return trimmed
  }
  return trimmed.slice(start, end + 1)
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(parseCsvLine)
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      cells.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  cells.push(current.trim())
  return cells
}

function requiredColumn(headers: string[], name: string): number {
  const index = headers.indexOf(name)
  if (index < 0) {
    throw new Error(`网易财经 163 返回数据缺少列：${name}`)
  }
  return index
}

function toNeteaseCode(security: SecurityCode): string {
  if (security.prefix === 'sh') {
    return `0${security.code}`
  }
  if (security.prefix === 'sz') {
    return `1${security.code}`
  }
  throw new Error('网易财经 163 暂不支持北交所代码')
}

function findTencentKlineKey(
  data: TencentSecurityData | undefined,
  period: string,
  adjust: StockAdjust
): string | null {
  if (!data) {
    return null
  }

  const candidates =
    adjust === 'qfq'
      ? [`qfq${period}`, period]
      : adjust === 'hfq'
        ? [`hfq${period}`, period]
        : [period]

  return candidates.find((key) => Array.isArray(data[key])) ?? null
}

function getTencentRows(data: TencentSecurityData, key: string): string[][] {
  const value = data[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((row): row is string[] => Array.isArray(row))
}

function parseRemoteTimestamp(value: string, interval: IntervalType): number {
  const normalized = value.trim()
  const match = /^(\d{4})-?(\d{2})-?(\d{2})(?:\s?(\d{2}):?(\d{2}))?/.exec(normalized)
  if (!match) {
    return Number.NaN
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = interval === 'minute' ? Number(match[4] ?? 0) : 0
  const minute = interval === 'minute' ? Number(match[5] ?? 0) : 0
  return new Date(year, month - 1, day, hour, minute).getTime()
}

function normalizeTimeKey(value: string, period: StockPeriod): string {
  const interval = intervalFromPeriod(period)
  const digits = value.replace(/\D/g, '')
  return interval === 'minute' ? digits.slice(0, 12) : digits.slice(0, 8)
}

function parseFiniteNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseNullableNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function parsePositiveNumber(value: unknown): number | undefined {
  const parsed = parseNullableNumber(value)
  return parsed !== null && parsed > 0 ? parsed : undefined
}

function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = parseNullableNumber(value)
  return parsed !== null && parsed >= 0 ? parsed : null
}

function sumVolumes(levels: TimeshareOrderBookSnapshot['bidLevels']): number {
  return levels.reduce((sum, level) => sum + level.volume, 0)
}

function createAdvancedCacheKey(security: SecurityCode, tradeDate: string): string {
  return `${EASTMONEY_META.id}:${security.prefixed}:${tradeDate}`
}

function offsetDateKey(dateKey: string, days: number): string {
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6))
  const day = Number(dateKey.slice(6, 8))
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDateKey(date)
}

function intervalFromPeriod(period: StockPeriod): IntervalType {
  if (period === 'day' || period === 'week' || period === 'month') {
    return period
  }
  return 'minute'
}

function periodLabel(period: StockPeriod): string {
  const labels: Record<StockPeriod, string> = {
    day: '日线',
    week: '周线',
    month: '月线',
    '5': '5分钟',
    '15': '15分钟',
    '30': '30分钟',
    '60': '60分钟'
  }
  return labels[period]
}

function adjustLabel(adjust: StockAdjust): string {
  const labels: Record<StockAdjust, string> = {
    none: '不复权',
    qfq: '前复权',
    hfq: '后复权'
  }
  return labels[adjust]
}

function marketScopeLabel(marketScope: SourceCapabilities['markets'][number]): string {
  const labels: Record<SourceCapabilities['markets'][number], string> = {
    stock: '股票',
    etf: 'ETF',
    index: '指数'
  }
  return labels[marketScope]
}

function limitForPeriod(period: StockPeriod): number {
  if (period === 'day') {
    return 520
  }
  if (period === 'week' || period === 'month') {
    return 260
  }
  return 1023
}

function toDashDate(date: string): string {
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeTimeshareTimeKey(value: string): string {
  return value.replace(/\D/g, '').slice(0, 12)
}

interface EastmoneyResponse {
  data?: {
    name?: string
    klines?: string[]
  }
}

interface EastmoneyTimeshareResponse {
  data?: {
    name?: string
    preClose?: string | number
    prePrice?: string | number
    yc?: string | number
    trends?: string[]
  }
}

interface EastmoneyQuoteResponse {
  data?: EastmoneyQuoteData
}

type EastmoneyQuoteData = Record<string, unknown>

type TencentSecurityData = {
  qt?: Record<string, string[]>
  [key: string]: unknown
}

interface TencentResponse {
  data?: Record<string, TencentSecurityData>
}

interface TencentTimeshareResponse {
  data?: Record<string, TencentTimeshareSecurityData>
}

interface TencentTimeshareSecurityData {
  data?: {
    date?: string
    data?: string[]
  }
  qt?: Record<string, string[]>
}

interface SinaKlineRow {
  day: string
  open: string
  high: string
  low: string
  close: string
  volume: string
  amount?: string
}
