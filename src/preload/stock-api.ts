import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type {
  IndicatorName,
  IndicatorSettingsMap,
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
  watchlist?: WatchlistItem[]
  enabledIndicators?: Partial<Record<IndicatorName, boolean>>
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
  getSettings(): Promise<AppSettings>
  setCheckUpdatesOnStartup(enabled: boolean): Promise<AppSettings>
  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings>
  setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings>
  setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  cancelUpdateDownload(): Promise<void>
  openUpdateDownloadPage(version?: string): Promise<void>
  quitAndInstallUpdate(): Promise<void>
  onUpdateEvent(callback: (event: AppUpdateEvent) => void): () => void
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
}
