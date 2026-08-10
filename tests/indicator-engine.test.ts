import { describe, expect, it } from 'vitest'
import {
  calculateBoll,
  calculateEma,
  calculateMovingAverage,
  enrichStockDataset
} from '../src/renderer/features/stock-workspace/models/indicator-engine'
import type { StockDataset } from '../src/renderer/features/stock-workspace/models/stock-types'

describe('indicator-engine', () => {
  it('calculates moving averages with undefined warm-up period', () => {
    expect(calculateMovingAverage([1, 2, 3, 4], 3)).toEqual([undefined, undefined, 2, 3])
  })

  it('calculates EMA from the first value', () => {
    const values = calculateEma([10, 12, 14], 2)

    expect(values[0]).toBe(10)
    expect(values[1]).toBeCloseTo(11.333333333333334, 12)
    expect(values[2]).toBeCloseTo(13.11111111111111, 12)
  })

  it('calculates BOLL values after enough records', () => {
    const result = calculateBoll([1, 2, 3, 4, 5], 5, 2)
    expect(result[0]).toBeUndefined()
    expect(result[4]?.mid).toBe(3)
    expect(result[4]?.upper).toBeCloseTo(5.828427, 5)
    expect(result[4]?.lower).toBeCloseTo(0.171572, 5)
  })

  it('enriches a dataset with volume MA and signal fields', () => {
    const dataset: StockDataset = {
      meta: {
        lineType: '日线',
        symbol: '000001',
        name: '测试'
      },
      interval: 'day',
      columns: [],
      candles: Array.from({ length: 25 }, (_, index) => ({
        timeKey: `202401${String(index + 1).padStart(2, '0')}`,
        timestamp: new Date(2024, 0, index + 1).getTime(),
        open: index + 1,
        high: index + 2,
        low: index,
        close: index + 1,
        volume: index + 10,
        turnover: index + 20
      }))
    }

    const enriched = enrichStockDataset(dataset)
    expect(enriched.candles[19].boll).toBeDefined()
    expect(enriched.candles[4].volumeMa.ma5).toBe(12)
  })
})
