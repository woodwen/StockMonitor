import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type {
  IndicatorName,
  IndicatorSettingsMap,
  StockDataSourceMeta,
  StockDataset,
  StockQuery
} from '../renderer/features/stock-workspace/models/stock-types'

export interface AppSettings {
  checkUpdatesOnStartup: boolean
  networkProxy: NetworkProxySettings
  workspace: WorkspaceSettings
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
  indicatorSettings?: IndicatorSettingsMap
  enabledIndicators?: Partial<Record<IndicatorName, boolean>>
}

export type MenuCommand = 'refresh-stock' | 'check-update'

export interface StockApi {
  getStockDataSources(): Promise<StockDataSourceMeta[]>
  fetchStockDataset(query: StockQuery): Promise<StockDataset>
  getSettings(): Promise<AppSettings>
  setCheckUpdatesOnStartup(enabled: boolean): Promise<AppSettings>
  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings>
  setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  quitAndInstallUpdate(): Promise<void>
  onUpdateEvent(callback: (event: AppUpdateEvent) => void): () => void
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
}
