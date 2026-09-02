import { makeAutoObservable, runInAction } from 'mobx'
import type {
  LocalCacheBackupExportResult,
  LocalCacheBackupImportResult,
  LocalCacheBackupImportStrategy,
  LocalCacheBackupInspectResult,
  NetworkProxySettings,
  WorkspaceSettings
} from '../../../../preload/stock-api'
import type {
  AiAnalysisResult,
  AiAnalysisStreamEvent,
  AiAnalysisStreamStatus,
  AiConnectorSettings,
  AiConnectorSettingsSnapshot,
  AiConnectorTestResult,
  AiHttpProviderPresetId,
  AiStrategyBacktestSummary,
  AiUseCaseId,
  AiUseCaseDefinition,
  AiUseCaseWorkflow,
  AiWorkspaceContext
} from '../models/ai-models'
import {
  aiUseCaseDefinitions,
  cloneAiConnectorSettings,
  createAiConnectorIdForProvider,
  createDefaultAiConnectorSettings,
  createDefaultAiConnectorSettingsSnapshot,
  createAiUseCaseWorkflow,
  getAiHttpProviderPreset,
  getAiUseCaseDefinition,
  normalizeAiConnectorSettings,
  parseAiNewsItems,
  validateAiAnalysisRequest
} from '../models/ai-models'
import { enrichStockDataset, getLatestCandle } from '../models/indicator-engine'
import { cloneIndicatorSettings } from '../models/indicator-definitions'
import { cloneTimeshareIndicatorSettings } from '../models/timeshare-indicator-definitions'
import {
  cloneKlineStrategySettings,
  createDefaultKlineStrategySettings,
  getKlineStrategyDatasetMissingRanges,
  getKlineStrategyPeriodError,
  isKlineStrategyDatasetCoveringQuery,
  klineStrategyTemplates,
  normalizeKlineStrategyParams,
  normalizeKlineStrategySettings,
  runKlineStrategyBacktests,
  validateKlineBacktestAssumptions
} from '../models/kline-strategy-backtesting'
import type {
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorName,
  IndicatorSettingsMap,
  KlineBacktestAssumptions,
  KlineCachedDatasetResult,
  KlineCacheDateRange,
  KlineCacheJob,
  KlineCacheRequestQuery,
  KlineCacheSeriesRequestItem,
  KlineCacheStatusRequest,
  KlineCacheStatusRow,
  KlineStrategyBacktestResult,
  KlineStrategyParameterDefinition,
  KlineStrategyParams,
  KlineStrategyRecommendationLevel,
  KlineStrategySettings,
  KlineStrategyTemplateId,
  StockAdjust,
  StockDataset,
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
  createKlineCacheRequestQuery,
  getKlineCacheRequestError,
  KLINE_CACHE_ADJUST_OPTIONS,
  KLINE_CACHE_PERIOD_OPTIONS,
  normalizeKlineCacheAdjusts,
  normalizeKlineCachePeriods
} from '../models/kline-cache'
import type { StockDataAdapter } from '../adapters/ElectronStockDataAdapter'
import { KLineChartViewModel } from './KLineChartViewModel'
import { TimeshareChartViewModel } from './TimeshareChartViewModel'

export type RemoteLoadStatus = 'idle' | 'loading' | 'success' | 'error'
export type SourceTestStatus = 'testing' | 'success' | 'error'
export type KlineCacheTargetMode = 'single' | 'multiple'
export type LocalCacheBackupResult = LocalCacheBackupExportResult | LocalCacheBackupImportResult

export interface StockWorkspaceViewModelOptions {
  onLocalCacheImported?: () => Promise<void> | void
  getStartupDate?: () => Date
}

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

export interface StrategyTemplateDraftRow {
  id: KlineStrategyTemplateId
  name: string
  typeLabel: string
  basicLogic: string
  recommendationLevel: KlineStrategyRecommendationLevel
  description: string
  signalDescription: string
  minSampleSize: number
  compatiblePeriodLabel: string
  parameters: KlineStrategyParameterDefinition[]
  params: KlineStrategyParams
  errors: string[]
}

const WORKSPACE_SAVE_DEBOUNCE_MS = 500
const TIMESHARE_REFRESH_INTERVAL_MS = 15_000
const KLINE_CACHE_JOB_POLL_INTERVAL_MS = 1_000

function getDefaultAiQuestion(useCaseId: AiUseCaseId): string {
  switch (useCaseId) {
    case 'natural-language-strategy':
      return '请把我的自然语言策略想法整理成可审查的策略草稿。'
    case 'backtest-report':
      return '请解读当前策略回测结果，区分事实、推断、风险和待核实问题。'
    case 'strategy-diagnosis':
      return '请诊断当前策略表现，指出可能失效原因、过拟合风险和数据缺口。'
    case 'parameter-optimization':
      return '请给出参数优化候选和验证计划，排序依据必须来自后续本地回测。'
    case 'natural-language-stock-screening':
      return '请把我的自然语言选股条件转换成可审查的本地筛选草稿。'
    case 'strategy-comparison':
      return '请基于统一指标解释当前策略在不同标的或周期上的差异。'
    case 'market-regime':
      return '请基于当前行情摘要识别市场环境，并列出依据、置信度和待关注项。'
    case 'daily-review':
      return '请基于当前工作区生成一次手动每日复盘。'
    case 'news-kline-analysis':
      return '请把我提供的新闻或公告摘要与当前 K 线现象做关联分析。'
    case 'price-move-prediction':
      return '请做实验性涨跌概率/风险假设，明确样本窗口、置信度和验证限制。'
    default:
      return '请基于当前工作区上下文回答我的问题。'
  }
}

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
  watchlistSearchText = ''
  watchlistAddText = ''
  watchlistAddPreview: WatchlistParseResult = createEmptyWatchlistParseResult()
  watchlistPasteError = ''
  klineCacheDialogOpen = false
  klineCacheLoading = false
  klineCacheError = ''
  klineCacheRows: KlineCacheStatusRow[] = []
  klineCacheSelectedRowIds: string[] = []
  klineCacheQuery: KlineCacheRequestQuery = createKlineCacheRequestQuery(createDefaultStockQuery())
  klineCacheTargetMode: KlineCacheTargetMode = 'single'
  klineCacheJob: KlineCacheJob | null = null
  localCacheExporting = false
  localCacheImportInspecting = false
  localCacheImporting = false
  localCacheImportDialogOpen = false
  localCacheResultDialogOpen = false
  localCacheImportStrategy: LocalCacheBackupImportStrategy = 'merge'
  localCacheBackupInspect: LocalCacheBackupInspectResult | null = null
  localCacheBackupResult: LocalCacheBackupResult | null = null
  strategyPanelOpen = false
  strategyRunning = false
  strategyError = ''
  strategyStatusMessage = ''
  strategySettings: KlineStrategySettings = createDefaultKlineStrategySettings()
  strategyDraft: KlineStrategySettings = createDefaultKlineStrategySettings()
  strategyInitialCapitalInput: number | null =
    createDefaultKlineStrategySettings().assumptions.initialCapital
  strategyFeeRatePercentInput: number | null =
    createDefaultKlineStrategySettings().assumptions.feeRate * 100
  strategySlippageRatePercentInput: number | null =
    createDefaultKlineStrategySettings().assumptions.slippageRate * 100
  strategyResults: KlineStrategyBacktestResult[] = []
  selectedStrategyResultId = ''
  aiConnectorSnapshot: AiConnectorSettingsSnapshot = createDefaultAiConnectorSettingsSnapshot()
  aiConnectorSettings: AiConnectorSettings = createDefaultAiConnectorSettings()
  aiConnectorDraft: AiConnectorSettings = createDefaultAiConnectorSettings()
  aiSettingsOpen = false
  aiSettingsSaving = false
  aiSettingsTesting = false
  aiSettingsError = ''
  aiApiKeyDraft = ''
  aiConnectorTestResult: AiConnectorTestResult | null = null
  aiAnalysisOpen = false
  aiUseCaseId: AiUseCaseId = 'daily-review'
  aiQuestion = getDefaultAiQuestion('daily-review')
  aiNewsText = ''
  aiAnalysisRunning = false
  aiAnalysisStreamStatus: AiAnalysisStreamStatus = 'idle'
  aiAnalysisStreamRequestId = ''
  aiAnalysisPartialOutput = ''
  aiAnalysisWarnings: string[] = []
  aiAnalysisFallbackWarning = ''
  aiAnalysisError = ''
  aiAnalysisResult: AiAnalysisResult | null = null
  aiConfirmedUseCaseIds: AiUseCaseId[] = []
  private workspaceSaveTimer?: ReturnType<typeof setTimeout>
  private timeshareRefreshTimer?: ReturnType<typeof setTimeout>
  private klineCacheJobTimer?: ReturnType<typeof setTimeout>
  private klineCacheStatusRequestId = 0
  private timeshareRequestId = 0
  private strategyRequestId = 0
  private aiAnalysisRequestId = 0
  private aiAnalysisStreamDisposer?: () => void

  constructor(
    private readonly dataAdapter: StockDataAdapter,
    private readonly options: StockWorkspaceViewModelOptions = {}
  ) {
    makeAutoObservable<
      this,
      | 'dataAdapter'
      | 'options'
      | 'workspaceSaveTimer'
      | 'timeshareRefreshTimer'
      | 'klineCacheJobTimer'
      | 'klineCacheStatusRequestId'
      | 'timeshareRequestId'
      | 'strategyRequestId'
      | 'aiAnalysisRequestId'
      | 'aiAnalysisStreamDisposer'
    >(
      this,
      {
        dataAdapter: false,
        options: false,
        workspaceSaveTimer: false,
        timeshareRefreshTimer: false,
        klineCacheJobTimer: false,
        klineCacheStatusRequestId: false,
        timeshareRequestId: false,
        strategyRequestId: false,
        aiAnalysisRequestId: false,
        aiAnalysisStreamDisposer: false
      },
      { autoBind: true }
    )
    this.aiAnalysisStreamDisposer = this.dataAdapter.onAiAnalysisStreamEvent((event) => {
      runInAction(() => {
        this.applyAiAnalysisStreamEvent(event)
      })
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    this.initialized = true
    await this.loadSources()
    await this.loadSettings({ refreshDateBaseline: true })
    await this.loadAiConnectorSettings()
    this.addVisibilityListener()
    await this.refreshStock({ allowStartupFallback: true })
  }

  dispose(): void {
    this.cancelActiveStrategyRun()
    this.cancelActiveAiAnalysis()
    this.aiAnalysisStreamDisposer?.()
    this.aiAnalysisStreamDisposer = undefined
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
      this.invalidateStrategyResultsIfQueryChanged(query)
      this.query = query
      this.chart.setDataset(enriched, query)
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
        this.invalidateStrategyResultsIfQueryChanged({
          ...this.query,
          symbol: query.symbol
        })
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
      this.syncSelectedStrategySignals()
    } else {
      this.cancelActiveStrategyRun()
      this.chart.setStrategySignals([])
    }
    this.saveWorkspaceSettingsNow()
    void this.refreshStock()
  }

  setSymbol(symbol: string): void {
    const query = {
      ...this.query,
      symbol
    }
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
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

    const query = this.normalizeQueryForSource({
      ...this.query,
      sourceId
    })
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
    this.sourceTestResults = []
    this.saveWorkspaceSettingsNow()
  }

  setPeriod(period: StockPeriod): void {
    const query = this.normalizeQueryForSource({
      ...this.query,
      period
    })
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
    this.saveWorkspaceSettingsNow()
  }

  setAdjust(adjust: StockAdjust): void {
    const query = this.normalizeQueryForSource({
      ...this.query,
      adjust
    })
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
    this.saveWorkspaceSettingsNow()
  }

  setStartDate(startDate: string): void {
    const query = {
      ...this.query,
      startDate: normalizeDateInput(startDate)
    }
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
    this.queueWorkspaceSettingsSave()
  }

  setEndDate(endDate: string): void {
    const query = {
      ...this.query,
      endDate: normalizeDateInput(endDate)
    }
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
    this.queueWorkspaceSettingsSave()
  }

  toggleWatchlistOpen(): void {
    this.watchlistOpen = !this.watchlistOpen
    if (!this.watchlistOpen) {
      this.exitWatchlistManageMode()
      this.clearWatchlistSearch()
    }
  }

  setWatchlistSearchText(text: string): void {
    this.watchlistSearchText = text
  }

  clearWatchlistSearch(): void {
    this.watchlistSearchText = ''
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
    const query = {
      ...this.query,
      symbol: normalizedSymbol
    }
    this.invalidateStrategyResultsIfQueryChanged(query)
    this.query = query
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
    const selected = new Set(this.selectedWatchlistSymbols)
    this.filteredWatchlist.forEach((item) => selected.add(item.symbol))
    this.selectedWatchlistSymbols = this.watchlist
      .map((item) => item.symbol)
      .filter((symbol) => selected.has(symbol))
  }

  invertWatchlistSelection(): void {
    const selected = new Set(this.selectedWatchlistSymbols)
    const visible = new Set(this.filteredWatchlist.map((item) => item.symbol))
    const next = new Set(this.selectedWatchlistSymbols.filter((symbol) => !visible.has(symbol)))
    this.filteredWatchlist.forEach((item) => {
      if (!selected.has(item.symbol)) {
        next.add(item.symbol)
      }
    })
    this.selectedWatchlistSymbols = this.watchlist
      .map((item) => item.symbol)
      .filter((symbol) => next.has(symbol))
  }

  removeSelectedWatchlistItems(): void {
    if (this.selectedWatchlistSymbols.length === 0) {
      return
    }
    this.watchlist = removeWatchlistSymbols(this.watchlist, this.selectedWatchlistSymbols)
    const cacheTargetSymbols = new Set(this.klineCacheTargetItems.map((item) => item.symbol))
    this.klineCacheSelectedRowIds = this.klineCacheSelectedRowIds.filter((rowId) =>
      this.klineCacheRows.some((row) => row.id === rowId && cacheTargetSymbols.has(row.symbol))
    )
    this.exitWatchlistManageMode()
    this.saveWorkspaceSettingsNow()
  }

  openKlineCacheDialog(): void {
    this.klineCacheQuery = this.normalizeKlineCacheQuery(createKlineCacheRequestQuery(this.query))
    this.klineCacheTargetMode = 'single'
    this.klineCacheSelectedRowIds = []
    this.klineCacheError = ''
    this.klineCacheDialogOpen = true
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

  setKlineCacheTargetMode(mode: KlineCacheTargetMode): void {
    if (this.klineCacheTargetMode === mode) {
      return
    }
    this.klineCacheTargetMode = mode
    this.resetKlineCacheRowsForQueryChange()
    void this.loadKlineCacheStatus()
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
    this.klineCacheQuery = {
      ...this.klineCacheQuery,
      startDate: normalizeDateInput(startDate)
    }
    this.resetKlineCacheRowsForQueryChange()
  }

  setKlineCacheEndDate(endDate: string): void {
    this.klineCacheQuery = {
      ...this.klineCacheQuery,
      endDate: normalizeDateInput(endDate)
    }
    this.resetKlineCacheRowsForQueryChange()
  }

  async loadKlineCacheStatus(): Promise<void> {
    const items = this.klineCacheTargetItems
    if (items.length === 0) {
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

    const request = this.createKlineCacheRequest(items)
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
    await this.startKlineCacheRefresh(this.klineCacheTargetItems)
  }

  async refreshSelectedKlineCache(): Promise<void> {
    const selectedRows = this.selectedKlineCacheRows
    if (selectedRows.length === 0) {
      return
    }
    await this.startKlineCacheRefresh(this.klineCacheTargetItems, selectedRows)
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
        this.createKlineCacheRequest(this.klineCacheTargetItems, selectedRows)
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

  openStrategyPanel(): void {
    this.strategyDraft = cloneKlineStrategySettings(this.strategySettings)
    this.syncStrategyAssumptionInputs()
    this.strategyError = ''
    this.strategyPanelOpen = true
  }

  closeStrategyPanel(): void {
    this.strategyPanelOpen = false
    this.strategyDraft = cloneKlineStrategySettings(this.strategySettings)
    this.syncStrategyAssumptionInputs()
  }

  setStrategySelectedTemplateIds(templateIds: KlineStrategyTemplateId[]): void {
    const allowed = new Set(klineStrategyTemplates.map((template) => template.id))
    const selected: KlineStrategyTemplateId[] = []
    templateIds.forEach((templateId) => {
      if (allowed.has(templateId) && !selected.includes(templateId)) {
        selected.push(templateId)
      }
    })
    this.strategyDraft = {
      ...this.strategyDraft,
      selectedTemplateIds: selected
    }
  }

  setStrategyTemplateSelected(templateId: KlineStrategyTemplateId, selected: boolean): void {
    const next = new Set(this.strategyDraft.selectedTemplateIds)
    if (selected) {
      next.add(templateId)
    } else {
      next.delete(templateId)
    }
    this.setStrategySelectedTemplateIds(Array.from(next))
  }

  setStrategyDraftParam(
    templateId: KlineStrategyTemplateId,
    key: string,
    value: number | null
  ): void {
    this.strategyDraft = {
      ...this.strategyDraft,
      paramsByTemplate: {
        ...this.strategyDraft.paramsByTemplate,
        [templateId]: {
          ...(this.strategyDraft.paramsByTemplate[templateId] ?? {}),
          [key]: value ?? 0
        }
      }
    }
  }

  setStrategyInitialCapital(value: number | null): void {
    this.strategyInitialCapitalInput = value
    if (value !== null) {
      this.patchStrategyAssumptions({ initialCapital: value })
    }
  }

  setStrategyFeeRatePercent(value: number | null): void {
    this.strategyFeeRatePercentInput = value
    if (value !== null) {
      this.patchStrategyAssumptions({ feeRate: value / 100 })
    }
  }

  setStrategySlippageRatePercent(value: number | null): void {
    this.strategySlippageRatePercentInput = value
    if (value !== null) {
      this.patchStrategyAssumptions({ slippageRate: value / 100 })
    }
  }

  async runStrategyBacktest(): Promise<void> {
    if (this.viewMode !== 'kline') {
      this.strategyError = '请切换到 K 线模式后查看历史回测'
      this.strategyStatusMessage = ''
      return
    }

    const formErrors = this.strategyFormErrors
    if (formErrors.length > 0) {
      this.strategyError = formErrors.join('；')
      this.strategyStatusMessage = ''
      return
    }

    const query = this.createStrategyBacktestQuery()
    const settings: KlineStrategySettings = {
      ...this.strategyDraft,
      selectedTemplateIds: [...this.strategyDraft.selectedTemplateIds],
      paramsByTemplate: cloneKlineStrategySettings(this.strategyDraft).paramsByTemplate
    }
    const normalizedSettings = normalizeKlineStrategySettings(settings)
    const requestId = ++this.strategyRequestId
    this.strategyRunning = true
    this.strategyError = ''
    this.strategyStatusMessage = '正在读取历史 K 线缓存'

    try {
      const dataset = await this.resolveStrategyDataset(query, requestId)
      this.setStrategyStatusMessage('正在运行策略回测', requestId)
      const comparison = runKlineStrategyBacktests({
        dataset,
        query,
        settings
      })
      runInAction(() => {
        if (this.strategyRequestId !== requestId) {
          return
        }
        this.strategySettings = normalizedSettings
        this.strategyDraft = cloneKlineStrategySettings(normalizedSettings)
        this.syncStrategyAssumptionInputs()
        this.strategyResults = comparison.results
        this.selectedStrategyResultId = chooseSelectedStrategyResultId(comparison.results)
        this.strategyRunning = false
        this.strategyError = ''
        this.strategyStatusMessage = ''
        this.syncSelectedStrategySignals()
      })
      this.saveWorkspaceSettingsNow()
    } catch (error) {
      runInAction(() => {
        if (this.strategyRequestId !== requestId) {
          return
        }
        this.strategyRunning = false
        this.strategyError = formatErrorMessage(error)
        this.strategyStatusMessage = ''
      })
    }
  }

  selectStrategyResult(resultId: string): void {
    if (!this.strategyResults.some((result) => result.id === resultId)) {
      return
    }
    this.selectedStrategyResultId = resultId
    this.syncSelectedStrategySignals()
  }

  openAiSettings(): void {
    this.aiConnectorDraft = cloneAiConnectorSettings(this.aiConnectorSettings)
    this.aiApiKeyDraft = ''
    this.aiSettingsError = ''
    this.aiSettingsOpen = true
    void this.loadAiConnectorSettings()
  }

  closeAiSettings(): void {
    this.aiSettingsOpen = false
    this.aiConnectorDraft = cloneAiConnectorSettings(this.aiConnectorSettings)
    this.aiApiKeyDraft = ''
    this.aiSettingsError = ''
  }

  setAiConnectorEnabled(enabled: boolean): void {
    this.aiConnectorDraft = {
      ...this.aiConnectorDraft,
      enabled
    }
  }

  setAiConnectorDisplayName(displayName: string): void {
    this.aiConnectorDraft = {
      ...this.aiConnectorDraft,
      displayName
    }
  }

  setAiConnectorModel(model: string): void {
    this.aiConnectorDraft = {
      ...this.aiConnectorDraft,
      model,
      availability: 'unknown'
    }
    this.aiConnectorTestResult = null
  }

  setAiConnectorProfile(profile: string): void {
    this.aiConnectorDraft = {
      ...this.aiConnectorDraft,
      profile
    }
  }

  setAiConnectorTemperature(temperature: number | null): void {
    this.aiConnectorDraft = normalizeAiConnectorSettings({
      ...this.aiConnectorDraft,
      temperature: temperature ?? this.aiConnectorDraft.temperature
    })
  }

  setAiConnectorTimeoutSeconds(timeoutSeconds: number | null): void {
    this.aiConnectorDraft = normalizeAiConnectorSettings({
      ...this.aiConnectorDraft,
      timeoutMs: timeoutSeconds === null ? this.aiConnectorDraft.timeoutMs : timeoutSeconds * 1000
    })
  }

  setAiConnectorContextLimit(contextLimit: number | null): void {
    this.aiConnectorDraft = normalizeAiConnectorSettings({
      ...this.aiConnectorDraft,
      contextLimit: contextLimit ?? this.aiConnectorDraft.contextLimit
    })
  }

  setAiHttpProviderPreset(presetId: AiHttpProviderPresetId): void {
    const preset = getAiHttpProviderPreset(presetId)
    this.aiConnectorDraft = normalizeAiConnectorSettings({
      ...this.aiConnectorDraft,
      connectorId: createAiConnectorIdForProvider(presetId),
      kind: 'http-provider',
      displayName: preset.displayName,
      model: preset.model,
      availability: 'unknown',
      httpProvider: {
        ...this.aiConnectorDraft.httpProvider,
        presetId,
        baseUrl: preset.baseUrl || this.aiConnectorDraft.httpProvider.baseUrl
      }
    })
    this.aiConnectorTestResult = null
  }

  setAiHttpProviderBaseUrl(baseUrl: string): void {
    this.aiConnectorDraft = normalizeAiConnectorSettings({
      ...this.aiConnectorDraft,
      availability: 'unknown',
      httpProvider: {
        ...this.aiConnectorDraft.httpProvider,
        baseUrl
      }
    })
    this.aiConnectorTestResult = null
  }

  setAiApiKeyDraft(apiKey: string): void {
    this.aiApiKeyDraft = apiKey
    if (apiKey.trim()) {
      this.aiConnectorDraft = {
        ...this.aiConnectorDraft,
        availability: 'unknown'
      }
      this.aiConnectorTestResult = null
    }
  }

  setAiSettingsError(message: string): void {
    this.aiSettingsError = message
  }

  async saveAiSettings(): Promise<void> {
    this.aiSettingsSaving = true
    this.aiSettingsError = ''
    try {
      const settings = this.createAiConnectorSettingsPayload()
      if (settings.enabled && settings.availability !== 'available') {
        throw new Error('请先测试连接成功后再启用 AI connector')
      }
      if (settings.enabled && !this.hasUsableAiCredential && !this.aiApiKeyDraft.trim()) {
        throw new Error('请先保存或测试 HTTP provider API key')
      }
      let snapshot = await this.dataAdapter.setAiConnectorSettings(settings)
      if (this.aiApiKeyDraft.trim()) {
        snapshot = await this.dataAdapter.saveAiConnectorApiKey(
          snapshot.settings.connectorId,
          this.aiApiKeyDraft
        )
      }
      runInAction(() => {
        this.applyAiConnectorSnapshot(snapshot, { syncDraft: true })
        this.aiApiKeyDraft = ''
        this.aiSettingsSaving = false
      })
    } catch (error) {
      runInAction(() => {
        this.aiSettingsSaving = false
        this.aiSettingsError = formatErrorMessage(error)
      })
    }
  }

  async testAiSettings(): Promise<void> {
    this.aiSettingsTesting = true
    this.aiSettingsError = ''
    this.aiConnectorTestResult = null
    try {
      const settings = this.createAiConnectorSettingsPayload()
      let snapshot = await this.dataAdapter.setAiConnectorSettings(settings)
      if (this.aiApiKeyDraft.trim()) {
        snapshot = await this.dataAdapter.saveAiConnectorApiKey(
          snapshot.settings.connectorId,
          this.aiApiKeyDraft
        )
      }
      const result = await this.dataAdapter.testAiConnector()
      runInAction(() => {
        this.applyAiConnectorSnapshot(
          {
            ...snapshot,
            settings: {
              ...snapshot.settings,
              availability: result.status
            },
            credentialStatus: result.credentialStatus
          },
          { syncDraft: true }
        )
        this.aiConnectorTestResult = result
        this.aiApiKeyDraft = ''
        this.aiSettingsTesting = false
      })
    } catch (error) {
      runInAction(() => {
        this.aiSettingsTesting = false
        this.aiSettingsError = formatErrorMessage(error)
      })
    }
  }

  async clearAiApiKey(): Promise<void> {
    this.aiSettingsSaving = true
    this.aiSettingsError = ''
    try {
      const snapshot = await this.dataAdapter.clearAiConnectorApiKey(
        this.aiConnectorDraft.connectorId
      )
      runInAction(() => {
        this.applyAiConnectorSnapshot(snapshot, { syncDraft: true })
        this.aiApiKeyDraft = ''
        this.aiConnectorTestResult = null
        this.aiSettingsSaving = false
      })
    } catch (error) {
      runInAction(() => {
        this.aiSettingsSaving = false
        this.aiSettingsError = formatErrorMessage(error)
      })
    }
  }

  openAiAnalysisPanel(): void {
    this.aiAnalysisOpen = true
    this.aiAnalysisError = ''
  }

  closeAiAnalysisPanel(): void {
    this.aiAnalysisOpen = false
    this.aiAnalysisError = ''
    this.cancelActiveAiAnalysis()
  }

  setAiUseCaseId(useCaseId: AiUseCaseId): void {
    const previousDefault = getDefaultAiQuestion(this.aiUseCaseId)
    this.cancelActiveAiAnalysis()
    this.aiUseCaseId = useCaseId
    this.setAiUseCaseConfirmed(false)
    if (!this.aiQuestion.trim() || this.aiQuestion === previousDefault) {
      this.aiQuestion = getDefaultAiQuestion(useCaseId)
    }
    this.resetAiAnalysisOutput()
  }

  setAiQuestion(question: string): void {
    this.aiQuestion = question
    this.setAiUseCaseConfirmed(false)
  }

  setAiNewsText(text: string): void {
    this.aiNewsText = text
    this.setAiUseCaseConfirmed(false)
  }

  setAiUseCaseConfirmed(confirmed: boolean): void {
    const next = new Set(this.aiConfirmedUseCaseIds)
    if (confirmed) {
      next.add(this.aiUseCaseId)
    } else {
      next.delete(this.aiUseCaseId)
    }
    this.aiConfirmedUseCaseIds = [...next]
  }

  async runAiAnalysis(): Promise<void> {
    this.cancelActiveAiAnalysis()
    const request = this.createAiAnalysisRequest()
    const localErrors = this.aiAnalysisValidationErrors
    if (localErrors.length > 0) {
      this.aiAnalysisError = localErrors.join('；')
      return
    }

    const sequenceId = ++this.aiAnalysisRequestId
    const requestId = `ai-analysis-${Date.now()}-${sequenceId}`
    this.aiAnalysisStreamRequestId = requestId
    this.aiAnalysisRunning = true
    this.aiAnalysisStreamStatus = 'running'
    this.aiAnalysisPartialOutput = ''
    this.aiAnalysisWarnings = []
    this.aiAnalysisFallbackWarning = ''
    this.aiAnalysisError = ''
    this.aiAnalysisResult = null
    try {
      await this.dataAdapter.startAiAnalysisStream({
        requestId,
        analysisRequest: request
      })
      runInAction(() => {
        if (this.aiAnalysisRequestId !== sequenceId) {
          return
        }
        this.aiAnalysisStreamRequestId = requestId
      })
    } catch (error) {
      runInAction(() => {
        if (this.aiAnalysisRequestId !== sequenceId) {
          return
        }
        this.aiAnalysisRunning = false
        this.aiAnalysisStreamStatus = 'error'
        this.aiAnalysisStreamRequestId = ''
        this.aiAnalysisError = formatErrorMessage(error)
      })
    }
  }

  cancelAiAnalysis(): void {
    this.cancelActiveAiAnalysis()
  }

  createAiAnalysisRequest() {
    const useCase = getAiUseCaseDefinition(this.aiUseCaseId)
    const context = this.createAiWorkspaceContext()
    const newsItems = useCase.requiresNews ? parseAiNewsItems(this.aiNewsText) : undefined
    const baseRequest = {
      useCaseId: this.aiUseCaseId,
      question: this.aiQuestion.trim() || getDefaultAiQuestion(this.aiUseCaseId),
      context,
      newsItems
    }
    return {
      ...baseRequest,
      workflow: createAiUseCaseWorkflow(baseRequest, this.aiUseCaseConfirmed)
    }
  }

  createAiWorkspaceContext(): AiWorkspaceContext {
    const klineDataset = this.chart.dataset
    const timeshareDataset = this.timeshare.dataset
    const missingData: string[] = []
    const dataDateRange =
      this.viewMode === 'timeshare'
        ? {
            tradeDate:
              timeshareDataset?.advanced?.tradeDate ??
              timeshareDataset?.points.at(-1)?.timeKey.slice(0, 8) ??
              undefined
          }
        : {
            startDate: klineDataset?.candles[0]?.timeKey ?? this.query.startDate,
            endDate: klineDataset?.candles.at(-1)?.timeKey ?? this.query.endDate
          }
    const recordCount = this.recordCount
    if (recordCount === 0) {
      missingData.push('当前没有已加载行情数据')
    }
    if (this.viewMode === 'kline' && !this.selectedStrategyResult) {
      missingData.push('当前没有策略回测结果')
    }

    return {
      generatedAt: new Date().toISOString(),
      viewMode: this.viewMode,
      symbol: this.aiCurrentSecuritySymbol,
      stockName: this.currentStockName,
      dataSourceName: this.activeSourceName,
      dataDateRange,
      recordCount,
      latestSummary: this.latestSummary,
      enabledIndicators: this.getEnabledIndicatorLabels(),
      strategyBacktest: this.createAiStrategyBacktestSummary(this.selectedStrategyResult),
      missingData
    }
  }

  toggleIndicator(name: IndicatorName, enabled: boolean): void {
    const previousRevision = this.chart.revision
    this.chart.setIndicator(name, enabled)
    if (this.chart.revision !== previousRevision) {
      this.reenrichCurrentDataset()
      this.syncSelectedStrategySignals()
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
      this.syncSelectedStrategySignals()
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
    this.syncSelectedStrategySignals()
    this.saveWorkspaceSettingsNow()
  }

  setKLineIndicatorDraftEnabled(name: IndicatorName, enabled: boolean): void {
    this.chart.setIndicatorDraftEnabled(name, enabled)
    this.syncSelectedStrategySignals()
  }

  setKLineIndicatorDraftParam(name: IndicatorName, index: number, value: number): void {
    this.chart.setIndicatorDraftParam(name, index, value)
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
    this.chart.resetIndicatorDraftParams(name)
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

  async exportLocalCacheBackup(): Promise<void> {
    this.localCacheExporting = true
    this.localCacheBackupResult = null
    try {
      const result = await this.dataAdapter.exportLocalCacheBackup()
      runInAction(() => {
        this.localCacheExporting = false
        if (result.status !== 'cancelled') {
          this.localCacheBackupResult = result
          this.localCacheResultDialogOpen = true
        }
      })
    } catch (error) {
      runInAction(() => {
        this.localCacheExporting = false
        this.localCacheBackupResult = {
          status: 'error',
          message: formatErrorMessage(error)
        }
        this.localCacheResultDialogOpen = true
      })
    }
  }

  async inspectLocalCacheBackup(): Promise<void> {
    this.localCacheImportInspecting = true
    this.localCacheBackupInspect = null
    this.localCacheBackupResult = null
    this.localCacheImportStrategy = 'merge'
    try {
      const result = await this.dataAdapter.inspectLocalCacheBackup()
      runInAction(() => {
        this.localCacheImportInspecting = false
        if (result.status === 'ready') {
          this.localCacheBackupInspect = result
          this.localCacheImportDialogOpen = true
          return
        }
        if (result.status === 'error') {
          this.localCacheBackupResult = {
            status: 'error',
            message: result.message
          }
          this.localCacheResultDialogOpen = true
        }
      })
    } catch (error) {
      runInAction(() => {
        this.localCacheImportInspecting = false
        this.localCacheBackupResult = {
          status: 'error',
          message: formatErrorMessage(error)
        }
        this.localCacheResultDialogOpen = true
      })
    }
  }

  setLocalCacheImportStrategy(strategy: LocalCacheBackupImportStrategy): void {
    this.localCacheImportStrategy = strategy === 'replace' ? 'replace' : 'merge'
  }

  closeLocalCacheImportDialog(): void {
    if (this.localCacheImporting) {
      return
    }
    this.localCacheImportDialogOpen = false
  }

  closeLocalCacheResultDialog(): void {
    this.localCacheResultDialogOpen = false
  }

  async confirmLocalCacheImport(): Promise<void> {
    const importToken = this.localCacheBackupInspect?.importToken
    if (!importToken || this.localCacheImporting) {
      return
    }

    this.localCacheImporting = true
    try {
      const result = await this.dataAdapter.importLocalCacheBackup({
        importToken,
        strategy: this.localCacheImportStrategy
      })
      if (result.status === 'success') {
        await this.reloadAfterLocalCacheImport()
      }
      runInAction(() => {
        this.localCacheImporting = false
        this.localCacheImportDialogOpen = false
        this.localCacheBackupResult = result
        this.localCacheResultDialogOpen = true
      })
    } catch (error) {
      runInAction(() => {
        this.localCacheImporting = false
        this.localCacheBackupResult = {
          status: 'error',
          message: formatErrorMessage(error)
        }
        this.localCacheResultDialogOpen = true
      })
    }
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

  get filteredWatchlist(): WatchlistItem[] {
    const keyword = this.watchlistSearchText.trim().toLowerCase()
    if (!keyword) {
      return this.watchlist
    }
    return this.watchlist.filter((item) => {
      const symbol = item.symbol.toLowerCase()
      const bareSymbol = symbol.replace(/^(sh|sz)/, '')
      const name = item.name.toLowerCase()
      return symbol.includes(keyword) || bareSymbol.includes(keyword) || name.includes(keyword)
    })
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

  get klineCacheTargetItems(): WatchlistItem[] {
    if (this.klineCacheTargetMode === 'multiple') {
      return normalizeWatchlist(this.watchlist)
    }
    const item = createWatchlistItem(this.query.symbol, this.currentStockName, 1)
    return item ? [item] : []
  }

  get klineCacheEmptyDescription(): string {
    return this.klineCacheTargetMode === 'multiple' ? '暂无自选股' : '暂无可缓存证券'
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
    return (
      this.klineCacheTargetItems.length > 0 &&
      !this.klineCacheRunning &&
      !this.klineCacheFormError
    )
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
    return KLINE_CACHE_PERIOD_OPTIONS.filter((period) => supported.includes(period)).map(
      (period) => periodOptions.find((option) => option.value === period) ?? { value: period, label: period }
    )
  }

  get klineCacheAdjustOptions(): Array<{ value: StockAdjust; label: string }> {
    const source = this.sources.find((item) => item.id === this.klineCacheQuery.sourceId)
    const supported = source?.capabilities.adjusts ?? []
    return KLINE_CACHE_ADJUST_OPTIONS.filter((adjust) => supported.includes(adjust)).map(
      (adjust) => adjustOptions.find((option) => option.value === adjust) ?? { value: adjust, label: adjust }
    )
  }

  get strategyTemplateOptions(): Array<{ value: KlineStrategyTemplateId; label: string }> {
    return klineStrategyTemplates.map((template) => ({
      value: template.id,
      label: template.name
    }))
  }

  get strategyBacktestDateRangeLabel(): string {
    const query = this.createStrategyBacktestQuery()
    return `${query.startDate} - ${query.endDate}`
  }

  get strategyTemplateDraftRows(): StrategyTemplateDraftRow[] {
    return klineStrategyTemplates
      .filter((template) => this.strategyDraft.selectedTemplateIds.includes(template.id))
      .map((template) => {
        const params = {
          ...template.defaultParams,
          ...(this.strategyDraft.paramsByTemplate[template.id] ?? {})
        }
        return {
          id: template.id,
          name: template.name,
          typeLabel: template.typeLabel,
          basicLogic: template.basicLogic,
          recommendationLevel: template.recommendationLevel,
          description: template.description,
          signalDescription: template.signalDescription,
          minSampleSize: template.minSampleSize,
          compatiblePeriodLabel: template.compatiblePeriods
            .map((period) => periodLabel(period))
            .join('/'),
          parameters: template.parameters,
          params,
          errors: normalizeKlineStrategyParams(template.id, params).errors
        }
      })
  }

  get strategyFormErrors(): string[] {
    const errors: string[] = []
    if (this.strategyDraft.selectedTemplateIds.length === 0) {
      errors.push('请至少选择一个策略模板')
    }
    const periodError = getKlineStrategyPeriodError(this.query.period)
    if (periodError) {
      errors.push(periodError)
    }
    const dateRangeError = getStrategyDateRangeError(this.query)
    if (dateRangeError) {
      errors.push(dateRangeError)
    }
    errors.push(...validateKlineBacktestAssumptions(this.strategyDraftAssumptionsForValidation))
    return uniqueStrings(errors)
  }

  get canRunStrategyBacktest(): boolean {
    return this.viewMode === 'kline' && !this.strategyRunning && this.strategyFormErrors.length === 0
  }

  get selectedStrategyResult(): KlineStrategyBacktestResult | undefined {
    return this.strategyResults.find((result) => result.id === this.selectedStrategyResultId)
  }

  get rankedStrategyResults(): KlineStrategyBacktestResult[] {
    return [...this.strategyResults].sort((left, right) => {
      if (left.rank && right.rank) {
        return left.rank - right.rank
      }
      if (left.rank) {
        return -1
      }
      if (right.rank) {
        return 1
      }
      return left.templateName.localeCompare(right.templateName, 'zh-CN')
    })
  }

  get bestRankedStrategyResult(): KlineStrategyBacktestResult | undefined {
    return this.rankedStrategyResults.find((result) => result.rank === 1)
  }

  get aiUseCaseOptions(): AiUseCaseDefinition[] {
    return aiUseCaseDefinitions
  }

  get selectedAiUseCase(): AiUseCaseDefinition {
    return getAiUseCaseDefinition(this.aiUseCaseId)
  }

  get aiUseCaseConfirmed(): boolean {
    return this.aiConfirmedUseCaseIds.includes(this.aiUseCaseId)
  }

  get aiUseCaseConfirmationLabel(): string {
    return this.selectedAiUseCase.confirmationLabel ?? ''
  }

  get aiUseCaseWorkflow(): AiUseCaseWorkflow {
    return createAiUseCaseWorkflow(
      {
        useCaseId: this.aiUseCaseId,
        question: this.aiQuestion.trim() || getDefaultAiQuestion(this.aiUseCaseId),
        context: this.createAiWorkspaceContext(),
        newsItems: this.selectedAiUseCase.requiresNews
          ? parseAiNewsItems(this.aiNewsText)
          : undefined
      },
      this.aiUseCaseConfirmed
    )
  }

  get aiUseCaseWorkflowNotes(): string[] {
    const workflow = this.aiUseCaseWorkflow
    return [
      `发送范围：${workflow.targetScope}`,
      ...workflow.localValidationNotes,
      ...workflow.localBacktestValidationNotes,
      ...workflow.outputHandlingNotes
    ]
  }

  get aiConnectorStatusLabel(): string {
    if (!this.aiConnectorSettings.enabled) {
      return '未启用'
    }
    if (this.aiConnectorSettings.availability === 'available') {
      return '可用'
    }
    if (this.aiConnectorSettings.availability === 'unavailable') {
      return '不可用'
    }
    return '未测试'
  }

  get aiSettingsCredentialLabel(): string {
    switch (this.aiConnectorSnapshot.credentialStatus) {
      case 'not-required':
        return '不需要 API key'
      case 'saved':
        return '已保存'
      case 'temporary':
        return '本次会话临时可用'
      case 'unsupported':
        return '当前平台无法解密已保存密钥'
      default:
        return '未保存'
    }
  }

  get aiConnectorModelOptions(): string[] {
    const preset = getAiHttpProviderPreset(this.aiConnectorDraft.httpProvider.presetId)
    return uniqueStrings([this.aiConnectorDraft.model, preset.model, ...preset.models])
  }

  get aiAnalysisValidationErrors(): string[] {
    const errors: string[] = []
    if (!this.aiConnectorSettings.enabled) {
      errors.push('AI connector 未启用，请先打开 AI 设置完成配置')
    } else if (this.aiConnectorSettings.availability !== 'available') {
      errors.push('AI connector 未测试或不可用，请先在 AI 设置中测试连接')
    } else if (!this.hasUsableAiCredential) {
      errors.push('HTTP provider 缺少可用 API key，请先在 AI 设置中保存 API key')
    }
    errors.push(...validateAiAnalysisRequest(this.createAiAnalysisRequest()))
    return uniqueStrings(errors)
  }

  get canRunAiAnalysis(): boolean {
    return !this.aiAnalysisRunning && this.aiAnalysisValidationErrors.length === 0
  }

  get aiAnalysisStatusLabel(): string {
    switch (this.aiAnalysisStreamStatus) {
      case 'running':
        return '生成中'
      case 'cancelling':
        return '取消中'
      case 'cancelled':
        return '已取消'
      case 'success':
        return '已完成'
      case 'error':
        return '失败'
      default:
        return '未开始'
    }
  }

  get aiVisibleAnalysisOutput(): string {
    return this.aiAnalysisResult?.outputText || this.aiAnalysisPartialOutput
  }

  get aiCurrentAnalysisScope(): string {
    const context = this.createAiWorkspaceContext()
    const range =
      context.viewMode === 'timeshare'
        ? context.dataDateRange.tradeDate ?? '未加载交易日'
        : `${context.dataDateRange.startDate ?? '-'} 至 ${context.dataDateRange.endDate ?? '-'}`
    return `${context.stockName}(${context.symbol}) · ${context.dataSourceName} · ${range}`
  }

  get aiContextSummary(): string {
    const context = this.createAiWorkspaceContext()
    const range =
      context.viewMode === 'timeshare'
        ? context.dataDateRange.tradeDate ?? '未加载交易日'
        : `${context.dataDateRange.startDate ?? '-'} 至 ${context.dataDateRange.endDate ?? '-'}`
    return [
      `${context.stockName}(${context.symbol})`,
      context.viewMode === 'timeshare' ? '分时' : 'K 线',
      context.dataSourceName,
      range,
      `${context.recordCount} 条`,
      context.latestSummary
    ].join(' · ')
  }

  get currentStockName(): string {
    const dataset = this.viewMode === 'timeshare' ? this.timeshare.dataset : this.chart.dataset
    const name = normalizeWatchlistName(dataset?.meta.name)
    return name || this.aiCurrentSecuritySymbol
  }

  private get aiCurrentSecuritySymbol(): string {
    const dataset = this.viewMode === 'timeshare' ? this.timeshare.dataset : this.chart.dataset
    const datasetSymbol = normalizeWatchlistSymbol(dataset?.meta.symbol ?? '')
    return datasetSymbol ?? this.normalizedCurrentSymbol
  }

  private get hasUsableAiCredential(): boolean {
    return (
      this.aiConnectorSnapshot.credentialStatus === 'saved' ||
      this.aiConnectorSnapshot.credentialStatus === 'temporary' ||
      this.aiConnectorSnapshot.credentialStatus === 'not-required'
    )
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

  private async loadSettings(options: { refreshDateBaseline?: boolean } = {}): Promise<void> {
    try {
      const settings = await this.dataAdapter.getSettings()
      const normalizedQuery = this.normalizeQueryForSource(settings.workspace.query)
      const baselineResult = options.refreshDateBaseline
        ? refreshStockQueryDateBaseline(
            normalizedQuery,
            this.options.getStartupDate?.() ?? new Date()
          )
        : { query: normalizedQuery, changed: false }
      runInAction(() => {
        this.networkProxy = settings.networkProxy
        this.proxyDraft = { ...settings.networkProxy }
        this.viewMode = normalizeWorkspaceViewMode(settings.workspace.viewMode)
        this.timeshareSourceId = this.normalizeTimeshareSourceId(settings.workspace.timeshareSourceId)
        this.query = baselineResult.query
        this.chart.setIndicatorSettings(
          settings.workspace.indicatorSettings,
          settings.workspace.enabledIndicators
        )
        this.timeshare.setIndicatorSettings(settings.workspace.timeshareIndicatorSettings)
        this.strategySettings = normalizeKlineStrategySettings(settings.workspace.klineStrategySettings)
        this.strategyDraft = cloneKlineStrategySettings(this.strategySettings)
        this.syncStrategyAssumptionInputs()
        this.watchlist = normalizeWatchlist(settings.workspace.watchlist)
        this.watchlistAddPreview = parseWatchlistText(this.watchlistAddText, this.watchlist)
      })
      if (baselineResult.changed) {
        this.saveWorkspaceSettingsNow()
      }
    } catch (error) {
      console.warn('Failed to load workspace settings', error)
    }
  }

  private async loadAiConnectorSettings(): Promise<void> {
    try {
      const snapshot = await this.dataAdapter.getAiConnectorSettings()
      runInAction(() => {
        this.applyAiConnectorSnapshot(snapshot, { syncDraft: !this.aiSettingsOpen })
      })
    } catch (error) {
      console.warn('Failed to load AI connector settings', error)
    }
  }

  private applyAiConnectorSnapshot(
    snapshot: AiConnectorSettingsSnapshot,
    options: { syncDraft: boolean }
  ): void {
    const settings = normalizeAiConnectorSettings(snapshot.settings)
    this.aiConnectorSnapshot = {
      ...snapshot,
      settings
    }
    this.aiConnectorSettings = cloneAiConnectorSettings(settings)
    if (options.syncDraft) {
      this.aiConnectorDraft = cloneAiConnectorSettings(settings)
    }
  }

  private createAiConnectorSettingsPayload(): AiConnectorSettings {
    return cloneAiConnectorSettings(normalizeAiConnectorSettings(this.aiConnectorDraft))
  }

  private async reloadAfterLocalCacheImport(): Promise<void> {
    this.cancelPendingWorkspaceSettingsSave()
    await this.loadSettings()
    await this.loadAiConnectorSettings()
    await this.options.onLocalCacheImported?.()
    if (this.klineCacheDialogOpen) {
      await this.loadKlineCacheStatus()
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
    this.klineCacheStatusRequestId += 1
    this.klineCacheRows = []
    this.klineCacheSelectedRowIds = []
    this.klineCacheLoading = false
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

  private patchStrategyAssumptions(patch: Partial<KlineStrategySettings['assumptions']>): void {
    this.strategyDraft = {
      ...this.strategyDraft,
      assumptions: {
        ...this.strategyDraft.assumptions,
        ...patch
      }
    }
  }

  private get strategyDraftAssumptionsForValidation(): KlineBacktestAssumptions {
    return {
      initialCapital: this.strategyInitialCapitalInput ?? Number.NaN,
      feeRate:
        this.strategyFeeRatePercentInput === null
          ? Number.NaN
          : this.strategyFeeRatePercentInput / 100,
      slippageRate:
        this.strategySlippageRatePercentInput === null
          ? Number.NaN
          : this.strategySlippageRatePercentInput / 100
    }
  }

  private syncStrategyAssumptionInputs(): void {
    this.strategyInitialCapitalInput = this.strategyDraft.assumptions.initialCapital
    this.strategyFeeRatePercentInput = this.strategyDraft.assumptions.feeRate * 100
    this.strategySlippageRatePercentInput = this.strategyDraft.assumptions.slippageRate * 100
  }

  private createStrategyBacktestQuery(): StockQuery {
    return this.normalizeQueryForSource({ ...this.query })
  }

  private async resolveStrategyDataset(query: StockQuery, requestId: number): Promise<StockDataset> {
    const cached = await this.dataAdapter.getCachedKlineDataset(query)
    this.assertStrategyRequestActive(requestId)
    if (
      cached.status === 'complete' &&
      cached.dataset &&
      isKlineStrategyDatasetCoveringQuery(cached.dataset, query)
    ) {
      return cached.dataset
    }
    try {
      await this.prepareStrategyKlineCache(query, requestId)
    } catch (error) {
      throw new Error(formatStrategyCacheRefreshError(error, cached, query))
    }
    this.setStrategyStatusMessage('正在读取历史 K 线缓存', requestId)
    const refreshed = await this.dataAdapter.getCachedKlineDataset(query)
    this.assertStrategyRequestActive(requestId)
    if (refreshed.status === 'complete' && refreshed.dataset) {
      const missingRanges = getKlineStrategyDatasetMissingRanges(refreshed.dataset, query)
      if (missingRanges.length > 0) {
        throw new Error(
          `历史 K 线缓存未覆盖所选回测区间：${formatKlineCacheMissingRanges(missingRanges)}`
        )
      }
      return refreshed.dataset
    }
    throw new Error(formatCachedKlineDatasetError(refreshed, '历史 K 线缓存刷新后仍不完整'))
  }

  private async prepareStrategyKlineCache(query: StockQuery, requestId: number): Promise<void> {
    this.setStrategyStatusMessage('正在准备历史 K 线缓存', requestId)
    const job = await this.dataAdapter.startKlineCacheRefresh(this.createStrategyKlineCacheRequest(query))
    this.assertStrategyRequestActive(requestId)
    const finishedJob = await this.waitForStrategyKlineCacheJob(job, requestId)
    if (finishedJob.status === 'cancelled') {
      throw new Error('历史 K 线缓存刷新已取消')
    }
  }

  private async waitForStrategyKlineCacheJob(
    job: KlineCacheJob,
    requestId: number
  ): Promise<KlineCacheJob> {
    let currentJob = job
    while (isKlineCacheJobActive(currentJob)) {
      this.assertStrategyRequestActive(requestId)
      this.setStrategyStatusMessage('正在准备历史 K 线缓存', requestId)
      await delay(KLINE_CACHE_JOB_POLL_INTERVAL_MS)
      this.assertStrategyRequestActive(requestId)
      const nextJob = await this.dataAdapter.getKlineCacheJob(currentJob.id)
      this.assertStrategyRequestActive(requestId)
      if (!nextJob) {
        throw new Error('历史 K 线缓存刷新任务不存在')
      }
      currentJob = nextJob
    }
    return currentJob
  }

  private createStrategyKlineCacheRequest(query: StockQuery): KlineCacheStatusRequest {
    return {
      query: {
        sourceId: query.sourceId,
        periods: [query.period],
        adjusts: [query.adjust],
        startDate: query.startDate,
        endDate: query.endDate
      },
      items: [
        {
          symbol: query.symbol,
          name: this.currentStockName,
          createdAt: 0
        }
      ]
    }
  }

  private setStrategyStatusMessage(message: string, requestId: number): void {
    runInAction(() => {
      if (this.strategyRequestId === requestId) {
        this.strategyStatusMessage = message
      }
    })
  }

  private assertStrategyRequestActive(requestId: number): void {
    if (this.strategyRequestId !== requestId) {
      throw new Error('策略回测请求已过期')
    }
  }

  private cancelActiveStrategyRun(): void {
    this.strategyRequestId += 1
    this.strategyRunning = false
    this.strategyStatusMessage = ''
  }

  private enrichAiAnalysisOutput(useCaseId: AiUseCaseId, outputText: string): string {
    if (useCaseId === 'parameter-optimization') {
      return appendSection(
        outputText,
        '本地批量回测验证',
        this.createAiParameterOptimizationValidationNotes(outputText)
      )
    }
    if (useCaseId === 'natural-language-stock-screening') {
      return appendSection(outputText, '本地筛选边界', this.createAiStockScreeningBoundaryNotes())
    }
    if (useCaseId === 'strategy-comparison') {
      return appendSection(outputText, '本地对比事实', this.createAiStrategyComparisonFactNotes())
    }
    if (useCaseId === 'price-move-prediction') {
      return appendSection(outputText, '实验边界', [
        '预测结果未写入策略信号、回测收益、智能选股推荐或自动交易动作'
      ])
    }
    return outputText
  }

  private createAiParameterOptimizationValidationNotes(outputText: string): string[] {
    const dataset = this.chart.dataset
    const baseResult = this.selectedStrategyResult
    if (this.viewMode !== 'kline' || !dataset || !baseResult?.metrics) {
      return ['当前缺少可验证的 K 线回测结果，候选参数不可排序']
    }
    const candidates = extractAiParameterCandidates(outputText, baseResult.templateId)
    if (candidates.length === 0) {
      return ['未检测到可解析候选参数，无法进入本地批量回测验证']
    }

    const ranked = candidates.map((candidate, index) => {
      if (candidate.templateId !== baseResult.templateId) {
        return {
          label: candidate.label || `候选 ${index + 1}`,
          status: 'unavailable' as const,
          reason: `候选模板 ${candidate.templateId} 与当前策略 ${baseResult.templateId} 不一致`
        }
      }
      const normalized = normalizeKlineStrategyParams(baseResult.templateId, {
        ...baseResult.params,
        ...candidate.params
      })
      if (normalized.errors.length > 0) {
        return {
          label: candidate.label || `候选 ${index + 1}`,
          status: 'unavailable' as const,
          reason: normalized.errors.join('；')
        }
      }
      const comparison = runKlineStrategyBacktests({
        dataset,
        query: baseResult.query,
        settings: {
          selectedTemplateIds: [baseResult.templateId],
          paramsByTemplate: {
            [baseResult.templateId]: normalized.params
          },
          assumptions: baseResult.assumptions
        }
      })
      const result = comparison.results[0]
      if (!result || result.status !== 'success' || !result.metrics) {
        return {
          label: candidate.label || `候选 ${index + 1}`,
          status: 'unavailable' as const,
          reason: result?.unavailableReason ?? '本地回测未生成有效结果'
        }
      }
      return {
        label: candidate.label || `候选 ${index + 1}`,
        status: 'success' as const,
        score: result.score ?? 0,
        metrics: result.metrics,
        params: normalized.params
      }
    })

    return ranked
      .sort((left, right) => {
        if (left.status === 'success' && right.status === 'success') {
          return right.score - left.score
        }
        if (left.status === 'success') {
          return -1
        }
        if (right.status === 'success') {
          return 1
        }
        return left.label.localeCompare(right.label, 'zh-CN')
      })
      .map((candidate, index) => {
        if (candidate.status === 'unavailable') {
          return `${index + 1}. ${candidate.label}：不可用，${candidate.reason}`
        }
        return `${index + 1}. ${candidate.label}：收益 ${formatPercent(candidate.metrics.totalReturn)}，回撤 ${formatPercent(candidate.metrics.maxDrawdown)}，胜率 ${formatPercent(candidate.metrics.winRate)}，交易 ${candidate.metrics.tradeCount}，参数 ${formatStrategyParams(candidate.params)}`
      })
  }

  private createAiStockScreeningBoundaryNotes(): string[] {
    const context = this.createAiWorkspaceContext()
    const scope =
      this.watchlist.length > 0
        ? `已确认自选股范围 ${this.watchlist.length} 只：${this.watchlist
            .slice(0, 20)
            .map((item) => `${item.name}(${item.symbol})`)
            .join('、')}`
        : `未配置自选股范围，仅保留当前证券 ${context.stockName}(${context.symbol}) 作为示例上下文`
    return [
      scope,
      `数据新鲜度：${this.aiContextSummary}`,
      context.missingData.length > 0 ? `缺失项：${context.missingData.join('；')}` : '缺失项：无'
    ]
  }

  private createAiStrategyComparisonFactNotes(): string[] {
    if (this.rankedStrategyResults.length === 0) {
      return ['当前没有可对比的本地策略回测结果']
    }
    return [
      `统一指标：总收益、最大回撤、胜率、盈亏比、交易次数；可比日期范围：${this.strategyBacktestDateRangeLabel}`,
      ...this.rankedStrategyResults.slice(0, 8).map((result) => {
        if (result.status !== 'success' || !result.metrics) {
          return `${result.templateName}：不可用，${result.unavailableReason ?? '缺少回测指标'}`
        }
        return `${result.templateName}：收益 ${formatPercent(result.metrics.totalReturn)}，回撤 ${formatPercent(result.metrics.maxDrawdown)}，胜率 ${formatPercent(result.metrics.winRate)}，交易 ${result.metrics.tradeCount}`
      })
    ]
  }

  private cancelActiveAiAnalysis(): void {
    const requestId = this.aiAnalysisStreamRequestId
    this.aiAnalysisRequestId += 1
    if (requestId) {
      void this.dataAdapter.cancelAiAnalysis(requestId)
    }
    this.aiAnalysisStreamRequestId = ''
    this.aiAnalysisRunning = false
    if (this.aiAnalysisStreamStatus === 'running' || this.aiAnalysisStreamStatus === 'cancelling') {
      this.aiAnalysisStreamStatus = 'cancelled'
    }
  }

  private applyAiAnalysisStreamEvent(event: AiAnalysisStreamEvent): void {
    if (!this.aiAnalysisStreamRequestId || event.requestId !== this.aiAnalysisStreamRequestId) {
      return
    }
    if (event.type === 'started') {
      this.aiAnalysisStreamStatus = 'running'
      this.aiAnalysisRunning = true
      this.aiAnalysisError = ''
      return
    }
    if (event.type === 'chunk') {
      this.aiAnalysisPartialOutput += event.chunkText
      return
    }
    if (event.type === 'completed') {
      const outputText = this.enrichAiAnalysisOutput(
        event.useCaseId,
        event.outputText || this.aiAnalysisPartialOutput
      )
      this.aiAnalysisRunning = false
      this.aiAnalysisStreamStatus = 'success'
      this.aiAnalysisPartialOutput = outputText
      this.aiAnalysisWarnings = event.warnings
      this.aiAnalysisFallbackWarning = event.streamingFallback
        ? event.warnings.find((warning) => warning.includes('不支持流式内容')) ?? ''
        : ''
      this.aiAnalysisResult = {
        status: 'success',
        useCaseId: event.useCaseId,
        connector: event.connector,
        outputText,
        warnings: event.warnings,
        streamingFallback: event.streamingFallback,
        elapsedMs: event.elapsedMs,
        completedAt: event.completedAt
      }
      this.aiAnalysisStreamRequestId = ''
      return
    }
    if (event.type === 'failed') {
      const outputText = this.enrichAiAnalysisOutput(
        event.useCaseId,
        event.outputText || this.aiAnalysisPartialOutput
      )
      this.aiAnalysisRunning = false
      this.aiAnalysisStreamStatus = 'error'
      this.aiAnalysisPartialOutput = outputText
      this.aiAnalysisWarnings = event.warnings
      this.aiAnalysisError = event.errorMessage || 'AI 分析失败'
      this.aiAnalysisResult = {
        status: 'error',
        useCaseId: event.useCaseId,
        connector: event.connector,
        outputText,
        warnings: event.warnings,
        errorMessage: this.aiAnalysisError,
        elapsedMs: event.elapsedMs,
        completedAt: event.completedAt
      }
      this.aiAnalysisStreamRequestId = ''
      return
    }
    if (event.type === 'cancelled') {
      this.aiAnalysisRunning = false
      this.aiAnalysisStreamStatus = 'cancelled'
      this.aiAnalysisPartialOutput = event.outputText || this.aiAnalysisPartialOutput
      this.aiAnalysisWarnings = event.warnings
      this.aiAnalysisStreamRequestId = ''
    }
  }

  private resetAiAnalysisOutput(): void {
    this.aiAnalysisStreamStatus = 'idle'
    this.aiAnalysisPartialOutput = ''
    this.aiAnalysisWarnings = []
    this.aiAnalysisFallbackWarning = ''
    this.aiAnalysisError = ''
    this.aiAnalysisResult = null
  }

  private getEnabledIndicatorLabels(): string[] {
    if (this.viewMode === 'timeshare') {
      return Object.entries(this.timeshare.indicatorSettings)
        .filter(([, setting]) => setting.enabled)
        .map(([name]) => name)
    }
    return Object.entries(this.chart.indicatorSettings)
      .filter(([, setting]) => setting.enabled)
      .map(([name]) => name)
  }

  private createAiStrategyBacktestSummary(
    result: KlineStrategyBacktestResult | undefined
  ): AiStrategyBacktestSummary | undefined {
    if (!result || result.status !== 'success' || !result.metrics) {
      return undefined
    }
    return {
      templateName: result.templateName,
      period: result.query.period,
      adjust: result.query.adjust,
      startDate: result.dataStartDate ?? result.query.startDate,
      endDate: result.dataEndDate ?? result.query.endDate,
      sampleSize: result.equityCurve.length,
      totalReturnPercent: result.metrics.totalReturn * 100,
      maxDrawdownPercent: result.metrics.maxDrawdown * 100,
      winRatePercent: (result.metrics.winRate ?? 0) * 100,
      profitFactor: result.metrics.profitLossRatio ?? 0,
      tradeCount: result.metrics.tradeCount,
      assumptions: [
        `initialCapital=${result.assumptions.initialCapital}`,
        `feeRate=${result.assumptions.feeRate}`,
        `slippageRate=${result.assumptions.slippageRate}`
      ]
    }
  }

  private syncSelectedStrategySignals(): void {
    const result = this.selectedStrategyResult
    const strategySignalEnabled =
      this.viewMode === 'kline' && this.chart.effectiveIndicatorSettings.strategySignal.enabled
    this.chart.setStrategySignals(
      strategySignalEnabled && result?.status === 'success' ? result.signals : []
    )
  }

  private invalidateStrategyResultsIfQueryChanged(query: StockQuery): void {
    if (stockQueryEquals(this.query, query)) {
      return
    }
    this.strategyResults = []
    this.selectedStrategyResultId = ''
    this.strategyError = ''
    this.cancelActiveStrategyRun()
    this.chart.setStrategySignals([])
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
    this.cancelPendingWorkspaceSettingsSave()
    this.persistWorkspaceSettings()
  }

  private cancelPendingWorkspaceSettingsSave(): void {
    if (!this.workspaceSaveTimer) {
      return
    }
    clearTimeout(this.workspaceSaveTimer)
    this.workspaceSaveTimer = undefined
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
      klineStrategySettings: cloneKlineStrategySettings(this.strategySettings),
      watchlist: normalizeWatchlist(this.watchlist)
    }
  }

  private reenrichCurrentDataset(settings: IndicatorSettingsMap = this.chart.indicatorSettings): void {
    if (!this.chart.dataset) {
      return
    }
    this.chart.setDataset(enrichStockDataset(this.chart.dataset, settings))
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

interface AiParameterCandidate {
  label: string
  templateId: KlineStrategyTemplateId
  params: KlineStrategyParams
}

function appendSection(outputText: string, title: string, notes: string[]): string {
  if (notes.length === 0) {
    return outputText
  }
  const section = `${title}\n${notes.map((note) => `- ${note}`).join('\n')}`
  const trimmed = outputText.trim()
  return trimmed ? `${trimmed}\n\n${section}` : section
}

function extractAiParameterCandidates(
  outputText: string,
  fallbackTemplateId: KlineStrategyTemplateId
): AiParameterCandidate[] {
  const parsed = parseFirstJsonObject(outputText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return []
  }
  const record = parsed as Record<string, unknown>
  const rawCandidates = Array.isArray(record.candidateParameters)
    ? record.candidateParameters
    : []
  return rawCandidates
    .map((candidate, index) => normalizeAiParameterCandidate(candidate, index, fallbackTemplateId))
    .filter((candidate): candidate is AiParameterCandidate => Boolean(candidate))
    .slice(0, 12)
}

function normalizeAiParameterCandidate(
  value: unknown,
  index: number,
  fallbackTemplateId: KlineStrategyTemplateId
): AiParameterCandidate | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  const templateId = isKlineStrategyTemplateId(record.templateId)
    ? record.templateId
    : fallbackTemplateId
  const paramsSource =
    readRecord(record.params) ??
    readRecord(record.parameters) ??
    readRecord(record.parameterDrafts) ??
    record
  const params = readNumericParams(paramsSource)
  if (Object.keys(params).length === 0) {
    return null
  }
  return {
    label: readCandidateLabel(record, index),
    templateId,
    params
  }
}

function parseFirstJsonObject(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  for (const candidate of [fencedJson, trimmed, extractJsonObject(trimmed)].filter(Boolean) as string[]) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Keep the model output as plain text when it is not structured JSON.
    }
  }
  return null
}

function extractJsonObject(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  return start >= 0 && end > start ? text.slice(start, end + 1) : undefined
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readNumericParams(record: Record<string, unknown>): KlineStrategyParams {
  return Object.fromEntries(
    Object.entries(record)
      .map(([key, value]) => [key, Number(value)] as const)
      .filter(([, value]) => Number.isFinite(value))
  )
}

function readCandidateLabel(record: Record<string, unknown>, index: number): string {
  const label = [record.name, record.label, record.title]
    .find((value) => typeof value === 'string' && value.trim())
  return typeof label === 'string' ? label.trim().slice(0, 60) : `候选 ${index + 1}`
}

function isKlineStrategyTemplateId(value: unknown): value is KlineStrategyTemplateId {
  return klineStrategyTemplates.some((template) => template.id === value)
}

function formatPercent(value: number | undefined): string {
  return Number.isFinite(value) ? `${formatNumber((value ?? 0) * 100)}%` : '缺失'
}

function formatStrategyParams(params: KlineStrategyParams): string {
  return Object.entries(params)
    .map(([key, value]) => `${key}=${formatNumber(value)}`)
    .join(', ')
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function createDefaultStockQuery(): StockQuery {
  const endDate = new Date()
  const defaultDateRange = createDefaultDateRange(endDate)

  return {
    sourceId: 'eastmoney',
    symbol: 'sh000001',
    period: 'day',
    adjust: 'qfq',
    startDate: defaultDateRange.startDate,
    endDate: defaultDateRange.endDate
  }
}

export interface StockQueryDateBaselineRefreshResult {
  query: StockQuery
  changed: boolean
}

export function refreshStockQueryDateBaseline(
  query: StockQuery,
  startupDate: Date
): StockQueryDateBaselineRefreshResult {
  const startupDateKey = formatDateKey(startupDate)
  const spanDays = getDateKeySpanDays(query.startDate, query.endDate)

  if (spanDays === null) {
    const defaultDateRange = createDefaultDateRange(startupDate)
    const nextQuery = {
      ...query,
      startDate: defaultDateRange.startDate,
      endDate: defaultDateRange.endDate
    }
    return {
      query: nextQuery,
      changed: !stockQueryEquals(query, nextQuery)
    }
  }

  if (query.endDate === startupDateKey) {
    return {
      query,
      changed: false
    }
  }

  const nextQuery = {
    ...query,
    startDate: addDaysToDateKey(startupDateKey, -spanDays),
    endDate: startupDateKey
  }

  return {
    query: nextQuery,
    changed: !stockQueryEquals(query, nextQuery)
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

function createDefaultDateRange(endDate: Date): Pick<StockQuery, 'startDate' | 'endDate'> {
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - 2)
  return {
    startDate: formatDateKey(startDate),
    endDate: formatDateKey(endDate)
  }
}

function getDateKeySpanDays(startDateKey: string, endDateKey: string): number | null {
  const startTimestamp = parseDateKeyToUtcTimestamp(startDateKey)
  const endTimestamp = parseDateKeyToUtcTimestamp(endDateKey)
  if (startTimestamp === null || endTimestamp === null || startTimestamp > endTimestamp) {
    return null
  }
  return Math.round((endTimestamp - startTimestamp) / 86_400_000)
}

function addDaysToDateKey(dateKey: string, amount: number): string {
  const timestamp = parseDateKeyToUtcTimestamp(dateKey)
  if (timestamp === null) {
    return dateKey
  }
  return formatUtcDateKey(new Date(timestamp + amount * 86_400_000))
}

function parseDateKeyToUtcTimestamp(dateKey: string): number | null {
  if (!/^\d{8}$/.test(dateKey)) {
    return null
  }
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6))
  const day = Number(dateKey.slice(6, 8))
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return timestamp
}

function formatUtcDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('')
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

function getStrategyDateRangeError(query: Pick<StockQuery, 'startDate' | 'endDate'>): string {
  if (query.startDate.length !== 8 || query.endDate.length !== 8) {
    return '回测区间日期必须为 8 位数字'
  }
  if (query.startDate > query.endDate) {
    return '回测开始日期不能晚于结束日期'
  }
  return ''
}

function formatStrategyCacheRefreshError(
  error: unknown,
  cached: KlineCachedDatasetResult,
  query: StockQuery
): string {
  const message = formatErrorMessage(error)
  const missingRanges = getCachedKlineDatasetMissingRanges(cached, query)
  if (missingRanges.length === 0) {
    return message
  }
  return `${message}；缺失范围：${formatKlineCacheMissingRanges(missingRanges)}`
}

function chooseSelectedStrategyResultId(results: KlineStrategyBacktestResult[]): string {
  return (
    results.find((result) => result.rank === 1)?.id ??
    results.find((result) => result.status === 'success')?.id ??
    results[0]?.id ??
    ''
  )
}

function formatCachedKlineDatasetError(
  cached: KlineCachedDatasetResult,
  fallback: string
): string {
  const missingRanges = cached.missingRanges
    .map((range) => `${range.startDate}-${range.endDate}`)
    .join('；')
  const reason = cached.message || cached.lastError?.message
  if (reason) {
    return missingRanges ? `${reason}；缺失范围：${missingRanges}` : reason
  }
  return missingRanges ? `${fallback}：${missingRanges}` : fallback
}

function getCachedKlineDatasetMissingRanges(
  cached: KlineCachedDatasetResult,
  query: StockQuery
): KlineCacheDateRange[] {
  if (cached.dataset) {
    const candleMissingRanges = getKlineStrategyDatasetMissingRanges(cached.dataset, query)
    if (candleMissingRanges.length > 0) {
      return candleMissingRanges
    }
  }
  return cached.missingRanges
}

function formatKlineCacheMissingRanges(missingRanges: KlineCacheDateRange[]): string {
  return missingRanges.map((range) => `${range.startDate}-${range.endDate}`).join('；')
}

function stockQueryEquals(left: StockQuery, right: StockQuery): boolean {
  return (
    left.sourceId === right.sourceId &&
    left.symbol.trim().toLowerCase() === right.symbol.trim().toLowerCase() &&
    left.period === right.period &&
    left.adjust === right.adjust &&
    left.startDate === right.startDate &&
    left.endDate === right.endDate
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
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
