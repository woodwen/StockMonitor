import { makeAutoObservable, runInAction } from 'mobx'
import type { NetworkProxySettings, WorkspaceSettings } from '../../../../preload/stock-api'
import { enrichStockDataset, getLatestCandle } from '../models/indicator-engine'
import { cloneIndicatorSettings } from '../models/indicator-definitions'
import { cloneTimeshareIndicatorSettings } from '../models/timeshare-indicator-definitions'
import type {
  IndicatorName,
  StockAdjust,
  StockDataSourceMeta,
  StockPeriod,
  StockQuery,
  StockSourceId,
  StockTimeshareQuery,
  WorkspaceViewMode
} from '../models/stock-types'
import type { StockDataAdapter } from '../adapters/ElectronStockDataAdapter'
import { KLineChartViewModel } from './KLineChartViewModel'
import { TimeshareChartViewModel } from './TimeshareChartViewModel'

export type RemoteLoadStatus = 'idle' | 'loading' | 'success' | 'error'
export type SourceTestStatus = 'testing' | 'success' | 'error'

export interface SourceTestResult {
  sourceId: StockSourceId
  sourceName: string
  status: SourceTestStatus
  mode: WorkspaceViewMode
  query: StockQuery | StockTimeshareQuery
  requestLabel: string
  supportsTimeshare: boolean
  message: string
  elapsedMs?: number
  recordCount?: number
}

const WORKSPACE_SAVE_DEBOUNCE_MS = 500
const TIMESHARE_REFRESH_INTERVAL_MS = 15_000

export class StockWorkspaceViewModel {
  readonly chart = new KLineChartViewModel()
  readonly timeshare = new TimeshareChartViewModel()

  sources: StockDataSourceMeta[] = []
  query: StockQuery = createDefaultStockQuery()
  timeshareSourceId: StockSourceId = 'eastmoney'
  viewMode: WorkspaceViewMode = 'timeshare'
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
  private timeshareRefreshTimer?: ReturnType<typeof setTimeout>
  private timeshareRequestId = 0

  constructor(private readonly dataAdapter: StockDataAdapter) {
    makeAutoObservable<
      this,
      'dataAdapter' | 'workspaceSaveTimer' | 'timeshareRefreshTimer' | 'timeshareRequestId'
    >(
      this,
      {
        dataAdapter: false,
        workspaceSaveTimer: false,
        timeshareRefreshTimer: false,
        timeshareRequestId: false
      },
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
    this.addVisibilityListener()
    await this.refreshStock({ allowStartupFallback: true })
  }

  dispose(): void {
    this.removeVisibilityListener()
    this.stopTimeshareAutoRefresh()
    if (this.workspaceSaveTimer) {
      clearTimeout(this.workspaceSaveTimer)
      this.workspaceSaveTimer = undefined
      this.persistWorkspaceSettings()
    }
  }

  async refreshStock(options: { allowStartupFallback?: boolean; silent?: boolean } = {}): Promise<void> {
    if (this.viewMode === 'timeshare') {
      await this.refreshTimeshare(options)
      return
    }
    await this.refreshKline(options)
  }

  private async refreshKline(options: { allowStartupFallback?: boolean } = {}): Promise<void> {
    this.stopTimeshareAutoRefresh()
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

  private async refreshTimeshare(options: { silent?: boolean } = {}): Promise<void> {
    this.stopTimeshareAutoRefresh()
    const query = this.createTimeshareQuery()
    const requestId = ++this.timeshareRequestId

    if (!options.silent) {
      this.status = 'loading'
      this.error = ''
    }

    try {
      const dataset = await this.dataAdapter.fetchStockTimeshareDataset(query)
      if (requestId !== this.timeshareRequestId) {
        return
      }
      runInAction(() => {
        this.query = {
          ...this.query,
          symbol: query.symbol
        }
        this.timeshare.setDataset(dataset)
        this.status = 'success'
        this.error = ''
      })
      this.scheduleTimeshareAutoRefresh()
    } catch (error) {
      if (requestId !== this.timeshareRequestId) {
        return
      }
      this.failLoad(error)
      this.scheduleTimeshareAutoRefresh()
    }
  }

  setViewMode(viewMode: WorkspaceViewMode): void {
    if (this.viewMode === viewMode) {
      return
    }
    this.viewMode = viewMode
    this.error = ''
    this.sourceTestResults = []
    if (viewMode === 'kline') {
      this.stopTimeshareAutoRefresh()
    }
    this.saveWorkspaceSettingsNow()
    void this.refreshStock()
  }

  setSymbol(symbol: string): void {
    this.query = {
      ...this.query,
      symbol
    }
    this.queueWorkspaceSettingsSave()
  }

  setSourceId(sourceId: StockSourceId): void {
    if (this.viewMode === 'timeshare') {
      if (!this.canUseSourceForCurrentMode(sourceId)) {
        return
      }
      this.timeshareSourceId = sourceId
      this.sourceTestResults = []
      this.saveWorkspaceSettingsNow()
      return
    }

    this.query = this.normalizeQueryForSource({
      ...this.query,
      sourceId
    })
    this.sourceTestResults = []
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
    if (this.viewMode === 'timeshare') {
      this.timeshare.openIndicatorDialog()
      return
    }
    this.chart.openIndicatorDialog()
  }

  closeIndicatorDialog(): void {
    if (this.viewMode === 'timeshare') {
      this.timeshare.closeIndicatorDialog()
      return
    }
    this.chart.closeIndicatorDialog()
  }

  applyIndicatorSettingsDraft(): void {
    if (this.viewMode === 'timeshare') {
      if (this.timeshare.applyIndicatorDraft()) {
        this.saveWorkspaceSettingsNow()
      }
      return
    }
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
      if (this.viewMode === 'timeshare') {
        const query = this.createTimeshareQuery(source.id)
        const supportsTimeshare = source.capabilities.timeshare
        return {
          sourceId: source.id,
          sourceName: source.name,
          status: supportsTimeshare ? ('testing' as const) : ('error' as const),
          mode: 'timeshare' as const,
          query,
          requestLabel: `${query.symbol} 分时`,
          supportsTimeshare,
          message: supportsTimeshare ? '请求中' : '不支持分时'
        }
      }

      const query = this.normalizeQueryForSource({
        ...baseQuery,
        sourceId: source.id
      })
      return {
        sourceId: source.id,
        sourceName: source.name,
        status: 'testing' as const,
        mode: 'kline' as const,
        query,
        requestLabel: `${query.symbol} ${periodLabel(query.period)} ${adjustLabel(query.adjust)}`,
        supportsTimeshare: source.capabilities.timeshare,
        message: '请求中'
      }
    })

    runInAction(() => {
      this.sourceTestRunning = true
      this.sourceTestResults = initialResults
    })

    await Promise.all(
      initialResults
        .filter((result) => result.status === 'testing')
        .map((result) => this.testDataSource(result))
    )

    runInAction(() => {
      this.sourceTestRunning = false
    })
  }

  get loading(): boolean {
    return this.status === 'loading'
  }

  get selectedKlineSource(): StockDataSourceMeta | undefined {
    return this.sources.find((source) => source.id === this.query.sourceId)
  }

  get selectedTimeshareSource(): StockDataSourceMeta | undefined {
    return this.sources.find((source) => source.id === this.timeshareSourceId)
  }

  get activeSource(): StockDataSourceMeta | undefined {
    return this.viewMode === 'timeshare' ? this.selectedTimeshareSource : this.selectedKlineSource
  }

  get selectedSource(): StockDataSourceMeta | undefined {
    return this.activeSource
  }

  get selectedSourceName(): string {
    return this.activeSourceName
  }

  get selectedKlineSourceName(): string {
    return this.selectedKlineSource?.name ?? this.query.sourceId
  }

  get selectedTimeshareSourceName(): string {
    return this.selectedTimeshareSource?.name ?? this.timeshareSourceId
  }

  get activeSourceName(): string {
    return this.viewMode === 'timeshare' ? this.selectedTimeshareSourceName : this.selectedKlineSourceName
  }

  get availablePeriodOptions(): Array<{ value: StockPeriod; label: string }> {
    const supported = this.selectedKlineSource?.capabilities.periods ?? []
    return periodOptions.filter((option) => supported.includes(option.value))
  }

  get availableAdjustOptions(): Array<{ value: StockAdjust; label: string }> {
    const supported = this.selectedKlineSource?.capabilities.adjusts ?? []
    return adjustOptions.filter((option) => supported.includes(option.value))
  }

  get activeTitle(): string {
    return this.viewMode === 'timeshare' ? this.timeshare.title : this.chart.title
  }

  get activeSourceLabel(): string {
    return this.viewMode === 'timeshare' ? this.timeshare.sourceLabel : this.chart.sourceLabel
  }

  get latestSummary(): string {
    if (this.viewMode === 'timeshare') {
      return this.timeshare.latestSummary
    }
    const latest = getLatestCandle(this.chart.dataset)
    if (!latest) {
      return '暂无行情'
    }
    return `收 ${formatNumber(latest.close)}  高 ${formatNumber(latest.high)}  低 ${formatNumber(latest.low)}  量 ${formatNumber(latest.volume, 0)}`
  }

  get recordCount(): number {
    if (this.viewMode === 'timeshare') {
      return this.timeshare.recordCount
    }
    return this.chart.dataset?.candles.length ?? 0
  }

  canUseSourceForCurrentMode(sourceId: StockSourceId): boolean {
    if (this.viewMode === 'kline') {
      return true
    }
    return Boolean(this.sources.find((source) => source.id === sourceId)?.capabilities.timeshare)
  }

  isSourceActiveForCurrentMode(sourceId: StockSourceId): boolean {
    return this.viewMode === 'timeshare'
      ? this.timeshareSourceId === sourceId
      : this.query.sourceId === sourceId
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
        this.viewMode = normalizeWorkspaceViewMode(settings.workspace.viewMode)
        this.timeshareSourceId = this.normalizeTimeshareSourceId(settings.workspace.timeshareSourceId)
        this.query = this.normalizeQueryForSource(settings.workspace.query)
        this.chart.setIndicatorSettings(
          settings.workspace.indicatorSettings,
          settings.workspace.enabledIndicators
        )
        this.timeshare.setIndicatorSettings(settings.workspace.timeshareIndicatorSettings)
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

  private normalizeTimeshareSourceId(sourceId: StockSourceId | undefined): StockSourceId {
    const source = this.sources.find((item) => item.id === sourceId)
    return source?.capabilities.timeshare ? source.id : 'eastmoney'
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

  private createTimeshareQuery(sourceId: StockSourceId = this.timeshareSourceId): StockTimeshareQuery {
    return {
      sourceId,
      symbol: this.query.symbol.trim()
    }
  }

  private sourceNameFor(sourceId: StockSourceId): string {
    return this.sources.find((source) => source.id === sourceId)?.name ?? sourceId
  }

  private async testDataSource(result: SourceTestResult): Promise<void> {
    const startedAt = performance.now()
    try {
      if (result.mode === 'timeshare') {
        const dataset = await this.dataAdapter.fetchStockTimeshareDataset(
          result.query as StockTimeshareQuery
        )
        this.updateSourceTestResult(result.sourceId, {
          status: 'success',
          elapsedMs: Math.round(performance.now() - startedAt),
          recordCount: dataset.points.length,
          message: '分时'
        })
      } else {
        const query = result.query as StockQuery
        const dataset = await this.dataAdapter.fetchStockDataset(query)
        this.updateSourceTestResult(query.sourceId, {
          status: 'success',
          elapsedMs: Math.round(performance.now() - startedAt),
          recordCount: dataset.candles.length,
          message: `${periodLabel(query.period)} / ${adjustLabel(query.adjust)}`
        })
      }
    } catch (error) {
      this.updateSourceTestResult(result.sourceId, {
        status: 'error',
        elapsedMs: Math.round(performance.now() - startedAt),
        message: formatErrorMessage(error)
      })
    }
  }

  private updateSourceTestResult(
    sourceId: StockSourceId,
    patch: Partial<
      Omit<
        SourceTestResult,
        'sourceId' | 'sourceName' | 'mode' | 'query' | 'requestLabel' | 'supportsTimeshare'
      >
    >
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

  private scheduleTimeshareAutoRefresh(): void {
    this.stopTimeshareAutoRefresh()
    if (
      this.viewMode !== 'timeshare' ||
      !isDocumentVisible() ||
      !isAshareTradingTime(new Date())
    ) {
      return
    }

    this.timeshareRefreshTimer = setTimeout(() => {
      this.timeshareRefreshTimer = undefined
      void this.refreshTimeshare({ silent: true })
    }, TIMESHARE_REFRESH_INTERVAL_MS)
  }

  private stopTimeshareAutoRefresh(): void {
    if (!this.timeshareRefreshTimer) {
      return
    }
    clearTimeout(this.timeshareRefreshTimer)
    this.timeshareRefreshTimer = undefined
  }

  private addVisibilityListener(): void {
    if (typeof document === 'undefined') {
      return
    }
    document.addEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private removeVisibilityListener(): void {
    if (typeof document === 'undefined') {
      return
    }
    document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }

  private handleVisibilityChange(): void {
    if (this.viewMode !== 'timeshare') {
      return
    }
    if (!isDocumentVisible()) {
      this.stopTimeshareAutoRefresh()
      return
    }
    void this.refreshTimeshare({ silent: true })
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
      viewMode: this.viewMode,
      timeshareSourceId: this.timeshareSourceId,
      query: this.normalizeQueryForSource(this.query),
      indicatorSettings: cloneIndicatorSettings(this.chart.indicatorSettings),
      timeshareIndicatorSettings: cloneTimeshareIndicatorSettings(this.timeshare.indicatorSettings)
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

function normalizeWorkspaceViewMode(value: WorkspaceSettings['viewMode']): WorkspaceViewMode {
  return value === 'kline' ? 'kline' : 'timeshare'
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

function isDocumentVisible(): boolean {
  return typeof document === 'undefined' || document.visibilityState === 'visible'
}

function isAshareTradingTime(date: Date): boolean {
  const day = date.getDay()
  if (day === 0 || day === 6) {
    return false
  }
  const minutes = date.getHours() * 60 + date.getMinutes()
  return (minutes >= 9 * 60 + 30 && minutes <= 11 * 60 + 30) || (minutes >= 13 * 60 && minutes <= 15 * 60)
}
