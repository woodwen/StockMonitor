import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { AppSettings } from '../preload/stock-api'
import { readLegacyTextFile, readSampleLegacyTextFile } from './file-utils'
import {
  clearRecentFiles,
  getRecentFiles,
  getSettings,
  rememberRecentFile,
  setCheckUpdatesOnStartup
} from './store'
import { checkForUpdates, downloadUpdate, quitAndInstallUpdate } from './update-manager'
import { logger } from './logger'

export function registerIpcHandlers(window: BrowserWindow): void {
  ipcMain.handle('stock:openLegacyTextFile', async () => {
    const result = await dialog.showOpenDialog(window, {
      title: '导入行情文本',
      properties: ['openFile'],
      filters: [
        { name: 'Text Files', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    logger.info('Opening legacy stock file', filePath)
    const payload = await readLegacyTextFile(filePath)
    rememberRecentFile(filePath)
    return payload
  })

  ipcMain.handle('stock:readSampleLegacyTextFile', async () => {
    const payload = await readSampleLegacyTextFile()
    logger.info('Loaded sample legacy stock file', payload.filePath)
    return payload
  })

  ipcMain.handle('stock:getRecentFiles', () => getRecentFiles())
  ipcMain.handle('stock:clearRecentFiles', () => clearRecentFiles())
  ipcMain.handle('settings:get', (): AppSettings => getSettings())
  ipcMain.handle('settings:setCheckUpdatesOnStartup', (_event, enabled: boolean): AppSettings => {
    return setCheckUpdatesOnStartup(Boolean(enabled))
  })
  ipcMain.handle('update:check', () => checkForUpdates())
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:quitAndInstall', () => quitAndInstallUpdate())
}
