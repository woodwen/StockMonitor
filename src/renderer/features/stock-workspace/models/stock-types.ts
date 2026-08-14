export type IntervalType = 'minute' | 'day' | 'week' | 'month'

export type IndicatorName =
  | 'boll'
  | 'ma'
  | 'ema'
  | 'volumeMa'
  | 'macd'
  | 'kdj'
  | 'rsi'
  | 'bsSignal'
  | 'strategySignal'

export type IndicatorPane = 'main' | 'sub' | 'overlay'

export type IndicatorLineStyle = 'solid' | 'dashed' | 'dotted'

export interface IndicatorLineVisualStyle {
  color: string
  lineStyle: IndicatorLineStyle
}

export interface IndicatorBarVisualStyle {
  upColor: string
  downColor: string
  noChangeColor: string
}

export interface IndicatorMarkerVisualStyle {
  buyColor: string
  sellColor: string
}

export interface IndicatorVisualSettings {
  lines?: IndicatorLineVisualStyle[]
  bar?: IndicatorBarVisualStyle
  marker?: IndicatorMarkerVisualStyle
}

export interface IndicatorSettings {
  enabled: boolean
  params: number[]
  precision?: number
  styles: IndicatorVisualSettings
}

export type IndicatorSettingsMap = Record<IndicatorName, IndicatorSettings>

export type TimeshareIndicatorName =
  | 'avgPriceLine'
  | 'previousCloseLine'
  | 'volume'
  | 'ma'
  | 'ema'
  | 'boll'
  | 'bsSignal'
  | 'volumeMa'
  | 'kdj'
  | 'macd'
  | 'rsi'
  | 'volumeRatio'
  | 'turnoverRate'
  | 'orderRatio'
  | 'inOutVolume'
  | 'capitalFlow'

export type TimeshareIndicatorPane = 'base' | 'main' | 'signal' | 'volume' | 'sub' | 'advanced'

export interface TimeshareIndicatorSettings {
  enabled: boolean
  params: number[]
}

export type TimeshareIndicatorSettingsMap = Record<
  TimeshareIndicatorName,
  TimeshareIndicatorSettings
>

export type StockSourceId = 'eastmoney' | 'sina' | 'netease163' | 'tencent'

export type StockAdjust = 'none' | 'qfq' | 'hfq'

export type StockPeriod = 'day' | 'week' | 'month' | '5' | '15' | '30' | '60'

export type WorkspaceViewMode = 'kline' | 'timeshare'

export type StockMarketScope = 'stock' | 'etf' | 'index'

export type SourceCapabilitySupport = 'supported' | 'unsupported' | 'unknown'

export type TimeshareAdvancedContextKey =
  | 'minuteOhlc'
  | 'historicalVolume'
  | 'floatShares'
  | 'orderBook'
  | 'tradeDirection'
  | 'capitalFlow'

export interface TimeshareAdvancedContextCapability {
  status: SourceCapabilitySupport
  markets: StockMarketScope[]
  reason?: string
}

export type TimeshareAdvancedCapabilities = Record<
  TimeshareAdvancedContextKey,
  TimeshareAdvancedContextCapability
>

export interface SourceCapabilities {
  periods: StockPeriod[]
  adjusts: StockAdjust[]
  markets: StockMarketScope[]
  timeshare: boolean
  timeshareAdvanced?: TimeshareAdvancedCapabilities
}

export interface StockDataSourceMeta {
  id: StockSourceId
  name: string
  capabilities: SourceCapabilities
}

export interface StockQuery {
  sourceId: StockSourceId
  symbol: string
  period: StockPeriod
  adjust: StockAdjust
  startDate: string
  endDate: string
}

export interface StockMeta {
  lineType: string
  symbol: string
  name: string
}

export interface WatchlistItem {
  symbol: string
  name: string
  createdAt: number
  updatedAt?: number
}

export interface KlineCacheDateRange {
  startDate: string
  endDate: string
}

export interface KlineCacheRequestQuery {
  sourceId: StockSourceId
  periods: StockPeriod[]
  adjusts: StockAdjust[]
  startDate: string
  endDate: string
}

export type KlineCacheStatus = 'complete' | 'partial' | 'empty' | 'unsupported' | 'error'

export interface KlineCacheLastError {
  message: string
  occurredAt: number
}

export interface KlineCacheStatusRow {
  id: string
  symbol: string
  name: string
  query: StockQuery
  status: KlineCacheStatus
  recordCount: number
  coveredRanges: KlineCacheDateRange[]
  missingRanges: KlineCacheDateRange[]
  cachedStartDate?: string
  cachedEndDate?: string
  lastRefreshedAt?: number
  lastError?: KlineCacheLastError
  cacheBytes?: number
  message?: string
}

export interface KlineCacheStatusRequest {
  query: KlineCacheRequestQuery
  items: WatchlistItem[]
}

export interface KlineCacheSeriesRequestItem {
  id: string
  symbol: string
  name: string
  query: StockQuery
}

export interface KlineCacheRefreshRequest extends KlineCacheStatusRequest {
  rows?: KlineCacheSeriesRequestItem[]
}

export interface KlineCacheClearRequest extends KlineCacheStatusRequest {
  rows?: KlineCacheSeriesRequestItem[]
}

export type KlineCacheJobStatus = 'queued' | 'running' | 'completed' | 'cancelled'

export type KlineCacheJobRowStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'error'
  | 'unsupported'
  | 'cancelled'

export interface KlineCacheJobRow {
  id: string
  symbol: string
  name: string
  query: StockQuery
  status: KlineCacheJobRowStatus
  recordCount?: number
  missingRanges?: KlineCacheDateRange[]
  message?: string
  startedAt?: number
  finishedAt?: number
}

export interface KlineCacheJob {
  id: string
  status: KlineCacheJobStatus
  total: number
  completed: number
  currentRowId?: string
  currentSymbol?: string
  rows: KlineCacheJobRow[]
  startedAt: number
  finishedAt?: number
}

export interface KlineCachedDatasetResult {
  status: KlineCacheStatus
  query: StockQuery
  dataset?: StockDataset
  missingRanges: KlineCacheDateRange[]
  message?: string
  lastError?: KlineCacheLastError
}

export type WatchlistAddPreviewStatus = 'ready' | 'duplicate' | 'invalid'

export interface WatchlistAddPreview {
  lineNumber: number
  raw: string
  symbol: string
  name: string
  status: WatchlistAddPreviewStatus
  message: string
  item?: WatchlistItem
}

export interface WatchlistParseResult {
  previews: WatchlistAddPreview[]
  totalLineCount: number
  parsedLineCount: number
  truncated: boolean
}

export interface StockCandle {
  timeKey: string
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  turnover: number
}

export interface StockTimeshareQuery {
  sourceId: StockSourceId
  symbol: string
  tradeDate?: string
}

export interface StockTimesharePoint {
  timeKey: string
  timestamp: number
  price: number
  avgPrice: number
  volume: number
  turnover: number
  open?: number
  high?: number
  low?: number
  close?: number
}

export type TimeshareIndicatorDisplayShape = 'series' | 'latest' | 'accumulative'

export type TimeshareIndicatorAvailabilityStatus = 'available' | 'unavailable'

export interface TimeshareIndicatorAvailability {
  status: TimeshareIndicatorAvailabilityStatus
  displayShape: TimeshareIndicatorDisplayShape
  reason?: string
  source?: string
  basis?: string
}

export type TimeshareIndicatorAvailabilityMap = Partial<
  Record<TimeshareIndicatorName, TimeshareIndicatorAvailability>
>

export interface TimeshareHistoricalVolumeBaseline {
  basis: 'fiveDayAverageMinuteVolume' | 'sameMinuteCumulativeVolume'
  averageMinuteVolume: number
  tradeDays: number
  sampleStartDate: string
  sampleEndDate: string
  source: string
}

export interface TimeshareOrderBookLevel {
  price?: number
  volume: number
}

export interface TimeshareOrderBookSnapshot {
  bidLevels: TimeshareOrderBookLevel[]
  askLevels: TimeshareOrderBookLevel[]
  bidVolume: number
  askVolume: number
  timestamp: number
  source: string
}

export interface TimeshareInOutVolumeAggregate {
  inwardVolume: number
  outwardVolume: number
  source: 'tradeDirection' | 'sourceAggregate'
  timestamp: number
}

export interface TimeshareCapitalFlowAggregate {
  totalInflow: number
  totalOutflow: number
  netInflow: number
  source: 'tradeDirection' | 'sourceAggregate'
  timestamp: number
}

export interface StockTimeshareAdvancedContext {
  tradeDate: string
  historicalVolumeBaseline?: TimeshareHistoricalVolumeBaseline
  floatShares?: number
  orderBook?: TimeshareOrderBookSnapshot
  inOutVolume?: TimeshareInOutVolumeAggregate
  capitalFlow?: TimeshareCapitalFlowAggregate
  unavailableReasons?: Partial<Record<TimeshareAdvancedContextKey, string>>
}

export interface StockTimeshareDataset {
  meta: StockMeta
  previousClose: number
  points: StockTimesharePoint[]
  advanced?: StockTimeshareAdvancedContext
  indicatorAvailability?: TimeshareIndicatorAvailabilityMap
  sourceId?: StockSourceId
  sourceName?: string
  sourceUrl?: string
}

export interface BollValue {
  mid: number
  upper: number
  lower: number
}

export interface VolumeMaValue {
  ma5?: number
  ma10?: number
  ma20?: number
}

export type SignalSide = 'buy' | 'sell'

export interface BsSignal {
  side: SignalSide
  value: number
}

export interface TimeshareMacdValue {
  dif: number
  dea: number
  macd: number
}

export interface TimeshareKdjValue {
  k: number
  d: number
  j: number
}

export interface TimeshareVolumeRatioValue {
  value: number
  basis: string
}

export interface TimeshareTurnoverRateValue {
  value: number
  basis: string
}

export interface TimeshareOrderRatioValue {
  value: number
  bidVolume: number
  askVolume: number
  source: string
  timestamp: number
}

export interface TimeshareInOutVolumeValue extends TimeshareInOutVolumeAggregate {}

export interface TimeshareCapitalFlowValue extends TimeshareCapitalFlowAggregate {}

export interface TimeshareLatestIndicatorValues {
  orderRatio?: TimeshareOrderRatioValue
  inOutVolume?: TimeshareInOutVolumeValue
  capitalFlow?: TimeshareCapitalFlowValue
}

export interface TimeshareIndicatorValues {
  ma?: Record<string, number | undefined>
  ema?: Record<string, number | undefined>
  boll?: BollValue
  bsSignal?: BsSignal
  volumeMa?: Record<string, number | undefined>
  kdj?: TimeshareKdjValue
  macd?: TimeshareMacdValue
  rsi?: Record<string, number | undefined>
  volumeRatio?: TimeshareVolumeRatioValue
  turnoverRate?: TimeshareTurnoverRateValue
}

export interface EnrichedStockTimesharePoint extends StockTimesharePoint {
  indicators: TimeshareIndicatorValues
}

export interface EnrichedStockTimeshareDataset extends Omit<StockTimeshareDataset, 'points'> {
  points: EnrichedStockTimesharePoint[]
  indicatorSettings: TimeshareIndicatorSettingsMap
  indicatorAvailability: TimeshareIndicatorAvailabilityMap
  latestIndicators: TimeshareLatestIndicatorValues
}

export interface EnrichedStockCandle extends StockCandle {
  boll?: BollValue
  volumeMa: VolumeMaValue
  bsSignal?: BsSignal
}

export interface StockDataset {
  meta: StockMeta
  interval: IntervalType
  columns: string[]
  candles: StockCandle[]
  sourceId?: StockSourceId
  sourceName?: string
  sourceUrl?: string
  adjust?: StockAdjust
  sourcePath?: string
  encoding?: string
}

export interface EnrichedStockDataset extends Omit<StockDataset, 'candles'> {
  candles: EnrichedStockCandle[]
}

export type KlineStrategyPeriod = 'day' | 'week' | 'month'

export type KlineStrategyTemplateId =
  | 'ma-cross'
  | 'breakout-pullback'
  | 'rsi-reversion'
  | 'macd-trend-confirmation'
  | 'ma-bullish-alignment'
  | 'n-day-high-breakout'
  | 'volume-breakout'
  | 'bollinger-breakout'
  | 'bollinger-mean-reversion'
  | 'kdj-oversold-rebound'
  | 'atr-trend-following'
  | 'low-volume-ma-pullback'

export type KlineStrategyRecommendationLevel = 1 | 2 | 3 | 4 | 5

export interface KlineStrategyParameterDefinition {
  key: string
  label: string
  defaultValue: number
  min: number
  max: number
  step: number
  precision?: number
}

export type KlineStrategyParams = Record<string, number>

export interface KlineStrategyTemplateDefinition {
  id: KlineStrategyTemplateId
  name: string
  typeLabel: string
  basicLogic: string
  recommendationLevel: KlineStrategyRecommendationLevel
  description: string
  signalDescription: string
  parameters: KlineStrategyParameterDefinition[]
  defaultParams: KlineStrategyParams
  minSampleSize: number
  compatiblePeriods: KlineStrategyPeriod[]
}

export interface KlineBacktestAssumptions {
  initialCapital: number
  feeRate: number
  slippageRate: number
}

export interface KlineStrategySettings {
  selectedTemplateIds: KlineStrategyTemplateId[]
  paramsByTemplate: Partial<Record<KlineStrategyTemplateId, KlineStrategyParams>>
  assumptions: KlineBacktestAssumptions
  assumptionDefaultsVersion?: number
}

export interface KlineStrategySignal {
  side: SignalSide
  timeKey: string
  timestamp: number
  price: number
  templateId: KlineStrategyTemplateId
  templateName: string
  explanation: string
  indicatorValues: Record<string, number>
}

export interface KlineStrategyTrade {
  id: string
  templateId: KlineStrategyTemplateId
  entryTimeKey: string
  entryTimestamp: number
  entryPrice: number
  entrySignal: KlineStrategySignal
  exitTimeKey?: string
  exitTimestamp?: number
  exitPrice?: number
  exitSignal?: KlineStrategySignal
  holdingBars: number
  profit: number
  returnRate: number
  closed: boolean
}

export interface KlineStrategyEquityPoint {
  timeKey: string
  timestamp: number
  equity: number
  drawdown: number
}

export interface KlineStrategyMetrics {
  totalReturn: number
  annualizedReturn: number
  maxDrawdown: number
  winRate?: number
  tradeCount: number
  profitLossRatio?: number
  averageHoldingBars?: number
  finalEquity: number
  benchmarkReturn: number
}

export type KlineStrategyResultStatus = 'success' | 'unavailable'

export interface KlineStrategyBacktestResult {
  id: string
  status: KlineStrategyResultStatus
  templateId: KlineStrategyTemplateId
  templateName: string
  description: string
  query: StockQuery
  params: KlineStrategyParams
  assumptions: KlineBacktestAssumptions
  dataStartDate?: string
  dataEndDate?: string
  signals: KlineStrategySignal[]
  trades: KlineStrategyTrade[]
  equityCurve: KlineStrategyEquityPoint[]
  metrics?: KlineStrategyMetrics
  score?: number
  rank?: number
  unavailableReason?: string
}

export interface KlineStrategyComparisonResult {
  query: StockQuery
  assumptions: KlineBacktestAssumptions
  results: KlineStrategyBacktestResult[]
}
