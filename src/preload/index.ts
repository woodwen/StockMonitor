import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type { AiAnalysisStreamEvent } from '../renderer/features/stock-workspace/models/ai-models'
import type { StockApi, MenuCommand } from './stock-api'

const stockApi: StockApi = {
  getStockDataSources: () => ipcRenderer.invoke('stock:getDataSources'),
  fetchStockDataset: (query) => ipcRenderer.invoke('stock:fetchDataset', query),
  fetchStockTimeshareDataset: (query) => ipcRenderer.invoke('stock:fetchTimeshareDataset', query),
  getKlineCacheStatus: (request) => ipcRenderer.invoke('stock:getKlineCacheStatus', request),
  startKlineCacheRefresh: (request) =>
    ipcRenderer.invoke('stock:startKlineCacheRefresh', request),
  getKlineCacheJob: (jobId) => ipcRenderer.invoke('stock:getKlineCacheJob', jobId),
  cancelKlineCacheJob: (jobId) => ipcRenderer.invoke('stock:cancelKlineCacheJob', jobId),
  getCachedKlineDataset: (query) => ipcRenderer.invoke('stock:getCachedKlineDataset', query),
  clearKlineCache: (request) => ipcRenderer.invoke('stock:clearKlineCache', request),
  exportLocalCacheBackup: () => ipcRenderer.invoke('localCache:exportBackup'),
  inspectLocalCacheBackup: () => ipcRenderer.invoke('localCache:inspectBackup'),
  importLocalCacheBackup: (request) => ipcRenderer.invoke('localCache:importBackup', request),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setCheckUpdatesOnStartup: (enabled) =>
    ipcRenderer.invoke('settings:setCheckUpdatesOnStartup', enabled),
  setNetworkProxy: (proxy) => ipcRenderer.invoke('settings:setNetworkProxy', proxy),
  setWorkspaceSettings: (workspace) => ipcRenderer.invoke('settings:setWorkspaceSettings', workspace),
  setTradeProfitSettings: (settings) =>
    ipcRenderer.invoke('settings:setTradeProfitSettings', settings),
  getAiConnectorSettings: () => ipcRenderer.invoke('ai:getConnectorSettings'),
  setAiConnectorSettings: (settings) => ipcRenderer.invoke('ai:setConnectorSettings', settings),
  saveAiConnectorApiKey: (connectorId, apiKey) =>
    ipcRenderer.invoke('ai:saveConnectorApiKey', connectorId, apiKey),
  clearAiConnectorApiKey: (connectorId) =>
    ipcRenderer.invoke('ai:clearConnectorApiKey', connectorId),
  testAiConnector: () => ipcRenderer.invoke('ai:testConnector'),
  runAiAnalysis: (request) => ipcRenderer.invoke('ai:runAnalysis', request),
  startAiAnalysisStream: (request) => ipcRenderer.invoke('ai:startAnalysisStream', request),
  cancelAiAnalysis: (requestId) => ipcRenderer.invoke('ai:cancelAnalysis', requestId),
  onAiAnalysisStreamEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AiAnalysisStreamEvent): void => {
      callback(payload)
    }
    ipcRenderer.on('ai:analysisStreamEvent', listener)
    return () => ipcRenderer.removeListener('ai:analysisStreamEvent', listener)
  },
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  cancelUpdateDownload: () => ipcRenderer.invoke('update:cancelDownload'),
  openUpdateDownloadPage: (version) => ipcRenderer.invoke('update:openDownloadPage', version),
  quitAndInstallUpdate: () => ipcRenderer.invoke('update:quitAndInstall'),
  onUpdateEvent: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AppUpdateEvent): void => {
      callback(payload)
    }
    ipcRenderer.on('update:event', listener)
    return () => ipcRenderer.removeListener('update:event', listener)
  },
  onMenuCommand: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, command: MenuCommand): void => {
      callback(command)
    }
    ipcRenderer.on('menu:command', listener)
    return () => ipcRenderer.removeListener('menu:command', listener)
  }
}

contextBridge.exposeInMainWorld('stockApi', stockApi)
