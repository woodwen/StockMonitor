import Store from 'electron-store'
import type { AppSettings } from '../preload/stock-api'
import type { RecentFileEntry } from '../renderer/features/stock-workspace/models/stock-types'

interface AppStoreSchema {
  recentFiles: RecentFileEntry[]
  settings: AppSettings
  windowBounds?: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

export const appStore = new Store<AppStoreSchema>({
  name: 'stock-monitor',
  defaults: {
    recentFiles: [],
    settings: {
      checkUpdatesOnStartup: true
    }
  }
})

export function getSettings(): AppSettings {
  return appStore.get('settings')
}

export function setCheckUpdatesOnStartup(enabled: boolean): AppSettings {
  const settings = {
    ...getSettings(),
    checkUpdatesOnStartup: enabled
  }
  appStore.set('settings', settings)
  return settings
}

export function getRecentFiles(): RecentFileEntry[] {
  return appStore.get('recentFiles')
}

export function clearRecentFiles(): void {
  appStore.set('recentFiles', [])
}

export function rememberRecentFile(filePath: string): void {
  const fileName = filePath.split(/[\\/]/).pop() ?? filePath
  const next: RecentFileEntry = {
    filePath,
    fileName,
    openedAt: Date.now()
  }

  const deduped = getRecentFiles().filter((item) => item.filePath !== filePath)
  appStore.set('recentFiles', [next, ...deduped].slice(0, 5))
}
