import { makeAutoObservable, runInAction } from 'mobx'
import type { NetworkProxySettings, WorkspaceSettings } from '../../../../preload/stock-api'
import { enrichStockDataset, getLatestCandle } from '../models/indicator-engine'
import { cloneIndicatorSettings } from '../models/indicator-definitions'
import type {
  IndicatorName,
  StockAdjust,
  StockDataSourceMeta,
  StockPeriod,
  StockQuery,
  StockSourceId
} from '../models/stock-types'
import type { StockDataAdapter } from '../adapters/ElectronStockDataAdapter'
import { KLineChartViewModel } from './KLineChartViewModel'

export type RemoteLoadStatus = 'idle' | 'loading' | 'success' | 'error'
export type SourceTestStatus = 'testing' | 'success' | 'error'

export interface SourceTestResult {
  sourceId: StockSourceId
  sourceName: string
  status: SourceTestStatus
  query: StockQuery
  message: string
  elapsedMs?: number
  recordCount?: number
}

const WORKSPACE_SAVE_DEBOUNCE_MS = 500

export class StockWorkspaceViewModel {
  readonly chart = new KLineChartViewModel()

  sources: StockDataSourceMeta[] = []
  query: StockQuery = createDefaultStockQuery()
  sourceTestOpen = false
  sourceTestRunning = false
  sourceTestResults: SourceTestResult[] = []
  proxyDialogOpen = false
  networkProxy: NetworkProxySettings = createDefaultNetworkProxy()
  proxyDraft: NetworkProxySettings = createDefaultNetworkProxy()
  status: RemoteLoadStatus = 'idle'
  initialized = false
  error = ''
  private workspaceSaveTimer?: ReturnType<typeof setTimeout>

  constructor(private readonly dataAdapter: StockDataAdapter) {
    makeAutoObservable<this, 'dataAdapter' | 'workspaceSaveTimer'>(
      this,
      { dataAdapter: false, workspaceSaveTimer: false },
      { autoBind: true }
    )
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    this.initialized = true
    await this.loadSources()
    await this.loadSettings()
    await this.refreshStock({ allowStartupFallback: true })
  }

  dispose(): void {
    if (!this.workspaceSaveTimer) {
      return
    }
    clearTimeout(this.workspaceSaveTimer)
    this.workspaceSaveTimer = undefined
    this.persistWorkspaceSettings()
  }

  async refreshStock(options: { allowStartupFallback?: boolean } = {}): Promise<void> {
    const initialQuery = this.normalizeQueryForSource(this.query)
    const queries = options.allowStartupFallback
      ? [initialQuery, ...this.getStartupFallbackQueries(initialQuery)]
      : [initialQuery]
    const errors: string[] = []

    this.query = initialQuery
    this.status = 'loading'
    this.error = ''

    for (const query of queries) {
      try {
        await this.loadQuery(query)
        return
      } catch (error) {
        errors.push(`${this.sourceNameFor(query.sourceId)}：${formatErrorMessage(error)}`)
      }
    }

    this.failLoad(new Error(errors.join('；')))
  }

  private async loadQuery(query: StockQuery): Promise<void> {
    const dataset = await this.dataAdapter.fetchStockDataset(query)
    const enriched = enrichStockDataset(dataset, this.chart.indicatorSettings)
    runInAction(() => {
      this.query = query
      this.chart.setDataset(enriched)
      this.status = 'success'
      this.error = ''
    })
  }

  setSymbol(symbol: string): void {
    this.query = {
      ...this.query,
      symbol
    }
    this.queueWorkspaceSettingsSave()
  }

  setSourceId(sourceId: StockSourceId): void {
    this.query = this.normalizeQueryForSource({
      ...this.query,
      sourceId
    })
    this.saveWorkspaceSettingsNow()
  }

  setPeriod(period: StockPeriod): void {
    this.query = this.normalizeQueryForSource({
      ...this.query,
      period
    })
    this.saveWorkspaceSettingsNow()
  }

  setAdjust(adjust: StockAdjust): void {
    this.query = this.normalizeQueryForSource({
      ...this.query,
      adjust
    })
    this.saveWorkspaceSettingsNow()
  }

  setStartDate(startDate: string): void {
    this.query = {
      ...this.query,
      startDate: normalizeDateInput(startDate)
    }
    this.queueWorkspaceSettingsSave()
  }

  setEndDate(endDate: string): void {
    this.query = {
      ...this.query,
      endDate: normalizeDateInput(endDate)
    }
    this.queueWorkspaceSettingsSave()
  }

  toggleIndicator(name: IndicatorName, enabled: boolean): void {
    const previousRevision = this.chart.revision
    this.chart.setIndicator(name, enabled)
    if (this.chart.revision !== previousRevision) {
      this.reenrichCurrentDataset()
      this.saveWorkspaceSettingsNow()
    }
  }

  openIndicatorDialog(): void {
    this.chart.openIndicatorDialog()
  }

  closeIndicatorDialog(): void {
    this.chart.closeIndicatorDialog()
  }

  applyIndicatorSettingsDraft(): void {
    if (!this.chart.applyIndicatorDraft()) {
      return
    }
    this.reenrichCurrentDataset()
    this.saveWorkspaceSettingsNow()
  }

  openSourceTestDialog(): void {
    this.sourceTestOpen = true
    if (this.sourceTestResults.length === 0 && this.sources.length > 0) {
      void this.testDataSources()
    }
  }

  closeSourceTestDialog(): void {
    this.sourceTestOpen = false
  }

  openProxyDialog(): void {
    this.proxyDraft = { ...this.networkProxy }
    this.proxyDialogOpen = true
  }

  closeProxyDialog(): void {
    this.proxyDialogOpen = false
  }

  setProxyEnabled(enabled: boolean): void {
    this.proxyDraft = {
      ...this.proxyDraft,
      enabled
    }
  }

  setProxyProtocol(protocol: NetworkProxySettings['protocol']): void {
    this.proxyDraft = {
      ...this.proxyDraft,
      protocol
    }
  }

  setProxyHost(host: string): void {
    this.proxyDraft = {
      ...this.proxyDraft,
      host
    }
  }

  setProxyPort(port: number | null): void {
    this.proxyDraft = {
      ...this.proxyDraft,
      port: port ?? 7890
    }
  }

  async saveProxySettings(): Promise<void> {
    const settings = await this.dataAdapter.setNetworkProxy(normalizeNetworkProxy(this.proxyDraft))
    runInAction(() => {
      this.networkProxy = settings.networkProxy
      this.proxyDraft = { ...settings.networkProxy }
      this.proxyDialogOpen = false
    })
  }

  async testDataSources(): Promise<void> {
    const baseQuery = this.normalizeQueryForSource(this.query)
    const initialResults = this.sources.map((source) => {
      const query = this.normalizeQueryForSource({
        ...baseQuery,
        sourceId: source.id
      })
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'testing' as const,
        query,
        message: '请求中'
      }
    })

    runInAction(() => {
      this.sourceTestRunning = true
      this.sourceTestResults = initialResults
    })

    await Promise.all(initialResults.map((result) => this.testDataSource(result.query)))

    runInAction(() => {
      this.sourceTestRunning = false
    })
  }

  get loading(): boolean {
    return this.status === 'loading'
  }

  get selectedSource(): StockDataSourceMeta | undefined {
    return this.sources.find((source) => source.id === this.query.sourceId)
  }

  get selectedSourceName(): string {
    return this.selectedSource?.name ?? this.query.sourceId
  }

  get availablePeriodOptions(): Array<{ value: StockPeriod; label: string }> {
    const supported = this.selectedSource?.capabilities.periods ?? []
    return periodOptions.filter((option) => supported.includes(option.value))
  }

  get availableAdjustOptions(): Array<{ value: StockAdjust; label: string }> {
    const supported = this.selectedSource?.capabilities.adjusts ?? []
    return adjustOptions.filter((option) => supported.includes(option.value))
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

  private async loadSources(): Promise<void> {
    const sources = await this.dataAdapter.getStockDataSources()
    runInAction(() => {
      this.sources = sources
      this.query = this.normalizeQueryForSource(this.query)
    })
  }

  private async loadSettings(): Promise<void> {
    try {
      const settings = await this.dataAdapter.getSettings()
      runInAction(() => {
        this.networkProxy = settings.networkProxy
        this.proxyDraft = { ...settings.networkProxy }
        this.query = this.normalizeQueryForSource(settings.workspace.query)
        this.chart.setIndicatorSettings(
          settings.workspace.indicatorSettings,
          settings.workspace.enabledIndicators
        )
      })
    } catch (error) {
      console.warn('Failed to load workspace settings', error)
    }
  }

  private normalizeQueryForSource(query: StockQuery): StockQuery {
    const source = this.sources.find((item) => item.id === query.sourceId)
    if (!source) {
      return query
    }

    const period = source.capabilities.periods.includes(query.period)
      ? query.period
      : source.capabilities.periods.includes('day')
        ? 'day'
        : source.capabilities.periods[0]
    const adjust = source.capabilities.adjusts.includes(query.adjust)
      ? query.adjust
      : source.capabilities.adjusts[0]

    return {
      ...query,
      symbol: query.symbol.trim(),
      period,
      adjust
    }
  }

  private getStartupFallbackQueries(query: StockQuery): StockQuery[] {
    const fallbackPriority: StockSourceId[] = ['tencent', 'sina', 'netease163']
    return fallbackPriority
      .filter((sourceId) => sourceId !== query.sourceId)
      .filter((sourceId) => this.sources.some((source) => source.id === sourceId))
      .map((sourceId) =>
        this.normalizeQueryForSource({
          ...query,
          sourceId
        })
      )
  }

  private sourceNameFor(sourceId: StockSourceId): string {
    return this.sources.find((source) => source.id === sourceId)?.name ?? sourceId
  }

  private async testDataSource(query: StockQuery): Promise<void> {
    const startedAt = performance.now()
    try {
      const dataset = await this.dataAdapter.fetchStockDataset(query)
      this.updateSourceTestResult(query.sourceId, {
        status: 'success',
        elapsedMs: Math.round(performance.now() - startedAt),
        recordCount: dataset.candles.length,
        message: `${periodLabel(query.period)} / ${adjustLabel(query.adjust)}`
      })
    } catch (error) {
      this.updateSourceTestResult(query.sourceId, {
        status: 'error',
        elapsedMs: Math.round(performance.now() - startedAt),
        message: formatErrorMessage(error)
      })
    }
  }

  private updateSourceTestResult(
    sourceId: StockSourceId,
    patch: Partial<Omit<SourceTestResult, 'sourceId' | 'sourceName' | 'query'>>
  ): void {
    runInAction(() => {
      this.sourceTestResults = this.sourceTestResults.map((result) =>
        result.sourceId === sourceId
          ? {
              ...result,
              ...patch
            }
          : result
      )
    })
  }

  private failLoad(error: unknown): void {
    const message = formatErrorMessage(error)
    runInAction(() => {
      this.status = 'error'
      this.error = message
    })
  }

  private queueWorkspaceSettingsSave(): void {
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer)
    }
    this.workspaceSaveTimer = setTimeout(() => {
      this.workspaceSaveTimer = undefined
      this.persistWorkspaceSettings()
    }, WORKSPACE_SAVE_DEBOUNCE_MS)
  }

  private saveWorkspaceSettingsNow(): void {
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer)
      this.workspaceSaveTimer = undefined
    }
    this.persistWorkspaceSettings()
  }

  private persistWorkspaceSettings(): void {
    void this.dataAdapter.setWorkspaceSettings(this.getWorkspaceSettings()).catch((error) => {
      console.warn('Failed to save workspace settings', error)
    })
  }

  private getWorkspaceSettings(): WorkspaceSettings {
    return {
      query: this.normalizeQueryForSource(this.query),
      indicatorSettings: cloneIndicatorSettings(this.chart.indicatorSettings)
    }
  }

  private reenrichCurrentDataset(): void {
    if (!this.chart.dataset) {
      return
    }
    this.chart.setDataset(enrichStockDataset(this.chart.dataset, this.chart.indicatorSettings))
  }
}

export const periodOptions: Array<{ value: StockPeriod; label: string }> = [
  { value: 'day', label: '日线' },
  { value: 'week', label: '周线' },
  { value: 'month', label: '月线' },
  { value: '5', label: '5分钟' },
  { value: '15', label: '15分钟' },
  { value: '30', label: '30分钟' },
  { value: '60', label: '60分钟' }
]

export const adjustOptions: Array<{ value: StockAdjust; label: string }> = [
  { value: 'none', label: '不复权' },
  { value: 'qfq', label: '前复权' },
  { value: 'hfq', label: '后复权' }
]

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function createDefaultStockQuery(): StockQuery {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - 2)

  return {
    sourceId: 'eastmoney',
    symbol: 'sh000001',
    period: 'day',
    adjust: 'qfq',
    startDate: formatDateKey(startDate),
    endDate: formatDateKey(endDate)
  }
}

function createDefaultNetworkProxy(): NetworkProxySettings {
  return {
    enabled: false,
    protocol: 'socks5',
    host: '127.0.0.1',
    port: 7890
  }
}

function normalizeNetworkProxy(proxy: NetworkProxySettings): NetworkProxySettings {
  return {
    enabled: proxy.enabled,
    protocol: proxy.protocol === 'http' ? 'http' : 'socks5',
    host: proxy.host.trim() || '127.0.0.1',
    port: Number.isInteger(proxy.port) && proxy.port > 0 && proxy.port <= 65535 ? proxy.port : 7890
  }
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function normalizeDateInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8)
}

function periodLabel(period: StockPeriod): string {
  return periodOptions.find((option) => option.value === period)?.label ?? period
}

function adjustLabel(adjust: StockAdjust): string {
  return adjustOptions.find((option) => option.value === adjust)?.label ?? adjust
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
