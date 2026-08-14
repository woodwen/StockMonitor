import type {
  KlineBacktestAssumptions,
  KlineCacheDateRange,
  KlineStrategyBacktestResult,
  KlineStrategyComparisonResult,
  KlineStrategyEquityPoint,
  KlineStrategyMetrics,
  KlineStrategyParams,
  KlineStrategyPeriod,
  KlineStrategySettings,
  KlineStrategySignal,
  KlineStrategyTemplateDefinition,
  KlineStrategyTemplateId,
  KlineStrategyTrade,
  SignalSide,
  StockCandle,
  StockDataset,
  StockPeriod,
  StockQuery
} from './stock-types'
import { calculateBoll, calculateEma, calculateMovingAverage } from './indicator-engine'
import {
  addDays,
  getKlineCacheCandleRange,
  subtractKlineCacheRanges
} from './kline-cache'

export const KLINE_STRATEGY_SUPPORTED_PERIODS: KlineStrategyPeriod[] = ['day', 'week', 'month']
export const DEFAULT_KLINE_STRATEGY_INITIAL_CAPITAL = 100000
export const DEFAULT_KLINE_BACKTEST_FEE_RATE = 0.0005
export const DEFAULT_KLINE_BACKTEST_SLIPPAGE_RATE = 0.0002
export const KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION = 1

export const klineStrategyTemplates: KlineStrategyTemplateDefinition[] = [
  {
    id: 'ma-cross',
    name: '均线交叉',
    typeLabel: '趋势',
    basicLogic: '短期均线与长期均线交叉',
    recommendationLevel: 4,
    description: '比较短期均线与长期均线的历史交叉信号。',
    signalDescription: '短期均线上穿长期均线生成买入信号，下穿生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'shortPeriod', label: '短期均线', defaultValue: 5, min: 2, max: 120, step: 1 },
      { key: 'longPeriod', label: '长期均线', defaultValue: 20, min: 3, max: 250, step: 1 }
    ],
    defaultParams: {
      shortPeriod: 5,
      longPeriod: 20
    }
  },
  {
    id: 'breakout-pullback',
    name: '突破回撤',
    typeLabel: '趋势/突破',
    basicLogic: '收盘突破历史高点后按均线回撤退出',
    recommendationLevel: 4,
    description: '比较收盘价突破历史高点后的回撤退出信号。',
    signalDescription: '收盘价突破观察窗口高点生成买入信号，跌破退出均线生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'lookbackPeriod', label: '突破观察', defaultValue: 20, min: 5, max: 250, step: 1 },
      { key: 'exitPeriod', label: '退出均线', defaultValue: 10, min: 3, max: 120, step: 1 }
    ],
    defaultParams: {
      lookbackPeriod: 20,
      exitPeriod: 10
    }
  },
  {
    id: 'rsi-reversion',
    name: 'RSI 超买超卖',
    typeLabel: '反转',
    basicLogic: 'RSI 从超卖区间修复并在高位退出',
    recommendationLevel: 3,
    description: '比较 RSI 从超卖区间修复和进入超买区间的历史信号。',
    signalDescription: 'RSI 从超卖阈值下方修复生成买入信号，进入超买区间生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'period', label: 'RSI 周期', defaultValue: 14, min: 2, max: 120, step: 1 },
      { key: 'oversold', label: '超卖阈值', defaultValue: 30, min: 1, max: 50, step: 1 },
      { key: 'overbought', label: '超买阈值', defaultValue: 70, min: 50, max: 99, step: 1 }
    ],
    defaultParams: {
      period: 14,
      oversold: 30,
      overbought: 70
    }
  },
  {
    id: 'macd-trend-confirmation',
    name: 'MACD 趋势确认',
    typeLabel: '趋势',
    basicLogic: 'DIF/DEA 交叉并结合零轴位置确认趋势',
    recommendationLevel: 4,
    description: '比较 MACD DIF/DEA 交叉并结合零轴位置的历史信号。',
    signalDescription: 'DIF 在零轴上方上穿 DEA 生成买入信号，下穿 DEA 生成卖出信号。',
    minSampleSize: 40,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'fastPeriod', label: '快线 EMA', defaultValue: 12, min: 2, max: 120, step: 1 },
      { key: 'slowPeriod', label: '慢线 EMA', defaultValue: 26, min: 3, max: 250, step: 1 },
      { key: 'signalPeriod', label: '信号 EMA', defaultValue: 9, min: 2, max: 120, step: 1 }
    ],
    defaultParams: {
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9
    }
  },
  {
    id: 'ma-bullish-alignment',
    name: '均线多头排列',
    typeLabel: '趋势',
    basicLogic: 'MA5 > MA10 > MA20 > MA60',
    recommendationLevel: 5,
    description: '比较多条均线是否形成向上的历史多头排列。',
    signalDescription: '均线多头排列首次成立生成买入信号，多头排列失效或短期均线跌破中期均线生成卖出信号。',
    minSampleSize: 70,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'fastPeriod', label: '快速均线', defaultValue: 5, min: 2, max: 60, step: 1 },
      { key: 'shortPeriod', label: '短期均线', defaultValue: 10, min: 3, max: 120, step: 1 },
      { key: 'mediumPeriod', label: '中期均线', defaultValue: 20, min: 4, max: 180, step: 1 },
      { key: 'longPeriod', label: '长期均线', defaultValue: 60, min: 5, max: 250, step: 1 }
    ],
    defaultParams: {
      fastPeriod: 5,
      shortPeriod: 10,
      mediumPeriod: 20,
      longPeriod: 60
    }
  },
  {
    id: 'n-day-high-breakout',
    name: 'N 日新高突破',
    typeLabel: '趋势/突破',
    basicLogic: '收盘突破过去 N 日最高价',
    recommendationLevel: 5,
    description: '比较收盘价突破观察窗口历史高点后的趋势延续信号。',
    signalDescription: '收盘价突破过去 N 根 K 线最高价生成买入信号，跌破退出均线或突破价生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'lookbackPeriod', label: '突破观察', defaultValue: 20, min: 5, max: 250, step: 1 },
      { key: 'exitPeriod', label: '退出均线', defaultValue: 10, min: 3, max: 120, step: 1 }
    ],
    defaultParams: {
      lookbackPeriod: 20,
      exitPeriod: 10
    }
  },
  {
    id: 'volume-breakout',
    name: '放量突破',
    typeLabel: '量价',
    basicLogic: '突破压力位 + 成交量明显放大',
    recommendationLevel: 5,
    description: '比较价格突破压力位时成交量是否同步明显放大。',
    signalDescription: '收盘价突破压力位且成交量达到均量倍数阈值生成买入信号，跌破退出均线或突破位生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'resistancePeriod', label: '压力位观察', defaultValue: 20, min: 5, max: 250, step: 1 },
      { key: 'volumeMaPeriod', label: '成交量均线', defaultValue: 5, min: 2, max: 120, step: 1 },
      { key: 'volumeMultiplier', label: '放量倍数', defaultValue: 1.5, min: 1, max: 10, step: 0.1, precision: 2 },
      { key: 'exitPeriod', label: '退出均线', defaultValue: 10, min: 3, max: 120, step: 1 }
    ],
    defaultParams: {
      resistancePeriod: 20,
      volumeMaPeriod: 5,
      volumeMultiplier: 1.5,
      exitPeriod: 10
    }
  },
  {
    id: 'bollinger-breakout',
    name: '布林带突破',
    typeLabel: '波动/趋势',
    basicLogic: '收盘突破 Bollinger 上轨',
    recommendationLevel: 4,
    description: '比较收盘价向上突破 Bollinger 上轨后的趋势延续信号。',
    signalDescription: '收盘价向上突破 Bollinger 上轨生成买入信号，跌回中轨或上轨突破失效生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'period', label: 'Bollinger 周期', defaultValue: 20, min: 5, max: 120, step: 1 },
      { key: 'deviation', label: '标准差倍数', defaultValue: 2, min: 0.5, max: 5, step: 0.1, precision: 2 }
    ],
    defaultParams: {
      period: 20,
      deviation: 2
    }
  },
  {
    id: 'bollinger-mean-reversion',
    name: '布林带均值回归',
    typeLabel: '反转',
    basicLogic: '跌破下轨后重新回到通道',
    recommendationLevel: 4,
    description: '比较价格跌破 Bollinger 下轨后重新回到通道内的历史修复信号。',
    signalDescription: '收盘价跌破下轨后重新回到通道内生成买入信号，回到中轨生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'period', label: 'Bollinger 周期', defaultValue: 20, min: 5, max: 120, step: 1 },
      { key: 'deviation', label: '标准差倍数', defaultValue: 2, min: 0.5, max: 5, step: 0.1, precision: 2 }
    ],
    defaultParams: {
      period: 20,
      deviation: 2
    }
  },
  {
    id: 'kdj-oversold-rebound',
    name: 'KDJ 超卖反弹',
    typeLabel: '反转',
    basicLogic: 'K/D 低位金叉',
    recommendationLevel: 3,
    description: '比较 KDJ 在低位区间形成金叉后的历史反弹信号。',
    signalDescription: 'K、D 低位区域内 K 上穿 D 生成买入信号，K 下穿 D 或高位回落生成卖出信号。',
    minSampleSize: 30,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'rsvPeriod', label: 'RSV 周期', defaultValue: 9, min: 3, max: 120, step: 1 },
      { key: 'kSmoothing', label: 'K 平滑', defaultValue: 3, min: 1, max: 20, step: 1 },
      { key: 'dSmoothing', label: 'D 平滑', defaultValue: 3, min: 1, max: 20, step: 1 },
      { key: 'oversold', label: '超卖阈值', defaultValue: 20, min: 1, max: 50, step: 1 },
      { key: 'overbought', label: '高位阈值', defaultValue: 80, min: 50, max: 99, step: 1 }
    ],
    defaultParams: {
      rsvPeriod: 9,
      kSmoothing: 3,
      dSmoothing: 3,
      oversold: 20,
      overbought: 80
    }
  },
  {
    id: 'atr-trend-following',
    name: 'ATR 趋势跟踪',
    typeLabel: '趋势/波动',
    basicLogic: 'ATR 动态止损 + 趋势持有',
    recommendationLevel: 5,
    description: '比较趋势过滤条件和 ATR 动态止损参考下的历史趋势持有信号。',
    signalDescription: '趋势过滤成立且收盘价站上 ATR 动态止损参考生成买入信号，跌破动态止损或趋势失效生成卖出信号。',
    minSampleSize: 40,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'trendPeriod', label: '趋势均线', defaultValue: 20, min: 5, max: 250, step: 1 },
      { key: 'atrPeriod', label: 'ATR 周期', defaultValue: 14, min: 3, max: 120, step: 1 },
      { key: 'atrMultiplier', label: 'ATR 倍数', defaultValue: 3, min: 0.5, max: 10, step: 0.1, precision: 2 }
    ],
    defaultParams: {
      trendPeriod: 20,
      atrPeriod: 14,
      atrMultiplier: 3
    }
  },
  {
    id: 'low-volume-ma-pullback',
    name: '缩量回踩均线',
    typeLabel: '趋势回撤',
    basicLogic: '上涨趋势中缩量回踩 MA20/MA60',
    recommendationLevel: 5,
    description: '比较上涨趋势中价格缩量回踩关键均线后重新走强的历史信号。',
    signalDescription: '上涨趋势中缩量回踩支撑均线后重新走强生成买入信号，跌破支撑均线或趋势失效生成卖出信号。',
    minSampleSize: 70,
    compatiblePeriods: [...KLINE_STRATEGY_SUPPORTED_PERIODS],
    parameters: [
      { key: 'trendPeriod', label: '趋势均线', defaultValue: 60, min: 5, max: 250, step: 1 },
      { key: 'supportPeriod', label: '支撑均线', defaultValue: 20, min: 3, max: 180, step: 1 },
      { key: 'volumeMaPeriod', label: '成交量均线', defaultValue: 5, min: 2, max: 120, step: 1 },
      { key: 'volumeRatio', label: '缩量阈值', defaultValue: 0.8, min: 0.1, max: 1, step: 0.05, precision: 2 },
      { key: 'tolerancePercent', label: '回踩容差 %', defaultValue: 2, min: 0, max: 20, step: 0.1, precision: 2 }
    ],
    defaultParams: {
      trendPeriod: 60,
      supportPeriod: 20,
      volumeMaPeriod: 5,
      volumeRatio: 0.8,
      tolerancePercent: 2
    }
  }
]

const templateById = new Map(klineStrategyTemplates.map((template) => [template.id, template]))

type LegacyKlineStrategyDateRangeInput = {
  startDate?: unknown
  endDate?: unknown
}

type KlineStrategySettingsInput = Partial<
  Omit<KlineStrategySettings, 'assumptions' | 'assumptionDefaultsVersion'>
> & {
  assumptions?: Partial<KlineBacktestAssumptions> | null
  dateRange?: LegacyKlineStrategyDateRangeInput | null
  assumptionDefaultsVersion?: number | null
}

export function createDefaultKlineStrategySettings(): KlineStrategySettings {
  return {
    selectedTemplateIds: klineStrategyTemplates.map((template) => template.id),
    paramsByTemplate: Object.fromEntries(
      klineStrategyTemplates.map((template) => [template.id, { ...template.defaultParams }])
    ),
    assumptions: createDefaultKlineBacktestAssumptions(),
    assumptionDefaultsVersion: KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION
  }
}

export function createDefaultKlineBacktestAssumptions(): KlineBacktestAssumptions {
  return {
    initialCapital: DEFAULT_KLINE_STRATEGY_INITIAL_CAPITAL,
    feeRate: DEFAULT_KLINE_BACKTEST_FEE_RATE,
    slippageRate: DEFAULT_KLINE_BACKTEST_SLIPPAGE_RATE
  }
}

export function cloneKlineStrategySettings(settings: KlineStrategySettings): KlineStrategySettings {
  return {
    selectedTemplateIds: [...settings.selectedTemplateIds],
    paramsByTemplate: Object.fromEntries(
      klineStrategyTemplates.map((template) => [
        template.id,
        {
          ...template.defaultParams,
          ...(settings.paramsByTemplate[template.id] ?? {})
        }
      ])
    ),
    assumptions: { ...settings.assumptions },
    assumptionDefaultsVersion:
      settings.assumptionDefaultsVersion ?? KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION
  }
}

export function getKlineStrategyTemplate(
  id: KlineStrategyTemplateId
): KlineStrategyTemplateDefinition {
  const template = templateById.get(id)
  if (!template) {
    throw new Error(`未知策略模板：${id}`)
  }
  return template
}

export function normalizeKlineStrategySettings(
  settings?: KlineStrategySettingsInput | null
): KlineStrategySettings {
  const defaults = createDefaultKlineStrategySettings()
  const selectedTemplateIds = normalizeSelectedTemplateIds(settings?.selectedTemplateIds)
  const assumptions = normalizeKlineBacktestAssumptions(settings?.assumptions)
  const normalizedAssumptions = shouldMigrateLegacyZeroCostAssumptions(settings)
    ? {
        ...assumptions,
        feeRate: DEFAULT_KLINE_BACKTEST_FEE_RATE,
        slippageRate: DEFAULT_KLINE_BACKTEST_SLIPPAGE_RATE
      }
    : assumptions
  return {
    selectedTemplateIds:
      selectedTemplateIds.length > 0 ? selectedTemplateIds : [...defaults.selectedTemplateIds],
    paramsByTemplate: Object.fromEntries(
      klineStrategyTemplates.map((template) => [
        template.id,
        normalizeKlineStrategyParams(template.id, settings?.paramsByTemplate?.[template.id]).params
      ])
    ),
    assumptions: normalizedAssumptions,
    assumptionDefaultsVersion: KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION
  }
}

export function normalizeKlineStrategyParams(
  templateId: KlineStrategyTemplateId,
  params?: Partial<KlineStrategyParams> | null
): { params: KlineStrategyParams; errors: string[] } {
  const template = getKlineStrategyTemplate(templateId)
  const errors: string[] = []
  const normalized: KlineStrategyParams = {}

  template.parameters.forEach((definition) => {
    const rawValue = params?.[definition.key] ?? definition.defaultValue
    const value = Number(rawValue)
    if (!Number.isFinite(value)) {
      normalized[definition.key] = definition.defaultValue
      errors.push(`${definition.label}必须是有效数字`)
      return
    }
    const precision = definition.precision ?? 0
    const rounded = precision === 0 ? Math.round(value) : roundToPrecision(value, precision)
    const clamped = Math.min(definition.max, Math.max(definition.min, rounded))
    normalized[definition.key] = clamped
    if (rounded < definition.min || rounded > definition.max) {
      errors.push(`${definition.label}必须在 ${definition.min} 到 ${definition.max} 之间`)
    }
  })

  errors.push(...validateTemplateParamRelations(templateId, normalized))
  return { params: normalized, errors }
}

export function normalizeKlineBacktestAssumptions(
  assumptions?: Partial<KlineBacktestAssumptions> | null
): KlineBacktestAssumptions {
  return {
    initialCapital: normalizePositiveNumber(
      assumptions?.initialCapital,
      DEFAULT_KLINE_STRATEGY_INITIAL_CAPITAL
    ),
    feeRate: normalizeRate(assumptions?.feeRate, DEFAULT_KLINE_BACKTEST_FEE_RATE),
    slippageRate: normalizeRate(assumptions?.slippageRate, DEFAULT_KLINE_BACKTEST_SLIPPAGE_RATE)
  }
}

export function validateKlineBacktestAssumptions(
  assumptions: KlineBacktestAssumptions
): string[] {
  const errors: string[] = []
  if (!Number.isFinite(assumptions.initialCapital) || assumptions.initialCapital <= 0) {
    errors.push('初始资金必须大于 0')
  }
  if (!Number.isFinite(assumptions.feeRate) || assumptions.feeRate < 0 || assumptions.feeRate > 0.2) {
    errors.push('费用率必须在 0 到 20% 之间')
  }
  if (
    !Number.isFinite(assumptions.slippageRate) ||
    assumptions.slippageRate < 0 ||
    assumptions.slippageRate > 0.2
  ) {
    errors.push('滑点率必须在 0 到 20% 之间')
  }
  return errors
}

export function isKlineStrategySupportedPeriod(period: StockPeriod): period is KlineStrategyPeriod {
  return KLINE_STRATEGY_SUPPORTED_PERIODS.includes(period as KlineStrategyPeriod)
}

export function getKlineStrategyPeriodError(period: StockPeriod): string {
  return isKlineStrategySupportedPeriod(period) ? '' : '策略回测暂不支持分钟 K 线周期'
}

export function runKlineStrategyBacktests(input: {
  dataset: StockDataset
  query: StockQuery
  settings: KlineStrategySettings
}): KlineStrategyComparisonResult {
  const rawSettings = input.settings
  const settings = normalizeKlineStrategySettings(input.settings)
  const assumptions = settings.assumptions
  const candles = input.dataset.candles.filter(
    (candle) => candle.timeKey >= input.query.startDate && candle.timeKey <= input.query.endDate
  )
  const inputErrors = validateBacktestCandles(candles)
  const assumptionErrors = validateKlineBacktestAssumptions(assumptions)
  const periodError = getKlineStrategyPeriodError(input.query.period)

  const results = settings.selectedTemplateIds.map((templateId) => {
    const template = getKlineStrategyTemplate(templateId)
    const normalized = normalizeKlineStrategyParams(templateId, rawSettings.paramsByTemplate[templateId])
    const baseResult = createBaseResult(template, input.query, normalized.params, assumptions, candles)
    const errors = [
      periodError,
      ...inputErrors,
      ...assumptionErrors,
      ...normalized.errors,
      ...getTemplateAvailabilityErrors(template, input.query.period, candles)
    ].filter(Boolean)
    if (errors.length > 0) {
      return {
        ...baseResult,
        unavailableReason: uniqueValues(errors).join('；')
      }
    }

    const signals = generateSignals(template, candles, normalized.params)
    const backtest = executeSignals({
      template,
      query: input.query,
      candles,
      signals,
      assumptions
    })
    if (backtest.metrics.tradeCount === 0) {
      return {
        ...baseResult,
        unavailableReason: '没有已平仓交易，未参与历史表现排名',
        signals,
        trades: backtest.trades,
        equityCurve: backtest.equityCurve,
        metrics: backtest.metrics
      }
    }

    const score =
      backtest.metrics.totalReturn / Math.max(Math.abs(backtest.metrics.maxDrawdown), 0.01)

    return {
      ...baseResult,
      status: 'success' as const,
      signals,
      trades: backtest.trades,
      equityCurve: backtest.equityCurve,
      metrics: backtest.metrics,
      score
    }
  })

  return {
    query: { ...input.query },
    assumptions: { ...assumptions },
    results: rankKlineStrategyResults(results)
  }
}

export function getKlineStrategyDatasetMissingRanges(
  dataset: StockDataset,
  query: StockQuery
): KlineCacheDateRange[] {
  const candleRange = getKlineCacheCandleRange(dataset.candles)
  if (!candleRange) {
    return [{ startDate: query.startDate, endDate: query.endDate }]
  }
  return subtractKlineCacheRanges(
    { startDate: query.startDate, endDate: query.endDate },
    [candleRange]
  ).filter((range) => !isIgnorableStrategyBoundaryGap(range, candleRange, query))
}

export function isKlineStrategyDatasetCoveringQuery(
  dataset: StockDataset,
  query: StockQuery
): boolean {
  return getKlineStrategyDatasetMissingRanges(dataset, query).length === 0
}

function generateSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  return signalGenerators[template.id](template, candles, params)
}

function generateMaCrossSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const closes = candles.map((candle) => candle.close)
  const shortPeriod = params.shortPeriod
  const longPeriod = params.longPeriod
  const shortMa = calculateMovingAverage(closes, shortPeriod)
  const longMa = calculateMovingAverage(closes, longPeriod)
  const signals: KlineStrategySignal[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const previousShort = shortMa[index - 1]
    const previousLong = longMa[index - 1]
    const currentShort = shortMa[index]
    const currentLong = longMa[index]
    if (
      previousShort === undefined ||
      previousLong === undefined ||
      currentShort === undefined ||
      currentLong === undefined
    ) {
      continue
    }
    if (previousShort <= previousLong && currentShort > currentLong) {
      signals.push(
        createSignal(template, candles[index], 'buy', `短期均线上穿长期均线`, {
          shortMa: currentShort,
          longMa: currentLong
        })
      )
    } else if (previousShort >= previousLong && currentShort < currentLong) {
      signals.push(
        createSignal(template, candles[index], 'sell', `短期均线下穿长期均线`, {
          shortMa: currentShort,
          longMa: currentLong
        })
      )
    }
  }
  return signals
}

function generateBreakoutPullbackSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const lookbackPeriod = params.lookbackPeriod
  const exitPeriod = params.exitPeriod
  const closes = candles.map((candle) => candle.close)
  const exitMa = calculateMovingAverage(closes, exitPeriod)
  const signals: KlineStrategySignal[] = []

  for (let index = 1; index < candles.length; index += 1) {
    if (index < lookbackPeriod) {
      continue
    }
    const previousWindow = candles.slice(index - lookbackPeriod, index)
    const previousHigh = Math.max(...previousWindow.map((candle) => candle.high))
    const previousClose = candles[index - 1].close
    const current = candles[index]
    const currentExitMa = exitMa[index]
    if (previousClose <= previousHigh && current.close > previousHigh) {
      signals.push(
        createSignal(template, current, 'buy', `收盘价突破 ${lookbackPeriod} 根 K 线高点`, {
          previousHigh,
          close: current.close
        })
      )
    } else if (currentExitMa !== undefined && current.close < currentExitMa) {
      signals.push(
        createSignal(template, current, 'sell', `收盘价跌破退出均线`, {
          exitMa: currentExitMa,
          close: current.close
        })
      )
    }
  }
  return signals
}

function generateRsiReversionSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const rsi = calculateRsi(candles.map((candle) => candle.close), params.period)
  const signals: KlineStrategySignal[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const previousRsi = rsi[index - 1]
    const currentRsi = rsi[index]
    if (previousRsi === undefined || currentRsi === undefined) {
      continue
    }
    if (previousRsi < params.oversold && currentRsi >= params.oversold) {
      signals.push(
        createSignal(template, candles[index], 'buy', `RSI 从超卖区间修复`, {
          rsi: currentRsi
        })
      )
    } else if (previousRsi < params.overbought && currentRsi >= params.overbought) {
      signals.push(
        createSignal(template, candles[index], 'sell', `RSI 进入超买区间`, {
          rsi: currentRsi
        })
      )
    }
  }
  return signals
}

function generateMacdTrendSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const macd = calculateMacd(candles.map((candle) => candle.close), params)
  const signals: KlineStrategySignal[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const previous = macd[index - 1]
    const current = macd[index]
    if (!previous || !current) {
      continue
    }
    if (previous.dif <= previous.dea && current.dif > current.dea && current.dif > 0) {
      signals.push(
        createSignal(template, candles[index], 'buy', `DIF 在零轴上方上穿 DEA`, {
          dif: current.dif,
          dea: current.dea,
          macd: current.macd
        })
      )
    } else if (previous.dif >= previous.dea && current.dif < current.dea) {
      signals.push(
        createSignal(template, candles[index], 'sell', `DIF 下穿 DEA`, {
          dif: current.dif,
          dea: current.dea,
          macd: current.macd
        })
      )
    }
  }
  return signals
}

function generateMaBullishAlignmentSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const closes = candles.map((candle) => candle.close)
  const fastMa = calculateMovingAverage(closes, params.fastPeriod)
  const shortMa = calculateMovingAverage(closes, params.shortPeriod)
  const mediumMa = calculateMovingAverage(closes, params.mediumPeriod)
  const longMa = calculateMovingAverage(closes, params.longPeriod)
  const signals: KlineStrategySignal[] = []

  for (let index = 1; index < candles.length; index += 1) {
    const previousAligned = isMaBullishAligned(index - 1, fastMa, shortMa, mediumMa, longMa)
    const currentAligned = isMaBullishAligned(index, fastMa, shortMa, mediumMa, longMa)
    const currentFast = fastMa[index]
    const currentShort = shortMa[index]
    const currentMedium = mediumMa[index]
    const currentLong = longMa[index]
    if (
      currentFast === undefined ||
      currentShort === undefined ||
      currentMedium === undefined ||
      currentLong === undefined
    ) {
      continue
    }
    if (!previousAligned && currentAligned) {
      signals.push(
        createSignal(template, candles[index], 'buy', '均线多头排列首次成立', {
          fastMa: currentFast,
          shortMa: currentShort,
          mediumMa: currentMedium,
          longMa: currentLong
        })
      )
    } else if (previousAligned && (!currentAligned || currentFast < currentMedium)) {
      signals.push(
        createSignal(template, candles[index], 'sell', '均线多头排列失效', {
          fastMa: currentFast,
          shortMa: currentShort,
          mediumMa: currentMedium,
          longMa: currentLong
        })
      )
    }
  }
  return signals
}

function generateNDayHighBreakoutSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const lookbackPeriod = params.lookbackPeriod
  const exitMa = calculateMovingAverage(candles.map((candle) => candle.close), params.exitPeriod)
  const signals: KlineStrategySignal[] = []
  let breakoutLevel: number | undefined

  for (let index = 1; index < candles.length; index += 1) {
    if (index < lookbackPeriod) {
      continue
    }
    const current = candles[index]
    const previousHigh = maxHigh(candles.slice(index - lookbackPeriod, index))
    const currentExitMa = exitMa[index]
    if (breakoutLevel === undefined && candles[index - 1].close <= previousHigh && current.close > previousHigh) {
      breakoutLevel = previousHigh
      signals.push(
        createSignal(template, current, 'buy', `收盘价突破过去 ${lookbackPeriod} 根 K 线最高价`, {
          previousHigh,
          close: current.close,
          exitMa: currentExitMa ?? Number.NaN
        })
      )
    } else if (
      breakoutLevel !== undefined &&
      currentExitMa !== undefined &&
      (current.close < currentExitMa || current.close < breakoutLevel)
    ) {
      signals.push(
        createSignal(template, current, 'sell', '收盘价跌破退出均线或突破价', {
          breakoutLevel,
          exitMa: currentExitMa,
          close: current.close
        })
      )
      breakoutLevel = undefined
    }
  }
  return signals
}

function generateVolumeBreakoutSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const closes = candles.map((candle) => candle.close)
  const volumes = candles.map((candle) => candle.volume)
  const volumeMa = calculateMovingAverage(volumes, params.volumeMaPeriod)
  const exitMa = calculateMovingAverage(closes, params.exitPeriod)
  const signals: KlineStrategySignal[] = []
  let breakoutLevel: number | undefined

  for (let index = 1; index < candles.length; index += 1) {
    if (index < params.resistancePeriod) {
      continue
    }
    const current = candles[index]
    const resistance = maxHigh(candles.slice(index - params.resistancePeriod, index))
    const previousVolumeMa = volumeMa[index - 1]
    const currentVolumeMa = volumeMa[index]
    const currentExitMa = exitMa[index]
    if (
      breakoutLevel === undefined &&
      previousVolumeMa !== undefined &&
      candles[index - 1].close <= resistance &&
      current.close > resistance &&
      current.volume >= previousVolumeMa * params.volumeMultiplier
    ) {
      breakoutLevel = resistance
      signals.push(
        createSignal(template, current, 'buy', '突破压力位且成交量明显放大', {
          resistance,
          volume: current.volume,
          volumeMa: previousVolumeMa,
          volumeMultiplier: current.volume / previousVolumeMa
        })
      )
    } else if (
      breakoutLevel !== undefined &&
      currentExitMa !== undefined &&
      (current.close < currentExitMa || current.close < breakoutLevel)
    ) {
      signals.push(
        createSignal(template, current, 'sell', '收盘价跌破退出均线或突破位', {
          resistance: breakoutLevel,
          breakoutLevel,
          exitMa: currentExitMa,
          close: current.close,
          volume: current.volume,
          volumeMa: currentVolumeMa ?? Number.NaN,
          volumeMultiplier:
            currentVolumeMa !== undefined ? current.volume / currentVolumeMa : Number.NaN
        })
      )
      breakoutLevel = undefined
    }
  }
  return signals
}

function generateBollingerBreakoutSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const boll = calculateBoll(candles.map((candle) => candle.close), params.period, params.deviation)
  const signals: KlineStrategySignal[] = []
  let active = false

  for (let index = 1; index < candles.length; index += 1) {
    const previous = boll[index - 1]
    const current = boll[index]
    if (!previous || !current) {
      continue
    }
    const candle = candles[index]
    if (!active && candles[index - 1].close <= previous.upper && candle.close > current.upper) {
      active = true
      signals.push(
        createSignal(template, candle, 'buy', '收盘价向上突破 Bollinger 上轨', {
          upper: current.upper,
          mid: current.mid,
          close: candle.close
        })
      )
    } else if (active && (candle.close < current.mid || candle.close < current.upper)) {
      active = false
      signals.push(
        createSignal(template, candle, 'sell', '收盘价跌回 Bollinger 中轨或上轨突破失效', {
          upper: current.upper,
          mid: current.mid,
          close: candle.close
        })
      )
    }
  }
  return signals
}

function generateBollingerMeanReversionSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const boll = calculateBoll(candles.map((candle) => candle.close), params.period, params.deviation)
  const signals: KlineStrategySignal[] = []
  let sawBelowLower = false
  let active = false

  for (let index = 1; index < candles.length; index += 1) {
    const current = boll[index]
    if (!current) {
      continue
    }
    const candle = candles[index]
    if (!active && candle.close < current.lower) {
      sawBelowLower = true
      continue
    }
    if (!active && sawBelowLower && candle.close >= current.lower && candle.close <= current.upper) {
      active = true
      sawBelowLower = false
      signals.push(
        createSignal(template, candle, 'buy', '跌破下轨后重新回到 Bollinger 通道', {
          lower: current.lower,
          mid: current.mid,
          close: candle.close
        })
      )
    } else if (active && candle.close >= current.mid) {
      active = false
      signals.push(
        createSignal(template, candle, 'sell', '收盘价回到 Bollinger 中轨', {
          lower: current.lower,
          mid: current.mid,
          close: candle.close
        })
      )
    }
  }
  return signals
}

function generateKdjOversoldReboundSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const kdj = calculateKdj(candles, params)
  const signals: KlineStrategySignal[] = []
  let active = false

  for (let index = 1; index < candles.length; index += 1) {
    const previous = kdj[index - 1]
    const current = kdj[index]
    if (!previous || !current) {
      continue
    }
    const currentLowArea = current.k <= params.oversold && current.d <= params.oversold
    if (!active && currentLowArea && previous.k <= previous.d && current.k > current.d) {
      active = true
      signals.push(
        createSignal(template, candles[index], 'buy', 'K/D 低位金叉', {
          k: current.k,
          d: current.d,
          oversold: params.oversold
        })
      )
    } else if (
      active &&
      ((previous.k >= previous.d && current.k < current.d) ||
        (previous.k >= params.overbought && current.k < previous.k))
    ) {
      active = false
      signals.push(
        createSignal(template, candles[index], 'sell', 'K/D 死叉或高位回落', {
          k: current.k,
          d: current.d,
          overbought: params.overbought
        })
      )
    }
  }
  return signals
}

function generateAtrTrendFollowingSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const closes = candles.map((candle) => candle.close)
  const trendMa = calculateMovingAverage(closes, params.trendPeriod)
  const atr = calculateAtr(candles, params.atrPeriod)
  const signals: KlineStrategySignal[] = []
  let trailingStop: number | undefined

  for (let index = 1; index < candles.length; index += 1) {
    const previousTrendMa = trendMa[index - 1]
    const currentTrendMa = trendMa[index]
    const currentAtr = atr[index]
    if (previousTrendMa === undefined || currentTrendMa === undefined || currentAtr === undefined) {
      continue
    }
    const candle = candles[index]
    const trendActive = candle.close > currentTrendMa && currentTrendMa >= previousTrendMa
    const stopReference = candle.close - currentAtr * params.atrMultiplier
    if (trailingStop === undefined && trendActive) {
      trailingStop = stopReference
      signals.push(
        createSignal(template, candle, 'buy', '趋势过滤成立且收盘价站上 ATR 动态止损参考', {
          atr: currentAtr,
          stopReference,
          trendMa: currentTrendMa
        })
      )
    } else if (trailingStop !== undefined) {
      trailingStop = Math.max(trailingStop, stopReference)
      if (candle.close < trailingStop || candle.close < currentTrendMa) {
        signals.push(
          createSignal(template, candle, 'sell', '收盘价跌破 ATR 动态止损参考或趋势过滤失效', {
            atr: currentAtr,
            stopReference: trailingStop,
            trendMa: currentTrendMa,
            close: candle.close
          })
        )
        trailingStop = undefined
      }
    }
  }
  return signals
}

function generateLowVolumeMaPullbackSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  const closes = candles.map((candle) => candle.close)
  const volumes = candles.map((candle) => candle.volume)
  const trendMa = calculateMovingAverage(closes, params.trendPeriod)
  const supportMa = calculateMovingAverage(closes, params.supportPeriod)
  const volumeMa = calculateMovingAverage(volumes, params.volumeMaPeriod)
  const toleranceRate = params.tolerancePercent / 100
  const signals: KlineStrategySignal[] = []
  let sawPullback = false
  let active = false

  for (let index = 1; index < candles.length; index += 1) {
    const currentTrendMa = trendMa[index]
    const currentSupportMa = supportMa[index]
    const currentVolumeMa = volumeMa[index]
    if (
      currentTrendMa === undefined ||
      currentSupportMa === undefined ||
      currentVolumeMa === undefined
    ) {
      continue
    }
    const current = candles[index]
    const uptrend = current.close > currentTrendMa && currentSupportMa > currentTrendMa
    const nearSupport =
      isNearMovingAverage(current, currentSupportMa, toleranceRate) ||
      isNearMovingAverage(current, currentTrendMa, toleranceRate)
    const lowVolume = current.volume <= currentVolumeMa * params.volumeRatio
    if (!active && uptrend && nearSupport && lowVolume) {
      sawPullback = true
      continue
    }
    if (!active && sawPullback && uptrend && current.close > candles[index - 1].high) {
      active = true
      sawPullback = false
      signals.push(
        createSignal(template, current, 'buy', '上涨趋势中缩量回踩均线后重新走强', {
          trendMa: currentTrendMa,
          supportMa: currentSupportMa,
          volume: current.volume,
          volumeMa: currentVolumeMa
        })
      )
    } else if (active && (current.close < currentSupportMa || currentSupportMa < currentTrendMa)) {
      active = false
      signals.push(
        createSignal(template, current, 'sell', '收盘价跌破支撑均线或上涨趋势失效', {
          trendMa: currentTrendMa,
          supportMa: currentSupportMa,
          close: current.close,
          volume: current.volume,
          volumeMa: currentVolumeMa
        })
      )
    }
  }
  return signals
}

type KlineStrategySignalGenerator = (
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
) => KlineStrategySignal[]

const signalGenerators: Record<KlineStrategyTemplateId, KlineStrategySignalGenerator> = {
  'ma-cross': generateMaCrossSignals,
  'breakout-pullback': generateBreakoutPullbackSignals,
  'rsi-reversion': generateRsiReversionSignals,
  'macd-trend-confirmation': generateMacdTrendSignals,
  'ma-bullish-alignment': generateMaBullishAlignmentSignals,
  'n-day-high-breakout': generateNDayHighBreakoutSignals,
  'volume-breakout': generateVolumeBreakoutSignals,
  'bollinger-breakout': generateBollingerBreakoutSignals,
  'bollinger-mean-reversion': generateBollingerMeanReversionSignals,
  'kdj-oversold-rebound': generateKdjOversoldReboundSignals,
  'atr-trend-following': generateAtrTrendFollowingSignals,
  'low-volume-ma-pullback': generateLowVolumeMaPullbackSignals
}

function executeSignals(input: {
  template: KlineStrategyTemplateDefinition
  query: StockQuery
  candles: StockCandle[]
  signals: KlineStrategySignal[]
  assumptions: KlineBacktestAssumptions
}): {
  trades: KlineStrategyTrade[]
  equityCurve: KlineStrategyEquityPoint[]
  metrics: KlineStrategyMetrics
} {
  const signalByTimeKey = new Map(input.signals.map((signal) => [signal.timeKey, signal]))
  const trades: KlineStrategyTrade[] = []
  const equityCurve: KlineStrategyEquityPoint[] = []
  let cash = input.assumptions.initialCapital
  let peakEquity = input.assumptions.initialCapital
  let maxDrawdown = 0
  let position: {
    shares: number
    entryPrice: number
    entryIndex: number
    entryCash: number
    entrySignal: KlineStrategySignal
    tradeId: string
  } | null = null

  for (let index = 0; index < input.candles.length; index += 1) {
    const candle = input.candles[index]
    const previousSignal = index > 0 ? signalByTimeKey.get(input.candles[index - 1].timeKey) : undefined
    if (previousSignal?.side === 'buy' && !position) {
      const entryPrice = candle.open * (1 + input.assumptions.slippageRate)
      const shares = cash / (entryPrice * (1 + input.assumptions.feeRate))
      position = {
        shares,
        entryPrice,
        entryIndex: index,
        entryCash: cash,
        entrySignal: previousSignal,
        tradeId: `${input.template.id}-${trades.length + 1}`
      }
      cash = 0
    } else if (previousSignal?.side === 'sell' && position) {
      const exitPrice = candle.open * (1 - input.assumptions.slippageRate)
      const gross = position.shares * exitPrice
      const fee = gross * input.assumptions.feeRate
      const nextCash = gross - fee
      const profit = nextCash - position.entryCash
      trades.push({
        id: position.tradeId,
        templateId: input.template.id,
        entryTimeKey: input.candles[position.entryIndex].timeKey,
        entryTimestamp: input.candles[position.entryIndex].timestamp,
        entryPrice: position.entryPrice,
        entrySignal: position.entrySignal,
        exitTimeKey: candle.timeKey,
        exitTimestamp: candle.timestamp,
        exitPrice,
        exitSignal: previousSignal,
        holdingBars: index - position.entryIndex,
        profit,
        returnRate: profit / position.entryCash,
        closed: true
      })
      cash = nextCash
      position = null
    }

    const equity = position ? position.shares * candle.close : cash
    peakEquity = Math.max(peakEquity, equity)
    const drawdown = peakEquity > 0 ? equity / peakEquity - 1 : 0
    maxDrawdown = Math.min(maxDrawdown, drawdown)
    equityCurve.push({
      timeKey: candle.timeKey,
      timestamp: candle.timestamp,
      equity,
      drawdown
    })
  }

  const finalCandle = input.candles.at(-1)
  if (position && finalCandle) {
    const finalEquity = position.shares * finalCandle.close
    const profit = finalEquity - position.entryCash
    trades.push({
      id: position.tradeId,
      templateId: input.template.id,
      entryTimeKey: input.candles[position.entryIndex].timeKey,
      entryTimestamp: input.candles[position.entryIndex].timestamp,
      entryPrice: position.entryPrice,
      entrySignal: position.entrySignal,
      holdingBars: input.candles.length - 1 - position.entryIndex,
      profit,
      returnRate: profit / position.entryCash,
      closed: false
    })
  }

  const finalEquity = equityCurve.at(-1)?.equity ?? input.assumptions.initialCapital
  return {
    trades,
    equityCurve,
    metrics: calculateMetrics({
      candles: input.candles,
      trades,
      equityCurve,
      assumptions: input.assumptions,
      period: input.query.period as KlineStrategyPeriod,
      maxDrawdown,
      finalEquity
    })
  }
}

function calculateMetrics(input: {
  candles: StockCandle[]
  trades: KlineStrategyTrade[]
  equityCurve: KlineStrategyEquityPoint[]
  assumptions: KlineBacktestAssumptions
  period: KlineStrategyPeriod
  maxDrawdown: number
  finalEquity: number
}): KlineStrategyMetrics {
  const closedTrades = input.trades.filter((trade) => trade.closed)
  const wins = closedTrades.filter((trade) => trade.profit > 0)
  const losses = closedTrades.filter((trade) => trade.profit < 0)
  const totalProfit = wins.reduce((sum, trade) => sum + trade.profit, 0)
  const totalLoss = losses.reduce((sum, trade) => sum + Math.abs(trade.profit), 0)
  const totalReturn = input.finalEquity / input.assumptions.initialCapital - 1
  const firstClose = input.candles[0]?.close ?? 0
  const lastClose = input.candles.at(-1)?.close ?? firstClose
  return {
    totalReturn,
    annualizedReturn: calculateAnnualizedReturn(totalReturn, input.candles.length, input.period),
    maxDrawdown: input.maxDrawdown,
    winRate: closedTrades.length > 0 ? wins.length / closedTrades.length : undefined,
    tradeCount: closedTrades.length,
    profitLossRatio: totalProfit > 0 && totalLoss > 0 ? totalProfit / totalLoss : undefined,
    averageHoldingBars:
      closedTrades.length > 0
        ? closedTrades.reduce((sum, trade) => sum + trade.holdingBars, 0) / closedTrades.length
        : undefined,
    finalEquity: input.finalEquity,
    benchmarkReturn: firstClose > 0 ? lastClose / firstClose - 1 : 0
  }
}

function rankKlineStrategyResults(
  results: KlineStrategyBacktestResult[]
): KlineStrategyBacktestResult[] {
  const rankable = results
    .filter((result) => result.status === 'success' && result.score !== undefined && (result.metrics?.tradeCount ?? 0) > 0)
    .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))

  const rankById = new Map(rankable.map((result, index) => [result.id, index + 1]))
  return results.map((result) => ({
    ...result,
    rank: rankById.get(result.id)
  }))
}

function createBaseResult(
  template: KlineStrategyTemplateDefinition,
  query: StockQuery,
  params: KlineStrategyParams,
  assumptions: KlineBacktestAssumptions,
  candles: StockCandle[]
): KlineStrategyBacktestResult {
  return {
    id: template.id,
    status: 'unavailable',
    templateId: template.id,
    templateName: template.name,
    description: template.description,
    query: { ...query },
    params: { ...params },
    assumptions: { ...assumptions },
    dataStartDate: candles[0]?.timeKey,
    dataEndDate: candles.at(-1)?.timeKey,
    signals: [],
    trades: [],
    equityCurve: []
  }
}

function createSignal(
  template: KlineStrategyTemplateDefinition,
  candle: StockCandle,
  side: SignalSide,
  explanation: string,
  indicatorValues: Record<string, number>
): KlineStrategySignal {
  const finiteIndicatorValues = Object.fromEntries(
    Object.entries(indicatorValues).filter(([, value]) => Number.isFinite(value))
  )
  return {
    side,
    timeKey: candle.timeKey,
    timestamp: candle.timestamp,
    price: side === 'buy' ? candle.low : candle.high,
    templateId: template.id,
    templateName: template.name,
    explanation: formatSignalExplanation(explanation, finiteIndicatorValues),
    indicatorValues: finiteIndicatorValues
  }
}

function formatSignalExplanation(
  explanation: string,
  indicatorValues: Record<string, number>
): string {
  const details = Object.entries(indicatorValues)
    .map(([key, value]) => `${signalIndicatorValueLabels[key] ?? key} ${formatSignalValue(value)}`)
    .join('，')
  return details ? `${explanation}（${details}）` : explanation
}

const signalIndicatorValueLabels: Record<string, string> = {
  atr: 'ATR',
  breakoutLevel: '突破参考位',
  close: '收盘价',
  d: 'D',
  exitMa: '退出参考',
  fastMa: '快速均线',
  k: 'K',
  longMa: '长期均线',
  lower: '下轨',
  mediumMa: '中期均线',
  mid: '中轨',
  overbought: '高位阈值',
  oversold: '超卖阈值',
  previousHigh: '观察窗口高点',
  resistance: '压力位',
  shortMa: '短期均线',
  stopReference: '动态止损参考',
  supportMa: '支撑均线',
  trendMa: '趋势均线',
  upper: '上轨',
  volume: '成交量',
  volumeMa: '成交量均线',
  volumeMultiplier: '放量倍数'
}

function formatSignalValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value)
  }
  return value.toFixed(2)
}

function getTemplateAvailabilityErrors(
  template: KlineStrategyTemplateDefinition,
  period: StockPeriod,
  candles: StockCandle[]
): string[] {
  const errors: string[] = []
  if (!template.compatiblePeriods.includes(period as KlineStrategyPeriod)) {
    errors.push('策略模板不兼容当前周期')
  }
  if (candles.length < template.minSampleSize) {
    errors.push(`样本不足，至少需要 ${template.minSampleSize} 根 K 线`)
  }
  return errors
}

function validateBacktestCandles(candles: StockCandle[]): string[] {
  if (candles.length === 0) {
    return ['回测区间没有 K 线数据']
  }
  const errors: string[] = []
  const seen = new Set<string>()
  candles.forEach((candle, index) => {
    if (seen.has(candle.timeKey)) {
      errors.push(`存在重复 K 线：${candle.timeKey}`)
    }
    seen.add(candle.timeKey)
    if (index > 0 && candle.timeKey <= candles[index - 1].timeKey) {
      errors.push('K 线必须按时间升序排列')
    }
    if (
      !Number.isFinite(candle.open) ||
      !Number.isFinite(candle.high) ||
      !Number.isFinite(candle.low) ||
      !Number.isFinite(candle.close)
    ) {
      errors.push(`K 线价格字段无效：${candle.timeKey}`)
    }
  })
  return uniqueValues(errors)
}

function isMaBullishAligned(
  index: number,
  fastMa: Array<number | undefined>,
  shortMa: Array<number | undefined>,
  mediumMa: Array<number | undefined>,
  longMa: Array<number | undefined>
): boolean {
  const fast = fastMa[index]
  const short = shortMa[index]
  const medium = mediumMa[index]
  const long = longMa[index]
  return (
    fast !== undefined &&
    short !== undefined &&
    medium !== undefined &&
    long !== undefined &&
    fast > short &&
    short > medium &&
    medium > long
  )
}

function maxHigh(candles: StockCandle[]): number {
  return Math.max(...candles.map((candle) => candle.high))
}

function isNearMovingAverage(
  candle: StockCandle,
  movingAverage: number,
  toleranceRate: number
): boolean {
  return (
    candle.low <= movingAverage * (1 + toleranceRate) &&
    candle.close >= movingAverage * (1 - toleranceRate)
  )
}

function calculateRsi(values: number[], period: number): Array<number | undefined> {
  if (period <= 0 || values.length === 0) {
    return []
  }
  const result: Array<number | undefined> = Array(values.length).fill(undefined)
  let gainSum = 0
  let lossSum = 0

  for (let index = 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1]
    const gain = Math.max(change, 0)
    const loss = Math.max(-change, 0)
    if (index <= period) {
      gainSum += gain
      lossSum += loss
      if (index === period) {
        result[index] = toRsi(gainSum / period, lossSum / period)
      }
      continue
    }
    gainSum = (gainSum * (period - 1)) / period + gain
    lossSum = (lossSum * (period - 1)) / period + loss
    result[index] = toRsi(gainSum / period, lossSum / period)
  }
  return result
}

function calculateMacd(
  values: number[],
  params: KlineStrategyParams
): Array<{ dif: number; dea: number; macd: number } | undefined> {
  const fast = calculateEma(values, params.fastPeriod)
  const slow = calculateEma(values, params.slowPeriod)
  const dif = values.map((_, index) => fast[index] - slow[index])
  const dea = calculateEma(dif, params.signalPeriod)
  return values.map((_, index) =>
    index >= params.slowPeriod
      ? {
          dif: dif[index],
          dea: dea[index],
          macd: (dif[index] - dea[index]) * 2
        }
      : undefined
  )
}

function calculateKdj(
  candles: StockCandle[],
  params: KlineStrategyParams
): Array<{ k: number; d: number; j: number; rsv: number } | undefined> {
  const result: Array<{ k: number; d: number; j: number; rsv: number } | undefined> = Array(
    candles.length
  ).fill(undefined)
  let previousK = 50
  let previousD = 50

  for (let index = 0; index < candles.length; index += 1) {
    if (index < params.rsvPeriod - 1) {
      continue
    }
    const window = candles.slice(index - params.rsvPeriod + 1, index + 1)
    const lowestLow = Math.min(...window.map((candle) => candle.low))
    const highestHigh = Math.max(...window.map((candle) => candle.high))
    const range = highestHigh - lowestLow
    const rsv = range > 0 ? ((candles[index].close - lowestLow) / range) * 100 : 50
    const k = ((params.kSmoothing - 1) * previousK + rsv) / params.kSmoothing
    const d = ((params.dSmoothing - 1) * previousD + k) / params.dSmoothing
    result[index] = {
      k,
      d,
      j: 3 * k - 2 * d,
      rsv
    }
    previousK = k
    previousD = d
  }

  return result
}

function calculateAtr(candles: StockCandle[], period: number): Array<number | undefined> {
  const trueRanges = candles.map((candle, index) => {
    if (index === 0) {
      return candle.high - candle.low
    }
    const previousClose = candles[index - 1].close
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose)
    )
  })
  return calculateMovingAverage(trueRanges, period)
}

function toRsi(averageGain: number, averageLoss: number): number {
  if (averageLoss === 0) {
    return 100
  }
  const relativeStrength = averageGain / averageLoss
  return 100 - 100 / (1 + relativeStrength)
}

function validateTemplateParamRelations(
  templateId: KlineStrategyTemplateId,
  params: KlineStrategyParams
): string[] {
  return templateParamRelationValidators[templateId]?.(params) ?? []
}

type KlineStrategyParamRelationValidator = (params: KlineStrategyParams) => string[]

const templateParamRelationValidators: Partial<
  Record<KlineStrategyTemplateId, KlineStrategyParamRelationValidator>
> = {
  'ma-cross': (params) =>
    params.shortPeriod >= params.longPeriod ? ['短期均线必须小于长期均线'] : [],
  'rsi-reversion': (params) =>
    params.oversold >= params.overbought ? ['超卖阈值必须小于超买阈值'] : [],
  'macd-trend-confirmation': (params) =>
    params.fastPeriod >= params.slowPeriod ? ['快线 EMA 必须小于慢线 EMA'] : [],
  'ma-bullish-alignment': (params) =>
    params.fastPeriod < params.shortPeriod &&
    params.shortPeriod < params.mediumPeriod &&
    params.mediumPeriod < params.longPeriod
      ? []
      : ['均线周期必须满足快速 < 短期 < 中期 < 长期'],
  'n-day-high-breakout': (params) =>
    params.exitPeriod >= params.lookbackPeriod ? ['退出均线周期必须小于突破观察周期'] : [],
  'volume-breakout': (params) =>
    params.exitPeriod >= params.resistancePeriod ? ['退出均线周期必须小于突破观察周期'] : [],
  'kdj-oversold-rebound': (params) =>
    params.oversold >= params.overbought ? ['超卖阈值必须小于高位阈值'] : [],
  'low-volume-ma-pullback': (params) =>
    params.supportPeriod >= params.trendPeriod ? ['支撑均线周期必须小于趋势均线周期'] : []
}

function normalizeSelectedTemplateIds(values: unknown): KlineStrategyTemplateId[] {
  if (!Array.isArray(values)) {
    return []
  }
  const ids = new Set(klineStrategyTemplates.map((template) => template.id))
  const selected: KlineStrategyTemplateId[] = []
  values.forEach((value) => {
    if (ids.has(value as KlineStrategyTemplateId) && !selected.includes(value as KlineStrategyTemplateId)) {
      selected.push(value as KlineStrategyTemplateId)
    }
  })
  return selected
}

function normalizePositiveNumber(value: unknown, fallback: number): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : fallback
}

function normalizeRate(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) {
    return fallback
  }
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return fallback
  }
  return Math.min(numberValue, 0.2)
}

function isIgnorableStrategyBoundaryGap(
  range: KlineCacheDateRange,
  candleRange: KlineCacheDateRange,
  query: StockQuery
): boolean {
  const toleranceDays = getStrategyBoundaryToleranceDays(query.period)
  const isLeadingGap = range.startDate === query.startDate && range.endDate < candleRange.startDate
  if (isLeadingGap) {
    return (
      candleRange.startDate <= addDays(query.startDate, toleranceDays) &&
      isNaturalStrategyBoundaryGap(range, candleRange.startDate, query.period, 'leading')
    )
  }
  const isTrailingGap = range.endDate === query.endDate && range.startDate > candleRange.endDate
  if (isTrailingGap) {
    return (
      candleRange.endDate >= addDays(query.endDate, -toleranceDays) &&
      isNaturalStrategyBoundaryGap(range, candleRange.endDate, query.period, 'trailing')
    )
  }
  return false
}

function isNaturalStrategyBoundaryGap(
  range: KlineCacheDateRange,
  candleDate: string,
  period: StockPeriod,
  side: 'leading' | 'trailing'
): boolean {
  if (period === 'day') {
    return true
  }
  if (period === 'week') {
    return side === 'leading'
      ? candleDate <= weekEndOnOrAfter(range.startDate)
      : candleDate >= weekEndOnOrBefore(range.endDate)
  }
  if (period === 'month') {
    return side === 'leading'
      ? candleDate <= monthEndOnOrAfter(range.startDate)
      : candleDate >= monthEndOnOrBefore(range.endDate)
  }
  return false
}

function weekEndOnOrAfter(dateKey: string): string {
  const day = dateFromKey(dateKey).getUTCDay()
  const daysUntilFriday = day <= 5 ? 5 - day : 6
  return addDays(dateKey, daysUntilFriday)
}

function weekEndOnOrBefore(dateKey: string): string {
  const day = dateFromKey(dateKey).getUTCDay()
  const daysSinceFriday = day >= 5 ? day - 5 : day + 2
  return addDays(dateKey, -daysSinceFriday)
}

function monthEndOnOrAfter(dateKey: string): string {
  const date = dateFromKey(dateKey)
  return formatUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)))
}

function monthEndOnOrBefore(dateKey: string): string {
  const date = dateFromKey(dateKey)
  const currentMonthEnd = monthEndOnOrAfter(dateKey)
  if (dateKey >= currentMonthEnd) {
    return currentMonthEnd
  }
  return formatUtcDateKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0)))
}

function getStrategyBoundaryToleranceDays(period: StockPeriod): number {
  if (period === 'month') {
    return 45
  }
  if (period === 'week') {
    return 14
  }
  return 10
}

function dateFromKey(dateKey: string): Date {
  return new Date(
    Date.UTC(
      Number(dateKey.slice(0, 4)),
      Number(dateKey.slice(4, 6)) - 1,
      Number(dateKey.slice(6, 8))
    )
  )
}

function formatUtcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('')
}

function shouldMigrateLegacyZeroCostAssumptions(
  settings?: KlineStrategySettingsInput | null
): boolean {
  if (
    !settings?.assumptions ||
    settings.assumptionDefaultsVersion === KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION
  ) {
    return false
  }
  return (
    Number(settings.assumptions.initialCapital) === DEFAULT_KLINE_STRATEGY_INITIAL_CAPITAL &&
    Number(settings.assumptions.feeRate) === 0 &&
    Number(settings.assumptions.slippageRate) === 0
  )
}

function calculateAnnualizedReturn(
  totalReturn: number,
  barCount: number,
  period: KlineStrategyPeriod
): number {
  if (barCount <= 0 || totalReturn <= -1) {
    return 0
  }
  const periodsPerYear: Record<KlineStrategyPeriod, number> = {
    day: 252,
    week: 52,
    month: 12
  }
  return (1 + totalReturn) ** (periodsPerYear[period] / barCount) - 1
}

function roundToPrecision(value: number, precision: number): number {
  const factor = 10 ** precision
  return Math.round(value * factor) / factor
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values))
}
