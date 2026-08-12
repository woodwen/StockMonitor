import { makeAutoObservable, runInAction } from 'mobx'
import type { AppSettings, StockApi } from '../../../../preload/stock-api'
import { createDefaultIndicatorSettings } from '../../stock-workspace/models/indicator-definitions'
import { createDefaultTimeshareIndicatorSettings } from '../../stock-workspace/models/timeshare-indicator-definitions'
import type { AppUpdateEvent, AppUpdateState } from '../models/update-types'

export class AppUpdateViewModel {
  state: AppUpdateState = {
    status: 'idle'
  }
  isDownloadDialogVisible = true
  settings: AppSettings = createDefaultAppSettings()
  private removeUpdateListener?: () => void

  constructor(private readonly stockApi: StockApi = window.stockApi) {
    makeAutoObservable<this, 'stockApi'>(this, { stockApi: false }, { autoBind: true })
  }

  async initialize(): Promise<void> {
    try {
      this.settings = await this.stockApi.getSettings()
    } catch (error) {
      console.warn('Failed to load app update settings', error)
    }
    this.removeUpdateListener = this.stockApi.onUpdateEvent(this.handleUpdateEvent)
  }

  dispose(): void {
    this.removeUpdateListener?.()
  }

  async checkForUpdates(): Promise<void> {
    await this.stockApi.checkForUpdates()
  }

  async downloadUpdate(): Promise<void> {
    this.isDownloadDialogVisible = true
    this.state = {
      status: 'downloading',
      message: '正在下载更新...',
      progress: createEmptyProgress()
    }

    try {
      await this.stockApi.downloadUpdate()
    } catch (error) {
      runInAction(() => {
        this.isDownloadDialogVisible = true
        this.state = {
          status: 'error',
          message: error instanceof Error ? error.message : '下载更新失败，请稍后再试'
        }
      })
    }
  }

  async cancelDownload(): Promise<void> {
    try {
      await this.stockApi.cancelUpdateDownload()
    } finally {
      runInAction(() => {
        this.isDownloadDialogVisible = true
        this.state = { status: 'idle' }
      })
    }
  }

  downloadInBackground(): void {
    this.isDownloadDialogVisible = false
  }

  async openManualDownloadPage(): Promise<void> {
    try {
      await this.stockApi.openUpdateDownloadPage(this.state.version)
      runInAction(() => {
        this.state = { status: 'idle' }
      })
    } catch (error) {
      runInAction(() => {
        this.state = {
          status: 'error',
          message: error instanceof Error ? error.message : '打开下载页失败，请稍后再试'
        }
      })
    }
  }

  async quitAndInstall(): Promise<void> {
    await this.stockApi.quitAndInstallUpdate()
  }

  async setCheckUpdatesOnStartup(enabled: boolean): Promise<void> {
    const settings = await this.stockApi.setCheckUpdatesOnStartup(enabled)
    runInAction(() => {
      this.settings = settings
    })
  }

  dismiss(): void {
    this.state = { status: 'idle' }
  }

  private handleUpdateEvent(event: AppUpdateEvent): void {
    runInAction(() => {
      switch (event.type) {
        case 'checking':
          this.state = { status: 'checking', message: '正在检查更新...' }
          break
        case 'available':
          this.isDownloadDialogVisible = true
          this.state = {
            status: 'available',
            version: event.version,
            message: `发现新版本 ${event.version}`
          }
          break
        case 'manual-download':
          this.isDownloadDialogVisible = true
          this.state = {
            status: 'manual-download',
            version: event.version,
            message: event.message
          }
          break
        case 'not-available':
          this.state = {
            status: 'not-available',
            version: event.version,
            message: '当前已经是最新版本'
          }
          break
        case 'progress':
          if (this.state.status !== 'downloading') {
            this.isDownloadDialogVisible = true
          }
          this.state = {
            status: 'downloading',
            message: '正在下载更新...',
            progress: event.progress
          }
          break
        case 'downloaded':
          this.isDownloadDialogVisible = true
          this.state = {
            status: 'downloaded',
            version: event.version,
            message: `版本 ${event.version} 已下载`
          }
          break
        case 'cancelled':
          this.isDownloadDialogVisible = true
          this.state = { status: 'idle' }
          break
        case 'error':
          this.isDownloadDialogVisible = true
          this.state = {
            status: 'error',
            message: event.message
          }
          break
      }
    })
  }
}

function createEmptyProgress() {
  return {
    percent: 0,
    transferred: 0,
    total: 0,
    bytesPerSecond: 0
  }
}

function createDefaultAppSettings(): AppSettings {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - 2)

  return {
    checkUpdatesOnStartup: true,
    networkProxy: {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    workspace: {
      viewMode: 'timeshare',
      timeshareSourceId: 'eastmoney',
      query: {
        sourceId: 'eastmoney',
        symbol: 'sh000001',
        period: 'day',
        adjust: 'qfq',
        startDate: formatDateKey(startDate),
        endDate: formatDateKey(endDate)
      },
      indicatorSettings: createDefaultIndicatorSettings(),
      timeshareIndicatorSettings: createDefaultTimeshareIndicatorSettings()
    }
  }
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
