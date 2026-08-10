import type { FileTextPayload, RecentFileEntry } from '../models/stock-types'

export interface StockFileAdapter {
  openLegacyTextFile(): Promise<FileTextPayload | null>
  readSampleLegacyTextFile(): Promise<FileTextPayload>
  getRecentFiles(): Promise<RecentFileEntry[]>
  clearRecentFiles(): Promise<void>
}

export class ElectronFileAdapter implements StockFileAdapter {
  openLegacyTextFile(): Promise<FileTextPayload | null> {
    return window.stockApi.openLegacyTextFile()
  }

  readSampleLegacyTextFile(): Promise<FileTextPayload> {
    return window.stockApi.readSampleLegacyTextFile()
  }

  getRecentFiles(): Promise<RecentFileEntry[]> {
    return window.stockApi.getRecentFiles()
  }

  clearRecentFiles(): Promise<void> {
    return window.stockApi.clearRecentFiles()
  }
}
