import { describe, expect, it } from 'vitest'
import {
  createKlineCacheRequestQuery,
  expandKlineCacheStockQueries,
  filterKlineCacheCandlesByRange,
  getKlineCacheCandleRange,
  getKlineCacheRequestError,
  mergeKlineCacheRanges,
  normalizeKlineCacheCandles,
  normalizeKlineCacheDateKey,
  normalizeKlineCacheRange,
  subtractKlineCacheRanges,
  validateKlineCacheSourceCapability
} from '../src/renderer/features/stock-workspace/models/kline-cache'
import type {
  KlineCacheDateRange,
  StockCandle,
  StockDataSourceMeta,
  StockQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'

describe('kline cache model', () => {
  it('normalizes valid date ranges and rejects invalid dates', () => {
    expect(normalizeKlineCacheDateKey('2026-08-10')).toBe('20260810')
    expect(normalizeKlineCacheDateKey('20260230')).toBeNull()
    expect(normalizeKlineCacheRange({ startDate: '20260810', endDate: '20260801' })).toBeNull()
    expect(normalizeKlineCacheRange({ startDate: '20260801', endDate: '20260810' })).toEqual({
      startDate: '20260801',
      endDate: '20260810'
    })
  })

  it('defaults cache requests to day/week/month and all adjust modes', () => {
    const request = createKlineCacheRequestQuery({
      sourceId: 'eastmoney',
      symbol: 'sh600519',
      period: '60',
      adjust: 'none',
      startDate: '20260801',
      endDate: '20260810'
    })

    expect(request).toEqual({
      sourceId: 'eastmoney',
      periods: ['day', 'week', 'month'],
      adjusts: ['qfq', 'none', 'hfq'],
      startDate: '20260801',
      endDate: '20260810'
    })
  })

  it('expands cache request periods and adjusts into stable row ids', () => {
    const rows = expandKlineCacheStockQueries(
      {
        sourceId: 'eastmoney',
        periods: ['day', 'week'],
        adjusts: ['qfq', 'none'],
        startDate: '20260801',
        endDate: '20260810'
      },
      [{ symbol: 'SH600519', name: '贵州茅台', createdAt: 1 }]
    )

    expect(rows.map((row) => row.id)).toEqual([
      'eastmoney__sh600519__day__qfq',
      'eastmoney__sh600519__day__none',
      'eastmoney__sh600519__week__qfq',
      'eastmoney__sh600519__week__none'
    ])
    expect(rows[0].query).toMatchObject({
      symbol: 'sh600519',
      period: 'day',
      adjust: 'qfq'
    })
  })

  it('reports empty period or adjust selections before querying', () => {
    expect(
      getKlineCacheRequestError({
        sourceId: 'eastmoney',
        periods: [],
        adjusts: ['qfq'],
        startDate: '20260801',
        endDate: '20260810'
      })
    ).toBe('请至少选择一个周期')
    expect(
      getKlineCacheRequestError({
        sourceId: 'eastmoney',
        periods: ['day'],
        adjusts: [],
        startDate: '20260801',
        endDate: '20260810'
      })
    ).toBe('请至少选择一种复权')
  })

  it('merges overlapping and adjacent coverage ranges', () => {
    expect(
      mergeKlineCacheRanges([
        range('20260810', '20260820'),
        range('20260801', '20260805'),
        range('20260806', '20260809'),
        range('20260818', '20260831')
      ])
    ).toEqual([range('20260801', '20260831')])
  })

  it('calculates empty, partial and complete missing ranges', () => {
    expect(subtractKlineCacheRanges(range('20260801', '20260810'), [])).toEqual([
      range('20260801', '20260810')
    ])
    expect(
      subtractKlineCacheRanges(range('20260801', '20260810'), [
        range('20260801', '20260803'),
        range('20260807', '20260810')
      ])
    ).toEqual([range('20260804', '20260806')])
    expect(
      subtractKlineCacheRanges(range('20260801', '20260810'), [range('20260701', '20260831')])
    ).toEqual([])
  })

  it('normalizes candles by filtering invalid rows, sorting and keeping the latest duplicate timeKey', () => {
    const candles = normalizeKlineCacheCandles([
      candle('20260803', 3, 3),
      candle('bad', Number.NaN, 0),
      candle('20260801', 1, 1),
      candle('20260801', 2, 2)
    ])

    expect(candles.map((item) => item.timeKey)).toEqual(['20260801', '20260803'])
    expect(candles[0].close).toBe(2)
    expect(getKlineCacheCandleRange(candles)).toEqual(range('20260801', '20260803'))
    expect(filterKlineCacheCandlesByRange(candles, range('20260802', '20260803'))).toHaveLength(1)
  })

  it('reports unsupported source capabilities', () => {
    const query: StockQuery = {
      sourceId: 'netease163',
      symbol: 'sh000001',
      period: 'week',
      adjust: 'qfq',
      startDate: '20260801',
      endDate: '20260810'
    }

    expect(validateKlineCacheSourceCapability(neteaseSource, query)).toBe(
      '网易财经 163 暂不支持 周线'
    )
    expect(
      validateKlineCacheSourceCapability(neteaseSource, {
        ...query,
        period: 'day',
        adjust: 'none'
      })
    ).toBe('网易财经 163 暂不支持指数')
  })
})

function range(startDate: string, endDate: string): KlineCacheDateRange {
  return { startDate, endDate }
}

function candle(timeKey: string, timestamp: number, close: number): StockCandle {
  return {
    timeKey,
    timestamp,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: close * 100,
    turnover: close * 1000
  }
}

const neteaseSource: StockDataSourceMeta = {
  id: 'netease163',
  name: '网易财经 163',
  capabilities: {
    periods: ['day'],
    adjusts: ['none'],
    markets: ['stock'],
    timeshare: false
  }
}
