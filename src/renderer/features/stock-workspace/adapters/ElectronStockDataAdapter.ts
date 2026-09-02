import type {
  AppSettings,
  LocalCacheBackupExportResult,
  LocalCacheBackupImportRequest,
  LocalCacheBackupImportResult,
  LocalCacheBackupInspectResult,
  NetworkProxySettings,
  WorkspaceSettings
} from '../../../../preload/stock-api'
import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  AiAnalysisCancelResult,
  AiAnalysisStreamEvent,
  AiAnalysisStreamStartRequest,
  AiAnalysisStreamStartResult,
  AiConnectorSettings,
  AiConnectorSettingsSnapshot,
  AiConnectorTestResult
} from '../models/ai-models'
import type {
  StockDataSourceMeta,
  StockDataset,
  StockQuery,
  StockTimeshareDataset,
  StockTimeshareQuery,
  KlineCachedDatasetResult,
  KlineCacheClearRequest,
  KlineCacheJob,
  KlineCacheRefreshRequest,
  KlineCacheStatusRequest,
  KlineCacheStatusRow
} from '../models/stock-types'

export interface StockDataAdapter {
  getStockDataSources(): Promise<StockDataSourceMeta[]>
  fetchStockDataset(query: StockQuery): Promise<StockDataset>
  fetchStockTimeshareDataset(query: StockTimeshareQuery): Promise<StockTimeshareDataset>
  getKlineCacheStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]>
  startKlineCacheRefresh(request: KlineCacheRefreshRequest): Promise<KlineCacheJob>
  getKlineCacheJob(jobId: string): Promise<KlineCacheJob | null>
  cancelKlineCacheJob(jobId: string): Promise<KlineCacheJob | null>
  getCachedKlineDataset(query: StockQuery): Promise<KlineCachedDatasetResult>
  clearKlineCache(request: KlineCacheClearRequest): Promise<KlineCacheStatusRow[]>
  exportLocalCacheBackup(): Promise<LocalCacheBackupExportResult>
  inspectLocalCacheBackup(): Promise<LocalCacheBackupInspectResult>
  importLocalCacheBackup(request: LocalCacheBackupImportRequest): Promise<LocalCacheBackupImportResult>
  getSettings(): Promise<AppSettings>
  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings>
  setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings>
  getAiConnectorSettings(): Promise<AiConnectorSettingsSnapshot>
  setAiConnectorSettings(settings: AiConnectorSettings): Promise<AiConnectorSettingsSnapshot>
  saveAiConnectorApiKey(connectorId: string, apiKey: string): Promise<AiConnectorSettingsSnapshot>
  clearAiConnectorApiKey(connectorId: string): Promise<AiConnectorSettingsSnapshot>
  testAiConnector(): Promise<AiConnectorTestResult>
  runAiAnalysis(request: AiAnalysisRequest): Promise<AiAnalysisResult>
  startAiAnalysisStream(request: AiAnalysisStreamStartRequest): Promise<AiAnalysisStreamStartResult>
  cancelAiAnalysis(requestId: string): Promise<AiAnalysisCancelResult>
  onAiAnalysisStreamEvent(callback: (event: AiAnalysisStreamEvent) => void): () => void
}

export class ElectronStockDataAdapter implements StockDataAdapter {
  getStockDataSources(): Promise<StockDataSourceMeta[]> {
    return window.stockApi.getStockDataSources()
  }

  fetchStockDataset(query: StockQuery): Promise<StockDataset> {
    return window.stockApi.fetchStockDataset(query)
  }

  fetchStockTimeshareDataset(query: StockTimeshareQuery): Promise<StockTimeshareDataset> {
    return window.stockApi.fetchStockTimeshareDataset(query)
  }

  getKlineCacheStatus(request: KlineCacheStatusRequest): Promise<KlineCacheStatusRow[]> {
    return window.stockApi.getKlineCacheStatus(request)
  }

  startKlineCacheRefresh(request: KlineCacheRefreshRequest): Promise<KlineCacheJob> {
    return window.stockApi.startKlineCacheRefresh(request)
  }

  getKlineCacheJob(jobId: string): Promise<KlineCacheJob | null> {
    return window.stockApi.getKlineCacheJob(jobId)
  }

  cancelKlineCacheJob(jobId: string): Promise<KlineCacheJob | null> {
    return window.stockApi.cancelKlineCacheJob(jobId)
  }

  getCachedKlineDataset(query: StockQuery): Promise<KlineCachedDatasetResult> {
    return window.stockApi.getCachedKlineDataset(query)
  }

  clearKlineCache(request: KlineCacheClearRequest): Promise<KlineCacheStatusRow[]> {
    return window.stockApi.clearKlineCache(request)
  }

  exportLocalCacheBackup(): Promise<LocalCacheBackupExportResult> {
    return window.stockApi.exportLocalCacheBackup()
  }

  inspectLocalCacheBackup(): Promise<LocalCacheBackupInspectResult> {
    return window.stockApi.inspectLocalCacheBackup()
  }

  importLocalCacheBackup(
    request: LocalCacheBackupImportRequest
  ): Promise<LocalCacheBackupImportResult> {
    return window.stockApi.importLocalCacheBackup(request)
  }

  getSettings(): Promise<AppSettings> {
    return window.stockApi.getSettings()
  }

  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings> {
    return window.stockApi.setNetworkProxy(proxy)
  }

  setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings> {
    return window.stockApi.setWorkspaceSettings(workspace)
  }

  getAiConnectorSettings(): Promise<AiConnectorSettingsSnapshot> {
    return window.stockApi.getAiConnectorSettings()
  }

  setAiConnectorSettings(settings: AiConnectorSettings): Promise<AiConnectorSettingsSnapshot> {
    return window.stockApi.setAiConnectorSettings(settings)
  }

  saveAiConnectorApiKey(
    connectorId: string,
    apiKey: string
  ): Promise<AiConnectorSettingsSnapshot> {
    return window.stockApi.saveAiConnectorApiKey(connectorId, apiKey)
  }

  clearAiConnectorApiKey(connectorId: string): Promise<AiConnectorSettingsSnapshot> {
    return window.stockApi.clearAiConnectorApiKey(connectorId)
  }

  testAiConnector(): Promise<AiConnectorTestResult> {
    return window.stockApi.testAiConnector()
  }

  runAiAnalysis(request: AiAnalysisRequest): Promise<AiAnalysisResult> {
    return window.stockApi.runAiAnalysis(request)
  }

  startAiAnalysisStream(
    request: AiAnalysisStreamStartRequest
  ): Promise<AiAnalysisStreamStartResult> {
    return window.stockApi.startAiAnalysisStream(request)
  }

  cancelAiAnalysis(requestId: string): Promise<AiAnalysisCancelResult> {
    return window.stockApi.cancelAiAnalysis(requestId)
  }

  onAiAnalysisStreamEvent(callback: (event: AiAnalysisStreamEvent) => void): () => void {
    return window.stockApi.onAiAnalysisStreamEvent(callback)
  }
}
