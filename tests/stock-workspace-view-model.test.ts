import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  AppSettings,
  LocalCacheBackupExportResult,
  LocalCacheBackupImportRequest,
  LocalCacheBackupImportResult,
  LocalCacheBackupInspectResult,
  LocalCacheBackupSummary,
  NetworkProxySettings,
  WorkspaceSettings
} from '../src/preload/stock-api'
import type { StockDataAdapter } from '../src/renderer/features/stock-workspace/adapters/ElectronStockDataAdapter'
import type {
  AiAnalysisCancelResult,
  AiAnalysisRequest,
  AiAnalysisResult,
  AiAnalysisStreamEvent,
  AiAnalysisStreamStartRequest,
  AiAnalysisStreamStartResult,
  AiConnectorSettings,
  AiConnectorSettingsSnapshot
} from '../src/renderer/features/stock-workspace/models/ai-models'
import {
  AI_STREAMING_FALLBACK_NOTICE,
  createDefaultAiConnectorSettings,
  createDefaultAiConnectorSettingsSnapshot
} from '../src/renderer/features/stock-workspace/models/ai-models'
import { createDefaultIndicatorSettings } from '../src/renderer/features/stock-workspace/models/indicator-definitions'
import { createDefaultTimeshareIndicatorSettings } from '../src/renderer/features/stock-workspace/models/timeshare-indicator-definitions'
import type {
  KlineCacheClearRequest,
  KlineCachedDatasetResult,
  KlineCacheJob,
  KlineCacheRefreshRequest,
  KlineCacheSeriesRequestItem,
  KlineCacheStatusRequest,
  KlineCacheStatusRow,
  KlineStrategySettings,
  StockDataset,
  StockDataSourceMeta,
  StockQuery,
  StockTimeshareQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'
import { expandKlineCacheStockQueries } from '../src/renderer/features/stock-workspace/models/kline-cache'
import { createDefaultTradeProfitSettings } from '../src/renderer/features/trade-profit-calculator/models/trade-profit'
import {
  StockWorkspaceViewModel,
  type StockWorkspaceViewModelOptions
} from '../src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel'

class FakeDataAdapter implements StockDataAdapter {
  private settings: AppSettings = createDefaultSettings()
  savedWorkspaceSettings: WorkspaceSettings[] = []
  stockQueries: StockQuery[] = []
  timeshareQueries: StockTimeshareQuery[] = []
  klineCacheStatusRequests: KlineCacheStatusRequest[] = []
  klineCacheRefreshRequests: KlineCacheRefreshRequest[] = []
  klineCacheClearRequests: KlineCacheClearRequest[] = []
  klineCacheJobQueries: string[] = []
  nextKlineCacheRows: KlineCacheStatusRow[] | null = null
  nextKlineCacheJob: KlineCacheJob | null = null
  nextKlineCacheRefreshError: Error | null = null
  nextStockDataset: StockDataset | null = null
  nextCachedKlineDatasetResult: KlineCachedDatasetResult | null = null
  nextLocalCacheExportResult: LocalCacheBackupExportResult | null = null
  nextLocalCacheInspectResult: LocalCacheBackupInspectResult | null = null
  nextLocalCacheImportResult: LocalCacheBackupImportResult | null = null
  failWorkspaceSaves = false
  cachedKlineDatasetResults: KlineCachedDatasetResult[] = []
  cachedKlineQueries: StockQuery[] = []
  localCacheExportCount = 0
  localCacheInspectCount = 0
  localCacheImportRequests: LocalCacheBackupImportRequest[] = []
  aiConnectorSnapshot: AiConnectorSettingsSnapshot = createDefaultAiConnectorSettingsSnapshot()
  aiAnalysisRequests: AiAnalysisRequest[] = []
  aiAnalysisResults: AiAnalysisResult[] = []
  aiTestCount = 0
  private readonly aiAnalysisStreamListeners = new Set<(event: AiAnalysisStreamEvent) => void>()

  constructor(private readonly failingSourceIds: string[] = [], settings?: AppSettings) {
    if (settings) {
      this.settings = settings
      this.aiConnectorSnapshot = {
        ...this.aiConnectorSnapshot,
        settings: settings.aiConnector,
        credentialStatus: settings.aiConnector.enabled ? 'saved' : this.aiConnectorSnapshot.credentialStatus
      }
    }
  }

  get workspaceEndDate(): string {
    return this.settings.workspace.query.endDate
  }

  async getStockDataSources(): Promise<StockDataSourceMeta[]> {
    return [
      {
        id: 'eastmoney',
        name: '东方财富',
        capabilities: {
          periods: ['day', 'week', 'month', '5', '15', '30', '60'],
          adjusts: ['none', 'qfq', 'hfq'],
          markets: ['stock', 'etf', 'index'],
          timeshare: true
        }
      },
      {
        id: 'tencent',
        name: '腾讯/QQ 财经',
        capabilities: {
          periods: ['day', 'week', 'month'],
          adjusts: ['none', 'qfq', 'hfq'],
          markets: ['stock', 'etf', 'index'],
          timeshare: true
        }
      },
      {
        id: 'sina',
        name: '新浪财经',
        capabilities: {
          periods: ['day', 'week'],
          adjusts: ['none'],
          markets: ['stock', 'etf', 'index'],
          timeshare: false
        }
      },
      {
        id: 'netease163',
        name: '网易财经 163',
        capabilities: {
          periods: ['day'],
          adjusts: ['none'],
          markets: ['stock'],
          timeshare: false
        }
      }
    ]
  }

  async fetchStockDataset(query: StockQuery) {
    this.stockQueries.push(query)
    if (this.failingSourceIds.includes(query.sourceId)) {
      throw new Error(`${query.sourceId} failed`)
    }
    const dataset = this.nextStockDataset ?? createSampleStockDataset()

    return {
      ...dataset,
      meta: {
        ...dataset.meta,
        symbol: query.symbol,
        name: stockNameBySymbol[query.symbol] ?? dataset.meta.name
      },
      sourceId: query.sourceId,
      sourceName: sourceNameById[query.sourceId],
      adjust: query.adjust
    }
  }

  async fetchStockTimeshareDataset(query: StockTimeshareQuery) {
    this.timeshareQueries.push(query)
    if (this.failingSourceIds.includes(query.sourceId)) {
      throw new Error(`${query.sourceId} failed`)
    }

    return {
      meta: {
        lineType: '分时',
        symbol: query.symbol,
        name: stockNameBySymbol[query.symbol] ?? '上证指数'
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
      sourceId: query.sourceId,
      sourceName: sourceNameById[query.sourceId],
      sourceUrl: 'https://example.com/timeshare'
    }
  }

  async getKlineCacheStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]> {
    this.klineCacheStatusRequests.push(request)
    return this.nextKlineCacheRows ?? createKlineCacheRows(request)
  }

  async startKlineCacheRefresh(request: KlineCacheRefreshRequest): Promise<KlineCacheJob> {
    this.klineCacheRefreshRequests.push(request)
    if (this.nextKlineCacheRefreshError) {
      throw this.nextKlineCacheRefreshError
    }
    return this.nextKlineCacheJob ?? createCompletedKlineCacheJob(request)
  }

  async getKlineCacheJob(jobId: string): Promise<KlineCacheJob | null> {
    this.klineCacheJobQueries.push(jobId)
    return this.nextKlineCacheJob?.id === jobId ? this.nextKlineCacheJob : null
  }

  async cancelKlineCacheJob(jobId: string): Promise<KlineCacheJob | null> {
    if (!this.nextKlineCacheJob || this.nextKlineCacheJob.id !== jobId) {
      return null
    }
    this.nextKlineCacheJob = {
      ...this.nextKlineCacheJob,
      status: 'cancelled'
    }
    return this.nextKlineCacheJob
  }

  async getCachedKlineDataset(query: StockQuery): Promise<KlineCachedDatasetResult> {
    this.cachedKlineQueries.push(query)
    return this.cachedKlineDatasetResults.shift() ?? this.nextCachedKlineDatasetResult ?? {
      status: 'empty' as const,
      query,
      missingRanges: []
    }
  }

  async clearKlineCache(request: KlineCacheClearRequest): Promise<KlineCacheStatusRow[]> {
    this.klineCacheClearRequests.push(request)
    return createKlineCacheRows(request)
  }

  async exportLocalCacheBackup(): Promise<LocalCacheBackupExportResult> {
    this.localCacheExportCount += 1
    return this.nextLocalCacheExportResult ?? {
      status: 'success',
      filePath: '/tmp/stock-monitor.stock-monitor-backup.json',
      summary: createLocalCacheBackupSummary()
    }
  }

  async inspectLocalCacheBackup(): Promise<LocalCacheBackupInspectResult> {
    this.localCacheInspectCount += 1
    return this.nextLocalCacheInspectResult ?? {
      status: 'ready',
      importToken: 'token-1',
      filePath: '/tmp/stock-monitor.stock-monitor-backup.json',
      summary: createLocalCacheBackupSummary()
    }
  }

  async importLocalCacheBackup(
    request: LocalCacheBackupImportRequest
  ): Promise<LocalCacheBackupImportResult> {
    this.localCacheImportRequests.push(request)
    const result = this.nextLocalCacheImportResult ?? {
      status: 'success' as const,
      settings: this.settings,
      summary: {
        ...createLocalCacheBackupSummary(),
        strategy: request.strategy,
        importedKlineCacheEntryCount: 1,
        removedKlineCacheEntryCount: request.strategy === 'replace' ? 1 : 0
      }
    }
    if (result.status === 'success' && result.settings) {
      this.settings = result.settings
    }
    return result
  }

  async getSettings(): Promise<AppSettings> {
    return this.settings
  }

  async getAiConnectorSettings(): Promise<AiConnectorSettingsSnapshot> {
    return this.aiConnectorSnapshot
  }

  async setAiConnectorSettings(settings: AiConnectorSettings): Promise<AiConnectorSettingsSnapshot> {
    this.settings = {
      ...this.settings,
      aiConnector: settings
    }
    this.aiConnectorSnapshot = {
      ...this.aiConnectorSnapshot,
      settings
    }
    return this.aiConnectorSnapshot
  }

  async saveAiConnectorApiKey(
    connectorId: string,
    _apiKey: string
  ): Promise<AiConnectorSettingsSnapshot> {
    this.aiConnectorSnapshot = {
      ...this.aiConnectorSnapshot,
      settings: {
        ...this.aiConnectorSnapshot.settings,
        connectorId
      },
      credentialStatus: 'saved'
    }
    return this.aiConnectorSnapshot
  }

  async clearAiConnectorApiKey(connectorId: string): Promise<AiConnectorSettingsSnapshot> {
    this.aiConnectorSnapshot = {
      ...this.aiConnectorSnapshot,
      settings: {
        ...this.aiConnectorSnapshot.settings,
        connectorId
      },
      credentialStatus: 'missing'
    }
    return this.aiConnectorSnapshot
  }

  async testAiConnector() {
    this.aiTestCount += 1
    return {
      status: 'available' as const,
      connectorId: this.aiConnectorSnapshot.settings.connectorId,
      displayName: this.aiConnectorSnapshot.settings.displayName,
      kind: this.aiConnectorSnapshot.settings.kind,
      message: '可用',
      credentialStatus: this.aiConnectorSnapshot.credentialStatus
    }
  }

  async runAiAnalysis(request: AiAnalysisRequest): Promise<AiAnalysisResult> {
    this.aiAnalysisRequests.push(request)
    return (
      this.aiAnalysisResults.shift() ?? {
        status: 'success' as const,
        useCaseId: request.useCaseId,
        connector: {
          connectorId: this.aiConnectorSnapshot.settings.connectorId,
          displayName: this.aiConnectorSnapshot.settings.displayName,
          kind: this.aiConnectorSnapshot.settings.kind,
          model: this.aiConnectorSnapshot.settings.model,
          profile: this.aiConnectorSnapshot.settings.profile
        },
        outputText: 'AI 分析结果',
        warnings: ['仅供信息整理和历史数据解释，不构成投资建议'],
        elapsedMs: 12,
        completedAt: '2026-08-25T00:00:00.000Z'
      }
    )
  }

  async startAiAnalysisStream(
    request: AiAnalysisStreamStartRequest
  ): Promise<AiAnalysisStreamStartResult> {
    this.aiAnalysisRequests.push(request.analysisRequest)
    const result = this.aiAnalysisResults.shift() ?? this.createDefaultAiAnalysisResult(request.analysisRequest)
    const connector = result.connector
    this.emitAiAnalysisStreamEvent({
      type: 'started',
      requestId: request.requestId,
      useCaseId: request.analysisRequest.useCaseId,
      connector,
      startedAt: '2026-08-25T00:00:00.000Z'
    })
    if (result.status === 'success') {
      if (result.outputText) {
        this.emitAiAnalysisStreamEvent({
          type: 'chunk',
          requestId: request.requestId,
          useCaseId: request.analysisRequest.useCaseId,
          connector,
          chunkText: result.outputText,
          elapsedMs: result.elapsedMs
        })
      }
      this.emitAiAnalysisStreamEvent({
        type: 'completed',
        requestId: request.requestId,
        useCaseId: request.analysisRequest.useCaseId,
        connector,
        outputText: result.outputText,
        warnings: result.warnings,
        streamingFallback: result.streamingFallback,
        elapsedMs: result.elapsedMs,
        completedAt: result.completedAt
      })
    } else {
      this.emitAiAnalysisStreamEvent({
        type: 'failed',
        requestId: request.requestId,
        useCaseId: request.analysisRequest.useCaseId,
        connector,
        outputText: result.outputText,
        warnings: result.warnings,
        errorMessage: result.errorMessage ?? 'AI 分析失败',
        elapsedMs: result.elapsedMs,
        completedAt: result.completedAt
      })
    }
    return {
      requestId: request.requestId,
      useCaseId: request.analysisRequest.useCaseId,
      connector
    }
  }

  async cancelAiAnalysis(requestId: string): Promise<AiAnalysisCancelResult> {
    this.emitAiAnalysisStreamEvent({
      type: 'cancelled',
      requestId,
      useCaseId: 'daily-review',
      connector: this.createAiConnectorRunInfo(),
      outputText: '',
      warnings: ['仅供信息整理和历史数据解释，不构成投资建议'],
      elapsedMs: 0,
      completedAt: '2026-08-25T00:00:00.000Z'
    })
    return {
      requestId,
      status: 'cancelled'
    }
  }

  onAiAnalysisStreamEvent(callback: (event: AiAnalysisStreamEvent) => void): () => void {
    this.aiAnalysisStreamListeners.add(callback)
    return () => {
      this.aiAnalysisStreamListeners.delete(callback)
    }
  }

  async setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings> {
    this.settings = {
      ...this.settings,
      networkProxy: proxy
    }
    return this.settings
  }

  async setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings> {
    this.savedWorkspaceSettings.push(workspace)
    if (this.failWorkspaceSaves) {
      throw new Error('save failed')
    }
    this.settings = {
      ...this.settings,
      workspace
    }
    return this.settings
  }

  protected emitAiAnalysisStreamEvent(event: AiAnalysisStreamEvent): void {
    this.aiAnalysisStreamListeners.forEach((listener) => listener(event))
  }

  protected createDefaultAiAnalysisResult(request: AiAnalysisRequest): AiAnalysisResult {
    return {
      status: 'success' as const,
      useCaseId: request.useCaseId,
      connector: this.createAiConnectorRunInfo(),
      outputText: 'AI 分析结果',
      warnings: ['仅供信息整理和历史数据解释，不构成投资建议'],
      elapsedMs: 12,
      completedAt: '2026-08-25T00:00:00.000Z'
    }
  }

  protected createAiConnectorRunInfo(): AiAnalysisResult['connector'] {
    return {
      connectorId: this.aiConnectorSnapshot.settings.connectorId,
      displayName: this.aiConnectorSnapshot.settings.displayName,
      kind: this.aiConnectorSnapshot.settings.kind,
      model: this.aiConnectorSnapshot.settings.model,
      profile: this.aiConnectorSnapshot.settings.profile
    }
  }
}

class StructuredCloneCacheAdapter extends FakeDataAdapter {
  override async getKlineCacheStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]> {
    structuredClone(request)
    return super.getKlineCacheStatus(request)
  }

  override async startKlineCacheRefresh(request: KlineCacheRefreshRequest): Promise<KlineCacheJob> {
    structuredClone(request)
    return super.startKlineCacheRefresh(request)
  }

  override async clearKlineCache(request: KlineCacheClearRequest): Promise<KlineCacheStatusRow[]> {
    structuredClone(request)
    return super.clearKlineCache(request)
  }
}

class StructuredCloneAiSettingsAdapter extends FakeDataAdapter {
  override async setAiConnectorSettings(
    settings: AiConnectorSettings
  ): Promise<AiConnectorSettingsSnapshot> {
    structuredClone(settings)
    return super.setAiConnectorSettings(settings)
  }
}

class DeferredKlineCacheStatusAdapter extends FakeDataAdapter {
  private readonly pendingKlineCacheStatusResponses: Array<() => void> = []

  override async getKlineCacheStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]> {
    this.klineCacheStatusRequests.push(request)
    return new Promise((resolve) => {
      this.pendingKlineCacheStatusResponses.push(() => {
        resolve(this.nextKlineCacheRows ?? createKlineCacheRows(request))
      })
    })
  }

  resolveNextKlineCacheStatus(): void {
    const resolve = this.pendingKlineCacheStatusResponses.shift()
    if (!resolve) {
      throw new Error('没有待处理的 K 线缓存状态请求')
    }
    resolve()
  }
}

class DeferredAiAnalysisAdapter extends FakeDataAdapter {
  private readonly pendingAiResponses: Array<{
    requestId: string
    request: AiAnalysisRequest
  }> = []

  override async startAiAnalysisStream(
    request: AiAnalysisStreamStartRequest
  ): Promise<AiAnalysisStreamStartResult> {
    this.aiAnalysisRequests.push(request.analysisRequest)
    const connector = this.createAiConnectorRunInfo()
    this.pendingAiResponses.push({
      requestId: request.requestId,
      request: request.analysisRequest
    })
    this.emitAiAnalysisStreamEvent({
      type: 'started',
      requestId: request.requestId,
      useCaseId: request.analysisRequest.useCaseId,
      connector,
      startedAt: '2026-08-25T00:00:00.000Z'
    })
    return {
      requestId: request.requestId,
      useCaseId: request.analysisRequest.useCaseId,
      connector
    }
  }

  resolveNextAiAnalysis(outputText: string): void {
    const pending = this.pendingAiResponses.shift()
    if (!pending) {
      throw new Error('没有待处理的 AI 分析请求')
    }
    const connector = this.createAiConnectorRunInfo()
    this.emitAiAnalysisStreamEvent({
      type: 'chunk',
      requestId: pending.requestId,
      useCaseId: pending.request.useCaseId,
      connector,
      chunkText: outputText,
      elapsedMs: 1
    })
    this.emitAiAnalysisStreamEvent({
      type: 'completed',
      requestId: pending.requestId,
      useCaseId: pending.request.useCaseId,
      connector,
      outputText,
      warnings: [],
      elapsedMs: 1,
      completedAt: '2026-08-25T00:00:00.000Z'
    })
  }

  emitNextAiChunk(chunkText: string): void {
    const pending = this.pendingAiResponses[0]
    if (!pending) {
      throw new Error('没有待处理的 AI 分析请求')
    }
    this.emitAiAnalysisStreamEvent({
      type: 'chunk',
      requestId: pending.requestId,
      useCaseId: pending.request.useCaseId,
      connector: this.createAiConnectorRunInfo(),
      chunkText,
      elapsedMs: 1
    })
  }

  emitStaleAiChunk(requestId: string, chunkText: string): void {
    this.emitAiAnalysisStreamEvent({
      type: 'chunk',
      requestId,
      useCaseId: 'daily-review',
      connector: this.createAiConnectorRunInfo(),
      chunkText,
      elapsedMs: 1
    })
  }
}

const sourceNameById: Record<StockQuery['sourceId'], string> = {
  eastmoney: '东方财富',
  sina: '新浪财经',
  netease163: '网易财经 163',
  tencent: '腾讯/QQ 财经'
}

const stockNameBySymbol: Record<string, string> = {
  sh000001: '上证指数',
  sh600519: '贵州茅台',
  sz000001: '平安银行',
  sz000002: '万科A'
}

function createStockWorkspaceViewModel(
  adapter: StockDataAdapter,
  options: StockWorkspaceViewModelOptions = {}
): StockWorkspaceViewModel {
  return new StockWorkspaceViewModel(adapter, {
    getStartupDate: () => getStartupDateForAdapter(adapter),
    ...options
  })
}

function getStartupDateForAdapter(adapter: StockDataAdapter): Date {
  if (adapter instanceof FakeDataAdapter) {
    return dateFromDateKey(adapter.workspaceEndDate) ?? new Date(2026, 0, 1)
  }
  return new Date(2026, 0, 1)
}

function dateFromDateKey(dateKey: string): Date | null {
  if (!/^\d{8}$/.test(dateKey)) {
    return null
  }
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(4, 6))
  const day = Number(dateKey.slice(6, 8))
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

afterEach(() => {
  vi.useRealTimers()
})

describe('StockWorkspaceViewModel', () => {
  it('loads default timeshare data into timeshare state', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    await viewModel.initialize()

    expect(viewModel.viewMode).toBe('timeshare')
    expect(viewModel.timeshare.dataset?.meta.name).toBe('上证指数')
    expect(viewModel.recordCount).toBe(2)
    expect(viewModel.status).toBe('success')
    expect(viewModel.selectedSourceName).toBe('东方财富')
  })

  it('reports advanced timeshare indicator availability from the current dataset', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    await viewModel.initialize()

    expect(viewModel.getTimeshareIndicatorAvailability('kdj')).toMatchObject({
      available: false,
      message: '缺少分钟 OHLC'
    })
    expect(viewModel.getTimeshareIndicatorAvailability('volume')).toMatchObject({
      available: true,
      message: ''
    })
  })

  it('falls back to Tencent during startup when Eastmoney fails', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter(['eastmoney'], createKlineSettings())
    )

    await viewModel.initialize()

    expect(viewModel.status).toBe('success')
    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.selectedSourceName).toBe('腾讯/QQ 财经')
  })

  it('tests all data sources and records request status', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter(['eastmoney'], createKlineSettings())
    )

    await viewModel.initialize()
    await viewModel.testDataSources()
    viewModel.openSourceTestDialog()

    expect(viewModel.sourceTestOpen).toBe(true)
    expect(viewModel.sourceTestRunning).toBe(false)
    expect(viewModel.sourceTestResults).toHaveLength(4)
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'eastmoney')).toMatchObject({
      status: 'error',
      message: 'eastmoney failed'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'tencent')).toMatchObject({
      status: 'success',
      recordCount: expect.any(Number)
    })
  })

  it('normalizes query options when switching data sources', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.setSourceId('sina')

    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.query.adjust).toBe('none')
  })

  it('restores cached workspace query and indicator settings on startup', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          query: {
            sourceId: 'sina',
            symbol: 'sz000002',
            period: 'month',
            adjust: 'hfq',
            startDate: '20250101',
            endDate: '20251231'
          },
          viewMode: 'kline',
          enabledIndicators: {
            boll: false,
            volumeMa: true,
            bsSignal: false
          }
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.query).toEqual({
      sourceId: 'sina',
      symbol: 'sz000002',
      period: 'day',
      adjust: 'none',
      startDate: '20250101',
      endDate: '20251231'
    })
    expect(viewModel.chart.indicatorSettings.boll.enabled).toBe(false)
    expect(viewModel.chart.indicatorSettings.volumeMa.enabled).toBe(true)
    expect('bsSignal' in viewModel.chart.indicatorSettings).toBe(false)
    expect(viewModel.chart.indicatorSettings.strategySignal.enabled).toBe(true)
    expect(viewModel.chart.indicatorSettings.macd.enabled).toBe(false)
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
  })

  it('refreshes the saved kline date baseline to the startup date', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          symbol: 'sz000001',
          startDate: '20260801',
          endDate: '20260810'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()

    expect(viewModel.query).toMatchObject({
      symbol: 'sz000001',
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.stockQueries[0]).toMatchObject({
      symbol: 'sz000001',
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(adapter.savedWorkspaceSettings[0].query).toMatchObject({
      symbol: 'sz000001',
      startDate: '20260810',
      endDate: '20260819'
    })
  })

  it('continues startup refresh when saving the adjusted date baseline fails', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          startDate: '20260801',
          endDate: '20260810'
        }
      }
    })
    adapter.failWorkspaceSaves = true
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()

    expect(viewModel.status).toBe('success')
    expect(viewModel.query).toMatchObject({
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.stockQueries[0]).toMatchObject({
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(warnSpy).toHaveBeenCalledWith('Failed to save workspace settings', expect.any(Error))
    warnSpy.mockRestore()
  })

  it('keeps the saved kline dates on same-day startup without saving', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          startDate: '20260810',
          endDate: '20260819'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()

    expect(viewModel.query).toMatchObject({
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.stockQueries[0]).toMatchObject({
      startDate: '20260810',
      endDate: '20260819'
    })
    expect(adapter.savedWorkspaceSettings).toHaveLength(0)
  })

  it('falls back to the default startup date range when saved kline dates are invalid', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          sourceId: 'tencent',
          symbol: 'sz000001',
          startDate: '20260820',
          endDate: '20260810'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()

    expect(viewModel.query).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
    expect(adapter.stockQueries[0]).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(adapter.savedWorkspaceSettings[0].query).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
  })

  it('falls back to the default startup date range when saved kline dates are unparseable', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          sourceId: 'tencent',
          symbol: 'sz000001',
          startDate: 'not-a-date',
          endDate: '20260810'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()

    expect(viewModel.query).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
    expect(adapter.stockQueries[0]).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(adapter.savedWorkspaceSettings[0].query).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sz000001',
      startDate: '20240819',
      endDate: '20260819'
    })
  })

  it('restores cached watchlist on startup', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          watchlist: [
            { symbol: 'SH600519', name: '贵州茅台', createdAt: 1 },
            { symbol: 'xx000001', name: 'bad', createdAt: 2 },
            { symbol: '600519', name: 'duplicate', createdAt: 3 },
            { symbol: '000001', name: '', createdAt: 4 }
          ]
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.watchlist).toEqual([
      { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
      { symbol: 'sz000001', name: '', createdAt: 4 }
    ])
  })

  it('restores timeshare mode and loads timeshare data on startup', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare'
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.viewMode).toBe('timeshare')
    expect(viewModel.timeshare.dataset?.meta.lineType).toBe('分时')
    expect(viewModel.recordCount).toBe(2)
    expect(viewModel.latestSummary).toContain('价 10.20')
  })

  it('restores cached Tencent timeshare source on startup', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare',
          timeshareSourceId: 'tencent'
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.timeshare.dataset?.sourceId).toBe('tencent')
  })

  it('does not reuse a legacy kline source as the default timeshare source', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: undefined,
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
  })

  it('falls back unsupported cached timeshare source without changing the kline source', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'sina',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
  })

  it('tests timeshare-capable sources in timeshare mode', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare'
        }
      })
    )

    await viewModel.initialize()
    await viewModel.testDataSources()

    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'eastmoney')).toMatchObject({
      status: 'success',
      recordCount: 2,
      requestLabel: 'sh000001 分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'tencent')).toMatchObject({
      status: 'success',
      recordCount: 2,
      requestLabel: 'sh000001 分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'sina')).toMatchObject({
      status: 'error',
      message: '不支持分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'netease163')).toMatchObject({
      status: 'error',
      message: '不支持分时'
    })
  })

  it('keeps kline source and timeshare source independent when refreshing timeshare', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'eastmoney',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
    expect(viewModel.activeSourceName).toBe('东方财富')
  })

  it('keeps Tencent timeshare source independent while refreshing Sina kline data', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'kline',
        timeshareSourceId: 'tencent',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(adapter.stockQueries.at(-1)?.sourceId).toBe('sina')
    expect(adapter.timeshareQueries).toHaveLength(0)
    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.activeSourceName).toBe('新浪财经')
  })

  it('keeps Netease kline source independent while refreshing Tencent timeshare data', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'tencent',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'netease163',
          symbol: 'sh600519'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(adapter.stockQueries).toHaveLength(0)
    expect(adapter.timeshareQueries.at(-1)).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sh600519'
    })
    expect(viewModel.query.sourceId).toBe('netease163')
    expect(viewModel.query.period).toBe('day')
    expect(viewModel.query.adjust).toBe('none')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.activeSourceName).toBe('腾讯/QQ 财经')
  })

  it('exports local cache without changing current market data state', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const currentSymbol = viewModel.query.symbol
    const currentRecordCount = viewModel.recordCount
    const timeshareRequestCount = adapter.timeshareQueries.length

    await viewModel.exportLocalCacheBackup()

    expect(adapter.localCacheExportCount).toBe(1)
    expect(viewModel.localCacheResultDialogOpen).toBe(true)
    expect(viewModel.localCacheBackupResult?.status).toBe('success')
    expect(viewModel.query.symbol).toBe(currentSymbol)
    expect(viewModel.recordCount).toBe(currentRecordCount)
    expect(adapter.timeshareQueries).toHaveLength(timeshareRequestCount)
    expect(adapter.stockQueries).toHaveLength(0)
  })

  it('imports local cache, reloads local settings, refreshes open cache status, and avoids remote refresh', async () => {
    const importedSettings: AppSettings = {
      ...createDefaultSettings(),
      networkProxy: {
        enabled: true,
        protocol: 'http',
        host: '127.0.0.2',
        port: 8080
      },
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        query: {
          ...createDefaultSettings().workspace.query,
          symbol: 'sz000001'
        },
        watchlist: [{ symbol: 'sz000001', name: '平安银行', createdAt: 2 }]
      }
    }
    const adapter = new FakeDataAdapter()
    adapter.nextLocalCacheImportResult = {
      status: 'success',
      settings: importedSettings,
      summary: {
        ...createLocalCacheBackupSummary(),
        strategy: 'replace',
        importedKlineCacheEntryCount: 1,
        removedKlineCacheEntryCount: 1
      }
    }
    const onImported = vi.fn()
    const viewModel = createStockWorkspaceViewModel(adapter, {
      onLocalCacheImported: onImported
    })

    await viewModel.initialize()
    const remoteTimeshareRequestCount = adapter.timeshareQueries.length
    viewModel.openKlineCacheDialog()
    await waitForMicrotasks()
    const cacheStatusRequestCount = adapter.klineCacheStatusRequests.length

    await viewModel.inspectLocalCacheBackup()
    viewModel.setLocalCacheImportStrategy('replace')
    await viewModel.confirmLocalCacheImport()

    expect(adapter.localCacheInspectCount).toBe(1)
    expect(adapter.localCacheImportRequests).toEqual([
      {
        importToken: 'token-1',
        strategy: 'replace'
      }
    ])
    expect(viewModel.networkProxy).toEqual(importedSettings.networkProxy)
    expect(viewModel.watchlist).toEqual([{ symbol: 'sz000001', name: '平安银行', createdAt: 2 }])
    expect(viewModel.localCacheResultDialogOpen).toBe(true)
    expect(onImported).toHaveBeenCalledTimes(1)
    expect(adapter.klineCacheStatusRequests.length).toBe(cacheStatusRequestCount + 1)
    expect(adapter.timeshareQueries).toHaveLength(remoteTimeshareRequestCount)
    expect(adapter.stockQueries).toHaveLength(0)
  })

  it('uses the current view mode when marking the active source', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'kline',
          timeshareSourceId: 'tencent',
          query: {
            ...createDefaultSettings().workspace.query,
            sourceId: 'sina'
          }
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.isSourceActiveForCurrentMode('sina')).toBe(true)
    expect(viewModel.isSourceActiveForCurrentMode('tencent')).toBe(false)
    expect(viewModel.selectedKlineSourceName).toBe('新浪财经')
    expect(viewModel.selectedTimeshareSourceName).toBe('腾讯/QQ 财经')
    expect(viewModel.activeSourceName).toBe('新浪财经')
  })

  it('switches only the kline source in kline mode', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSourceId('netease163')

    expect(viewModel.query.sourceId).toBe('netease163')
    expect(viewModel.query.period).toBe('day')
    expect(viewModel.query.adjust).toBe('none')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        sourceId: 'netease163',
        period: 'day',
        adjust: 'none'
      },
      timeshareSourceId: 'eastmoney'
    })
  })

  it('switches only the timeshare source in timeshare mode and rejects unsupported sources', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSourceId('tencent')

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('tencent')

    viewModel.setSourceId('sina')

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        sourceId: 'tencent'
      },
      timeshareSourceId: 'tencent'
    })
  })

  it('saves workspace settings when users change controls', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setPeriod('week')
    viewModel.toggleIndicator('boll', false)

    expect(adapter.savedWorkspaceSettings).toHaveLength(2)
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        period: 'week'
      },
      indicatorSettings: {
        boll: {
          enabled: false
        }
      }
    })
  })

  it('debounces workspace saves for text inputs', async () => {
    vi.useFakeTimers()
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSymbol('s')
    viewModel.setSymbol('sz')
    viewModel.setSymbol('sz000002')

    expect(adapter.savedWorkspaceSettings).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(500)

    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(adapter.savedWorkspaceSettings[0].query.symbol).toBe('sz000002')
  })

  it('adds the current stock to the watchlist and saves workspace settings', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.addCurrentToWatchlist()

    expect(viewModel.isCurrentSymbolWatched).toBe(true)
    expect(viewModel.watchlist[0]).toMatchObject({
      symbol: 'sh000001',
      name: '上证指数'
    })
    expect(adapter.savedWorkspaceSettings.at(-1)?.watchlist?.[0]).toMatchObject({
      symbol: 'sh000001',
      name: '上证指数'
    })
  })

  it('batch adds watchlist items and skips duplicates and invalid lines', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setWatchlistAddText(['600519 贵州茅台', 'sh600519', 'sz000001 平安银行', 'bad'].join('\n'))
    viewModel.confirmWatchlistAdditions()

    expect(viewModel.watchlist.map((item) => item.symbol)).toEqual(['sh600519', 'sz000001'])
    expect(viewModel.watchlist.map((item) => item.name)).toEqual(['贵州茅台', '平安银行'])
    expect(viewModel.watchlistAddText).toBe('')
    expect(adapter.savedWorkspaceSettings.at(-1)?.watchlist?.map((item) => item.symbol)).toEqual([
      'sh600519',
      'sz000001'
    ])
  })

  it('appends pasted clipboard text into the batch add draft and previews it', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    await viewModel.initialize()
    viewModel.setWatchlistAddText('600519 贵州茅台')
    viewModel.appendWatchlistAddText('sz000001 平安银行')

    expect(viewModel.watchlistAddText).toBe('600519 贵州茅台\nsz000001 平安银行')
    expect(viewModel.watchlistPasteError).toBe('')
    expect(viewModel.watchlistAddPreview.previews.map((preview) => preview.symbol)).toEqual([
      'sh600519',
      'sz000001'
    ])
  })

  it('shows a paste error when clipboard text is empty', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    await viewModel.initialize()
    viewModel.appendWatchlistAddText('   ')

    expect(viewModel.watchlistAddText).toBe('')
    expect(viewModel.watchlistPasteError).toBe('剪切板没有可添加的文本')
  })

  it('removes one selected watchlist item in manage mode without changing the active chart', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        watchlist: [
          { symbol: 'sh000001', name: '上证指数', createdAt: 1 },
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 2 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.toggleWatchlistManageMode()
    viewModel.toggleWatchlistSelection('sh000001', true)
    viewModel.removeSelectedWatchlistItems()

    expect(viewModel.query.symbol).toBe('sh000001')
    expect(viewModel.timeshare.dataset?.meta.name).toBe('上证指数')
    expect(viewModel.watchlist.map((item) => item.symbol)).toEqual(['sh600519'])
    expect(adapter.savedWorkspaceSettings.at(-1)?.watchlist?.map((item) => item.symbol)).toEqual([
      'sh600519'
    ])
  })

  it('removes selected watchlist items and exits manage mode', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        watchlist: [
          { symbol: 'sh000001', name: '上证指数', createdAt: 1 },
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 2 },
          { symbol: 'sz000001', name: '平安银行', createdAt: 3 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.toggleWatchlistManageMode()
    viewModel.toggleWatchlistSelection('sh000001', true)
    viewModel.toggleWatchlistSelection('sz000001', true)
    viewModel.removeSelectedWatchlistItems()

    expect(viewModel.watchlistManageMode).toBe(false)
    expect(viewModel.selectedWatchlistSymbols).toEqual([])
    expect(viewModel.watchlist.map((item) => item.symbol)).toEqual(['sh600519'])
  })

  it('selects a watchlist item and preserves the current data source', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'kline',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        },
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.selectWatchlistItem('sh600519')

    expect(viewModel.query.symbol).toBe('sh600519')
    expect(viewModel.query.sourceId).toBe('sina')
    expect(adapter.stockQueries.at(-1)).toMatchObject({
      symbol: 'sh600519',
      sourceId: 'sina'
    })
  })

  it('backfills watchlist item names after loading stock data', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        query: {
          ...createDefaultSettings().workspace.query,
          symbol: 'sh600519'
        },
        watchlist: [{ symbol: 'sh600519', name: '', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.watchlist[0]).toMatchObject({
      symbol: 'sh600519',
      name: '贵州茅台'
    })
    expect(adapter.savedWorkspaceSettings.at(-1)?.watchlist?.[0]).toMatchObject({
      symbol: 'sh600519',
      name: '贵州茅台'
    })
  })

  it('filters the watchlist by name, full symbol and bare code without reordering', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          watchlist: [
            { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
            { symbol: 'sz000001', name: '平安银行', createdAt: 2 },
            { symbol: 'sz000002', name: '万科A', createdAt: 3 }
          ]
        }
      })
    )

    await viewModel.initialize()

    viewModel.setWatchlistSearchText('600519')
    expect(viewModel.filteredWatchlist.map((item) => item.symbol)).toEqual(['sh600519'])

    viewModel.setWatchlistSearchText('SZ000')
    expect(viewModel.filteredWatchlist.map((item) => item.symbol)).toEqual(['sz000001', 'sz000002'])

    viewModel.setWatchlistSearchText('平安')
    expect(viewModel.filteredWatchlist.map((item) => item.symbol)).toEqual(['sz000001'])
  })

  it('keeps watchlist search local and clears it when closing the panel', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        watchlist: [
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
          { symbol: 'sz000001', name: '平安银行', createdAt: 2 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const stockRequestCount = adapter.stockQueries.length
    const timeshareRequestCount = adapter.timeshareQueries.length
    const savedSettingsCount = adapter.savedWorkspaceSettings.length

    viewModel.toggleWatchlistOpen()
    viewModel.setWatchlistSearchText('不存在')

    expect(viewModel.filteredWatchlist).toEqual([])
    expect(adapter.stockQueries).toHaveLength(stockRequestCount)
    expect(adapter.timeshareQueries).toHaveLength(timeshareRequestCount)
    expect(adapter.savedWorkspaceSettings).toHaveLength(savedSettingsCount)

    viewModel.toggleWatchlistOpen()
    viewModel.toggleWatchlistOpen()

    expect(viewModel.watchlistSearchText).toBe('')
    expect(viewModel.filteredWatchlist.map((item) => item.symbol)).toEqual(['sh600519', 'sz000001'])
  })

  it('selects a filtered watchlist item without changing source selections', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'kline',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        },
        watchlist: [
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
          { symbol: 'sz000001', name: '平安银行', createdAt: 2 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setWatchlistSearchText('平安')
    await viewModel.selectWatchlistItem(viewModel.filteredWatchlist[0].symbol)

    expect(viewModel.query.symbol).toBe('sz000001')
    expect(viewModel.query.sourceId).toBe('sina')
    expect(adapter.stockQueries.at(-1)).toMatchObject({
      symbol: 'sz000001',
      sourceId: 'sina'
    })
  })

  it('applies watchlist select all and invert only to the filtered rows', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          watchlist: [
            { symbol: 'sh000001', name: '上证指数', createdAt: 1 },
            { symbol: 'sh600519', name: '贵州茅台', createdAt: 2 },
            { symbol: 'sz000001', name: '平安银行', createdAt: 3 }
          ]
        }
      })
    )

    await viewModel.initialize()
    viewModel.toggleWatchlistOpen()
    viewModel.toggleWatchlistManageMode()
    viewModel.setWatchlistSearchText('600')
    viewModel.toggleWatchlistSelection('sz000001', true)
    viewModel.selectAllWatchlistItems()

    expect(viewModel.selectedWatchlistSymbols).toEqual(['sh600519', 'sz000001'])

    viewModel.invertWatchlistSelection()

    expect(viewModel.selectedWatchlistSymbols).toEqual(['sz000001'])
  })

  it('clears watchlist selection when closing the panel', async () => {
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          watchlist: [
            { symbol: 'sh000001', name: '上证指数', createdAt: 1 },
            { symbol: 'sh600519', name: '贵州茅台', createdAt: 2 }
          ]
        }
      })
    )

    await viewModel.initialize()
    viewModel.toggleWatchlistOpen()
    viewModel.toggleWatchlistManageMode()
    viewModel.selectAllWatchlistItems()
    viewModel.setWatchlistSearchText('600')
    viewModel.toggleWatchlistOpen()

    expect(viewModel.watchlistOpen).toBe(false)
    expect(viewModel.watchlistManageMode).toBe(false)
    expect(viewModel.selectedWatchlistSymbols).toEqual([])
    expect(viewModel.watchlistSearchText).toBe('')
  })

  it('opens kline cache dialog with current source/date and default period/adjust selections without switching timeshare mode', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        query: {
          ...createDefaultSettings().workspace.query,
          symbol: 'sh600519',
          period: 'week',
          adjust: 'hfq',
          startDate: '20250101',
          endDate: '20251231'
        },
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const timeshareRequestCount = adapter.timeshareQueries.length
    viewModel.openKlineCacheDialog()
    await Promise.resolve()

    expect(viewModel.klineCacheDialogOpen).toBe(true)
    expect(viewModel.klineCacheTargetMode).toBe('single')
    expect(viewModel.viewMode).toBe('timeshare')
    expect(adapter.timeshareQueries).toHaveLength(timeshareRequestCount)
    expect(adapter.stockQueries).toHaveLength(0)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
    expect(adapter.klineCacheStatusRequests[0]).toMatchObject({
      query: {
        sourceId: 'eastmoney',
        periods: ['day'],
        adjusts: ['qfq'],
        startDate: '20250101',
        endDate: '20251231'
      },
      items: [{ symbol: 'sh600519' }]
    })
  })

  it('caches the current stock in single mode even when it is not watched', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          symbol: 'sz000001'
        },
        watchlist: []
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()

    expect(viewModel.klineCacheTargetMode).toBe('single')
    expect(viewModel.klineCacheTargetItems.map((item) => item.symbol)).toEqual(['sz000001'])
    expect(viewModel.canRefreshKlineCache).toBe(true)
    expect(adapter.klineCacheStatusRequests.at(-1)?.items).toEqual([
      expect.objectContaining({ symbol: 'sz000001', name: '平安银行' })
    ])
    expect(adapter.klineCacheRefreshRequests.at(-1)?.items).toEqual([
      expect.objectContaining({ symbol: 'sz000001', name: '平安银行' })
    ])
    expect(viewModel.klineCacheJob?.total).toBe(1)
  })

  it('does not remember multi-stock cache mode when reopening the cache dialog', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    viewModel.setKlineCacheTargetMode('multiple')
    await Promise.resolve()
    viewModel.closeKlineCacheDialog()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()

    expect(viewModel.klineCacheTargetMode).toBe('single')
    expect(adapter.klineCacheStatusRequests.at(-1)?.items).toEqual([
      expect.objectContaining({ symbol: 'sh000001' })
    ])
  })

  it('uses the watchlist in multi-stock cache mode and preserves query selections when switching modes', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
          { symbol: 'sz000001', name: '平安银行', createdAt: 2 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    viewModel.setKlineCachePeriods(['day', 'week'])
    await Promise.resolve()
    viewModel.setKlineCacheAdjusts(['qfq', 'none'])
    await Promise.resolve()
    viewModel.selectAllKlineCacheRows()

    expect(viewModel.selectedKlineCacheCount).toBe(4)

    viewModel.setKlineCacheTargetMode('multiple')
    await Promise.resolve()

    expect(viewModel.klineCacheQuery).toMatchObject({
      periods: ['day', 'week'],
      adjusts: ['qfq', 'none']
    })
    expect(viewModel.klineCacheSelectedRowIds).toEqual([])
    expect(adapter.klineCacheStatusRequests.at(-1)?.items.map((item) => item.symbol)).toEqual([
      'sh600519',
      'sz000001'
    ])

    await viewModel.refreshAllKlineCache()

    expect(adapter.klineCacheRefreshRequests.at(-1)?.items.map((item) => item.symbol)).toEqual([
      'sh600519',
      'sz000001'
    ])
    expect(viewModel.klineCacheJob?.total).toBe(8)

    viewModel.setKlineCacheTargetMode('single')
    await Promise.resolve()

    expect(viewModel.klineCacheQuery).toMatchObject({
      periods: ['day', 'week'],
      adjusts: ['qfq', 'none']
    })
    expect(viewModel.klineCacheSelectedRowIds).toEqual([])
    expect(adapter.klineCacheStatusRequests.at(-1)?.items).toEqual([
      expect.objectContaining({ symbol: 'sh000001' })
    ])
  })

  it('disables multi-stock cache refresh when the watchlist is empty', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    const statusRequestCount = adapter.klineCacheStatusRequests.length
    viewModel.setKlineCacheTargetMode('multiple')
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()

    expect(viewModel.klineCacheTargetMode).toBe('multiple')
    expect(viewModel.klineCacheTargetItems).toEqual([])
    expect(viewModel.klineCacheRows).toEqual([])
    expect(viewModel.klineCacheEmptyDescription).toBe('暂无自选股')
    expect(viewModel.canRefreshKlineCache).toBe(false)
    expect(adapter.klineCacheStatusRequests).toHaveLength(statusRequestCount)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
  })

  it('ignores stale single-stock cache status after switching to empty multi-stock mode', async () => {
    const adapter = new DeferredKlineCacheStatusAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()

    expect(adapter.klineCacheStatusRequests).toHaveLength(1)
    expect(viewModel.klineCacheLoading).toBe(true)

    viewModel.setKlineCacheTargetMode('multiple')
    await Promise.resolve()

    expect(viewModel.klineCacheTargetItems).toEqual([])
    expect(viewModel.klineCacheRows).toEqual([])
    expect(viewModel.klineCacheLoading).toBe(false)

    adapter.resolveNextKlineCacheStatus()
    await Promise.resolve()

    expect(viewModel.klineCacheTargetMode).toBe('multiple')
    expect(viewModel.klineCacheTargetItems).toEqual([])
    expect(viewModel.klineCacheRows).toEqual([])
    expect(viewModel.klineCacheLoading).toBe(false)
    expect(adapter.klineCacheStatusRequests).toHaveLength(1)
  })

  it('keeps supported cache query selections when switching cache data sources', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    viewModel.setKlineCachePeriods(['day', 'week', 'month'])
    viewModel.setKlineCacheAdjusts(['qfq', 'none', 'hfq'])
    viewModel.setKlineCacheSourceId('sina')
    await Promise.resolve()

    expect(viewModel.klineCacheQuery).toMatchObject({
      sourceId: 'sina',
      periods: ['day', 'week'],
      adjusts: ['none']
    })
  })

  it('blocks cache status and refresh when source switching leaves no supported period or adjust selections', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    viewModel.setKlineCachePeriod('5')
    viewModel.setKlineCacheAdjust('hfq')
    await Promise.resolve()
    const statusRequestCount = adapter.klineCacheStatusRequests.length
    viewModel.setKlineCacheSourceId('sina')
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()

    expect(viewModel.klineCacheQuery).toMatchObject({
      sourceId: 'sina',
      periods: [],
      adjusts: []
    })
    expect(viewModel.klineCacheFormError).toBe('请至少选择一个周期')
    expect(adapter.klineCacheStatusRequests).toHaveLength(statusRequestCount)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
  })

  it('keeps cache refresh state separate from the current chart dataset', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const dataset = viewModel.chart.dataset
    const stockRequestCount = adapter.stockQueries.length

    viewModel.openKlineCacheDialog()
    await viewModel.refreshAllKlineCache()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(adapter.klineCacheRefreshRequests[0].query).toMatchObject({
      periods: ['day'],
      adjusts: ['qfq']
    })
    expect(adapter.stockQueries).toHaveLength(stockRequestCount)
    expect(viewModel.chart.dataset).toBe(dataset)
    expect(viewModel.klineCacheJob?.status).toBe('completed')
    expect(viewModel.klineCacheJob?.total).toBe(1)
  })

  it('blocks cache refresh when the date range is invalid', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    viewModel.setKlineCacheStartDate('20260810')
    viewModel.setKlineCacheEndDate('20260801')
    await viewModel.refreshAllKlineCache()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
    expect(viewModel.klineCacheError).toBe('缓存日期范围无效')
  })

  it('clears stale cache rows and selections when cache query changes', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    viewModel.setKlineCacheSelectedSymbols(['sh000001'])

    expect(viewModel.klineCacheRows).toHaveLength(1)
    expect(viewModel.selectedKlineCacheCount).toBe(1)

    viewModel.setKlineCacheStartDate('20250101')
    await viewModel.refreshSelectedKlineCache()
    await viewModel.clearSelectedKlineCache()

    expect(viewModel.klineCacheRows).toEqual([])
    expect(viewModel.klineCacheSelectedRowIds).toEqual([])
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
    expect(adapter.klineCacheClearRequests).toHaveLength(0)
  })

  it('blocks cache status and refresh when no period or adjust is selected', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    const statusRequestCount = adapter.klineCacheStatusRequests.length
    viewModel.setKlineCachePeriods([])
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()

    expect(viewModel.klineCacheFormError).toBe('请至少选择一个周期')
    expect(adapter.klineCacheStatusRequests).toHaveLength(statusRequestCount)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)

    viewModel.setKlineCachePeriods(['day'])
    viewModel.setKlineCacheAdjusts([])
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()

    expect(viewModel.klineCacheFormError).toBe('请至少选择一种复权')
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
  })

  it('passes plain cloneable cache requests to the data adapter', async () => {
    const adapter = new StructuredCloneCacheAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        watchlist: [{ symbol: 'sh600519', name: '贵州茅台', createdAt: 1 }]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    await viewModel.refreshAllKlineCache()
    viewModel.setKlineCacheSelectedSymbols(['sh000001'])
    await viewModel.clearSelectedKlineCache()

    expect(viewModel.klineCacheError).toBe('')
    expect(adapter.klineCacheStatusRequests).toHaveLength(2)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(adapter.klineCacheClearRequests).toHaveLength(1)
    expect(adapter.klineCacheClearRequests[0].rows).toHaveLength(1)
    expect(adapter.klineCacheClearRequests[0].rows?.[0]).toMatchObject({
      id: 'eastmoney__sh000001__day__qfq',
      query: {
        symbol: 'sh000001',
        period: 'day',
        adjust: 'qfq'
      }
    })
  })

  it('restores strategy settings on startup', async () => {
    const strategySettings = {
      selectedTemplateIds: ['ma-cross'],
      paramsByTemplate: {
        'ma-cross': {
          shortPeriod: 3,
          longPeriod: 8
        }
      },
      assumptions: {
        initialCapital: 50000,
        feeRate: 0.001,
        slippageRate: 0.002
      },
      dateRange: {
        startDate: '20240110',
        endDate: '20240210'
      }
    } as unknown as KlineStrategySettings
    const viewModel = createStockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createKlineSettings(),
        workspace: {
          ...createKlineSettings().workspace,
          klineStrategySettings: strategySettings
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.strategySettings.selectedTemplateIds).toEqual(['ma-cross'])
    expect(viewModel.strategySettings.paramsByTemplate['ma-cross']).toMatchObject({
      shortPeriod: 3,
      longPeriod: 8
    })
    expect(viewModel.strategySettings.assumptions).toEqual({
      initialCapital: 50000,
      feeRate: 0.001,
      slippageRate: 0.002
    })
    expect((viewModel.strategySettings as unknown as { dateRange?: unknown }).dateRange).toBeUndefined()
    viewModel.openStrategyPanel()
    expect(viewModel.strategyBacktestDateRangeLabel).toBe('20240101 - 20260101')
  })

  it('derives strategy template display rows in the view model', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 30)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 5)

    expect(viewModel.strategyTemplateDraftRows).toHaveLength(1)
    expect(viewModel.strategyTemplateDraftRows[0]).toMatchObject({
      id: 'ma-cross',
      typeLabel: '趋势',
      basicLogic: '短期均线与长期均线交叉',
      recommendationLevel: 4,
      minSampleSize: 30,
      compatiblePeriodLabel: '日线/周线/月线',
      signalDescription: expect.stringContaining('买入信号'),
      errors: ['短期均线必须小于长期均线']
    })
  })

  it('runs strategy backtest from the cached kline dataset and saves preferences', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    viewModel.setStrategyInitialCapital(50000)
    await viewModel.runStrategyBacktest()

    expect(adapter.cachedKlineQueries).toHaveLength(1)
    expect(adapter.cachedKlineQueries[0]).toMatchObject({
      sourceId: 'eastmoney',
      symbol: 'sh000001',
      period: 'day',
      adjust: 'qfq',
      startDate: '20240101',
      endDate: '20260101'
    })
    expect(viewModel.strategyError).toBe('')
    expect(viewModel.strategyResults[0]).toMatchObject({
      status: 'success',
      templateId: 'ma-cross'
    })
    expect(viewModel.strategyResults[0].signals.length).toBeGreaterThan(0)
    expect(viewModel.chart.strategySignals.length).toBeGreaterThan(0)
    const savedStrategySettings = adapter.savedWorkspaceSettings.at(-1)?.klineStrategySettings
    expect(savedStrategySettings).toMatchObject({
      selectedTemplateIds: ['ma-cross'],
      assumptions: {
        initialCapital: 50000
      }
    })
    expect((savedStrategySettings as unknown as { dateRange?: unknown })?.dateRange).toBeUndefined()
  })

  it('keeps invalid template params scoped to the affected strategy result', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross', 'breakout-pullback'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    viewModel.setStrategyDraftParam('breakout-pullback', 'lookbackPeriod', 0)
    await viewModel.runStrategyBacktest()

    const valid = viewModel.strategyResults.find((result) => result.templateId === 'ma-cross')
    const invalid = viewModel.strategyResults.find((result) => result.templateId === 'breakout-pullback')
    expect(viewModel.strategyError).toBe('')
    expect(valid).toMatchObject({
      status: 'success',
      rank: 1
    })
    expect(invalid).toMatchObject({
      status: 'unavailable',
      unavailableReason: expect.stringContaining('突破观察必须在 5 到 250 之间')
    })
  })

  it('runs strategy backtest with the current kline date range', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const expectedQuery: StockQuery = {
      ...createKlineSettings().workspace.query,
      endDate: '20240214'
    }
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult(expectedQuery)
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setEndDate('20240214')
    viewModel.openStrategyPanel()
    expect(viewModel.strategyBacktestDateRangeLabel).toBe('20240101 - 20240214')
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.cachedKlineQueries).toHaveLength(1)
    expect(adapter.cachedKlineQueries[0]).toMatchObject({
      startDate: '20240101',
      endDate: '20240214'
    })
    expect(viewModel.query.startDate).toBe('20240101')
    expect(viewModel.query.endDate).toBe('20240214')
    expect(viewModel.strategyResults[0]).toMatchObject({
      status: 'success',
      query: {
        startDate: '20240101',
        endDate: '20240214'
      },
      dataStartDate: '20240101',
      dataEndDate: '20240214'
    })
    const savedStrategySettings = adapter.savedWorkspaceSettings.at(-1)?.klineStrategySettings
    expect((savedStrategySettings as unknown as { dateRange?: unknown })?.dateRange).toBeUndefined()
  })

  it('keeps a manually selected historical date range during the current session', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createKlineSettings(),
      workspace: {
        ...createKlineSettings().workspace,
        query: {
          ...createKlineSettings().workspace.query,
          startDate: '20260810',
          endDate: '20260819'
        }
      }
    })
    const expectedQuery: StockQuery = {
      ...createKlineSettings().workspace.query,
      startDate: '20240101',
      endDate: '20240214'
    }
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult(expectedQuery)
    const viewModel = createStockWorkspaceViewModel(adapter, {
      getStartupDate: () => new Date(2026, 7, 19)
    })

    await viewModel.initialize()
    viewModel.setStartDate('20240101')
    viewModel.setEndDate('20240214')
    await viewModel.refreshStock()
    viewModel.openKlineCacheDialog()
    await Promise.resolve()
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.stockQueries.at(-1)).toMatchObject({
      startDate: '20240101',
      endDate: '20240214'
    })
    expect(adapter.klineCacheStatusRequests.at(-1)?.query).toMatchObject({
      startDate: '20240101',
      endDate: '20240214'
    })
    expect(adapter.cachedKlineQueries.at(-1)).toMatchObject({
      startDate: '20240101',
      endDate: '20240214'
    })
    expect(viewModel.query).toMatchObject({
      startDate: '20240101',
      endDate: '20240214'
    })
  })

  it('runs strategy backtest when a complete cache starts after a non-trading boundary', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const query: StockQuery = {
      ...createKlineSettings().workspace.query,
      symbol: 'sh601138',
      startDate: '20240810',
      endDate: '20260810'
    }
    adapter.nextStockDataset = createCrossingStockDatasetWithDateRange('20240812', '20260810')
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult(
      query,
      createCrossingStockDatasetWithDateRange('20240812', '20260810')
    )
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSymbol('sh601138')
    viewModel.setStartDate('20240810')
    viewModel.setEndDate('20260810')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.cachedKlineQueries.at(-1)).toMatchObject({
      symbol: 'sh601138',
      startDate: '20240810',
      endDate: '20260810'
    })
    expect(adapter.klineCacheRefreshRequests).toHaveLength(0)
    expect(viewModel.strategyError).toBe('')
    expect(viewModel.strategyResults[0]).toMatchObject({
      status: 'success',
      query: {
        startDate: '20240810',
        endDate: '20260810'
      },
      dataStartDate: '20240812',
      dataEndDate: '20260810'
    })
  })

  it('rejects strategy backtests when a daily boundary gap exceeds the tolerance', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const query: StockQuery = {
      ...createKlineSettings().workspace.query,
      symbol: 'sh601138',
      startDate: '20240801',
      endDate: '20240820'
    }
    const dataset = createCrossingStockDatasetWithDateRange('20240812', '20240820')
    adapter.cachedKlineDatasetResults = [
      createCompleteCachedKlineDatasetResult(query, dataset),
      createCompleteCachedKlineDatasetResult(query, dataset)
    ]
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSymbol('sh601138')
    viewModel.setStartDate('20240801')
    viewModel.setEndDate('20240820')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(viewModel.strategyResults).toEqual([])
    expect(viewModel.strategyError).toBe(
      '历史 K 线缓存未覆盖所选回测区间：20240801-20240811'
    )
  })

  it('displays the current kline date range in strategy settings', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20240110')
    viewModel.setEndDate('20240210')
    viewModel.openStrategyPanel()

    expect(viewModel.strategyBacktestDateRangeLabel).toBe('20240110 - 20240210')
    expect(viewModel.strategyFormErrors).not.toContain('回测开始日期不能晚于结束日期')
    expect(adapter.cachedKlineQueries).toHaveLength(0)
  })

  it('blocks strategy backtest when the current kline date range is invalid', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20240210')
    viewModel.setEndDate('20240110')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    await viewModel.runStrategyBacktest()

    expect(viewModel.strategyFormErrors).toContain('回测开始日期不能晚于结束日期')
    expect(viewModel.strategyError).toBe('回测开始日期不能晚于结束日期')
    expect(adapter.cachedKlineQueries).toHaveLength(0)
  })

  it('keeps strategy assumption inputs empty while users are editing numeric fields', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    viewModel.setStrategyFeeRatePercent(0.125)
    viewModel.setStrategyFeeRatePercent(null)

    expect((viewModel as unknown as { strategyFeeRatePercentInput: number | null }).strategyFeeRatePercentInput).toBeNull()
    expect(viewModel.strategyFormErrors).toContain('费用率必须在 0 到 20% 之间')
    expect(viewModel.canRunStrategyBacktest).toBe(false)
  })

  it('uses cached kline data when the current chart dataset no longer matches the query', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextCachedKlineDatasetResult = {
      status: 'complete',
      query: {
        ...createKlineSettings().workspace.query,
        startDate: '20230101'
      },
      dataset: createCrossingStockDatasetCoveringQuery({
        ...createKlineSettings().workspace.query,
        startDate: '20230101'
      }),
      missingRanges: []
    }
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20230101')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.cachedKlineQueries).toHaveLength(1)
    expect(adapter.cachedKlineQueries[0]).toMatchObject({
      startDate: '20230101',
      period: 'day'
    })
    expect(viewModel.strategyResults[0].status).toBe('success')
  })

  it('refreshes missing kline cache before running a strategy backtest', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.cachedKlineDatasetResults = [
      {
        status: 'partial',
        query: createKlineSettings().workspace.query,
        missingRanges: [{ startDate: '20230101', endDate: '20231231' }]
      },
      {
        status: 'complete',
        query: createKlineSettings().workspace.query,
        dataset: createCrossingStockDatasetCoveringQuery({
          ...createKlineSettings().workspace.query,
          startDate: '20230101'
        }),
        missingRanges: []
      }
    ]
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20230101')
    const stockQueryCount = adapter.stockQueries.length
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.cachedKlineQueries).toHaveLength(2)
    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(adapter.klineCacheRefreshRequests[0]).toMatchObject({
      query: {
        sourceId: 'eastmoney',
        periods: ['day'],
        adjusts: ['qfq'],
        startDate: '20230101',
        endDate: '20260101'
      },
      items: [
        {
          symbol: 'sh000001'
        }
      ]
    })
    expect(adapter.stockQueries).toHaveLength(stockQueryCount)
    expect(viewModel.klineCacheJob).toBeNull()
    expect(viewModel.klineCacheError).toBe('')
    expect(viewModel.strategyStatusMessage).toBe('')
    expect(viewModel.strategyError).toBe('')
    expect(viewModel.strategyResults[0]).toMatchObject({
      status: 'success',
      query: {
        startDate: '20230101',
        endDate: '20260101'
      }
    })
  })

  it('rejects strategy backtests when cached candles do not cover the selected range', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.cachedKlineDatasetResults = [
      {
        status: 'complete',
        query: {
          ...createKlineSettings().workspace.query,
          startDate: '20160810',
          endDate: '20260810'
        },
        dataset: createCrossingStockDataset(),
        missingRanges: []
      },
      {
        status: 'complete',
        query: {
          ...createKlineSettings().workspace.query,
          startDate: '20160810',
          endDate: '20260810'
        },
        dataset: createCrossingStockDataset(),
        missingRanges: []
      }
    ]
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20160810')
    viewModel.setEndDate('20260810')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(viewModel.strategyResults).toEqual([])
    expect(viewModel.chart.strategySignals).toEqual([])
    expect(viewModel.strategyError).toBe(
      '历史 K 线缓存未覆盖所选回测区间：20160810-20231231；20240215-20260810'
    )
  })

  it('keeps previous strategy results when kline cache refresh fails', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.toggleIndicator('strategySignal', true)
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()
    const previousResults = viewModel.strategyResults
    const stockQueryCount = adapter.stockQueries.length

    adapter.nextStockDataset = null
    adapter.nextCachedKlineDatasetResult = {
      status: 'empty',
      query: createKlineSettings().workspace.query,
      missingRanges: [{ startDate: '20240101', endDate: '20260101' }]
    }
    adapter.nextKlineCacheRefreshError = new Error('cache refresh failed')
    await viewModel.runStrategyBacktest()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(adapter.stockQueries).toHaveLength(stockQueryCount)
    expect(viewModel.klineCacheJob).toBeNull()
    expect(viewModel.klineCacheError).toBe('')
    expect(viewModel.strategyError).toBe('cache refresh failed；缺失范围：20240101-20260101')
    expect(viewModel.strategyStatusMessage).toBe('')
    expect(viewModel.strategyResults).toBe(previousResults)
    expect(viewModel.chart.strategySignals.length).toBeGreaterThan(0)
  })

  it('stops polling an in-flight strategy cache job when the kline query changes', async () => {
    vi.useFakeTimers()
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.cachedKlineDatasetResults = [
      {
        status: 'empty',
        query: createKlineSettings().workspace.query,
        missingRanges: [{ startDate: '20230101', endDate: '20231231' }]
      }
    ]
    adapter.nextKlineCacheJob = {
      id: 'job-active',
      status: 'running',
      total: 1,
      completed: 0,
      rows: [],
      startedAt: 1
    }
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setStartDate('20230101')
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    const runPromise = viewModel.runStrategyBacktest()
    await Promise.resolve()
    await Promise.resolve()

    expect(adapter.klineCacheRefreshRequests).toHaveLength(1)
    expect(viewModel.strategyRunning).toBe(true)

    viewModel.setSymbol('sh600519')
    await vi.advanceTimersByTimeAsync(1000)
    await runPromise

    expect(viewModel.strategyRunning).toBe(false)
    expect(adapter.klineCacheJobQueries).toHaveLength(0)
    expect(viewModel.strategyResults).toEqual([])
    expect(viewModel.strategyError).toBe('')
  })

  it('blocks strategy backtest for minute kline periods without reading cache', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setPeriod('5')
    viewModel.openStrategyPanel()
    await viewModel.runStrategyBacktest()

    expect(viewModel.strategyError).toBe('策略回测暂不支持分钟 K 线周期')
    expect(adapter.cachedKlineQueries).toHaveLength(0)
    expect(viewModel.strategyResults).toEqual([])
  })

  it('clears stale strategy results when the kline query changes', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.toggleIndicator('strategySignal', true)
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(viewModel.strategyResults.length).toBeGreaterThan(0)
    expect(viewModel.chart.strategySignals.length).toBeGreaterThan(0)

    viewModel.setSymbol('sh600519')

    expect(viewModel.strategyResults).toEqual([])
    expect(viewModel.selectedStrategyResultId).toBe('')
    expect(viewModel.chart.strategySignals).toEqual([])
  })

  it('restores selected strategy signals when returning to kline mode', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.toggleIndicator('strategySignal', true)
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    const signalCount = viewModel.chart.strategySignals.length
    expect(signalCount).toBeGreaterThan(0)

    viewModel.setViewMode('timeshare')
    expect(viewModel.strategyResults.length).toBeGreaterThan(0)
    expect(viewModel.chart.strategySignals).toEqual([])

    viewModel.setViewMode('kline')
    expect(viewModel.chart.strategySignals).toHaveLength(signalCount)
  })

  it('does not run strategy backtest in timeshare mode', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    await viewModel.runStrategyBacktest()

    expect(viewModel.viewMode).toBe('timeshare')
    expect(viewModel.strategyError).toBe('请切换到 K 线模式后查看历史回测')
    expect(adapter.cachedKlineQueries).toHaveLength(0)
    expect(adapter.timeshareQueries.length).toBeGreaterThan(0)
  })

  it('saves proxy settings from the workspace state', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.openProxyDialog()
    viewModel.setProxyEnabled(true)
    viewModel.setProxyProtocol('http')
    viewModel.setProxyHost('localhost')
    viewModel.setProxyPort(8080)
    await viewModel.saveProxySettings()

    expect(viewModel.proxyDialogOpen).toBe(false)
    expect(viewModel.networkProxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'localhost',
      port: 8080
    })
  })

  it('toggles chart indicators', () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    viewModel.toggleIndicator('boll', false)

    expect(viewModel.chart.indicatorSettings.boll.enabled).toBe(false)
  })

  it('enables kline strategy signals by default and ignores legacy B/S settings', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect('bsSignal' in viewModel.chart.indicatorSettings).toBe(false)
    expect(viewModel.chart.indicatorSettings.strategySignal.enabled).toBe(true)

    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftEnabled('strategySignal', false)

    expect(viewModel.chart.indicatorDraft.strategySignal.enabled).toBe(false)
    expect('bsSignal' in viewModel.chart.indicatorDraft).toBe(false)
    expect(viewModel.chart.previewIndicatorSettings?.strategySignal.enabled).toBe(false)

    viewModel.closeIndicatorDialog()

    expect(viewModel.chart.indicatorSettings.strategySignal.enabled).toBe(true)
    expect(viewModel.chart.previewIndicatorSettings).toBeNull()

    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()

    expect(viewModel.chart.strategySignals.length).toBeGreaterThan(0)

    viewModel.toggleIndicator('strategySignal', false)

    expect(viewModel.chart.indicatorSettings.strategySignal.enabled).toBe(false)
    expect(viewModel.chart.strategySignals).toEqual([])

    viewModel.toggleIndicator('strategySignal', true)

    expect(viewModel.chart.indicatorSettings.strategySignal.enabled).toBe(true)
    expect(viewModel.chart.strategySignals.length).toBeGreaterThan(0)
  })

  it('applies indicator dialog drafts and saves indicator params', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftParam('boll', 0, 30)
    viewModel.setKLineIndicatorDraftEnabled('macd', true)
    viewModel.applyIndicatorSettingsDraft()

    expect(viewModel.chart.indicatorDialogOpen).toBe(false)
    expect(viewModel.chart.indicatorSettings.boll.params).toEqual([30, 2])
    expect(viewModel.chart.indicatorSettings.macd.enabled).toBe(true)
    expect(adapter.savedWorkspaceSettings.at(-1)?.indicatorSettings?.boll.params).toEqual([30, 2])
  })

  it('previews kline indicator drafts without saving until apply', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const saveCount = adapter.savedWorkspaceSettings.length

    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftPrecision('boll', 3)
    viewModel.setKLineIndicatorDraftLineColor('boll', 0, '#123456')

    expect(viewModel.chart.previewIndicatorSettings?.boll.precision).toBe(3)
    expect(viewModel.chart.effectiveIndicatorSettings.boll.styles.lines?.[0].color).toBe('#123456')
    expect(viewModel.chart.indicatorSettings.boll.precision).toBe(2)
    expect(adapter.savedWorkspaceSettings).toHaveLength(saveCount)

    viewModel.closeIndicatorDialog()

    expect(viewModel.chart.previewIndicatorSettings).toBeNull()
    expect(viewModel.chart.effectiveIndicatorSettings.boll.precision).toBe(2)
    expect(adapter.savedWorkspaceSettings).toHaveLength(saveCount)
  })

  it('saves kline indicator style and precision after applying the draft', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftPrecision('boll', 4)
    viewModel.setKLineIndicatorDraftLineStyle('boll', 0, 'dashed')
    viewModel.setKLineIndicatorDraftLineColor('boll', 0, '#654321')
    viewModel.applyIndicatorSettingsDraft()

    expect(viewModel.chart.indicatorSettings.boll.precision).toBe(4)
    expect(viewModel.chart.indicatorSettings.boll.styles.lines?.[0]).toEqual({
      color: '#654321',
      lineStyle: 'dashed'
    })
    const savedBoll = adapter.savedWorkspaceSettings.at(-1)?.indicatorSettings?.boll
    expect(savedBoll?.precision).toBe(4)
    expect(savedBoll?.styles.lines?.[0]).toEqual({
      color: '#654321',
      lineStyle: 'dashed'
    })
  })

  it('keeps the last valid preview when kline indicator draft has errors', async () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftPrecision('boll', 3)
    viewModel.setKLineIndicatorDraftPrecision('boll', 9)

    expect(viewModel.chart.indicatorDraftHasErrors).toBe(true)
    expect(viewModel.chart.previewIndicatorSettings?.boll.precision).toBe(3)
  })

  it('applies timeshare indicator drafts without refetching remote data', async () => {
    const adapter = new FakeDataAdapter([], createDefaultSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const requestCount = adapter.timeshareQueries.length

    viewModel.openIndicatorDialog()
    viewModel.timeshare.setIndicatorDraftEnabled('ma', true)
    viewModel.timeshare.setIndicatorDraftParam('ma', 0, 3)
    viewModel.applyIndicatorSettingsDraft()

    expect(viewModel.timeshare.indicatorDialogOpen).toBe(false)
    expect(viewModel.timeshare.indicatorSettings.ma.enabled).toBe(true)
    expect(viewModel.timeshare.indicatorSettings.ma.params).toEqual([3, 10, 20, 60])
    expect(viewModel.chart.indicatorSettings.ma.enabled).toBe(false)
    expect(adapter.timeshareQueries).toHaveLength(requestCount)
    expect(adapter.savedWorkspaceSettings.at(-1)?.timeshareIndicatorSettings?.ma).toMatchObject({
      enabled: true,
      params: [3, 10, 20, 60]
    })
  })

  it('loads AI connector settings on startup without triggering AI requests', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.aiConnectorSettings.enabled).toBe(false)
    expect(adapter.aiAnalysisRequests).toHaveLength(0)
    expect(adapter.aiTestCount).toBe(0)
  })

  it('saves and tests AI connector settings from the separated settings modal', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openAiSettings()
    viewModel.setAiHttpProviderPreset('deepseek')
    viewModel.setAiConnectorModel('deepseek-chat')
    viewModel.setAiConnectorEnabled(true)
    viewModel.setAiApiKeyDraft('sk-test')
    await viewModel.testAiSettings()

    expect(adapter.aiTestCount).toBe(1)
    expect(viewModel.aiConnectorSettings).toMatchObject({
      enabled: true,
      kind: 'http-provider',
      model: 'deepseek-chat',
      availability: 'available'
    })
    expect(viewModel.aiConnectorSnapshot.credentialStatus).toBe('saved')
    expect(viewModel.aiApiKeyDraft).toBe('')
  })

  it('keeps pasted AI API keys in the settings draft before save or test', async () => {
    const adapter = new FakeDataAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openAiSettings()
    viewModel.setAiApiKeyDraft(' sk-pasted ')
    viewModel.setAiSettingsError('读取剪切板失败，请使用 Cmd/Ctrl+V 粘贴')

    expect(viewModel.aiApiKeyDraft).toBe(' sk-pasted ')
    expect(viewModel.aiSettingsError).toBe('读取剪切板失败，请使用 Cmd/Ctrl+V 粘贴')
    expect(adapter.aiTestCount).toBe(0)
  })

  it('sends plain AI connector settings through the adapter boundary', async () => {
    const adapter = new StructuredCloneAiSettingsAdapter()
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openAiSettings()
    viewModel.setAiConnectorDisplayName('DeepSeek Local')
    await viewModel.saveAiSettings()

    expect(viewModel.aiSettingsError).toBe('')
    expect(adapter.aiConnectorSnapshot.settings.displayName).toBe('DeepSeek Local')
  })

  it('requires a successful test before saving enabled AI connector changes', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openAiSettings()
    viewModel.setAiConnectorModel('deepseek-v4-flash')
    await viewModel.saveAiSettings()

    expect(viewModel.aiConnectorDraft.availability).toBe('unknown')
    expect(viewModel.aiSettingsError).toBe('请先测试连接成功后再启用 AI connector')
    expect(adapter.aiConnectorSnapshot.settings.model).toBe('deepseek-v4-pro')
  })

  it('blocks AI analysis when the enabled connector has not been tested successfully', async () => {
    const settings = createAiEnabledSettings()
    settings.aiConnector.availability = 'unknown'
    const adapter = new FakeDataAdapter([], settings)
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()

    expect(viewModel.canRunAiAnalysis).toBe(false)
    expect(viewModel.aiAnalysisError).toContain('AI connector 未测试或不可用')
    expect(adapter.aiAnalysisRequests).toHaveLength(0)
  })

  it('blocks AI analysis when the enabled connector is missing an API key', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    adapter.aiConnectorSnapshot = {
      ...adapter.aiConnectorSnapshot,
      credentialStatus: 'missing'
    }
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()

    expect(viewModel.canRunAiAnalysis).toBe(false)
    expect(viewModel.aiAnalysisError).toContain('HTTP provider 缺少可用 API key')
    expect(adapter.aiAnalysisRequests).toHaveLength(0)
  })

  it('runs AI analysis only after manual trigger and sends a limited workspace context', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const requestCount = adapter.aiAnalysisRequests.length
    viewModel.openAiAnalysisPanel()
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests).toHaveLength(requestCount + 1)
    expect(adapter.aiAnalysisRequests[0]).toMatchObject({
      useCaseId: 'daily-review',
      context: {
        symbol: 'sh000001',
        stockName: '上证指数',
        viewMode: 'timeshare',
        recordCount: 2,
        dataSourceName: '东方财富'
      }
    })
    expect(viewModel.aiAnalysisResult?.outputText).toBe('AI 分析结果')
  })

  it('defaults AI analysis to the current stock without sending watchlist samples', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createAiEnabledSettings(),
      workspace: {
        ...createAiEnabledSettings().workspace,
        watchlist: [
          { symbol: 'sh600519', name: '贵州茅台', createdAt: 1 },
          { symbol: 'sz000001', name: '平安银行', createdAt: 2 }
        ]
      }
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests[0].context).toMatchObject({
      symbol: 'sh000001',
      stockName: '上证指数'
    })
    expect('watchlist' in adapter.aiAnalysisRequests[0].context).toBe(false)
  })

  it('requires explicit confirmation before sending stock screening scope', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setAiUseCaseId('natural-language-stock-screening')
    await viewModel.runAiAnalysis()

    expect(viewModel.aiAnalysisError).toContain('请先确认')
    expect(adapter.aiAnalysisRequests).toHaveLength(0)

    viewModel.setAiUseCaseConfirmed(true)
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests).toHaveLength(1)
    expect(adapter.aiAnalysisRequests[0]).toMatchObject({
      useCaseId: 'natural-language-stock-screening',
      workflow: {
        confirmedByUser: true,
        confirmationRequired: true
      }
    })
    expect(adapter.aiAnalysisRequests[0].workflow?.targetScope).toContain('用户确认后的标的范围')
  })

  it('blocks default strategy draft text until the user enters a concrete strategy idea', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setAiUseCaseId('natural-language-strategy')
    await viewModel.runAiAnalysis()

    expect(viewModel.aiAnalysisError).toContain('请输入具体自然语言策略描述')
    expect(adapter.aiAnalysisRequests).toHaveLength(0)

    viewModel.setAiQuestion('当短期均线上穿长期均线，且成交量高于 5 日均量时生成趋势策略草稿。')
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests).toHaveLength(1)
    expect(adapter.aiAnalysisRequests[0].workflow?.localValidationNotes.join('；')).toContain(
      '策略名称'
    )
    expect(adapter.aiAnalysisRequests[0].workflow?.outputHandlingNotes.join('；')).toContain(
      '用户确认前不得保存'
    )
  })

  it('keeps experimental prediction output outside strategy results and signals', async () => {
    const settings = {
      ...createAiEnabledSettings(),
      workspace: {
        ...createAiEnabledSettings().workspace,
        viewMode: 'kline' as const
      }
    }
    const adapter = new FakeDataAdapter([], settings)
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setAiUseCaseId('price-move-prediction')
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests).toHaveLength(1)
    expect(adapter.aiAnalysisRequests[0].workflow?.outputHandlingNotes.join('；')).toContain(
      '不得写入策略信号'
    )
    expect(viewModel.strategyResults).toEqual([])
  })

  it('validates AI parameter candidates with local backtests before displaying ranking', async () => {
    const settings = {
      ...createAiEnabledSettings(),
      workspace: {
        ...createAiEnabledSettings().workspace,
        viewMode: 'kline' as const
      }
    }
    const adapter = new FakeDataAdapter([], settings)
    adapter.nextStockDataset = createCrossingStockDataset()
    adapter.nextCachedKlineDatasetResult = createCompleteCachedKlineDatasetResult(settings.workspace.query)
    adapter.aiAnalysisResults.push({
      status: 'success',
      useCaseId: 'parameter-optimization',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: JSON.stringify({
        candidateParameters: [
          {
            name: '短长均线候选',
            templateId: 'ma-cross',
            params: { shortPeriod: 3, longPeriod: 8 }
          },
          {
            name: '越界候选',
            templateId: 'ma-cross',
            params: { shortPeriod: 300, longPeriod: 1 }
          }
        ],
        optimizationGoal: '控制回撤',
        riskNotes: ['样本窗口有限'],
        localBacktestRequired: true
      }),
      warnings: [],
      elapsedMs: 12,
      completedAt: '2026-08-25T00:00:00.000Z'
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openStrategyPanel()
    viewModel.setStrategySelectedTemplateIds(['ma-cross'])
    viewModel.setStrategyDraftParam('ma-cross', 'shortPeriod', 3)
    viewModel.setStrategyDraftParam('ma-cross', 'longPeriod', 8)
    await viewModel.runStrategyBacktest()
    viewModel.setAiUseCaseId('parameter-optimization')
    viewModel.setAiUseCaseConfirmed(true)
    await viewModel.runAiAnalysis()

    expect(viewModel.aiAnalysisResult?.outputText).toContain('本地批量回测验证')
    expect(viewModel.aiAnalysisResult?.outputText).toContain('短长均线候选')
    expect(viewModel.aiAnalysisResult?.outputText).toContain('不可用')

    adapter.aiAnalysisResults.push({
      status: 'success',
      useCaseId: 'strategy-comparison',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: '模型对比摘要',
      warnings: [],
      elapsedMs: 12,
      completedAt: '2026-08-25T00:00:00.000Z'
    })
    viewModel.setAiUseCaseId('strategy-comparison')
    viewModel.setAiUseCaseConfirmed(true)
    await viewModel.runAiAnalysis()

    expect(viewModel.aiAnalysisResult?.outputText).toContain('本地对比事实')
    expect(viewModel.aiAnalysisResult?.outputText).toContain('统一指标')
    expect(viewModel.aiAnalysisResult?.outputText).toContain('可比日期范围')
  })

  it('uses the currently displayed chart security as the default AI analysis scope', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSymbol('sz000001')
    await viewModel.runAiAnalysis()

    expect(adapter.aiAnalysisRequests[0].context).toMatchObject({
      symbol: 'sh000001',
      stockName: '上证指数'
    })
    expect(viewModel.aiCurrentAnalysisScope).toContain('上证指数(sh000001)')
  })

  it('shows AI stream chunks before the final result completes', async () => {
    const adapter = new DeferredAiAnalysisAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()
    adapter.emitNextAiChunk('第一段')

    expect(viewModel.aiAnalysisRunning).toBe(true)
    expect(viewModel.aiAnalysisStreamStatus).toBe('running')
    expect(viewModel.aiAnalysisPartialOutput).toBe('第一段')
    expect(viewModel.aiVisibleAnalysisOutput).toBe('第一段')
    expect(viewModel.aiAnalysisResult).toBeNull()

    adapter.resolveNextAiAnalysis('第一段第二段')

    expect(viewModel.aiAnalysisRunning).toBe(false)
    expect(viewModel.aiAnalysisStreamStatus).toBe('success')
    expect(viewModel.aiAnalysisResult?.outputText).toBe('第一段第二段')
  })

  it('cancels an active AI stream and ignores later chunks from that request', async () => {
    const adapter = new DeferredAiAnalysisAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()
    const requestId = viewModel.aiAnalysisStreamRequestId

    viewModel.cancelAiAnalysis()
    adapter.emitStaleAiChunk(requestId, '不应显示')

    expect(viewModel.aiAnalysisRunning).toBe(false)
    expect(viewModel.aiAnalysisStreamStatus).toBe('cancelled')
    expect(viewModel.aiAnalysisPartialOutput).not.toContain('不应显示')
    expect(viewModel.aiAnalysisStreamRequestId).toBe('')
  })

  it('surfaces unsupported streaming fallback warnings in the final AI result', async () => {
    const adapter = new FakeDataAdapter([], createAiEnabledSettings())
    adapter.aiAnalysisResults.push({
      status: 'success',
      useCaseId: 'daily-review',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      outputText: '非流式结果',
      warnings: [AI_STREAMING_FALLBACK_NOTICE],
      streamingFallback: true,
      elapsedMs: 12,
      completedAt: '2026-08-25T00:00:00.000Z'
    })
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    await viewModel.runAiAnalysis()

    expect(viewModel.aiAnalysisResult).toMatchObject({
      status: 'success',
      outputText: '非流式结果',
      streamingFallback: true
    })
    expect(viewModel.aiAnalysisFallbackWarning).toBe(AI_STREAMING_FALLBACK_NOTICE)
  })

  it('keeps stale AI analysis responses from replacing the latest result', async () => {
    const adapter = new DeferredAiAnalysisAdapter([], createAiEnabledSettings())
    const viewModel = createStockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    const firstRun = viewModel.runAiAnalysis()
    viewModel.setAiQuestion('第二次复盘')
    const secondRun = viewModel.runAiAnalysis()

    adapter.resolveNextAiAnalysis('旧结果')
    await waitForMicrotasks()

    expect(viewModel.aiAnalysisResult).toBeNull()
    expect(viewModel.aiAnalysisRunning).toBe(true)

    adapter.resolveNextAiAnalysis('新结果')
    await firstRun
    await secondRun

    expect(viewModel.aiAnalysisResult?.outputText).toBe('新结果')
    expect(adapter.aiAnalysisRequests).toHaveLength(2)
  })

  it('prevents enabling more than three sub indicators in the draft', () => {
    const viewModel = createStockWorkspaceViewModel(new FakeDataAdapter())

    viewModel.openIndicatorDialog()
    viewModel.setKLineIndicatorDraftEnabled('macd', true)
    viewModel.setKLineIndicatorDraftEnabled('kdj', true)
    viewModel.setKLineIndicatorDraftEnabled('rsi', true)

    expect(viewModel.chart.draftEnabledSubIndicatorCount).toBe(3)
    expect(viewModel.chart.indicatorDraft.rsi.enabled).toBe(false)
  })
})

function createDefaultSettings(): AppSettings {
  return {
    checkUpdatesOnStartup: true,
    networkProxy: {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    workspace: {
      viewMode: 'timeshare',
      timeshareSourceId: 'eastmoney',
      query: {
        sourceId: 'eastmoney',
        symbol: 'sh000001',
        period: 'day',
        adjust: 'qfq',
        startDate: '20240101',
        endDate: '20260101'
      },
      indicatorSettings: createDefaultIndicatorSettings(),
      timeshareIndicatorSettings: createDefaultTimeshareIndicatorSettings(),
      watchlist: []
    },
    tradeProfit: createDefaultTradeProfitSettings(),
    aiConnector: createDefaultAiConnectorSettings()
  }
}

function createKlineSettings(): AppSettings {
  return {
    ...createDefaultSettings(),
    workspace: {
      ...createDefaultSettings().workspace,
      viewMode: 'kline'
    }
  }
}

function createAiEnabledSettings(): AppSettings {
  return {
    ...createDefaultSettings(),
    aiConnector: {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      availability: 'available'
    }
  }
}

function createLocalCacheBackupSummary(): LocalCacheBackupSummary {
  return {
    settingsSections: [
      'checkUpdatesOnStartup',
      'networkProxy',
      'workspace',
      'tradeProfit',
      'aiConnector'
    ],
    includesNetworkProxy: true,
    klineCacheEntryCount: 1,
    klineCacheBytes: 1024,
    skippedCount: 0,
    skippedItems: []
  }
}

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

function createSampleStockDataset(): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: '000001',
      name: '上证指数'
    },
    interval: 'day',
    columns: ['时间', '开盘价', '最高价', '最低价', '收盘价', '成交量', '成交额'],
    candles: Array.from({ length: 130 }, (_, index) => {
      const date = new Date(2024, 0, index + 1)
      const value = 3000 + index
      return {
        timeKey: formatDateKey(date),
        timestamp: date.getTime(),
        open: value,
        high: value + 10,
        low: value - 10,
        close: value + 2,
        volume: 1000 + index,
        turnover: 2000 + index
      }
    })
  }
}

function createCrossingStockDataset(): StockDataset {
  return {
    ...createSampleStockDataset(),
    candles: Array.from({ length: 45 }, (_, index) => {
      const date = new Date(2024, 0, index + 1)
      const close =
        index < 12
          ? 30 - index
          : index < 28
            ? 18 + (index - 12) * 1.4
            : 40 - (index - 28) * 1.8
      return {
        timeKey: formatDateKey(date),
        timestamp: date.getTime(),
        open: close - 0.2,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1000 + index,
        turnover: 2000 + index
      }
    })
  }
}

function createCrossingStockDatasetWithDateRange(
  firstDateKey: string,
  lastDateKey: string
): StockDataset {
  const source = createCrossingStockDataset()
  const firstTimestamp = timestampFromDateKey(firstDateKey)
  const candles = source.candles.map((candle, index) => {
    const date = new Date(firstTimestamp)
    date.setDate(date.getDate() + index)
    return {
      ...candle,
      timeKey: formatDateKey(date),
      timestamp: date.getTime()
    }
  })
  const last = candles.at(-1)
  if (last && last.timeKey < lastDateKey) {
    candles.push({
      ...last,
      timeKey: lastDateKey,
      timestamp: timestampFromDateKey(lastDateKey)
    })
  }
  return {
    ...source,
    candles
  }
}

function createCompleteCachedKlineDatasetResult(
  query: StockQuery = createKlineSettings().workspace.query,
  dataset: StockDataset = createCrossingStockDatasetCoveringQuery(query)
): KlineCachedDatasetResult {
  return {
    status: 'complete',
    query,
    dataset,
    missingRanges: []
  }
}

function createCrossingStockDatasetCoveringQuery(query: StockQuery): StockDataset {
  const dataset = createCrossingStockDataset()
  const candles = [...dataset.candles]
  const first = candles[0]
  const last = candles.at(-1)
  if (first && query.startDate < first.timeKey) {
    candles.unshift({
      ...first,
      timeKey: query.startDate,
      timestamp: timestampFromDateKey(query.startDate)
    })
  }
  if (last && query.endDate > last.timeKey) {
    candles.push({
      ...last,
      timeKey: query.endDate,
      timestamp: timestampFromDateKey(query.endDate)
    })
  }
  return {
    ...dataset,
    candles
  }
}

function createKlineCacheRows(
  request: KlineCacheStatusRequest | KlineCacheRefreshRequest | KlineCacheClearRequest
): KlineCacheStatusRow[] {
  const rows = 'rows' in request && request.rows?.length
    ? request.rows
    : expandKlineCacheStockQueries(request.query, request.items)
  return rows.map((row) => createKlineCacheRow(row))
}

function createKlineCacheRow(item: KlineCacheSeriesRequestItem): KlineCacheStatusRow {
  return {
    id: item.id,
    symbol: item.query.symbol,
    name: item.name,
    query: { ...item.query },
    status: 'empty',
    recordCount: 0,
    coveredRanges: [],
    missingRanges: [
      {
        startDate: item.query.startDate,
        endDate: item.query.endDate
      }
    ]
  }
}

function createCompletedKlineCacheJob(request: KlineCacheRefreshRequest): KlineCacheJob {
  const rows = createKlineCacheRows(request)
  return {
    id: 'job-1',
    status: 'completed',
    total: rows.length,
    completed: rows.length,
    rows: rows.map((row) => ({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      query: { ...row.query },
      status: 'success',
      recordCount: 2,
      missingRanges: []
    })),
    startedAt: 1,
    finishedAt: 2
  }
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function timestampFromDateKey(dateKey: string): number {
  return new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(4, 6)) - 1,
    Number(dateKey.slice(6, 8))
  ).getTime()
}
