import { makeAutoObservable, runInAction } from 'mobx'
import { enrichStockDataset, getLatestCandle } from '../models/indicator-engine'
import { parseLegacyStockText } from '../models/legacy-stock-parser'
import type { FileTextPayload, IndicatorName, RecentFileEntry } from '../models/stock-types'
import type { StockFileAdapter } from '../adapters/ElectronFileAdapter'
import { ImportFileViewModel } from './ImportFileViewModel'
import { KLineChartViewModel } from './KLineChartViewModel'

export class StockWorkspaceViewModel {
  readonly importFile = new ImportFileViewModel()
  readonly chart = new KLineChartViewModel()

  recentFiles: RecentFileEntry[] = []
  initialized = false
  error = ''

  constructor(private readonly fileAdapter: StockFileAdapter) {
    makeAutoObservable<this, 'fileAdapter'>(this, { fileAdapter: false }, { autoBind: true })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    this.initialized = true
    await this.refreshRecentFiles()
    await this.loadSample()
  }

  async openFile(): Promise<void> {
    this.importFile.start()
    this.error = ''

    try {
      const payload = await this.fileAdapter.openLegacyTextFile()
      if (!payload) {
        this.importFile.status = 'idle'
        return
      }
      this.applyFilePayload(payload)
      await this.refreshRecentFiles()
    } catch (error) {
      this.failImport(error)
    }
  }

  async loadSample(): Promise<void> {
    this.importFile.start('000002.txt')
    this.error = ''

    try {
      const payload = await this.fileAdapter.readSampleLegacyTextFile()
      this.applyFilePayload(payload)
    } catch (error) {
      this.failImport(error)
    }
  }

  async clearRecentFiles(): Promise<void> {
    await this.fileAdapter.clearRecentFiles()
    await this.refreshRecentFiles()
  }

  toggleIndicator(name: IndicatorName, enabled: boolean): void {
    this.chart.setIndicator(name, enabled)
  }

  get latestSummary(): string {
    const latest = getLatestCandle(this.chart.dataset)
    if (!latest) {
      return '暂无行情'
    }
    return `收 ${formatNumber(latest.close)}  高 ${formatNumber(latest.high)}  低 ${formatNumber(latest.low)}  量 ${formatNumber(latest.volume, 0)}`
  }

  get recordCount(): number {
    return this.chart.dataset?.candles.length ?? 0
  }

  private applyFilePayload(payload: FileTextPayload): void {
    const dataset = parseLegacyStockText(payload.text, {
      sourcePath: payload.filePath,
      encoding: payload.encoding
    })
    const enriched = enrichStockDataset(dataset)

    runInAction(() => {
      this.chart.setDataset(enriched)
      this.importFile.succeed(payload.fileName, payload.encoding)
      this.error = ''
    })
  }

  private async refreshRecentFiles(): Promise<void> {
    const recentFiles = await this.fileAdapter.getRecentFiles()
    runInAction(() => {
      this.recentFiles = recentFiles
    })
  }

  private failImport(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error)
    this.importFile.fail(message)
    this.error = message
  }
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}
