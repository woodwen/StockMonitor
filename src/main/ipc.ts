import { BrowserWindow, ipcMain } from 'electron'
import type { AppSettings, NetworkProxySettings, WorkspaceSettings } from '../preload/stock-api'
import type {
  StockQuery,
  StockTimeshareQuery
} from '../renderer/features/stock-workspace/models/stock-types'
import { getSettings, setCheckUpdatesOnStartup, setNetworkProxy, setWorkspaceSettings } from './store'
import { checkForUpdates, downloadUpdate, quitAndInstallUpdate } from './update-manager'
import { logger } from './logger'
import {
  fetchRemoteStockDataset,
  fetchRemoteStockTimeshareDataset,
  getStockDataSourceMetas
} from './remote-stock-sources'

export function registerIpcHandlers(_window: BrowserWindow): void {
  ipcMain.handle('stock:getDataSources', () => getStockDataSourceMetas())
  ipcMain.handle('stock:fetchDataset', async (_event, query: StockQuery) => {
    logger.info('Fetching remote stock dataset', query)
    return fetchRemoteStockDataset(query, { proxy: getSettings().networkProxy })
  })
  ipcMain.handle('stock:fetchTimeshareDataset', async (_event, query: StockTimeshareQuery) => {
    logger.info('Fetching remote stock timeshare dataset', query)
    return fetchRemoteStockTimeshareDataset(query, { proxy: getSettings().networkProxy })
  })

  ipcMain.handle('settings:get', (): AppSettings => getSettings())
  ipcMain.handle('settings:setCheckUpdatesOnStartup', (_event, enabled: boolean): AppSettings => {
    return setCheckUpdatesOnStartup(Boolean(enabled))
  })
  ipcMain.handle('settings:setNetworkProxy', (_event, proxy: NetworkProxySettings): AppSettings => {
    return setNetworkProxy(proxy)
  })
  ipcMain.handle('settings:setWorkspaceSettings', (_event, workspace: WorkspaceSettings): AppSettings => {
    return setWorkspaceSettings(workspace)
  })
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:quitAndInstall', () => quitAndInstallUpdate())
}
