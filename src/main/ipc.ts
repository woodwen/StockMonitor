import { ipcMain } from 'electron'
import type {
  AppSettings,
  NetworkProxySettings,
  WorkspaceSettings
} from '../preload/stock-api'
import type { TradeProfitSettings } from '../renderer/features/trade-profit-calculator/models/trade-profit'
import type {
  StockQuery,
  StockTimeshareQuery
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
  fetchRemoteStockDataset,
  fetchRemoteStockTimeshareDataset,
  getStockDataSourceMetas
} from './remote-stock-sources'

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
  registerIpcHandler('update:check', () => checkForUpdates())
  registerIpcHandler('update:download', () => downloadUpdate())
  registerIpcHandler('update:cancelDownload', () => cancelUpdateDownload())
  registerIpcHandler('update:openDownloadPage', (_event, version?: string) =>
    openUpdateDownloadPage(version)
  )
  registerIpcHandler('update:quitAndInstall', () => quitAndInstallUpdate())
}
