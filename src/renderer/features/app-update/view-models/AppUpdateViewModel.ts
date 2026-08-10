import { makeAutoObservable, runInAction } from 'mobx'
import type { AppSettings, StockApi } from '../../../../preload/stock-api'
import type { AppUpdateEvent, AppUpdateState } from '../models/update-types'

export class AppUpdateViewModel {
  state: AppUpdateState = {
    status: 'idle'
  }
  settings: AppSettings = {
    checkUpdatesOnStartup: true
  }
  private removeUpdateListener?: () => void

  constructor(private readonly stockApi: StockApi = window.stockApi) {
    makeAutoObservable<this, 'stockApi'>(this, { stockApi: false }, { autoBind: true })
  }

  async initialize(): Promise<void> {
    this.settings = await this.stockApi.getSettings()
    this.removeUpdateListener = this.stockApi.onUpdateEvent(this.handleUpdateEvent)
  }

  dispose(): void {
    this.removeUpdateListener?.()
  }

  async checkForUpdates(): Promise<void> {
    await this.stockApi.checkForUpdates()
  }

  async downloadUpdate(): Promise<void> {
    await this.stockApi.downloadUpdate()
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
          this.state = {
            status: 'available',
            version: event.version,
            message: `发现新版本 ${event.version}`
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
          this.state = {
            status: 'downloading',
            message: '正在下载更新...',
            progress: event.progress
          }
          break
        case 'downloaded':
          this.state = {
            status: 'downloaded',
            version: event.version,
            message: `版本 ${event.version} 已下载`
          }
          break
        case 'error':
          this.state = {
            status: 'error',
            message: event.message
          }
          break
      }
    })
  }
}
