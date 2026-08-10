import { makeAutoObservable } from 'mobx'
import type { StockTimeshareDataset, StockTimesharePoint } from '../models/stock-types'

export class TimeshareChartViewModel {
  dataset: StockTimeshareDataset | null = null
  revision = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDataset(dataset: StockTimeshareDataset): void {
    this.dataset = dataset
    this.revision += 1
  }

  get hasDataset(): boolean {
    return this.dataset !== null && this.dataset.points.length > 0
  }

  get title(): string {
    if (!this.dataset) {
      return '未加载数据'
    }
    return `${this.dataset.meta.name}(${this.dataset.meta.symbol}) 分时`
  }

  get sourceLabel(): string {
    if (!this.dataset) {
      return '未加载'
    }
    return this.dataset.sourceName ?? this.dataset.sourceUrl ?? '远端分时'
  }

  get latestPoint(): StockTimesharePoint | null {
    const points = this.dataset?.points ?? []
    return points.length > 0 ? points[points.length - 1] : null
  }

  get recordCount(): number {
    return this.dataset?.points.length ?? 0
  }

  get latestSummary(): string {
    const latest = this.latestPoint
    if (!latest || !this.dataset) {
      return '暂无分时'
    }

    const previousClose = this.dataset.previousClose
    const change = latest.price - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    return `价 ${formatNumber(latest.price)}  涨跌 ${formatSignedNumber(change)}  ${formatSignedNumber(changePercent)}%`
  }
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function formatSignedNumber(value: number, digits = 2): string {
  const formatted = formatNumber(Math.abs(value), digits)
  if (value > 0) {
    return `+${formatted}`
  }
  if (value < 0) {
    return `-${formatted}`
  }
  return formatted
}
