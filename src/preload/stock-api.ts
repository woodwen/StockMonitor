import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
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
} from '../renderer/features/stock-workspace/models/ai-models'
import type {
  IndicatorName,
  IndicatorSettingsMap,
  LegacyIndicatorName,
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
  KlineCacheStatusRow,
  KlineStrategySettings,
  TimeshareIndicatorSettingsMap,
  WatchlistItem,
  WorkspaceViewMode
} from '../renderer/features/stock-workspace/models/stock-types'
import type { TradeProfitSettings } from '../renderer/features/trade-profit-calculator/models/trade-profit'

export interface AppSettings {
  checkUpdatesOnStartup: boolean
  networkProxy: NetworkProxySettings
  workspace: WorkspaceSettings
  tradeProfit: TradeProfitSettings
  aiConnector: AiConnectorSettings
}

export type NetworkProxyProtocol = 'http' | 'socks5'

export interface NetworkProxySettings {
  enabled: boolean
  protocol: NetworkProxyProtocol
  host: string
  port: number
}

export interface WorkspaceSettings {
  query: StockQuery
  timeshareSourceId?: StockQuery['sourceId']
  viewMode?: WorkspaceViewMode
  indicatorSettings?: IndicatorSettingsMap
  timeshareIndicatorSettings?: TimeshareIndicatorSettingsMap
  klineStrategySettings?: KlineStrategySettings
  watchlist?: WatchlistItem[]
  enabledIndicators?: Partial<Record<LegacyIndicatorName, boolean>>
}

export type LocalCacheBackupImportStrategy = 'merge' | 'replace'

export type LocalCacheBackupStatus = 'cancelled' | 'error' | 'ready' | 'success'

export type LocalCacheBackupSection = 'settings' | 'klineCache'

export type LocalCacheBackupSkippedSection = LocalCacheBackupSection | 'backup'

export interface LocalCacheBackupSkippedItem {
  section: LocalCacheBackupSkippedSection
  itemId?: string
  reason: string
}

export interface LocalCacheBackupSummary {
  settingsSections: string[]
  includesNetworkProxy: boolean
  klineCacheEntryCount: number
  klineCacheBytes: number
  skippedCount: number
  skippedItems: LocalCacheBackupSkippedItem[]
}

export interface LocalCacheBackupExportResult {
  status: Extract<LocalCacheBackupStatus, 'cancelled' | 'error' | 'success'>
  filePath?: string
  summary?: LocalCacheBackupSummary
  message?: string
}

export interface LocalCacheBackupInspectResult {
  status: Extract<LocalCacheBackupStatus, 'cancelled' | 'error' | 'ready'>
  importToken?: string
  filePath?: string
  summary?: LocalCacheBackupSummary
  message?: string
}

export interface LocalCacheBackupImportRequest {
  importToken: string
  strategy: LocalCacheBackupImportStrategy
}

export interface LocalCacheBackupImportSummary extends LocalCacheBackupSummary {
  strategy: LocalCacheBackupImportStrategy
  importedKlineCacheEntryCount: number
  removedKlineCacheEntryCount: number
}

export interface LocalCacheBackupImportResult {
  status: Extract<LocalCacheBackupStatus, 'error' | 'success'>
  settings?: AppSettings
  summary?: LocalCacheBackupImportSummary
  message?: string
}

export type MenuCommand =
  | 'refresh-stock'
  | 'check-update'
  | 'open-user-manual'
  | 'open-version-updates'

export interface StockApi {
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
  setCheckUpdatesOnStartup(enabled: boolean): Promise<AppSettings>
  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings>
  setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings>
  setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings>
  getAiConnectorSettings(): Promise<AiConnectorSettingsSnapshot>
  setAiConnectorSettings(settings: AiConnectorSettings): Promise<AiConnectorSettingsSnapshot>
  saveAiConnectorApiKey(connectorId: string, apiKey: string): Promise<AiConnectorSettingsSnapshot>
  clearAiConnectorApiKey(connectorId: string): Promise<AiConnectorSettingsSnapshot>
  testAiConnector(): Promise<AiConnectorTestResult>
  runAiAnalysis(request: AiAnalysisRequest): Promise<AiAnalysisResult>
  startAiAnalysisStream(request: AiAnalysisStreamStartRequest): Promise<AiAnalysisStreamStartResult>
  cancelAiAnalysis(requestId: string): Promise<AiAnalysisCancelResult>
  onAiAnalysisStreamEvent(callback: (event: AiAnalysisStreamEvent) => void): () => void
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): Promise<void>
  openUpdateDownloadPage(version?: string): Promise<void>
  quitAndInstallUpdate(): Promise<void>
  onUpdateEvent(callback: (event: AppUpdateEvent) => void): () => void
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
}
