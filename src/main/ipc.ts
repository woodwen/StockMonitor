import { ipcMain } from 'electron'
import type {
  AppSettings,
  LocalCacheBackupImportRequest,
  NetworkProxySettings,
  WorkspaceSettings
} from '../preload/stock-api'
import type { TradeProfitSettings } from '../renderer/features/trade-profit-calculator/models/trade-profit'
import type {
  AiAnalysisRequest,
  AiAnalysisStreamStartRequest,
  AiConnectorSettings
} from '../renderer/features/stock-workspace/models/ai-models'
import type {
  StockQuery,
  StockTimeshareQuery,
  KlineCacheStatusRequest,
  KlineCacheRefreshRequest,
  KlineCacheClearRequest
} from '../renderer/features/stock-workspace/models/stock-types'
import {
  getSettings,
  setCheckUpdatesOnStartup,
  setNetworkProxy,
  setTradeProfitSettings,
  setWorkspaceSettings
} from './store'
import {
  cancelUpdateDownload,
  checkForUpdates,
  downloadUpdate,
  openUpdateDownloadPage,
  quitAndInstallUpdate
} from './update-manager'
import { logger } from './logger'
import {
  cancelKlineCacheJob,
  clearKlineCache,
  getCachedKlineDataset,
  getKlineCacheJob,
  getKlineCacheStatus,
  startKlineCacheRefresh
} from './kline-cache'
import {
  fetchRemoteStockDataset,
  fetchRemoteStockTimeshareDataset,
  getStockDataSourceMetas
} from './remote-stock-sources'
import {
  exportLocalCacheBackup,
  importLocalCacheBackup,
  inspectLocalCacheBackup
} from './local-cache-portability'
import {
  clearAiConnectorApiKey,
  cancelAiAnalysis,
  getAiConnectorSettingsSnapshot,
  runAiAnalysis,
  saveAiConnectorApiKey,
  saveAiConnectorSettingsSnapshot,
  startAiAnalysisStream,
  testAiConnector
} from './ai-connector'

type IpcMainHandler = Parameters<typeof ipcMain.handle>[1]

function registerIpcHandler(channel: string, handler: IpcMainHandler): void {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

export function registerIpcHandlers(): void {
  registerIpcHandler('stock:getDataSources', () => getStockDataSourceMetas())
  registerIpcHandler('stock:fetchDataset', async (_event, query: StockQuery) => {
    logger.info('Fetching remote stock dataset', query)
    return fetchRemoteStockDataset(query, { proxy: getSettings().networkProxy })
  })
  registerIpcHandler('stock:fetchTimeshareDataset', async (_event, query: StockTimeshareQuery) => {
    logger.info('Fetching remote stock timeshare dataset', query)
    return fetchRemoteStockTimeshareDataset(query, { proxy: getSettings().networkProxy })
  })
  registerIpcHandler('stock:getKlineCacheStatus', async (_event, request: KlineCacheStatusRequest) => {
    return getKlineCacheStatus(request)
  })
  registerIpcHandler(
    'stock:startKlineCacheRefresh',
    (_event, request: KlineCacheRefreshRequest) => {
      return startKlineCacheRefresh(request)
    }
  )
  registerIpcHandler('stock:getKlineCacheJob', (_event, jobId: string) => {
    return getKlineCacheJob(jobId)
  })
  registerIpcHandler('stock:cancelKlineCacheJob', (_event, jobId: string) => {
    return cancelKlineCacheJob(jobId)
  })
  registerIpcHandler('stock:getCachedKlineDataset', async (_event, query: StockQuery) => {
    return getCachedKlineDataset(query)
  })
  registerIpcHandler('stock:clearKlineCache', async (_event, request: KlineCacheClearRequest) => {
    return clearKlineCache(request)
  })
  registerIpcHandler('localCache:exportBackup', () => exportLocalCacheBackup())
  registerIpcHandler('localCache:inspectBackup', () => inspectLocalCacheBackup())
  registerIpcHandler(
    'localCache:importBackup',
    (_event, request: LocalCacheBackupImportRequest) => importLocalCacheBackup(request)
  )

  registerIpcHandler('settings:get', (): AppSettings => getSettings())
  registerIpcHandler('settings:setCheckUpdatesOnStartup', (_event, enabled: boolean): AppSettings => {
    return setCheckUpdatesOnStartup(Boolean(enabled))
  })
  registerIpcHandler('settings:setNetworkProxy', (_event, proxy: NetworkProxySettings): AppSettings => {
    return setNetworkProxy(proxy)
  })
  registerIpcHandler('settings:setWorkspaceSettings', (_event, workspace: WorkspaceSettings): AppSettings => {
    return setWorkspaceSettings(workspace)
  })
  registerIpcHandler(
    'settings:setTradeProfitSettings',
    (_event, settings: TradeProfitSettings): AppSettings => {
      return setTradeProfitSettings(settings)
    }
  )
  registerIpcHandler('ai:getConnectorSettings', () => getAiConnectorSettingsSnapshot())
  registerIpcHandler('ai:setConnectorSettings', (_event, settings: AiConnectorSettings) => {
    return saveAiConnectorSettingsSnapshot(settings)
  })
  registerIpcHandler(
    'ai:saveConnectorApiKey',
    (_event, connectorId: string, apiKey: string) => saveAiConnectorApiKey(connectorId, apiKey)
  )
  registerIpcHandler('ai:clearConnectorApiKey', (_event, connectorId: string) => {
    return clearAiConnectorApiKey(connectorId)
  })
  registerIpcHandler('ai:testConnector', () => testAiConnector())
  registerIpcHandler('ai:runAnalysis', (_event, request: AiAnalysisRequest) => {
    return runAiAnalysis(request)
  })
  registerIpcHandler('ai:startAnalysisStream', (event, request: AiAnalysisStreamStartRequest) => {
    return startAiAnalysisStream(request, (payload) => {
      event.sender.send('ai:analysisStreamEvent', payload)
    })
  })
  registerIpcHandler('ai:cancelAnalysis', (_event, requestId: string) => {
    return cancelAiAnalysis(requestId)
  })
  registerIpcHandler('update:check', () => checkForUpdates())
  registerIpcHandler('update:download', () => downloadUpdate())
  registerIpcHandler('update:cancelDownload', () => cancelUpdateDownload())
  registerIpcHandler('update:openDownloadPage', (_event, version?: string) =>
    openUpdateDownloadPage(version)
  )
  registerIpcHandler('update:quitAndInstall', () => quitAndInstallUpdate())
}
