import type { AppUpdateEvent } from '../renderer/features/app-update/models/update-types'
import type { FileTextPayload, RecentFileEntry } from '../renderer/features/stock-workspace/models/stock-types'

export interface AppSettings {
  checkUpdatesOnStartup: boolean
}

export type MenuCommand = 'open-file' | 'load-sample' | 'check-update'

export interface StockApi {
  openLegacyTextFile(): Promise<FileTextPayload | null>
  readSampleLegacyTextFile(): Promise<FileTextPayload>
  getRecentFiles(): Promise<RecentFileEntry[]>
  clearRecentFiles(): Promise<void>
  getSettings(): Promise<AppSettings>
  setCheckUpdatesOnStartup(enabled: boolean): Promise<AppSettings>
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  quitAndInstallUpdate(): Promise<void>
  onUpdateEvent(callback: (event: AppUpdateEvent) => void): () => void
  onMenuCommand(callback: (command: MenuCommand) => void): () => void
}
