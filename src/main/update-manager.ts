import type { BrowserWindow } from 'electron'
import { app } from 'electron'
import electronUpdater from 'electron-updater'
import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import { logger } from './logger'

const { autoUpdater } = electronUpdater

let mainWindow: BrowserWindow | null = null

export function configureUpdateManager(window: BrowserWindow): void {
  mainWindow = window
  autoUpdater.autoDownload = false
  autoUpdater.logger = logger

  autoUpdater.on('checking-for-update', () => {
    logger.info('Checking for updates')
    sendUpdateEvent({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    logger.info('Update available', info.version)
    sendUpdateEvent({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    logger.info('No update available', info.version)
    sendUpdateEvent({ type: 'not-available', version: info.version })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendUpdateEvent({
      type: 'progress',
      progress: {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond
      }
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    logger.info('Update downloaded', info.version)
    sendUpdateEvent({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error) => {
    logger.error('Update error', error)
    sendUpdateEvent({ type: 'error', message: error.message })
  })
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    logger.info('Skipping real update check in development')
    sendUpdateEvent({ type: 'checking' })
    setTimeout(() => {
      sendUpdateEvent({ type: 'not-available', version: app.getVersion() })
    }, 400)
    return
  }

  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    sendUpdateEvent({ type: 'error', message: '开发环境不下载更新包' })
    return
  }
  await autoUpdater.downloadUpdate()
}

export function quitAndInstallUpdate(): void {
  if (!app.isPackaged) {
    logger.info('Skipping quitAndInstall in development')
    return
  }
  autoUpdater.quitAndInstall()
}

function sendUpdateEvent(event: AppUpdateEvent): void {
  mainWindow?.webContents.send('update:event', event)
}
