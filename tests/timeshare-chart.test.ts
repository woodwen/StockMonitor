import { describe, expect, it } from 'vitest'
import { getTradingMinuteIndex } from '../src/renderer/features/stock-workspace/adapters/TimeshareChartAdapter'
import { TimeshareChartViewModel } from '../src/renderer/features/stock-workspace/view-models/TimeshareChartViewModel'
import type { StockTimeshareDataset } from '../src/renderer/features/stock-workspace/models/stock-types'

describe('TimeshareChartViewModel', () => {
  it('derives latest summary from latest point and previous close', () => {
    const viewModel = new TimeshareChartViewModel()

    viewModel.setDataset(sampleTimeshareDataset)

    expect(viewModel.recordCount).toBe(2)
    expect(viewModel.latestSummary).toContain('价 10.20')
    expect(viewModel.latestSummary).toContain('+2.00%')
  })

  it('increments revision when dataset changes', () => {
    const viewModel = new TimeshareChartViewModel()

    viewModel.setDataset(sampleTimeshareDataset)
    viewModel.setDataset(sampleTimeshareDataset)

    expect(viewModel.revision).toBe(2)
  })
})

describe('TimeshareChartAdapter helpers', () => {
  it('compresses midday break in trading minute index', () => {
    expect(getTradingMinuteIndex(new Date(2026, 7, 10, 9, 30).getTime())).toBe(0)
    expect(getTradingMinuteIndex(new Date(2026, 7, 10, 11, 30).getTime())).toBe(120)
    expect(getTradingMinuteIndex(new Date(2026, 7, 10, 13, 0).getTime())).toBe(120)
    expect(getTradingMinuteIndex(new Date(2026, 7, 10, 15, 0).getTime())).toBe(240)
    expect(getTradingMinuteIndex(new Date(2026, 7, 10, 12, 0).getTime())).toBeNull()
  })
})

const sampleTimeshareDataset: StockTimeshareDataset = {
  meta: {
    lineType: '分时',
    symbol: 'sh000001',
    name: '上证指数'
  },
  previousClose: 10,
  points: [
    {
      timeKey: '202608100930',
      timestamp: new Date(2026, 7, 10, 9, 30).getTime(),
      price: 10.1,
      avgPrice: 10.05,
      volume: 100,
      turnover: 1000
    },
    {
      timeKey: '202608100931',
      timestamp: new Date(2026, 7, 10, 9, 31).getTime(),
      price: 10.2,
      avgPrice: 10.08,
      volume: 120,
      turnover: 1224
    }
  ],
  sourceId: 'eastmoney',
  sourceName: '东方财富'
}
