import type {
  KlineBacktestAssumptions,
  KlineStrategyBacktestResult,
  KlineStrategyComparisonResult,
  KlineStrategyDateRange,
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
import { calculateEma, calculateMovingAverage } from './indicator-engine'

export const KLINE_STRATEGY_SUPPORTED_PERIODS: KlineStrategyPeriod[] = ['day', 'week', 'month']
export const DEFAULT_KLINE_STRATEGY_INITIAL_CAPITAL = 100000
export const DEFAULT_KLINE_BACKTEST_FEE_RATE = 0.0005
export const DEFAULT_KLINE_BACKTEST_SLIPPAGE_RATE = 0.0002
export const KLINE_BACKTEST_ASSUMPTION_DEFAULTS_VERSION = 1

export const klineStrategyTemplates: KlineStrategyTemplateDefinition[] = [
  {
    id: 'ma-cross',
    name: '均线交叉',
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
  }
]

const templateById = new Map(klineStrategyTemplates.map((template) => [template.id, template]))

type KlineStrategySettingsInput = Partial<
  Omit<KlineStrategySettings, 'assumptions' | 'dateRange' | 'assumptionDefaultsVersion'>
> & {
  assumptions?: Partial<KlineBacktestAssumptions> | null
  dateRange?: Partial<KlineStrategyDateRange> | null
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
    ...(settings.dateRange
      ? {
          dateRange: { ...settings.dateRange }
        }
      : {}),
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
  const dateRange = normalizeKlineStrategyDateRange(settings?.dateRange)
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
    ...(dateRange ? { dateRange } : {}),
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

function generateSignals(
  template: KlineStrategyTemplateDefinition,
  candles: StockCandle[],
  params: KlineStrategyParams
): KlineStrategySignal[] {
  if (template.id === 'ma-cross') {
    return generateMaCrossSignals(template, candles, params)
  }
  if (template.id === 'breakout-pullback') {
    return generateBreakoutPullbackSignals(template, candles, params)
  }
  if (template.id === 'rsi-reversion') {
    return generateRsiReversionSignals(template, candles, params)
  }
  return generateMacdTrendSignals(template, candles, params)
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
  return {
    side,
    timeKey: candle.timeKey,
    timestamp: candle.timestamp,
    price: side === 'buy' ? candle.low : candle.high,
    templateId: template.id,
    templateName: template.name,
    explanation,
    indicatorValues: Object.fromEntries(
      Object.entries(indicatorValues).filter(([, value]) => Number.isFinite(value))
    )
  }
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
  const errors: string[] = []
  if (templateId === 'ma-cross' && params.shortPeriod >= params.longPeriod) {
    errors.push('短期均线必须小于长期均线')
  }
  if (templateId === 'rsi-reversion' && params.oversold >= params.overbought) {
    errors.push('超卖阈值必须小于超买阈值')
  }
  if (templateId === 'macd-trend-confirmation' && params.fastPeriod >= params.slowPeriod) {
    errors.push('快线 EMA 必须小于慢线 EMA')
  }
  return errors
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

function normalizeKlineStrategyDateRange(
  dateRange?: Partial<KlineStrategyDateRange> | null
): KlineStrategyDateRange | undefined {
  const startDate = normalizeDateKeyInput(dateRange?.startDate)
  const endDate = normalizeDateKeyInput(dateRange?.endDate)
  if (startDate.length !== 8 || endDate.length !== 8 || startDate > endDate) {
    return undefined
  }
  return { startDate, endDate }
}

function normalizeDateKeyInput(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, 8) : ''
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
