import type {
  BsSignal,
  EnrichedStockTimeshareDataset,
  StockTimeshareDataset,
  TimeshareIndicatorSettingsMap,
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
  const prices = dataset.points.map((point) => point.price)
  const volumes = dataset.points.map((point) =>
    Number.isFinite(point.volume) ? Math.max(0, point.volume) : 0
  )

  const maByPeriod = resolvedSettings.ma.enabled
    ? createSeriesByPeriod(prices, resolvedSettings.ma.params, calculateMovingAverage)
    : new Map<number, Array<number | undefined>>()
  const emaByPeriod = resolvedSettings.ema.enabled
    ? createSeriesByPeriod(prices, resolvedSettings.ema.params, calculateEma)
    : new Map<number, Array<number | undefined>>()
  const bollValues = resolvedSettings.boll.enabled
    ? calculateBoll(prices, resolvedSettings.boll.params[0], resolvedSettings.boll.params[1])
    : []
  const bsSignals = resolvedSettings.bsSignal.enabled
    ? calculateTimeshareBsSignals(
        prices,
        resolvedSettings.bsSignal.params[0],
        resolvedSettings.bsSignal.params[1]
      )
    : []
  const volumeMaByPeriod = resolvedSettings.volumeMa.enabled
    ? createSeriesByPeriod(volumes, resolvedSettings.volumeMa.params, calculateMovingAverage)
    : new Map<number, Array<number | undefined>>()
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

  return {
    ...dataset,
    indicatorSettings: resolvedSettings,
    points: dataset.points.map((point, index) => ({
      ...point,
      indicators: {
        ...(maByPeriod.size > 0 ? { ma: valuesAtIndex(maByPeriod, index) } : {}),
        ...(emaByPeriod.size > 0 ? { ema: valuesAtIndex(emaByPeriod, index) } : {}),
        ...(bollValues[index] ? { boll: bollValues[index] } : {}),
        ...(bsSignals[index] ? { bsSignal: bsSignals[index] } : {}),
        ...(volumeMaByPeriod.size > 0 ? { volumeMa: valuesAtIndex(volumeMaByPeriod, index) } : {}),
        ...(macdValues[index] ? { macd: macdValues[index] } : {}),
        ...(rsiByPeriod.size > 0 ? { rsi: valuesAtIndex(rsiByPeriod, index) } : {})
      }
    }))
  }
}

export function calculateTimeshareBsSignals(
  prices: number[],
  fastPeriod: number,
  slowPeriod: number
): Array<BsSignal | undefined> {
  if (fastPeriod <= 0 || slowPeriod <= 0) {
    throw new Error('B/S 周期必须大于 0')
  }
  if (fastPeriod >= slowPeriod) {
    throw new Error('B/S 快线必须小于慢线')
  }

  const fastEma = calculateEma(prices, fastPeriod)
  const slowEma = calculateEma(prices, slowPeriod)
  const signals: Array<BsSignal | undefined> = []

  for (let index = 1; index < prices.length; index += 1) {
    const previousFast = fastEma[index - 1]
    const previousSlow = slowEma[index - 1]
    const currentFast = fastEma[index]
    const currentSlow = slowEma[index]

    if (previousFast <= previousSlow && currentFast > currentSlow) {
      signals[index] = {
        side: 'buy',
        value: prices[index]
      }
    } else if (previousFast >= previousSlow && currentFast < currentSlow) {
      signals[index] = {
        side: 'sell',
        value: prices[index]
      }
    }
  }

  return signals
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

function valuesAtIndex(
  seriesByPeriod: Map<number, Array<number | undefined>>,
  index: number
): Record<string, number | undefined> {
  return Object.fromEntries(
    Array.from(seriesByPeriod.entries()).map(([period, values]) => [String(period), values[index]])
  )
}
