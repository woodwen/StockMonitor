import { describe, expect, it } from 'vitest'
import {
  createLocalCacheBackupSummaryItems,
  formatLocalCacheBackupSettingsSections,
  getLocalCacheImportOkText,
  isLocalCacheImportDanger,
  LOCAL_CACHE_IMPORT_STRATEGY_OPTIONS
} from '../src/renderer/features/stock-workspace/views/LocalCachePortabilityModal'
import { createTopToolbarMoreMenuItems } from '../src/renderer/features/stock-workspace/views/TopToolbar'

describe('LocalCachePortabilityModal', () => {
  it('keeps local cache import and export entries in the toolbar more menu', () => {
    const labels = (createTopToolbarMoreMenuItems({
      activeSourceName: '东方财富',
      networkProxyEnabled: false,
      localCacheExporting: false,
      localCacheImportInspecting: false,
      localCacheImporting: false,
      checkUpdatesOnStartup: true,
      isCheckingForUpdates: false,
      onOpenSourceTestDialog: () => undefined,
      onOpenProxyDialog: () => undefined,
      onExportLocalCacheBackup: () => undefined,
      onInspectLocalCacheBackup: () => undefined,
      onCheckForUpdates: () => undefined,
      onSetCheckUpdatesOnStartup: () => undefined
    }) as Array<{ label?: unknown }>)
      .filter((item) => typeof item.label === 'string')
      .map((item) => item.label)

    expect(labels).toContain('导出缓存')
    expect(labels).toContain('导入缓存')
  })

  it('offers merge as the first import strategy and replace as an explicit option', () => {
    expect(LOCAL_CACHE_IMPORT_STRATEGY_OPTIONS).toEqual([
      { label: '合并导入', value: 'merge' },
      { label: '覆盖导入', value: 'replace' }
    ])
    expect(getLocalCacheImportOkText('merge')).toBe('导入')
    expect(getLocalCacheImportOkText('replace')).toBe('覆盖导入')
    expect(isLocalCacheImportDanger('merge')).toBe(false)
    expect(isLocalCacheImportDanger('replace')).toBe(true)
  })

  it('formats local cache backup settings sections for the confirmation summary', () => {
    expect(
      formatLocalCacheBackupSettingsSections([
        'checkUpdatesOnStartup',
        'networkProxy',
        'workspace',
        'tradeProfit'
      ])
    ).toBe('启动检查更新、网络代理、工作区、做T测算')
    expect(formatLocalCacheBackupSettingsSections([])).toBe('无')
  })

  it('creates result summary items with settings, cache count, bytes, and skipped count', () => {
    expect(
      createLocalCacheBackupSummaryItems({
        settingsSections: ['workspace', 'tradeProfit'],
        includesNetworkProxy: false,
        klineCacheEntryCount: 3,
        klineCacheBytes: 1536,
        skippedCount: 2,
        skippedItems: []
      })
    ).toEqual([
      { key: 'settings', label: '设置分区', children: '工作区、做T测算' },
      { key: 'kline', label: 'K 线缓存', children: '3 条' },
      { key: 'bytes', label: '缓存体积', children: '1.5 KB' },
      { key: 'skipped', label: '跳过项', children: '2 项' }
    ])
  })
})
