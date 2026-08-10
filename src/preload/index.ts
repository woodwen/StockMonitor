import { contextBridge, ipcRenderer } from 'electron'
import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type { StockApi, MenuCommand } from './stock-api'

const stockApi: StockApi = {
  openLegacyTextFile: () => ipcRenderer.invoke('stock:openLegacyTextFile'),
  readSampleLegacyTextFile: () => ipcRenderer.invoke('stock:readSampleLegacyTextFile'),
  getRecentFiles: () => ipcRenderer.invoke('stock:getRecentFiles'),
  clearRecentFiles: () => ipcRenderer.invoke('stock:clearRecentFiles'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setCheckUpdatesOnStartup: (enabled) =>
    ipcRenderer.invoke('settings:setCheckUpdatesOnStartup', enabled),
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
