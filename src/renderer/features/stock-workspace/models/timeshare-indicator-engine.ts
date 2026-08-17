import type {
  EnrichedStockTimeshareDataset,
  StockTimeshareAdvancedContext,
  StockTimeshareDataset,
  StockTimesharePoint,
  TimeshareCapitalFlowValue,
  TimeshareIndicatorAvailability,
  TimeshareIndicatorAvailabilityMap,
  TimeshareIndicatorSettingsMap,
  TimeshareKdjValue,
  TimeshareMacdValue
} from './stock-types'
import { calculateBoll, calculateEma, calculateMovingAverage } from './indicator-engine'
import {
  createDefaultTimeshareIndicatorSettings,
  normalizeTimeshareIndicatorSettings
} from './timeshare-indicator-definitions'

export const defaultTimeshareIndicatorSettings = createDefaultTimeshareIndicatorSettings()

export function enrichTimeshareDataset(
  dataset: StockTimeshareDataset,
  settings: TimeshareIndicatorSettingsMap = defaultTimeshareIndicatorSettings
): EnrichedStockTimeshareDataset {
  const resolvedSettings = normalizeTimeshareIndicatorSettings(settings)
  const indicatorAvailability = createTimeshareIndicatorAvailability(dataset)
  const prices = dataset.points.map((point) => point.price)
  const volumes = dataset.points.map((point) =>
    Number.isFinite(point.volume) ? Math.max(0, point.volume) : 0
  )
  const cumulativeVolumes = createCumulativeSeries(volumes)

  const maByPeriod = resolvedSettings.ma.enabled
    ? createSeriesByPeriod(prices, resolvedSettings.ma.params, calculateMovingAverage)
    : new Map<number, Array<number | undefined>>()
  const emaByPeriod = resolvedSettings.ema.enabled
    ? createSeriesByPeriod(prices, resolvedSettings.ema.params, calculateEma)
    : new Map<number, Array<number | undefined>>()
  const bollValues = resolvedSettings.boll.enabled
    ? calculateBoll(prices, resolvedSettings.boll.params[0], resolvedSettings.boll.params[1])
    : []
  const volumeMaByPeriod = resolvedSettings.volumeMa.enabled
    ? createSeriesByPeriod(volumes, resolvedSettings.volumeMa.params, calculateMovingAverage)
    : new Map<number, Array<number | undefined>>()
  const kdjValues =
    resolvedSettings.kdj.enabled && isAvailable(indicatorAvailability.kdj)
      ? calculateKdj(
          dataset.points,
          resolvedSettings.kdj.params[0],
          resolvedSettings.kdj.params[1],
          resolvedSettings.kdj.params[2]
        )
      : []
  const macdValues = resolvedSettings.macd.enabled
    ? calculateMacd(
        prices,
        resolvedSettings.macd.params[0],
        resolvedSettings.macd.params[1],
        resolvedSettings.macd.params[2]
      )
    : []
  const rsiByPeriod = resolvedSettings.rsi.enabled
    ? createSeriesByPeriod(prices, resolvedSettings.rsi.params, calculateRsi)
    : new Map<number, Array<number | undefined>>()
  const volumeRatioValues =
    resolvedSettings.volumeRatio.enabled && isAvailable(indicatorAvailability.volumeRatio)
      ? calculateVolumeRatio(cumulativeVolumes, dataset.advanced)
      : []
  const turnoverRateValues =
    resolvedSettings.turnoverRate.enabled && isAvailable(indicatorAvailability.turnoverRate)
      ? calculateTurnoverRate(cumulativeVolumes, dataset.advanced)
      : []
  const latestIndicators = {
    ...(resolvedSettings.orderRatio.enabled && isAvailable(indicatorAvailability.orderRatio)
      ? { orderRatio: calculateOrderRatio(dataset.advanced) }
      : {}),
    ...(resolvedSettings.inOutVolume.enabled && isAvailable(indicatorAvailability.inOutVolume)
      ? { inOutVolume: dataset.advanced?.inOutVolume }
      : {}),
    ...(resolvedSettings.capitalFlow.enabled && isAvailable(indicatorAvailability.capitalFlow)
      ? { capitalFlow: dataset.advanced?.capitalFlow as TimeshareCapitalFlowValue | undefined }
      : {})
  }

  return {
    ...dataset,
    indicatorSettings: resolvedSettings,
    indicatorAvailability,
    latestIndicators,
    points: dataset.points.map((point, index) => ({
      ...point,
      indicators: {
        ...(maByPeriod.size > 0 ? { ma: valuesAtIndex(maByPeriod, index) } : {}),
        ...(emaByPeriod.size > 0 ? { ema: valuesAtIndex(emaByPeriod, index) } : {}),
        ...(bollValues[index] ? { boll: bollValues[index] } : {}),
        ...(volumeMaByPeriod.size > 0 ? { volumeMa: valuesAtIndex(volumeMaByPeriod, index) } : {}),
        ...(kdjValues[index] ? { kdj: kdjValues[index] } : {}),
        ...(macdValues[index] ? { macd: macdValues[index] } : {}),
        ...(rsiByPeriod.size > 0 ? { rsi: valuesAtIndex(rsiByPeriod, index) } : {}),
        ...(volumeRatioValues[index] ? { volumeRatio: volumeRatioValues[index] } : {}),
        ...(turnoverRateValues[index] ? { turnoverRate: turnoverRateValues[index] } : {})
      }
    }))
  }
}

export function createTimeshareIndicatorAvailability(
  dataset: StockTimeshareDataset
): TimeshareIndicatorAvailabilityMap {
  return {
    kdj: createAvailability({
      available: hasMinuteOhlc(dataset.points),
      displayShape: 'series',
      source: dataset.sourceName,
      basis: '分钟 high/low/close',
      reason: dataset.advanced?.unavailableReasons?.minuteOhlc ?? '缺少分钟 OHLC'
    }),
    volumeRatio: createAvailability({
      available: hasValidVolumes(dataset.points) && hasHistoricalVolumeBaseline(dataset.advanced),
      displayShape: 'series',
      source: dataset.advanced?.historicalVolumeBaseline?.source ?? dataset.sourceName,
      basis: dataset.advanced?.historicalVolumeBaseline
        ? volumeRatioBasisLabel(dataset.advanced.historicalVolumeBaseline.basis)
        : undefined,
      reason: dataset.advanced?.unavailableReasons?.historicalVolume ?? '缺少历史成交量基准'
    }),
    turnoverRate: createAvailability({
      available: hasValidVolumes(dataset.points) && hasPositiveNumber(dataset.advanced?.floatShares),
      displayShape: 'series',
      source: dataset.sourceName,
      basis: '累计成交量 / 流通股本',
      reason: dataset.advanced?.unavailableReasons?.floatShares ?? '缺少流通股本'
    }),
    orderRatio: createAvailability({
      available:
        hasPositiveNumber(dataset.advanced?.orderBook?.bidVolume) ||
        hasPositiveNumber(dataset.advanced?.orderBook?.askVolume),
      displayShape: 'latest',
      source: dataset.advanced?.orderBook?.source ?? dataset.sourceName,
      basis: '买卖前 5 档数量',
      reason: dataset.advanced?.unavailableReasons?.orderBook ?? '缺少盘口买卖档位'
    }),
    inOutVolume: createAvailability({
      available:
        hasNonNegativeNumber(dataset.advanced?.inOutVolume?.inwardVolume) &&
        hasNonNegativeNumber(dataset.advanced?.inOutVolume?.outwardVolume),
      displayShape: 'accumulative',
      source: dataset.advanced?.inOutVolume?.source ?? dataset.sourceName,
      basis: '方向成交量',
      reason: dataset.advanced?.unavailableReasons?.tradeDirection ?? '缺少逐笔方向或内外盘聚合字段'
    }),
    capitalFlow: createAvailability({
      available:
        hasNonNegativeNumber(dataset.advanced?.capitalFlow?.totalInflow) &&
        hasNonNegativeNumber(dataset.advanced?.capitalFlow?.totalOutflow) &&
        hasFiniteNumber(dataset.advanced?.capitalFlow?.netInflow),
      displayShape: 'accumulative',
      source: dataset.advanced?.capitalFlow?.source ?? dataset.sourceName,
      basis: '总流入 / 总流出 / 净流入',
      reason: dataset.advanced?.unavailableReasons?.capitalFlow ?? '缺少资金流聚合字段'
    })
  }
}

export function calculateMacd(
  values: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number
): TimeshareMacdValue[] {
  if (fastPeriod <= 0 || slowPeriod <= 0 || signalPeriod <= 0) {
    throw new Error('MACD 周期必须大于 0')
  }
  if (fastPeriod >= slowPeriod) {
    throw new Error('MACD 快线必须小于慢线')
  }

  const fastEma = calculateEma(values, fastPeriod)
  const slowEma = calculateEma(values, slowPeriod)
  const difValues = values.map((_, index) => fastEma[index] - slowEma[index])
  const deaValues = calculateEma(difValues, signalPeriod)

  return difValues.map((dif, index) => ({
    dif,
    dea: deaValues[index],
    macd: (dif - deaValues[index]) * 2
  }))
}

export function calculateKdj(
  points: StockTimesharePoint[],
  period: number,
  kPeriod: number,
  dPeriod: number
): Array<TimeshareKdjValue | undefined> {
  if (period <= 0 || kPeriod <= 0 || dPeriod <= 0) {
    throw new Error('KDJ 周期必须大于 0')
  }

  const result: Array<TimeshareKdjValue | undefined> = []
  let previousK = 50
  let previousD = 50

  points.forEach((point, index) => {
    if (index < period - 1) {
      return
    }

    const window = points.slice(index - period + 1, index + 1)
    if (!window.every(hasOhlcPoint)) {
      return
    }
    const highs = window.map((item) => item.high as number)
    const lows = window.map((item) => item.low as number)
    const highest = Math.max(...highs)
    const lowest = Math.min(...lows)
    const close = point.close ?? point.price
    const rsv = highest === lowest ? 50 : ((close - lowest) / (highest - lowest)) * 100
    const k = ((kPeriod - 1) * previousK + rsv) / kPeriod
    const d = ((dPeriod - 1) * previousD + k) / dPeriod
    const j = 3 * k - 2 * d
    previousK = k
    previousD = d
    result[index] = { k, d, j }
  })

  return result
}

export function calculateVolumeRatio(
  cumulativeVolumes: number[],
  advanced: StockTimeshareAdvancedContext | undefined
): Array<{ value: number; basis: string } | undefined> {
  const baseline = advanced?.historicalVolumeBaseline
  if (!baseline || baseline.averageMinuteVolume <= 0) {
    return []
  }
  const basis = volumeRatioBasisLabel(baseline.basis)
  return cumulativeVolumes.map((volume, index) => {
    const elapsedMinutes = index + 1
    if (elapsedMinutes <= 0 || volume < 0) {
      return undefined
    }
    return {
      value: volume / elapsedMinutes / baseline.averageMinuteVolume,
      basis
    }
  })
}

export function calculateTurnoverRate(
  cumulativeVolumes: number[],
  advanced: StockTimeshareAdvancedContext | undefined
): Array<{ value: number; basis: string } | undefined> {
  const floatShares = advanced?.floatShares
  if (!floatShares || floatShares <= 0) {
    return []
  }
  return cumulativeVolumes.map((volume) =>
    volume >= 0
      ? {
          value: (volume / floatShares) * 100,
          basis: '累计成交量 / 流通股本'
        }
      : undefined
  )
}

export function calculateOrderRatio(
  advanced: StockTimeshareAdvancedContext | undefined
): {
  value: number
  bidVolume: number
  askVolume: number
  source: string
  timestamp: number
} | undefined {
  const orderBook = advanced?.orderBook
  if (!orderBook) {
    return undefined
  }
  const denominator = orderBook.bidVolume + orderBook.askVolume
  if (denominator <= 0) {
    return undefined
  }
  return {
    value: ((orderBook.bidVolume - orderBook.askVolume) / denominator) * 100,
    bidVolume: orderBook.bidVolume,
    askVolume: orderBook.askVolume,
    source: orderBook.source,
    timestamp: orderBook.timestamp
  }
}

export function calculateRsi(values: number[], period: number): Array<number | undefined> {
  if (period <= 0) {
    throw new Error('RSI 周期必须大于 0')
  }

  return values.map((_, index) => {
    if (index < period) {
      return undefined
    }

    let gain = 0
    let loss = 0
    for (let cursor = index - period + 1; cursor <= index; cursor += 1) {
      const change = values[cursor] - values[cursor - 1]
      if (change > 0) {
        gain += change
      } else {
        loss += Math.abs(change)
      }
    }

    if (gain === 0 && loss === 0) {
      return 50
    }
    if (loss === 0) {
      return 100
    }
    const relativeStrength = gain / loss
    return 100 - 100 / (1 + relativeStrength)
  })
}

function createSeriesByPeriod(
  values: number[],
  periods: number[],
  calculate: (values: number[], period: number) => Array<number | undefined>
): Map<number, Array<number | undefined>> {
  return new Map(periods.map((period) => [period, calculate(values, period)]))
}

function createCumulativeSeries(values: number[]): number[] {
  let total = 0
  return values.map((value) => {
    total += value
    return total
  })
}

function valuesAtIndex(
  seriesByPeriod: Map<number, Array<number | undefined>>,
  index: number
): Record<string, number | undefined> {
  return Object.fromEntries(
    Array.from(seriesByPeriod.entries()).map(([period, values]) => [String(period), values[index]])
  )
}

function createAvailability(options: {
  available: boolean
  displayShape: TimeshareIndicatorAvailability['displayShape']
  reason: string
  source?: string
  basis?: string
}): TimeshareIndicatorAvailability {
  return {
    status: options.available ? 'available' : 'unavailable',
    displayShape: options.displayShape,
    ...(options.available ? {} : { reason: options.reason }),
    ...(options.source ? { source: options.source } : {}),
    ...(options.basis ? { basis: options.basis } : {})
  }
}

function isAvailable(availability: TimeshareIndicatorAvailability | undefined): boolean {
  return availability?.status === 'available'
}

function hasMinuteOhlc(points: StockTimesharePoint[]): boolean {
  return points.length > 0 && points.every(hasOhlcPoint)
}

function hasOhlcPoint(point: StockTimesharePoint): boolean {
  return (
    hasFiniteNumber(point.high) &&
    hasFiniteNumber(point.low) &&
    hasFiniteNumber(point.close ?? point.price)
  )
}

function hasValidVolumes(points: StockTimesharePoint[]): boolean {
  return points.length > 0 && points.every((point) => hasNonNegativeNumber(point.volume))
}

function hasHistoricalVolumeBaseline(advanced: StockTimeshareAdvancedContext | undefined): boolean {
  return hasPositiveNumber(advanced?.historicalVolumeBaseline?.averageMinuteVolume)
}

function hasPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function hasNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function volumeRatioBasisLabel(
  basis: NonNullable<StockTimeshareAdvancedContext['historicalVolumeBaseline']>['basis']
): string {
  return basis === 'sameMinuteCumulativeVolume' ? '同分钟累计历史基准' : '5日均每分钟成交量'
}
