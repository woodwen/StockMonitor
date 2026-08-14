import { describe, expect, it } from 'vitest'
import {
  calculateKdj,
  calculateMacd,
  calculateOrderRatio,
  calculateRsi,
  calculateTimeshareBsSignals,
  calculateTurnoverRate,
  calculateVolumeRatio,
  createTimeshareIndicatorAvailability,
  enrichTimeshareDataset
} from '../src/renderer/features/stock-workspace/models/timeshare-indicator-engine'
import { createDefaultTimeshareIndicatorSettings } from '../src/renderer/features/stock-workspace/models/timeshare-indicator-definitions'
import type { StockTimeshareDataset } from '../src/renderer/features/stock-workspace/models/stock-types'

describe('timeshare-indicator-engine', () => {
  it('calculates MACD from the first price', () => {
    const result = calculateMacd([10, 11, 12], 12, 26, 9)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ dif: 0, dea: 0, macd: 0 })
    expect(result[2].dif).toBeGreaterThan(0)
  })

  it('calculates RSI for rising and flat series', () => {
    expect(calculateRsi([1, 2, 3, 4], 3)[3]).toBe(100)
    expect(calculateRsi([1, 1, 1, 1], 3)[3]).toBe(50)
    expect(calculateRsi([4, 3, 2, 1], 3)[3]).toBe(0)
  })

  it('calculates B/S signals from fast and slow EMA crosses', () => {
    const signals = calculateTimeshareBsSignals([10, 9, 8, 9, 10, 11, 10, 9, 8], 2, 4)

    expect(signals.some((signal) => signal?.side === 'buy')).toBe(true)
    expect(signals.some((signal) => signal?.side === 'sell')).toBe(true)
  })

  it('calculates KDJ from minute OHLC and uses RSV 50 for flat ranges', () => {
    const points = createSampleTimeshareDataset().points.map((point) => ({
      ...point,
      high: 10,
      low: 10,
      close: 10
    }))

    const result = calculateKdj(points, 9, 3, 3)

    expect(result[8]).toEqual({ k: 50, d: 50, j: 50 })
  })

  it('calculates volume ratio, turnover rate and order ratio with fixed defaults', () => {
    const advanced = {
      tradeDate: '20260810',
      historicalVolumeBaseline: {
        basis: 'fiveDayAverageMinuteVolume' as const,
        averageMinuteVolume: 100,
        tradeDays: 5,
        sampleStartDate: '20260803',
        sampleEndDate: '20260807',
        source: '东方财富'
      },
      floatShares: 10_000,
      orderBook: {
        bidLevels: [{ volume: 300 }],
        askLevels: [{ volume: 100 }],
        bidVolume: 300,
        askVolume: 100,
        timestamp: 1,
        source: '东方财富'
      }
    }

    expect(calculateVolumeRatio([100, 300], advanced)[1]).toEqual({
      value: 1.5,
      basis: '5日均每分钟成交量'
    })
    expect(calculateTurnoverRate([100, 300], advanced)[1]).toEqual({
      value: 3,
      basis: '累计成交量 / 流通股本'
    })
    expect(calculateOrderRatio(advanced)).toMatchObject({
      value: 50,
      bidVolume: 300,
      askVolume: 100
    })
  })

  it('marks advanced indicators unavailable when prerequisite data is missing', () => {
    const availability = createTimeshareIndicatorAvailability({
      ...createSampleTimeshareDataset(),
      advanced: {
        tradeDate: '20260810',
        unavailableReasons: {
          minuteOhlc: '缺少分钟 OHLC'
        }
      }
    })

    expect(availability.kdj).toMatchObject({
      status: 'unavailable',
      reason: '缺少分钟 OHLC'
    })
    expect(availability.turnoverRate?.reason).toBe('缺少流通股本')
    expect(availability.inOutVolume?.reason).toBe('缺少逐笔方向或内外盘聚合字段')
  })

  it('enriches a timeshare dataset with enabled indicator values', () => {
    const settings = createDefaultTimeshareIndicatorSettings()
    settings.ma.enabled = true
    settings.boll.enabled = true
    settings.bsSignal.enabled = true
    settings.bsSignal.params = [2, 4]
    settings.volumeMa.enabled = true
    settings.macd.enabled = true
    settings.rsi.enabled = true
    settings.volumeRatio.enabled = true
    settings.turnoverRate.enabled = true
    settings.orderRatio.enabled = true
    settings.inOutVolume.enabled = true
    settings.capitalFlow.enabled = true

    const enriched = enrichTimeshareDataset(createAdvancedTimeshareDataset(), settings)

    expect(enriched.indicatorSettings.ma.enabled).toBe(true)
    expect(enriched.points[4].indicators.ma?.['5']).toBe(12)
    expect(enriched.points[19].indicators.boll).toBeDefined()
    expect(enriched.points[4].indicators.volumeMa?.['5']).toBe(102)
    expect(enriched.points[1].indicators.macd?.dif).toBeGreaterThan(0)
    expect(enriched.points[24].indicators.rsi?.['6']).toBe(100)
    expect(enriched.points[1].indicators.volumeRatio?.value).toBe(1.005)
    expect(enriched.points[1].indicators.turnoverRate?.value).toBe(0.0201)
    expect(enriched.latestIndicators.orderRatio?.value).toBe(50)
    expect(enriched.latestIndicators.inOutVolume).toMatchObject({
      inwardVolume: 120,
      outwardVolume: 180
    })
    expect(enriched.latestIndicators.capitalFlow).toMatchObject({
      totalInflow: 5000,
      totalOutflow: 3000,
      netInflow: 2000
    })
    expect(enriched.points.some((point) => point.indicators.bsSignal)).toBe(true)
  })
})

function createSampleTimeshareDataset(): StockTimeshareDataset {
  return {
    meta: {
      lineType: '分时',
      symbol: 'sh000001',
      name: '上证指数'
    },
    previousClose: 10,
    points: Array.from({ length: 30 }, (_, index) => {
      const timestamp = new Date(2026, 7, 10, 9, 30 + index).getTime()
      return {
        timeKey: `20260810${String(930 + index).padStart(4, '0')}`,
        timestamp,
        price: 10 + index,
        avgPrice: 10 + index / 2,
        volume: 100 + index,
        turnover: 1000 + index
      }
    }),
    sourceId: 'eastmoney',
    sourceName: '东方财富'
  }
}

function createAdvancedTimeshareDataset(): StockTimeshareDataset {
  const dataset = createSampleTimeshareDataset()
  return {
    ...dataset,
    points: dataset.points.map((point) => ({
      ...point,
      open: point.price - 0.1,
      high: point.price + 0.2,
      low: point.price - 0.2,
      close: point.price
    })),
    advanced: {
      tradeDate: '20260810',
      historicalVolumeBaseline: {
        basis: 'fiveDayAverageMinuteVolume',
        averageMinuteVolume: 100,
        tradeDays: 5,
        sampleStartDate: '20260803',
        sampleEndDate: '20260807',
        source: '东方财富'
      },
      floatShares: 1_000_000,
      orderBook: {
        bidLevels: [{ volume: 300 }],
        askLevels: [{ volume: 100 }],
        bidVolume: 300,
        askVolume: 100,
        timestamp: 1,
        source: '东方财富'
      },
      inOutVolume: {
        inwardVolume: 120,
        outwardVolume: 180,
        source: 'sourceAggregate',
        timestamp: 1
      },
      capitalFlow: {
        totalInflow: 5000,
        totalOutflow: 3000,
        netInflow: 2000,
        source: 'sourceAggregate',
        timestamp: 1
      }
    }
  }
}
