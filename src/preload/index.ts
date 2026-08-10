import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type { StockApi, MenuCommand } from './stock-api'

const stockApi: StockApi = {
  getStockDataSources: () => ipcRenderer.invoke('stock:getDataSources'),
  fetchStockDataset: (query) => ipcRenderer.invoke('stock:fetchDataset', query),
  fetchStockTimeshareDataset: (query) => ipcRenderer.invoke('stock:fetchTimeshareDataset', query),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setCheckUpdatesOnStartup: (enabled) =>
    ipcRenderer.invoke('settings:setCheckUpdatesOnStartup', enabled),
  setNetworkProxy: (proxy) => ipcRenderer.invoke('settings:setNetworkProxy', proxy),
  setWorkspaceSettings: (workspace) => ipcRenderer.invoke('settings:setWorkspaceSettings', workspace),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
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
