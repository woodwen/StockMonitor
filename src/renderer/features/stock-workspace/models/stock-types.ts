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

export type IndicatorPane = 'main' | 'sub' | 'overlay'

export interface IndicatorSettings {
  enabled: boolean
  params: number[]
}

export type IndicatorSettingsMap = Record<IndicatorName, IndicatorSettings>

export type StockSourceId = 'eastmoney' | 'sina' | 'netease163' | 'tencent'

export type StockAdjust = 'none' | 'qfq' | 'hfq'

export type StockPeriod = 'day' | 'week' | 'month' | '5' | '15' | '30' | '60'

export type StockMarketScope = 'stock' | 'etf' | 'index'

export interface SourceCapabilities {
  periods: StockPeriod[]
  adjusts: StockAdjust[]
  markets: StockMarketScope[]
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
