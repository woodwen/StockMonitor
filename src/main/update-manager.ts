import type { BrowserWindow } from 'electron'
import { app, shell } from 'electron'
import { CancellationToken } from 'builder-util-runtime'
import electronUpdater from 'electron-updater'
import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import { logger } from './logger'
import { getElectronProxyRules } from './network-proxy'
import { getSettings } from './store'

const { autoUpdater } = electronUpdater
const RELEASES_URL = 'https://github.com/woodwen/StockMonitor/releases'
const MACOS_SIGNED_AUTO_UPDATE_ENABLED = false
const MACOS_MANUAL_DOWNLOAD_MESSAGE =
  '当前 macOS 安装包暂未签名，系统不支持应用内自动安装。请打开下载页下载最新版 DMG 后手动安装。'

type UpdateError = Error & {
  code?: string
}

interface DownloadUpdateOptions {
  forceAutomaticInstall?: boolean
}

let mainWindow: BrowserWindow | null = null
let downloadCancellationToken: CancellationToken | null = null
let downloadPromise: Promise<void> | null = null
let downloadCancellationNotified = false
let latestAvailableVersion: string | undefined

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
    latestAvailableVersion = info.version
    if (shouldUseManualMacUpdateInstall()) {
      sendManualDownloadEvent(info.version)
      return
    }
    sendUpdateEvent({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', (info) => {
    logger.info('No update available', info.version)
    latestAvailableVersion = undefined
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
    resetDownloadCancellation()
    logger.info('Update downloaded', info.version)
    sendUpdateEvent({ type: 'downloaded', version: info.version })
  })

  autoUpdater.on('update-cancelled', () => {
    resetDownloadCancellation()
    sendDownloadCancelledEvent()
  })

  autoUpdater.on('error', (error) => {
    if (isCancellationError(error)) {
      resetDownloadCancellation()
      sendDownloadCancelledEvent()
      return
    }

    resetDownloadCancellation()
    logger.error('Update error', error)
    sendUpdateEvent({ type: 'error', message: getUserFacingUpdateErrorMessage(error) })
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

  await applyUpdaterProxySettings()
  await autoUpdater.checkForUpdates()
}

export async function downloadUpdate(options: DownloadUpdateOptions = {}): Promise<void> {
  if (!app.isPackaged) {
    sendUpdateEvent({ type: 'error', message: '开发环境不下载更新包' })
    return
  }
  if (!options.forceAutomaticInstall && shouldUseManualMacUpdateInstall()) {
    sendManualDownloadEvent(latestAvailableVersion)
    return
  }
  if (downloadPromise) {
    await downloadPromise
    return
  }
  await applyUpdaterProxySettings()
  const cancellationToken = new CancellationToken()
  downloadCancellationToken = cancellationToken
  downloadCancellationNotified = false

  const promise = autoUpdater
    .downloadUpdate(cancellationToken)
    .then(() => undefined)
    .catch((error) => {
      if (isCancellationError(error)) {
        sendDownloadCancelledEvent()
        return
      }
      throw error
    })
    .finally(() => {
      if (downloadCancellationToken === cancellationToken) {
        downloadCancellationToken = null
      }
      if (downloadPromise === promise) {
        downloadPromise = null
      }
    })
  downloadPromise = promise
  await promise
}

export function cancelUpdateDownload(): void {
  if (!downloadCancellationToken || downloadCancellationToken.cancelled) {
    return
  }

  downloadCancellationToken.cancel()
  sendDownloadCancelledEvent()
}

export async function openUpdateDownloadPage(version?: string): Promise<void> {
  await shell.openExternal(getReleaseDownloadUrl(version ?? latestAvailableVersion))
}

export function quitAndInstallUpdate(): void {
  if (!app.isPackaged) {
    logger.info('Skipping quitAndInstall in development')
    return
  }
  autoUpdater.quitAndInstall()
}

export function shouldUseManualMacUpdateInstall(
  platform: NodeJS.Platform = process.platform,
  isPackaged = app.isPackaged,
  signedAutoUpdateEnabled = MACOS_SIGNED_AUTO_UPDATE_ENABLED
): boolean {
  return isPackaged && platform === 'darwin' && !signedAutoUpdateEnabled
}

export function getReleaseDownloadUrl(version?: string): string {
  if (!version) {
    return RELEASES_URL
  }

  return `${RELEASES_URL}/tag/v${encodeURIComponent(version)}`
}

function sendUpdateEvent(event: AppUpdateEvent): void {
  mainWindow?.webContents.send('update:event', event)
}

function sendManualDownloadEvent(version?: string): void {
  logger.info('macOS update requires manual download while builds are unsigned', version)
  sendUpdateEvent({
    type: 'manual-download',
    version,
    message: MACOS_MANUAL_DOWNLOAD_MESSAGE
  })
}

function sendDownloadCancelledEvent(): void {
  if (downloadCancellationNotified) {
    return
  }

  downloadCancellationNotified = true
  sendUpdateEvent({ type: 'cancelled' })
}

function resetDownloadCancellation(): void {
  downloadCancellationToken = null
  downloadPromise = null
}

async function applyUpdaterProxySettings(): Promise<void> {
  try {
    const proxyRules = getElectronProxyRules(getSettings().networkProxy)
    await autoUpdater.netSession.setProxy({ proxyRules })
  } catch (error) {
    logger.warn('Failed to configure updater proxy', error)
  }
}

function getUserFacingUpdateErrorMessage(error: UpdateError): string {
  const rawMessage = getRawUpdateErrorMessage(error)
  if (
    error.code === 'ERR_UPDATER_ZIP_FILE_NOT_FOUND' ||
    rawMessage.includes('ZIP file not provided')
  ) {
    return '更新包不完整，请下载最新版安装包或稍后再试'
  }

  if (isNetworkUpdateError(error, rawMessage)) {
    return `更新服务器连接失败，请检查网络连接，或在“网络代理”中启用可访问 GitHub 的代理后重试。${formatOriginalError(rawMessage)}`
  }

  return rawMessage || '更新检查失败，请稍后再试'
}

function isNetworkUpdateError(error: UpdateError, rawMessage: string): boolean {
  const networkErrorSignals = [
    'net::ERR_CONNECTION_CLOSED',
    'net::ERR_CONNECTION_RESET',
    'net::ERR_CONNECTION_TIMED_OUT',
    'net::ERR_INTERNET_DISCONNECTED',
    'net::ERR_NAME_NOT_RESOLVED',
    'net::ERR_NETWORK_CHANGED',
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EAI_AGAIN'
  ]
  const text = `${error.code ?? ''} ${rawMessage}`
  return networkErrorSignals.some((signal) => text.includes(signal))
}

function isCancellationError(error: unknown): boolean {
  return error instanceof Error && error.message === 'cancelled'
}

function getRawUpdateErrorMessage(error: UpdateError): string {
  return error.message || error.code || ''
}

function formatOriginalError(rawMessage: string): string {
  return rawMessage ? `（原始错误：${rawMessage}）` : ''
}
