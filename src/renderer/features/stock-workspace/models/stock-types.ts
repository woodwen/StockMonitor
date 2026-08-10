export type IntervalType = 'minute' | 'day' | 'week' | 'month'

export type IndicatorName = 'boll' | 'volumeMa' | 'bsSignal'

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
  sourcePath?: string
  encoding?: string
}

export interface EnrichedStockDataset extends Omit<StockDataset, 'candles'> {
  candles: EnrichedStockCandle[]
}

export interface FileTextPayload {
  filePath: string
  fileName: string
  text: string
  encoding: string
}

export interface RecentFileEntry {
  filePath: string
  fileName: string
  openedAt: number
}
