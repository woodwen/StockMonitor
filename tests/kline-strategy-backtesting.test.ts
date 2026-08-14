import { describe, expect, it } from 'vitest'
import {
  createDefaultKlineStrategySettings,
  getKlineStrategyDatasetMissingRanges,
  isKlineStrategyDatasetCoveringQuery,
  klineStrategyTemplates,
  normalizeKlineStrategyParams,
  normalizeKlineStrategySettings,
  runKlineStrategyBacktests
} from '../src/renderer/features/stock-workspace/models/kline-strategy-backtesting'
import type {
  KlineStrategySettings,
  KlineStrategyTemplateId,
  StockCandle,
  StockDataset,
  StockQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'

describe('kline-strategy-backtesting', () => {
  it('provides four daily/weekly/monthly strategy templates', () => {
    expect(klineStrategyTemplates.map((template) => template.id)).toEqual([
      'ma-cross',
      'breakout-pullback',
      'rsi-reversion',
      'macd-trend-confirmation'
    ])
    klineStrategyTemplates.forEach((template) => {
      expect(template.compatiblePeriods).toEqual(['day', 'week', 'month'])
      expect(template.parameters.length).toBeGreaterThan(0)
      expect(template.minSampleSize).toBeGreaterThan(0)
      expect(template.signalDescription.length).toBeGreaterThan(0)
    })
  })

  it('uses practical non-zero default backtest cost assumptions', () => {
    expect(createDefaultKlineStrategySettings().assumptionDefaultsVersion).toBe(1)
    expect(createDefaultKlineStrategySettings().assumptions).toEqual({
      initialCapital: 100000,
      feeRate: 0.0005,
      slippageRate: 0.0002
    })
  })

  it('normalizes missing and legacy backtest cost assumptions while preserving explicit zero values', () => {
    expect(normalizeKlineStrategySettings({ assumptions: {} }).assumptions).toEqual({
      initialCapital: 100000,
      feeRate: 0.0005,
      slippageRate: 0.0002
    })
    expect(
      normalizeKlineStrategySettings({
        assumptions: {
          initialCapital: 100000,
          feeRate: 0,
          slippageRate: 0
        }
      }).assumptions
    ).toEqual({
      initialCapital: 100000,
      feeRate: 0.0005,
      slippageRate: 0.0002
    })
    expect(
      normalizeKlineStrategySettings({
        assumptionDefaultsVersion: 1,
        assumptions: {
          initialCapital: 100000,
          feeRate: 0,
          slippageRate: 0
        }
      }).assumptions
    ).toEqual({
      initialCapital: 100000,
      feeRate: 0,
      slippageRate: 0
    })
  })

  it('ignores legacy strategy date range preferences after normalization', () => {
    const settings = normalizeKlineStrategySettings({
      dateRange: {
        startDate: '2024-01-10',
        endDate: '2024/02/10'
      }
    })

    expect((settings as unknown as { dateRange?: unknown }).dateRange).toBeUndefined()
  })

  it('normalizes params and reports invalid parameter relations', () => {
    const result = normalizeKlineStrategyParams('ma-cross', {
      shortPeriod: 30,
      longPeriod: 5
    })

    expect(result.params).toMatchObject({
      shortPeriod: 30,
      longPeriod: 5
    })
    expect(result.errors).toContain('短期均线必须小于长期均线')
  })

  it('marks minute periods unavailable without running templates', () => {
    const result = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: {
        ...defaultQuery,
        period: '5'
      },
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    }).results[0]

    expect(result.status).toBe('unavailable')
    expect(result.unavailableReason).toContain('策略回测暂不支持分钟 K 线周期')
    expect(result.signals).toEqual([])
  })

  it('generates deterministic signals, trades, drawdown metrics and rank', () => {
    const first = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    })
    const second = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    })
    const result = first.results[0]

    expect(first).toEqual(second)
    expect(result.status).toBe('success')
    expect(result.signals.map((signal) => signal.side)).toContain('buy')
    expect(result.signals.map((signal) => signal.side)).toContain('sell')
    expect(result.trades.some((trade) => trade.closed)).toBe(true)
    expect(result.metrics?.tradeCount).toBeGreaterThan(0)
    expect(result.metrics?.maxDrawdown).toBeLessThanOrEqual(0)
    expect(result.rank).toBe(1)
  })

  it.each([
    {
      templateId: 'breakout-pullback' as const,
      candles: createBreakoutPullbackCandles(),
      params: { lookbackPeriod: 5, exitPeriod: 3 }
    },
    {
      templateId: 'rsi-reversion' as const,
      candles: createRsiReversionCandles(),
      params: { period: 2, oversold: 45, overbought: 70 }
    },
    {
      templateId: 'macd-trend-confirmation' as const,
      candles: createMacdTrendCandles(),
      params: { fastPeriod: 2, slowPeriod: 5, signalPeriod: 2 }
    }
  ])('runs deterministic signals and trades for $templateId', ({ templateId, candles, params }) => {
    const query = {
      ...defaultQuery,
      endDate: '20240430'
    }
    const first = runKlineStrategyBacktests({
      dataset: createDataset(candles),
      query,
      settings: settingsFor([templateId], {
        [templateId]: params
      })
    })
    const second = runKlineStrategyBacktests({
      dataset: createDataset(candles),
      query,
      settings: settingsFor([templateId], {
        [templateId]: params
      })
    })
    const result = first.results[0]

    expect(first).toEqual(second)
    expect(result.status).toBe('success')
    expect(result.signals.map((signal) => signal.side)).toContain('buy')
    expect(result.signals.map((signal) => signal.side)).toContain('sell')
    expect(result.metrics?.tradeCount).toBeGreaterThan(0)
    expect(result.rank).toBe(1)
  })

  it('rejects empty, duplicated, descending or non-finite candle inputs', () => {
    const empty = runKlineStrategyBacktests({
      dataset: createDataset([]),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    }).results[0]
    const invalid = runKlineStrategyBacktests({
      dataset: createDataset([
        createCandle(2, 12),
        {
          ...createCandle(2, 13),
          open: Number.NaN
        },
        createCandle(1, 11)
      ]),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    }).results[0]

    expect(empty.status).toBe('unavailable')
    expect(empty.unavailableReason).toContain('回测区间没有 K 线数据')
    expect(invalid.status).toBe('unavailable')
    expect(invalid.unavailableReason).toContain('存在重复 K 线：20240103')
    expect(invalid.unavailableReason).toContain('K 线必须按时间升序排列')
    expect(invalid.unavailableReason).toContain('K 线价格字段无效：20240103')
  })

  it('keeps the selected query range separate from the actual data range', () => {
    const result = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: {
        ...defaultQuery,
        startDate: '20230101',
        endDate: '20250101'
      },
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    }).results[0]

    expect(result.query.startDate).toBe('20230101')
    expect(result.query.endDate).toBe('20250101')
    expect(result.dataStartDate).toBe('20240101')
    expect(result.dataEndDate).toBe('20240214')
  })

  it('ignores daily boundary gaps within the non-trading offset tolerance', () => {
    const weekendQuery: StockQuery = {
      ...defaultQuery,
      startDate: '20240810',
      endDate: '20240820'
    }
    const holidayQuery: StockQuery = {
      ...defaultQuery,
      startDate: '20241001',
      endDate: '20241011'
    }
    const outOfToleranceQuery: StockQuery = {
      ...weekendQuery,
      startDate: '20240801'
    }
    const weekendDataset = createDataset([
      createDateCandle('20240812', 10),
      createDateCandle('20240820', 12)
    ])
    const holidayDataset = createDataset([
      createDateCandle('20241008', 10),
      createDateCandle('20241011', 12)
    ])

    expect(isKlineStrategyDatasetCoveringQuery(weekendDataset, weekendQuery)).toBe(true)
    expect(getKlineStrategyDatasetMissingRanges(weekendDataset, weekendQuery)).toEqual([])
    expect(isKlineStrategyDatasetCoveringQuery(holidayDataset, holidayQuery)).toBe(true)
    expect(getKlineStrategyDatasetMissingRanges(holidayDataset, holidayQuery)).toEqual([])
    expect(isKlineStrategyDatasetCoveringQuery(weekendDataset, outOfToleranceQuery)).toBe(false)
    expect(getKlineStrategyDatasetMissingRanges(weekendDataset, outOfToleranceQuery)).toEqual([
      { startDate: '20240801', endDate: '20240811' }
    ])
  })

  it('keeps win rate and profit loss ratio unavailable without closed trades', () => {
    const result = runKlineStrategyBacktests({
      dataset: createDataset(createUptrendCandles()),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 3, longPeriod: 8 }
      })
    }).results[0]

    expect(result.status).toBe('unavailable')
    expect(result.metrics?.tradeCount).toBe(0)
    expect(result.metrics?.winRate).toBeUndefined()
    expect(result.metrics?.profitLossRatio).toBeUndefined()
    expect(result.rank).toBeUndefined()
    expect(result.unavailableReason).toBe('没有已平仓交易，未参与历史表现排名')
  })

  it('excludes unavailable strategy results from historical ranking', () => {
    const comparison = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: defaultQuery,
      settings: settingsFor(
        ['ma-cross', 'macd-trend-confirmation'],
        {
          'ma-cross': { shortPeriod: 3, longPeriod: 8 },
          'macd-trend-confirmation': { fastPeriod: 30, slowPeriod: 10, signalPeriod: 9 }
        }
      )
    })
    const invalid = comparison.results.find(
      (result) => result.templateId === 'macd-trend-confirmation'
    )
    const valid = comparison.results.find((result) => result.templateId === 'ma-cross')

    expect(invalid?.status).toBe('unavailable')
    expect(invalid?.rank).toBeUndefined()
    expect(valid?.rank).toBe(1)
  })

  it('keeps out-of-range template params unavailable instead of clamping them into a valid run', () => {
    const result = runKlineStrategyBacktests({
      dataset: createDataset(createCrossingCandles()),
      query: defaultQuery,
      settings: settingsFor(['ma-cross'], {
        'ma-cross': { shortPeriod: 1, longPeriod: 8 }
      })
    }).results[0]

    expect(result.status).toBe('unavailable')
    expect(result.rank).toBeUndefined()
    expect(result.unavailableReason).toContain('短期均线必须在 2 到 120 之间')
  })
})

const defaultQuery: StockQuery = {
  sourceId: 'eastmoney',
  symbol: 'sh000001',
  period: 'day',
  adjust: 'qfq',
  startDate: '20240101',
  endDate: '20240220'
}

function settingsFor(
  selectedTemplateIds: KlineStrategyTemplateId[],
  paramsByTemplate: KlineStrategySettings['paramsByTemplate']
): KlineStrategySettings {
  return {
    ...createDefaultKlineStrategySettings(),
    selectedTemplateIds,
    paramsByTemplate: {
      ...createDefaultKlineStrategySettings().paramsByTemplate,
      ...paramsByTemplate
    }
  }
}

function createDataset(candles: StockCandle[]): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: 'sh000001',
      name: '上证指数'
    },
    interval: 'day',
    columns: [],
    candles
  }
}

function createCrossingCandles(): StockCandle[] {
  return Array.from({ length: 45 }, (_, index) => {
    const close =
      index < 12
        ? 30 - index
        : index < 28
          ? 18 + (index - 12) * 1.4
          : 40 - (index - 28) * 1.8
    return createCandle(index, close)
  })
}

function createUptrendCandles(): StockCandle[] {
  return Array.from({ length: 45 }, (_, index) => createCandle(index, 20 + index))
}

function createBreakoutPullbackCandles(): StockCandle[] {
  return Array.from({ length: 60 }, (_, index) => {
    const close =
      index < 12
        ? 10 + index * 0.08
        : index < 28
          ? 18 + (index - 12) * 0.8
          : 30 - (index - 28) * 1.4
    return createCandle(index, close)
  })
}

function createRsiReversionCandles(): StockCandle[] {
  const closes = [
    10,
    9,
    8,
    9,
    11,
    10,
    9,
    8,
    9,
    11,
    ...Array.from({ length: 50 }, (_, index) => 11 + Math.sin(index / 3))
  ]
  return closes.map((close, index) => createCandle(index, close))
}

function createMacdTrendCandles(): StockCandle[] {
  const closes = [
    ...Array.from({ length: 15 }, (_, index) => 20 + index * 1.2),
    ...Array.from({ length: 8 }, (_, index) => 38 - index * 0.25),
    ...Array.from({ length: 15 }, (_, index) => 36 + index * 1.1),
    ...Array.from({ length: 15 }, (_, index) => 52 - index * 1.5),
    ...Array.from({ length: 20 }, (_, index) => 30 + index * 0.2)
  ]
  return closes.map((close, index) => createCandle(index, close))
}

function createCandle(index: number, close: number): StockCandle {
  const date = new Date(2024, 0, index + 1)
  return {
    timeKey: formatDateKey(date),
    timestamp: date.getTime(),
    open: close - 0.2,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000 + index,
    turnover: 2000 + index
  }
}

function createDateCandle(timeKey: string, close: number): StockCandle {
  return {
    timeKey,
    timestamp: new Date(
      Number(timeKey.slice(0, 4)),
      Number(timeKey.slice(4, 6)) - 1,
      Number(timeKey.slice(6, 8))
    ).getTime(),
    open: close - 0.2,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
    turnover: 2000
  }
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
