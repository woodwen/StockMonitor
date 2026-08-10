import type {
  BollValue,
  BsSignal,
  EnrichedStockCandle,
  EnrichedStockDataset,
  IndicatorSettingsMap,
  StockCandle,
  StockDataset,
  VolumeMaValue
} from './stock-types'
import { createDefaultIndicatorSettings } from './indicator-definitions'

export interface IndicatorConfig {
  bollPeriod: number
  bollDeviation: number
  volumeMaPeriods: number[]
  fastSignalPeriod: number
  slowSignalPeriod: number
}

export const defaultIndicatorConfig: IndicatorConfig = indicatorConfigFromSettings(
  createDefaultIndicatorSettings()
)

export function enrichStockDataset(
  dataset: StockDataset,
  config: IndicatorConfig | IndicatorSettingsMap = defaultIndicatorConfig
): EnrichedStockDataset {
  const resolvedConfig = resolveIndicatorConfig(config)
  const closes = dataset.candles.map((item) => item.close)
  const volumes = dataset.candles.map((item) => item.volume)
  const typicalPrices = dataset.candles.map((item) => (item.close + item.high + item.low) / 3)

  const bollValues = calculateBoll(closes, resolvedConfig.bollPeriod, resolvedConfig.bollDeviation)
  const volumeMas = calculateVolumeMas(volumes, resolvedConfig.volumeMaPeriods)
  const signals = calculateBsSignals(dataset.candles, typicalPrices, resolvedConfig)

  return {
    ...dataset,
    candles: dataset.candles.map((candle, index) => ({
      ...candle,
      boll: bollValues[index],
      volumeMa: volumeMas[index],
      bsSignal: signals[index]
    }))
  }
}

export function indicatorConfigFromSettings(settings: IndicatorSettingsMap): IndicatorConfig {
  const bollParams = settings.boll.params
  const volumeParams = settings.volumeMa.params
  const signalParams = settings.bsSignal.params
  return {
    bollPeriod: bollParams[0],
    bollDeviation: bollParams[1],
    volumeMaPeriods: [...volumeParams],
    fastSignalPeriod: signalParams[0],
    slowSignalPeriod: signalParams[1]
  }
}

export function calculateMovingAverage(values: number[], period: number): Array<number | undefined> {
  if (period <= 0) {
    throw new Error('移动平均周期必须大于 0')
  }

  const result: Array<number | undefined> = []
  let rollingSum = 0

  values.forEach((value, index) => {
    rollingSum += value
    if (index >= period) {
      rollingSum -= values[index - period]
    }
    result[index] = index >= period - 1 ? rollingSum / period : undefined
  })

  return result
}

export function calculateEma(values: number[], period: number): number[] {
  if (period <= 0) {
    throw new Error('EMA 周期必须大于 0')
  }
  if (values.length === 0) {
    return []
  }

  const factor = 2 / (period + 1)
  const result = [values[0]]

  for (let index = 1; index < values.length; index += 1) {
    result[index] = values[index] * factor + result[index - 1] * (1 - factor)
  }

  return result
}

export function calculateBoll(
  values: number[],
  period: number,
  deviation: number
): Array<BollValue | undefined> {
  const middle = calculateMovingAverage(values, period)

  return values.map((_, index) => {
    const mid = middle[index]
    if (mid === undefined) {
      return undefined
    }
    const slice = values.slice(index - period + 1, index + 1)
    const variance = slice.reduce((sum, value) => sum + (value - mid) ** 2, 0) / period
    const standardDeviation = Math.sqrt(variance)
    return {
      mid,
      upper: mid + deviation * standardDeviation,
      lower: mid - deviation * standardDeviation
    }
  })
}

function calculateVolumeMas(values: number[], periods: number[]): VolumeMaValue[] {
  const maByPeriod = new Map(periods.map((period) => [period, calculateMovingAverage(values, period)]))

  return values.map((_, index) => ({
    ma5: maByPeriod.get(5)?.[index],
    ma10: maByPeriod.get(10)?.[index],
    ma20: maByPeriod.get(20)?.[index]
  }))
}

function calculateBsSignals(
  candles: StockCandle[],
  typicalPrices: number[],
  config: IndicatorConfig
): Array<BsSignal | undefined> {
  const fastEma = calculateEma(typicalPrices, config.fastSignalPeriod)
  const slowEma = calculateEma(typicalPrices, config.slowSignalPeriod)
  const signals: Array<BsSignal | undefined> = []

  for (let index = 1; index < candles.length; index += 1) {
    const previousFast = fastEma[index - 1]
    const previousSlow = slowEma[index - 1]
    const currentFast = fastEma[index]
    const currentSlow = slowEma[index]

    if (previousFast <= previousSlow && currentFast > currentSlow) {
      signals[index] = {
        side: 'buy',
        value: candles[index].low
      }
    } else if (previousFast >= previousSlow && currentFast < currentSlow) {
      signals[index] = {
        side: 'sell',
        value: candles[index].high
      }
    }
  }

  return signals
}

function resolveIndicatorConfig(config: IndicatorConfig | IndicatorSettingsMap): IndicatorConfig {
  return 'bollPeriod' in config ? config : indicatorConfigFromSettings(config)
}

export function getLatestCandle(dataset: EnrichedStockDataset | null): EnrichedStockCandle | null {
  if (!dataset || dataset.candles.length === 0) {
    return null
  }
  return dataset.candles[dataset.candles.length - 1]
}
