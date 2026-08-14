import { randomUUID } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { app, dialog } from 'electron'
import type {
  AppSettings,
  LocalCacheBackupExportResult,
  LocalCacheBackupImportRequest,
  LocalCacheBackupImportResult,
  LocalCacheBackupImportStrategy,
  LocalCacheBackupInspectResult,
  LocalCacheBackupSection,
  LocalCacheBackupSkippedItem,
  LocalCacheBackupSummary
} from '../preload/stock-api'
import {
  getDefaultKlineCacheService,
  type KlineCacheFile,
  type KlineCacheImportEntriesResult,
  type KlineCacheService,
  type KlineCacheSkippedEntry
} from './kline-cache'
import { getSettings, setSettings } from './store'
import { logger } from './logger'

interface LocalCacheBackupFile {
  schemaVersion: 1
  appId: typeof STOCK_MONITOR_APP_ID
  createdAt: string
  appVersion: string
  sections: LocalCacheBackupSection[]
  settings: Partial<AppSettings>
  klineCache: {
    version: 1
    entries: unknown[]
  }
}

interface DialogSaveResult {
  canceled: boolean
  filePath?: string
}

interface DialogOpenResult {
  canceled: boolean
  filePaths: string[]
}

interface LocalCachePortabilityServiceOptions {
  getSettings?: () => AppSettings
  setSettings?: (settings: Partial<AppSettings> | undefined) => AppSettings
  klineCacheService?: KlineCacheService
  getAppVersion?: () => string
  now?: () => Date
  showSaveDialog?: (defaultPath: string) => Promise<DialogSaveResult>
  showOpenDialog?: () => Promise<DialogOpenResult>
}

interface ImportSession {
  filePath: string
  summary: LocalCacheBackupSummary
}

const STOCK_MONITOR_APP_ID = 'com.stockmonitor.desktop'
const BACKUP_SCHEMA_VERSION = 1
const BACKUP_FILE_EXTENSION = '.stock-monitor-backup.json'

let defaultService: LocalCachePortabilityService | undefined

export class LocalCachePortabilityService {
  private readonly importSessions = new Map<string, ImportSession>()
  private readonly getSettingsSnapshot: () => AppSettings
  private readonly persistSettings: (settings: Partial<AppSettings> | undefined) => AppSettings
  private readonly klineCacheService: KlineCacheService
  private readonly getAppVersion: () => string
  private readonly now: () => Date
  private readonly showSaveDialog: (defaultPath: string) => Promise<DialogSaveResult>
  private readonly showOpenDialog: () => Promise<DialogOpenResult>

  constructor(options: LocalCachePortabilityServiceOptions = {}) {
    this.getSettingsSnapshot = options.getSettings ?? getSettings
    this.persistSettings = options.setSettings ?? setSettings
    this.klineCacheService = options.klineCacheService ?? getDefaultKlineCacheService()
    this.getAppVersion = options.getAppVersion ?? (() => app.getVersion())
    this.now = options.now ?? (() => new Date())
    this.showSaveDialog =
      options.showSaveDialog ??
      ((defaultPath) =>
        dialog.showSaveDialog({
          title: '导出本地缓存',
          defaultPath,
          filters: [{ name: 'Stock Monitor Backup', extensions: ['json'] }]
        }))
    this.showOpenDialog =
      options.showOpenDialog ??
      (() =>
        dialog.showOpenDialog({
          title: '导入本地缓存',
          properties: ['openFile'],
          filters: [{ name: 'Stock Monitor Backup', extensions: ['json'] }]
        }))
  }

  async exportBackup(): Promise<LocalCacheBackupExportResult> {
    const dialogResult = await this.showSaveDialog(this.createDefaultBackupFileName())
    if (dialogResult.canceled || !dialogResult.filePath) {
      return { status: 'cancelled' }
    }
    return this.exportBackupToPath(dialogResult.filePath)
  }

  async exportBackupToPath(filePath: string): Promise<LocalCacheBackupExportResult> {
    try {
      const settings = this.getSettingsSnapshot()
      const klineCache = await this.klineCacheService.exportEntries()
      const backup: LocalCacheBackupFile = {
        schemaVersion: BACKUP_SCHEMA_VERSION,
        appId: STOCK_MONITOR_APP_ID,
        createdAt: this.now().toISOString(),
        appVersion: this.getAppVersion(),
        sections: ['settings', 'klineCache'],
        settings,
        klineCache: {
          version: 1,
          entries: klineCache.entries
        }
      }
      const summary = createSummary({
        settings,
        klineCacheEntryCount: klineCache.entries.length,
        klineCacheBytes: klineCache.totalBytes,
        skippedItems: mapKlineCacheSkippedItems(klineCache.skippedEntries)
      })

      await writeFile(filePath, `${JSON.stringify(backup, null, 2)}\n`, 'utf8')
      return {
        status: 'success',
        filePath,
        summary
      }
    } catch (error) {
      logger.warn('Failed to export local cache backup', error)
      return {
        status: 'error',
        filePath,
        message: formatErrorMessage(error)
      }
    }
  }

  async inspectBackup(): Promise<LocalCacheBackupInspectResult> {
    const dialogResult = await this.showOpenDialog()
    const filePath = dialogResult.filePaths[0]
    if (dialogResult.canceled || !filePath) {
      return { status: 'cancelled' }
    }
    return this.inspectBackupFile(filePath)
  }

  async inspectBackupFile(filePath: string): Promise<LocalCacheBackupInspectResult> {
    try {
      const backup = await this.readBackupFile(filePath)
      const summary = this.createImportSummary(backup)
      const importToken = randomUUID()
      this.importSessions.clear()
      this.importSessions.set(importToken, {
        filePath,
        summary
      })
      return {
        status: 'ready',
        importToken,
        filePath,
        summary
      }
    } catch (error) {
      return {
        status: 'error',
        filePath,
        message: formatErrorMessage(error)
      }
    }
  }

  async importBackup(request: LocalCacheBackupImportRequest): Promise<LocalCacheBackupImportResult> {
    const session = this.importSessions.get(request.importToken)
    if (!session) {
      return {
        status: 'error',
        message: '导入会话已过期，请重新选择备份文件'
      }
    }

    let klineCacheResult: KlineCacheImportEntriesResult | undefined
    let strategy: LocalCacheBackupImportStrategy = 'merge'
    let summary = session.summary
    try {
      const backup = await this.readBackupFile(session.filePath)
      summary = this.createImportSummary(backup)
      strategy = normalizeImportStrategy(request.strategy)
      klineCacheResult = await this.klineCacheService.importEntries(backup.klineCache.entries, strategy)
      const settings = this.persistSettings(this.createSettingsForImport(backup.settings, strategy))
      const resultSummary = createImportResultSummary(summary, strategy, klineCacheResult)
      return {
        status: 'success',
        settings,
        summary: resultSummary
      }
    } catch (error) {
      logger.warn('Failed to import local cache backup', error)
      return {
        status: 'error',
        message: formatErrorMessage(error),
        summary: klineCacheResult
          ? createImportResultSummary(summary, strategy, klineCacheResult)
          : undefined
      }
    } finally {
      this.importSessions.delete(request.importToken)
    }
  }

  private async readBackupFile(filePath: string): Promise<LocalCacheBackupFile> {
    const content = await readFile(filePath, 'utf8')
    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error('备份文件不是合法 JSON')
    }
    return normalizeBackupFile(parsed)
  }

  private createImportSummary(backup: LocalCacheBackupFile): LocalCacheBackupSummary {
    const preview = this.klineCacheService.inspectImportEntries(backup.klineCache.entries)
    return createSummary({
      settings: backup.settings,
      klineCacheEntryCount: preview.validEntries.length,
      klineCacheBytes: estimateEntriesBytes(preview.validEntries),
      skippedItems: mapKlineCacheSkippedItems(preview.skippedEntries)
    })
  }

  private createSettingsForImport(
    backupSettings: Partial<AppSettings>,
    strategy: LocalCacheBackupImportStrategy
  ): Partial<AppSettings> {
    if (strategy === 'replace') {
      return backupSettings
    }
    return {
      ...this.getSettingsSnapshot(),
      ...backupSettings
    }
  }

  private createDefaultBackupFileName(): string {
    const date = this.now().toISOString().slice(0, 10).replace(/-/g, '')
    return `stock-monitor-${date}${BACKUP_FILE_EXTENSION}`
  }
}

export function createLocalCachePortabilityService(
  options: LocalCachePortabilityServiceOptions = {}
): LocalCachePortabilityService {
  return new LocalCachePortabilityService(options)
}

export function exportLocalCacheBackup(): Promise<LocalCacheBackupExportResult> {
  return getDefaultService().exportBackup()
}

export function inspectLocalCacheBackup(): Promise<LocalCacheBackupInspectResult> {
  return getDefaultService().inspectBackup()
}

export function importLocalCacheBackup(
  request: LocalCacheBackupImportRequest
): Promise<LocalCacheBackupImportResult> {
  return getDefaultService().importBackup(request)
}

function getDefaultService(): LocalCachePortabilityService {
  if (!defaultService) {
    defaultService = new LocalCachePortabilityService()
  }
  return defaultService
}

function normalizeBackupFile(value: unknown): LocalCacheBackupFile {
  if (!isObject(value)) {
    throw new Error('备份文件格式无效')
  }
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    throw new Error('备份文件版本不兼容')
  }
  if (value.appId !== STOCK_MONITOR_APP_ID) {
    throw new Error('备份文件不属于 Stock Monitor')
  }
  if (!('createdAt' in value) || !('appVersion' in value)) {
    throw new Error('备份文件缺少必需顶层字段')
  }
  if (!isString(value.createdAt) || !isString(value.appVersion)) {
    throw new Error('备份文件顶层字段格式无效')
  }
  if (!Array.isArray(value.sections)) {
    throw new Error('备份文件缺少数据分区')
  }
  const sections = value.sections.filter(isBackupSection)
  if (!sections.includes('settings') || !sections.includes('klineCache')) {
    throw new Error('备份文件缺少必需数据分区')
  }
  if (!isObject(value.settings)) {
    throw new Error('备份文件设置分区格式无效')
  }
  if (!isObject(value.klineCache) || value.klineCache.version !== 1 || !Array.isArray(value.klineCache.entries)) {
    throw new Error('备份文件 K 线缓存分区格式无效')
  }

  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appId: STOCK_MONITOR_APP_ID,
    createdAt: value.createdAt,
    appVersion: value.appVersion,
    sections,
    settings: value.settings as Partial<AppSettings>,
    klineCache: {
      version: 1,
      entries: value.klineCache.entries
    }
  }
}

function createSummary(input: {
  settings: Partial<AppSettings>
  klineCacheEntryCount: number
  klineCacheBytes: number
  skippedItems: LocalCacheBackupSkippedItem[]
}): LocalCacheBackupSummary {
  return {
    settingsSections: getSettingsSections(input.settings),
    includesNetworkProxy: isObject(input.settings.networkProxy),
    klineCacheEntryCount: input.klineCacheEntryCount,
    klineCacheBytes: input.klineCacheBytes,
    skippedCount: input.skippedItems.length,
    skippedItems: input.skippedItems
  }
}

function createImportResultSummary(
  baseSummary: LocalCacheBackupSummary,
  strategy: LocalCacheBackupImportStrategy,
  result: KlineCacheImportEntriesResult
): LocalCacheBackupImportResult['summary'] {
  const skippedItems = [
    ...baseSummary.skippedItems,
    ...mapKlineCacheSkippedItems(result.skippedEntries)
  ]
  const dedupedSkippedItems = dedupeSkippedItems(skippedItems)
  return {
    ...baseSummary,
    strategy,
    klineCacheEntryCount: result.importedCount,
    skippedCount: dedupedSkippedItems.length,
    skippedItems: dedupedSkippedItems,
    importedKlineCacheEntryCount: result.importedCount,
    removedKlineCacheEntryCount: result.removedCount
  }
}

function getSettingsSections(settings: Partial<AppSettings>): string[] {
  const sections: string[] = []
  if ('checkUpdatesOnStartup' in settings) {
    sections.push('checkUpdatesOnStartup')
  }
  if ('networkProxy' in settings) {
    sections.push('networkProxy')
  }
  if ('workspace' in settings) {
    sections.push('workspace')
  }
  if ('tradeProfit' in settings) {
    sections.push('tradeProfit')
  }
  return sections
}

function mapKlineCacheSkippedItems(entries: KlineCacheSkippedEntry[]): LocalCacheBackupSkippedItem[] {
  return entries.map((entry) => ({
    section: 'klineCache',
    itemId: entry.seriesKey ?? entry.fileName,
    reason: entry.reason
  }))
}

function dedupeSkippedItems(items: LocalCacheBackupSkippedItem[]): LocalCacheBackupSkippedItem[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.section}:${item.itemId ?? ''}:${item.reason}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function estimateEntriesBytes(entries: KlineCacheFile[]): number {
  return Buffer.byteLength(JSON.stringify(entries), 'utf8')
}

function normalizeImportStrategy(strategy: LocalCacheBackupImportStrategy): LocalCacheBackupImportStrategy {
  return strategy === 'replace' ? 'replace' : 'merge'
}

function isBackupSection(value: unknown): value is LocalCacheBackupSection {
  return value === 'settings' || value === 'klineCache'
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
