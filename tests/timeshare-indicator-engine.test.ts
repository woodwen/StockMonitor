import { describe, expect, it } from 'vitest'
import {
  calculateMacd,
  calculateRsi,
  calculateTimeshareBsSignals,
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

  it('enriches a timeshare dataset with enabled indicator values', () => {
    const settings = createDefaultTimeshareIndicatorSettings()
    settings.ma.enabled = true
    settings.boll.enabled = true
    settings.bsSignal.enabled = true
    settings.bsSignal.params = [2, 4]
    settings.volumeMa.enabled = true
    settings.macd.enabled = true
    settings.rsi.enabled = true

    const enriched = enrichTimeshareDataset(createSampleTimeshareDataset(), settings)

    expect(enriched.indicatorSettings.ma.enabled).toBe(true)
    expect(enriched.points[4].indicators.ma?.['5']).toBe(12)
    expect(enriched.points[19].indicators.boll).toBeDefined()
    expect(enriched.points[4].indicators.volumeMa?.['5']).toBe(102)
    expect(enriched.points[1].indicators.macd?.dif).toBeGreaterThan(0)
    expect(enriched.points[24].indicators.rsi?.['6']).toBe(100)
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
