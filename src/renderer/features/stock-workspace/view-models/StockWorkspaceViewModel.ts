import { makeAutoObservable, runInAction } from 'mobx'
import type { NetworkProxySettings, WorkspaceSettings } from '../../../../preload/stock-api'
import { enrichStockDataset, getLatestCandle } from '../models/indicator-engine'
import { cloneIndicatorSettings } from '../models/indicator-definitions'
import { cloneTimeshareIndicatorSettings } from '../models/timeshare-indicator-definitions'
import type {
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorName,
  IndicatorSettingsMap,
  KlineCacheJob,
  KlineCacheRequestQuery,
  KlineCacheSeriesRequestItem,
  KlineCacheStatusRequest,
  KlineCacheStatusRow,
  StockAdjust,
  StockDataSourceMeta,
  StockPeriod,
  StockQuery,
  StockSourceId,
  StockTimeshareQuery,
  TimeshareAdvancedContextKey,
  TimeshareIndicatorName,
  WatchlistItem,
  WatchlistParseResult,
  WorkspaceViewMode
} from '../models/stock-types'
import {
  addWatchlistItems,
  createWatchlistItem,
  normalizeWatchlist,
  normalizeWatchlistName,
  normalizeWatchlistSymbol,
  parseWatchlistText,
  removeWatchlistSymbols
} from '../models/watchlist'
import {
  DEFAULT_KLINE_CACHE_ADJUSTS,
  DEFAULT_KLINE_CACHE_PERIODS,
  createKlineCacheRequestQuery,
  getKlineCacheRequestError,
  normalizeKlineCacheAdjusts,
  normalizeKlineCachePeriods
} from '../models/kline-cache'
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
const KLINE_CACHE_JOB_POLL_INTERVAL_MS = 1_000

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
  watchlist: WatchlistItem[] = []
  watchlistOpen = false
  watchlistManageMode = false
  selectedWatchlistSymbols: string[] = []
  watchlistAddText = ''
  watchlistAddPreview: WatchlistParseResult = createEmptyWatchlistParseResult()
  watchlistPasteError = ''
  klineCacheDialogOpen = false
  klineCacheLoading = false
  klineCacheError = ''
  klineCacheRows: KlineCacheStatusRow[] = []
  klineCacheSelectedRowIds: string[] = []
  klineCacheQuery: KlineCacheRequestQuery = createKlineCacheRequestQuery(createDefaultStockQuery())
  klineCacheJob: KlineCacheJob | null = null
  private workspaceSaveTimer?: ReturnType<typeof setTimeout>
  private timeshareRefreshTimer?: ReturnType<typeof setTimeout>
  private klineCacheJobTimer?: ReturnType<typeof setTimeout>
  private klineCacheStatusRequestId = 0
  private timeshareRequestId = 0

  constructor(private readonly dataAdapter: StockDataAdapter) {
    makeAutoObservable<
      this,
      | 'dataAdapter'
      | 'workspaceSaveTimer'
      | 'timeshareRefreshTimer'
      | 'klineCacheJobTimer'
      | 'klineCacheStatusRequestId'
      | 'timeshareRequestId'
    >(
      this,
      {
        dataAdapter: false,
        workspaceSaveTimer: false,
        timeshareRefreshTimer: false,
        klineCacheJobTimer: false,
        klineCacheStatusRequestId: false,
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
    this.stopKlineCacheJobPolling()
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
    const enriched = enrichStockDataset(dataset, this.chart.effectiveIndicatorSettings)
    let shouldSaveWatchlist = false
    runInAction(() => {
      this.query = query
      this.chart.setDataset(enriched)
      this.status = 'success'
      this.error = ''
      shouldSaveWatchlist = this.updateWatchlistItemName(query.symbol, dataset.meta.name)
    })
    if (shouldSaveWatchlist) {
      this.saveWorkspaceSettingsNow()
    }
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
      let shouldSaveWatchlist = false
      runInAction(() => {
        this.query = {
          ...this.query,
          symbol: query.symbol
        }
        this.timeshare.setDataset(dataset)
        this.status = 'success'
        this.error = ''
        shouldSaveWatchlist = this.updateWatchlistItemName(query.symbol, dataset.meta.name)
      })
      if (shouldSaveWatchlist) {
        this.saveWorkspaceSettingsNow()
      }
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

  toggleWatchlistOpen(): void {
    this.watchlistOpen = !this.watchlistOpen
    if (!this.watchlistOpen) {
      this.exitWatchlistManageMode()
    }
  }

  setWatchlistAddText(text: string): void {
    this.watchlistAddText = text
    this.watchlistPasteError = ''
    this.previewWatchlistAdditions()
  }

  appendWatchlistAddText(text: string): void {
    const content = text.trim()
    if (!content) {
      this.watchlistPasteError = '剪切板没有可添加的文本'
      return
    }

    const current = this.watchlistAddText.trimEnd()
    this.watchlistAddText = current ? `${current}\n${content}` : content
    this.watchlistPasteError = ''
    this.previewWatchlistAdditions()
  }

  setWatchlistPasteError(message: string): void {
    this.watchlistPasteError = message
  }

  previewWatchlistAdditions(): void {
    this.watchlistAddPreview = parseWatchlistText(this.watchlistAddText, this.watchlist)
  }

  confirmWatchlistAdditions(): void {
    const preview = parseWatchlistText(this.watchlistAddText, this.watchlist)
    const additions = preview.previews
      .filter((item) => item.status === 'ready' && item.item)
      .map((item) => item.item as WatchlistItem)

    this.watchlistAddPreview = preview
    if (additions.length === 0) {
      return
    }

    this.watchlist = addWatchlistItems(this.watchlist, additions)
    this.watchlistAddText = ''
    this.watchlistAddPreview = createEmptyWatchlistParseResult()
    this.saveWorkspaceSettingsNow()
  }

  addCurrentToWatchlist(): void {
    const item = createWatchlistItem(this.query.symbol, this.currentStockName)
    if (!item) {
      return
    }
    const next = addWatchlistItems(this.watchlist, [item])
    if (next.length === this.watchlist.length) {
      return
    }
    this.watchlist = next
    this.saveWorkspaceSettingsNow()
  }

  async selectWatchlistItem(symbol: string): Promise<void> {
    const normalizedSymbol = normalizeWatchlistSymbol(symbol)
    if (!normalizedSymbol) {
      return
    }
    this.query = {
      ...this.query,
      symbol: normalizedSymbol
    }
    this.error = ''
    this.sourceTestResults = []
    this.saveWorkspaceSettingsNow()
    await this.refreshStock()
  }

  toggleWatchlistManageMode(): void {
    this.watchlistManageMode = !this.watchlistManageMode
    this.selectedWatchlistSymbols = []
  }

  toggleWatchlistSelection(symbol: string, selected: boolean): void {
    const normalizedSymbol = normalizeWatchlistSymbol(symbol)
    if (!normalizedSymbol) {
      return
    }

    if (selected) {
      if (!this.selectedWatchlistSymbols.includes(normalizedSymbol)) {
        this.selectedWatchlistSymbols = [...this.selectedWatchlistSymbols, normalizedSymbol]
      }
      return
    }

    this.selectedWatchlistSymbols = this.selectedWatchlistSymbols.filter(
      (item) => item !== normalizedSymbol
    )
  }

  selectAllWatchlistItems(): void {
    this.selectedWatchlistSymbols = this.watchlist.map((item) => item.symbol)
  }

  invertWatchlistSelection(): void {
    const selected = new Set(this.selectedWatchlistSymbols)
    this.selectedWatchlistSymbols = this.watchlist
      .map((item) => item.symbol)
      .filter((symbol) => !selected.has(symbol))
  }

  removeSelectedWatchlistItems(): void {
    if (this.selectedWatchlistSymbols.length === 0) {
      return
    }
    this.watchlist = removeWatchlistSymbols(this.watchlist, this.selectedWatchlistSymbols)
    this.klineCacheSelectedRowIds = this.klineCacheSelectedRowIds.filter((rowId) =>
      this.klineCacheRows.some(
        (row) => row.id === rowId && this.watchlist.some((item) => item.symbol === row.symbol)
      )
    )
    this.exitWatchlistManageMode()
    this.saveWorkspaceSettingsNow()
  }

  openKlineCacheDialog(): void {
    this.klineCacheQuery = this.normalizeKlineCacheQuery(createKlineCacheRequestQuery(this.query))
    this.klineCacheSelectedRowIds = []
    this.klineCacheError = ''
    this.klineCacheDialogOpen = true
    if (this.watchlist.length === 0) {
      this.klineCacheRows = []
      return
    }
    void this.loadKlineCacheStatus()
    if (this.klineCacheJob && isKlineCacheJobActive(this.klineCacheJob)) {
      this.scheduleKlineCacheJobPolling()
    }
  }

  closeKlineCacheDialog(): void {
    this.klineCacheDialogOpen = false
    this.klineCacheError = ''
    this.stopKlineCacheJobPolling()
  }

  setKlineCacheSourceId(sourceId: StockSourceId): void {
    this.klineCacheQuery = this.normalizeKlineCacheQuery({
      ...this.klineCacheQuery,
      sourceId
    })
    this.resetKlineCacheRowsForQueryChange()
    void this.loadKlineCacheStatus()
  }

  setKlineCachePeriods(periods: StockPeriod[]): void {
    this.klineCacheQuery = this.normalizeKlineCacheQuery({
      ...this.klineCacheQuery,
      periods
    })
    this.resetKlineCacheRowsForQueryChange()
    void this.loadKlineCacheStatus()
  }

  setKlineCacheAdjusts(adjusts: StockAdjust[]): void {
    this.klineCacheQuery = this.normalizeKlineCacheQuery({
      ...this.klineCacheQuery,
      adjusts
    })
    this.resetKlineCacheRowsForQueryChange()
    void this.loadKlineCacheStatus()
  }

  setKlineCachePeriod(period: StockPeriod): void {
    this.setKlineCachePeriods([period])
  }

  setKlineCacheAdjust(adjust: StockAdjust): void {
    this.setKlineCacheAdjusts([adjust])
  }

  setKlineCacheStartDate(startDate: string): void {
    this.klineCacheStatusRequestId += 1
    this.klineCacheLoading = false
    this.klineCacheQuery = {
      ...this.klineCacheQuery,
      startDate: normalizeDateInput(startDate)
    }
    this.resetKlineCacheRowsForQueryChange()
  }

  setKlineCacheEndDate(endDate: string): void {
    this.klineCacheStatusRequestId += 1
    this.klineCacheLoading = false
    this.klineCacheQuery = {
      ...this.klineCacheQuery,
      endDate: normalizeDateInput(endDate)
    }
    this.resetKlineCacheRowsForQueryChange()
  }

  async loadKlineCacheStatus(): Promise<void> {
    if (this.watchlist.length === 0) {
      runInAction(() => {
        this.klineCacheRows = []
        this.klineCacheLoading = false
        this.klineCacheError = ''
      })
      return
    }
    const formError = this.klineCacheFormError
    if (formError) {
      runInAction(() => {
        this.klineCacheLoading = false
        this.klineCacheError = formError
      })
      return
    }

    const request = this.createKlineCacheRequest(this.watchlist)
    const requestId = ++this.klineCacheStatusRequestId
    this.klineCacheLoading = true
    this.klineCacheError = ''
    try {
      const rows = await this.dataAdapter.getKlineCacheStatus(request)
      runInAction(() => {
        if (this.klineCacheStatusRequestId !== requestId) {
          return
        }
        this.klineCacheRows = rows
        this.klineCacheSelectedRowIds = this.klineCacheSelectedRowIds.filter((rowId) =>
          rows.some((row) => row.id === rowId)
        )
        this.klineCacheLoading = false
        this.klineCacheError = ''
      })
    } catch (error) {
      runInAction(() => {
        if (this.klineCacheStatusRequestId !== requestId) {
          return
        }
        this.klineCacheLoading = false
        this.klineCacheError = formatErrorMessage(error)
      })
    }
  }

  async refreshAllKlineCache(): Promise<void> {
    await this.startKlineCacheRefresh(this.watchlist)
  }

  async refreshSelectedKlineCache(): Promise<void> {
    const selectedRows = this.selectedKlineCacheRows
    if (selectedRows.length === 0) {
      return
    }
    await this.startKlineCacheRefresh(this.watchlist, selectedRows)
  }

  async cancelKlineCacheRefresh(): Promise<void> {
    if (!this.klineCacheJob || !isKlineCacheJobActive(this.klineCacheJob)) {
      return
    }
    try {
      const job = await this.dataAdapter.cancelKlineCacheJob(this.klineCacheJob.id)
      runInAction(() => {
        this.klineCacheJob = job
      })
      if (job && isKlineCacheJobActive(job)) {
        this.scheduleKlineCacheJobPolling()
      }
    } catch (error) {
      runInAction(() => {
        this.klineCacheError = formatErrorMessage(error)
      })
    }
  }

  async clearSelectedKlineCache(): Promise<void> {
    const selectedRows = this.selectedKlineCacheRows
    if (selectedRows.length === 0 || this.klineCacheFormError) {
      return
    }

    this.klineCacheLoading = true
    this.klineCacheError = ''
    try {
      const rows = await this.dataAdapter.clearKlineCache(
        this.createKlineCacheRequest(this.watchlist, selectedRows)
      )
      runInAction(() => {
        const updatedRows = new Map(rows.map((row) => [row.id, row]))
        this.klineCacheRows = this.klineCacheRows.map((row) => updatedRows.get(row.id) ?? row)
        this.klineCacheSelectedRowIds = []
        this.klineCacheLoading = false
      })
    } catch (error) {
      runInAction(() => {
        this.klineCacheLoading = false
        this.klineCacheError = formatErrorMessage(error)
      })
    }
  }

  toggleKlineCacheSelection(rowId: string, selected: boolean): void {
    if (!this.klineCacheRows.some((row) => row.id === rowId)) {
      return
    }
    if (selected) {
      if (!this.klineCacheSelectedRowIds.includes(rowId)) {
        this.klineCacheSelectedRowIds = [...this.klineCacheSelectedRowIds, rowId]
      }
      return
    }
    this.klineCacheSelectedRowIds = this.klineCacheSelectedRowIds.filter((item) => item !== rowId)
  }

  setKlineCacheSelectedRowIds(rowIds: string[]): void {
    const available = new Set(this.klineCacheRows.map((row) => row.id))
    const next: string[] = []
    rowIds.forEach((rowId) => {
      if (available.has(rowId) && !next.includes(rowId)) {
        next.push(rowId)
      }
    })
    this.klineCacheSelectedRowIds = next
  }

  setKlineCacheSelectedSymbols(symbols: string[]): void {
    const normalizedSymbols = new Set(
      symbols
        .map((symbol) => normalizeWatchlistSymbol(symbol))
        .filter((symbol): symbol is string => Boolean(symbol))
    )
    this.setKlineCacheSelectedRowIds(
      this.klineCacheRows
        .filter((row) => normalizedSymbols.has(row.symbol))
        .map((row) => row.id)
    )
  }

  selectAllKlineCacheRows(): void {
    this.klineCacheSelectedRowIds = this.klineCacheRows.map((row) => row.id)
  }

  clearKlineCacheSelection(): void {
    this.klineCacheSelectedRowIds = []
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
    const hadPreview = Boolean(this.chart.previewIndicatorSettings)
    this.chart.closeIndicatorDialog()
    if (hadPreview) {
      this.reenrichCurrentDataset()
    }
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

  setKLineIndicatorDraftEnabled(name: IndicatorName, enabled: boolean): void {
    const previousRevision = this.chart.revision
    this.chart.setIndicatorDraftEnabled(name, enabled)
    this.reenrichPreviewDatasetIfNeeded(name, previousRevision)
  }

  setKLineIndicatorDraftParam(name: IndicatorName, index: number, value: number): void {
    const previousRevision = this.chart.revision
    this.chart.setIndicatorDraftParam(name, index, value)
    this.reenrichPreviewDatasetIfNeeded(name, previousRevision)
  }

  setKLineIndicatorDraftPrecision(name: IndicatorName, precision: number): void {
    this.chart.setIndicatorDraftPrecision(name, precision)
  }

  setKLineIndicatorDraftLineColor(name: IndicatorName, index: number, color: string): void {
    this.chart.setIndicatorDraftLineColor(name, index, color)
  }

  setKLineIndicatorDraftLineStyle(
    name: IndicatorName,
    index: number,
    lineStyle: IndicatorLineStyle
  ): void {
    this.chart.setIndicatorDraftLineStyle(name, index, lineStyle)
  }

  setKLineIndicatorDraftBarColor(
    name: IndicatorName,
    key: keyof IndicatorBarVisualStyle,
    color: string
  ): void {
    this.chart.setIndicatorDraftBarColor(name, key, color)
  }

  setKLineIndicatorDraftMarkerColor(
    name: IndicatorName,
    key: 'buyColor' | 'sellColor',
    color: string
  ): void {
    this.chart.setIndicatorDraftMarkerColor(name, key, color)
  }

  resetKLineIndicatorDraftParams(name: IndicatorName): void {
    const previousRevision = this.chart.revision
    this.chart.resetIndicatorDraftParams(name)
    this.reenrichPreviewDatasetIfNeeded(name, previousRevision)
  }

  resetKLineIndicatorDraftStyle(name: IndicatorName): void {
    this.chart.resetIndicatorDraftStyle(name)
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

  get normalizedCurrentSymbol(): string {
    return normalizeWatchlistSymbol(this.query.symbol) ?? this.query.symbol.trim().toLowerCase()
  }

  get isCurrentSymbolWatched(): boolean {
    const symbol = normalizeWatchlistSymbol(this.query.symbol)
    return Boolean(symbol && this.watchlist.some((item) => item.symbol === symbol))
  }

  get selectedWatchlistCount(): number {
    return this.selectedWatchlistSymbols.length
  }

  get canAddWatchlistPreview(): boolean {
    return this.watchlistAddPreview.previews.some((item) => item.status === 'ready')
  }

  get canDeleteSelectedWatchlistItems(): boolean {
    return this.selectedWatchlistSymbols.length > 0
  }

  get selectedKlineCacheCount(): number {
    return this.klineCacheSelectedRowIds.length
  }

  get selectedKlineCacheRows(): KlineCacheStatusRow[] {
    const selected = new Set(this.klineCacheSelectedRowIds)
    return this.klineCacheRows.filter((row) => selected.has(row.id))
  }

  get klineCacheFormError(): string {
    return getKlineCacheRequestError(this.klineCacheQuery)
  }

  get klineCacheRunning(): boolean {
    return Boolean(this.klineCacheJob && isKlineCacheJobActive(this.klineCacheJob))
  }

  get klineCacheProgressPercent(): number {
    if (!this.klineCacheJob || this.klineCacheJob.total === 0) {
      return 0
    }
    return Math.round((this.klineCacheJob.completed / this.klineCacheJob.total) * 100)
  }

  get canRefreshKlineCache(): boolean {
    return this.watchlist.length > 0 && !this.klineCacheRunning && !this.klineCacheFormError
  }

  get canRefreshSelectedKlineCache(): boolean {
    return this.selectedKlineCacheCount > 0 && !this.klineCacheRunning && !this.klineCacheFormError
  }

  get canClearSelectedKlineCache(): boolean {
    return this.selectedKlineCacheCount > 0 && !this.klineCacheRunning && !this.klineCacheFormError
  }

  get klineCachePeriodOptions(): Array<{ value: StockPeriod; label: string }> {
    const source = this.sources.find((item) => item.id === this.klineCacheQuery.sourceId)
    const supported = source?.capabilities.periods ?? []
    return DEFAULT_KLINE_CACHE_PERIODS.filter((period) => supported.includes(period)).map(
      (period) => periodOptions.find((option) => option.value === period) ?? { value: period, label: period }
    )
  }

  get klineCacheAdjustOptions(): Array<{ value: StockAdjust; label: string }> {
    const source = this.sources.find((item) => item.id === this.klineCacheQuery.sourceId)
    const supported = source?.capabilities.adjusts ?? []
    return DEFAULT_KLINE_CACHE_ADJUSTS.filter((adjust) => supported.includes(adjust)).map(
      (adjust) => adjustOptions.find((option) => option.value === adjust) ?? { value: adjust, label: adjust }
    )
  }

  get currentStockName(): string {
    const dataset = this.viewMode === 'timeshare' ? this.timeshare.dataset : this.chart.dataset
    const name = normalizeWatchlistName(dataset?.meta.name)
    return name || this.normalizedCurrentSymbol
  }

  canUseSourceForCurrentMode(sourceId: StockSourceId): boolean {
    if (this.viewMode === 'kline') {
      return true
    }
    return Boolean(this.sources.find((source) => source.id === sourceId)?.capabilities.timeshare)
  }

  getTimeshareIndicatorAvailability(name: TimeshareIndicatorName): {
    available: boolean
    message: string
  } {
    const datasetSymbol = normalizeWatchlistSymbol(this.timeshare.dataset?.meta.symbol ?? '')
    const currentSymbol = normalizeWatchlistSymbol(this.query.symbol.trim())
    const runtimeAvailability =
      this.timeshare.dataset?.sourceId === this.timeshareSourceId &&
      Boolean(datasetSymbol && currentSymbol && datasetSymbol === currentSymbol)
        ? this.timeshare.getIndicatorAvailability(name)
        : undefined
    if (runtimeAvailability) {
      return {
        available: runtimeAvailability.status === 'available',
        message:
          runtimeAvailability.status === 'available'
            ? `可用${runtimeAvailability.basis ? `：${runtimeAvailability.basis}` : ''}`
            : runtimeAvailability.reason ?? '当前数据不可用'
      }
    }

    const contextKey = timeshareIndicatorContextMap[name]
    if (!contextKey) {
      return {
        available: true,
        message: ''
      }
    }

    const capability = this.selectedTimeshareSource?.capabilities.timeshareAdvanced?.[contextKey]
    if (!capability) {
      return {
        available: false,
        message: '当前数据源未声明高级上下文能力'
      }
    }
    if (capability.status !== 'supported') {
      return {
        available: false,
        message: capability.reason ?? '当前数据源暂不支持'
      }
    }
    return {
      available: true,
      message: '当前数据源支持，刷新后确认本次数据'
    }
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
        this.watchlist = normalizeWatchlist(settings.workspace.watchlist)
        this.watchlistAddPreview = parseWatchlistText(this.watchlistAddText, this.watchlist)
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

  private normalizeKlineCacheQuery(query: KlineCacheRequestQuery): KlineCacheRequestQuery {
    const source = this.sources.find((item) => item.id === query.sourceId)
    const periods = normalizeKlineCachePeriods(query.periods).filter((period) =>
      source ? source.capabilities.periods.includes(period) : true
    )
    const adjusts = normalizeKlineCacheAdjusts(query.adjusts).filter((adjust) =>
      source ? source.capabilities.adjusts.includes(adjust) : true
    )
    return {
      sourceId: query.sourceId,
      periods,
      adjusts,
      startDate: normalizeDateInput(query.startDate),
      endDate: normalizeDateInput(query.endDate)
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

  private async startKlineCacheRefresh(
    items: WatchlistItem[],
    rows: KlineCacheStatusRow[] = []
  ): Promise<void> {
    const normalizedItems = normalizeWatchlist(items)
    if (normalizedItems.length === 0 && rows.length === 0) {
      return
    }
    const formError = this.klineCacheFormError
    if (formError) {
      this.klineCacheError = formError
      return
    }

    this.stopKlineCacheJobPolling()
    this.klineCacheError = ''
    try {
      const job = await this.dataAdapter.startKlineCacheRefresh(
        this.createKlineCacheRequest(normalizedItems, rows)
      )
      runInAction(() => {
        this.klineCacheJob = job
      })
      if (isKlineCacheJobActive(job)) {
        this.scheduleKlineCacheJobPolling()
      } else {
        await this.loadKlineCacheStatus()
      }
    } catch (error) {
      runInAction(() => {
        this.klineCacheError = formatErrorMessage(error)
      })
    }
  }

  private scheduleKlineCacheJobPolling(): void {
    this.stopKlineCacheJobPolling()
    this.klineCacheJobTimer = setTimeout(() => {
      this.klineCacheJobTimer = undefined
      void this.pollKlineCacheJob()
    }, KLINE_CACHE_JOB_POLL_INTERVAL_MS)
  }

  private stopKlineCacheJobPolling(): void {
    if (!this.klineCacheJobTimer) {
      return
    }
    clearTimeout(this.klineCacheJobTimer)
    this.klineCacheJobTimer = undefined
  }

  private resetKlineCacheRowsForQueryChange(): void {
    this.klineCacheRows = []
    this.klineCacheSelectedRowIds = []
    this.klineCacheError = ''
  }

  private async pollKlineCacheJob(): Promise<void> {
    const jobId = this.klineCacheJob?.id
    if (!jobId) {
      return
    }
    try {
      const job = await this.dataAdapter.getKlineCacheJob(jobId)
      runInAction(() => {
        this.klineCacheJob = job
      })
      if (job && isKlineCacheJobActive(job)) {
        this.scheduleKlineCacheJobPolling()
        return
      }
      await this.loadKlineCacheStatus()
    } catch (error) {
      runInAction(() => {
        this.klineCacheError = formatErrorMessage(error)
      })
    }
  }

  private createKlineCacheRequest(
    items: WatchlistItem[],
    rows: KlineCacheStatusRow[] = []
  ): KlineCacheStatusRequest {
    const request: KlineCacheStatusRequest & { rows?: KlineCacheSeriesRequestItem[] } = {
      query: {
        sourceId: this.klineCacheQuery.sourceId,
        periods: [...this.klineCacheQuery.periods],
        adjusts: [...this.klineCacheQuery.adjusts],
        startDate: this.klineCacheQuery.startDate,
        endDate: this.klineCacheQuery.endDate
      },
      items: normalizeWatchlist(items).map((item) => ({
        symbol: item.symbol,
        name: item.name,
        createdAt: item.createdAt,
        ...(item.updatedAt === undefined ? {} : { updatedAt: item.updatedAt })
      }))
    }
    if (rows.length > 0) {
      request.rows = rows.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        query: { ...row.query }
      }))
    }
    return request
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
      timeshareIndicatorSettings: cloneTimeshareIndicatorSettings(this.timeshare.indicatorSettings),
      watchlist: normalizeWatchlist(this.watchlist)
    }
  }

  private reenrichCurrentDataset(settings: IndicatorSettingsMap = this.chart.indicatorSettings): void {
    if (!this.chart.dataset) {
      return
    }
    this.chart.setDataset(enrichStockDataset(this.chart.dataset, settings))
  }

  private reenrichPreviewDatasetIfNeeded(name: IndicatorName, previousRevision: number): void {
    if (name !== 'bsSignal' || this.chart.revision === previousRevision) {
      return
    }
    this.reenrichCurrentDataset(this.chart.effectiveIndicatorSettings)
  }

  private exitWatchlistManageMode(): void {
    this.watchlistManageMode = false
    this.selectedWatchlistSymbols = []
  }

  private updateWatchlistItemName(symbol: string, name: string): boolean {
    const normalizedSymbol = normalizeWatchlistSymbol(symbol)
    const normalizedName = normalizeWatchlistName(name)
    if (!normalizedSymbol || !normalizedName) {
      return false
    }

    let changed = false
    this.watchlist = this.watchlist.map((item) => {
      if (item.symbol !== normalizedSymbol || (item.name && item.name !== item.symbol)) {
        return item
      }
      changed = true
      return {
        ...item,
        name: normalizedName,
        updatedAt: Date.now()
      }
    })
    return changed
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

function createEmptyWatchlistParseResult(): WatchlistParseResult {
  return {
    previews: [],
    totalLineCount: 0,
    parsedLineCount: 0,
    truncated: false
  }
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

function isKlineCacheJobActive(job: KlineCacheJob): boolean {
  return job.status === 'queued' || job.status === 'running'
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

const timeshareIndicatorContextMap: Partial<
  Record<TimeshareIndicatorName, TimeshareAdvancedContextKey>
> = {
  kdj: 'minuteOhlc',
  volumeRatio: 'historicalVolume',
  turnoverRate: 'floatShares',
  orderRatio: 'orderBook',
  inOutVolume: 'tradeDirection',
  capitalFlow: 'capitalFlow'
}
