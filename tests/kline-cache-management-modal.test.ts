import { describe, expect, it } from 'vitest'
import {
  createKlineCacheColumns,
  formatKlineCacheSourceName,
  KLINE_CACHE_SOURCE_COLUMN_WIDTH,
  KLINE_CACHE_TARGET_MODE_OPTIONS
} from '../src/renderer/features/stock-workspace/views/KlineCacheManagementModal'
import type {
  KlineCacheStatusRow,
  StockDataSourceMeta,
  StockQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'

describe('KlineCacheManagementModal', () => {
  it('offers single-stock and multi-stock cache target modes', () => {
    expect(KLINE_CACHE_TARGET_MODE_OPTIONS).toEqual([
      { label: '单只股票缓存', value: 'single' },
      { label: '多只股票缓存', value: 'multiple' }
    ])
  })

  it('places the source column after name with the configured width', () => {
    const columns = createKlineCacheColumns(sources)

    expect(columns?.map((column) => column.title)).toEqual([
      '名称',
      '数据源',
      '周期',
      '复权',
      '状态',
      '记录',
      '缓存范围',
      '缺失范围',
      '最近刷新',
      '消息'
    ])
    expect(columns?.[1]?.width).toBe(KLINE_CACHE_SOURCE_COLUMN_WIDTH)
    expect(KLINE_CACHE_SOURCE_COLUMN_WIDTH).toBe(96)
  })

  it('renders the source display name from each row query and falls back to sourceId', () => {
    const columns = createKlineCacheColumns(sources)
    const sourceColumn = columns?.[1] as { render?: (_: unknown, row: KlineCacheStatusRow) => unknown }

    expect(formatKlineCacheSourceName(sources, createRow('eastmoney'))).toBe('东方财富')
    expect(sourceColumn.render?.(undefined, createRow('tencent'))).toBe('腾讯/QQ 财经')
    expect(formatKlineCacheSourceName(sources, createRow('unknown-source'))).toBe('unknown-source')
  })
})

const sources: StockDataSourceMeta[] = [
  {
    id: 'eastmoney',
    name: '东方财富',
    capabilities: {
      periods: ['day', 'week', 'month'],
      adjusts: ['qfq', 'none', 'hfq'],
      markets: ['stock', 'etf', 'index'],
      timeshare: true
    }
  },
  {
    id: 'tencent',
    name: '腾讯/QQ 财经',
    capabilities: {
      periods: ['day'],
      adjusts: ['qfq'],
      markets: ['stock'],
      timeshare: true
    }
  }
]

function createRow(sourceId: string): KlineCacheStatusRow {
  const query: StockQuery = {
    sourceId: sourceId as StockQuery['sourceId'],
    symbol: 'sh000001',
    period: 'day',
    adjust: 'qfq',
    startDate: '20240101',
    endDate: '20260101'
  }
  return {
    id: `${sourceId}__sh000001__day__qfq`,
    symbol: 'sh000001',
    name: '上证指数',
    query,
    status: 'complete',
    recordCount: 10,
    coveredRanges: [{ startDate: '20240101', endDate: '20260101' }],
    missingRanges: []
  }
}
