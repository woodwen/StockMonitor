import { makeAutoObservable } from 'mobx'
import type { EnrichedStockDataset, IndicatorName } from '../models/stock-types'

export class KLineChartViewModel {
  dataset: EnrichedStockDataset | null = null
  enabledIndicators: Record<IndicatorName, boolean> = {
    boll: true,
    volumeMa: true,
    bsSignal: true
  }
  revision = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDataset(dataset: EnrichedStockDataset): void {
    this.dataset = dataset
    this.revision += 1
  }

  setIndicator(name: IndicatorName, enabled: boolean): void {
    this.enabledIndicators[name] = enabled
    this.revision += 1
  }

  setIndicators(enabledIndicators: Record<IndicatorName, boolean>): void {
    this.enabledIndicators = { ...enabledIndicators }
    this.revision += 1
  }

  get hasDataset(): boolean {
    return this.dataset !== null && this.dataset.candles.length > 0
  }

  get title(): string {
    if (!this.dataset) {
      return '未加载数据'
    }
    return `${this.dataset.meta.name}(${this.dataset.meta.symbol}) ${this.dataset.meta.lineType}`
  }

  get sourceLabel(): string {
    if (!this.dataset) {
      return '未加载'
    }
    return this.dataset.sourceName ?? this.dataset.sourcePath ?? '远端行情'
  }
}
