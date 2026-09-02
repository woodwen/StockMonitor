import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createTopToolbarMoreMenuItems,
  TopToolbar
} from '../src/renderer/features/stock-workspace/views/TopToolbar'

describe('TopToolbar', () => {
  it('keeps primary timeshare actions visible and hides the kline strategy entry', () => {
    const html = renderToStaticMarkup(createElement(TopToolbar, createToolbarProps()))

    expect(html).toContain('自选')
    expect(html).toContain('分时')
    expect(html).toContain('K线')
    expect(html).toContain('刷新')
    expect(html).toContain('指标')
    expect(html).toContain('做T')
    expect(html).toContain('AI')
    expect(html).toContain('更多')
    expect(html).toContain('上证指数')
    expect(html).not.toContain('策略')
  })

  it('shows kline parameters and the strategy entry only in kline mode', () => {
    const html = renderToStaticMarkup(
      createElement(TopToolbar, createToolbarProps({ viewMode: 'kline' }))
    )

    expect(html).toContain('20260801')
    expect(html).toContain('20260814')
    expect(html).toContain('策略')
  })

  it('creates the more menu entries and binds existing actions', () => {
    const callbacks = createMenuCallbacks()
    const items = createTopToolbarMoreMenuItems({
      activeSourceName: '东方财富',
      networkProxyEnabled: false,
      localCacheExporting: false,
      localCacheImportInspecting: false,
      localCacheImporting: false,
      checkUpdatesOnStartup: true,
      isCheckingForUpdates: false,
      aiConnectorStatusLabel: '未启用',
      ...callbacks
    })

    expect(menuKeys(items)).toEqual([
      'data-source',
      'network-proxy',
      'ai-settings',
      'cache-divider',
      'export-cache',
      'import-cache',
      'updates-divider',
      'check-updates',
      'check-updates-on-startup'
    ])
    expect(menuLabel(items, 'data-source')).toBe('数据源：东方财富')
    expect(menuLabel(items, 'network-proxy')).toBe('代理：直连')
    expect(menuLabel(items, 'ai-settings')).toBe('AI 设置：未启用')
    expect(menuLabel(items, 'export-cache')).toBe('导出缓存')
    expect(menuLabel(items, 'import-cache')).toBe('导入缓存')
    expect(menuLabel(items, 'check-updates')).toBe('检查更新')
    expect(menuLabel(items, 'check-updates-on-startup')).toBe('启动检查更新：已开启')

    menuItem(items, 'data-source').onClick?.({} as never)
    menuItem(items, 'network-proxy').onClick?.({} as never)
    menuItem(items, 'ai-settings').onClick?.({} as never)
    menuItem(items, 'export-cache').onClick?.({} as never)
    menuItem(items, 'import-cache').onClick?.({} as never)
    menuItem(items, 'check-updates').onClick?.({} as never)
    menuItem(items, 'check-updates-on-startup').onClick?.({} as never)

    expect(callbacks.onOpenSourceTestDialog).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenProxyDialog).toHaveBeenCalledTimes(1)
    expect(callbacks.onOpenAiSettings).toHaveBeenCalledTimes(1)
    expect(callbacks.onExportLocalCacheBackup).toHaveBeenCalledTimes(1)
    expect(callbacks.onInspectLocalCacheBackup).toHaveBeenCalledTimes(1)
    expect(callbacks.onCheckForUpdates).toHaveBeenCalledTimes(1)
    expect(callbacks.onSetCheckUpdatesOnStartup).toHaveBeenCalledWith(false)
  })

  it('keeps running more menu operations disabled with status labels', () => {
    const items = createTopToolbarMoreMenuItems({
      activeSourceName: '东方财富',
      networkProxyEnabled: true,
      localCacheExporting: true,
      localCacheImportInspecting: true,
      localCacheImporting: false,
      checkUpdatesOnStartup: false,
      isCheckingForUpdates: true,
      aiConnectorStatusLabel: '可用',
      ...createMenuCallbacks()
    })

    expect(menuLabel(items, 'network-proxy')).toBe('代理：已启用')
    expect(menuLabel(items, 'export-cache')).toBe('正在导出缓存')
    expect(menuItem(items, 'export-cache').disabled).toBe(true)
    expect(menuLabel(items, 'import-cache')).toBe('正在检查备份')
    expect(menuItem(items, 'import-cache').disabled).toBe(true)
    expect(menuLabel(items, 'check-updates')).toBe('正在检查更新')
    expect(menuItem(items, 'check-updates').disabled).toBe(true)
    expect(menuLabel(items, 'check-updates-on-startup')).toBe('启动检查更新：已关闭')
  })
})

function createToolbarProps(patch: { viewMode?: 'timeshare' | 'kline' } = {}) {
  return {
    stock: createToolbarStockViewModel(patch) as any,
    updates: {
      state: { status: 'idle' },
      checkForUpdates: () => undefined,
      settings: { checkUpdatesOnStartup: true },
      setCheckUpdatesOnStartup: () => undefined
    } as any,
    tradeProfit: {
      openCalculator: () => undefined
    } as any
  }
}

function createToolbarStockViewModel(patch: { viewMode?: 'timeshare' | 'kline' } = {}) {
  return {
    query: {
      sourceId: 'eastmoney',
      symbol: 'sh000001',
      period: 'day',
      adjust: 'qfq',
      startDate: '20260801',
      endDate: '20260814'
    },
    setSymbol: () => undefined,
    refreshStock: () => undefined,
    isCurrentSymbolWatched: false,
    watchlist: [],
    watchlistOpen: false,
    toggleWatchlistOpen: () => undefined,
    viewMode: patch.viewMode ?? 'timeshare',
    setViewMode: () => undefined,
    availablePeriodOptions: [{ label: '日线', value: 'day' }],
    setPeriod: () => undefined,
    availableAdjustOptions: [{ label: '前复权', value: 'qfq' }],
    setAdjust: () => undefined,
    setStartDate: () => undefined,
    setEndDate: () => undefined,
    loading: false,
    activeSourceName: '东方财富',
    openSourceTestDialog: () => undefined,
    networkProxy: { enabled: false },
    openProxyDialog: () => undefined,
    aiConnectorStatusLabel: '未启用',
    openAiAnalysisPanel: () => undefined,
    openAiSettings: () => undefined,
    localCacheExporting: false,
    exportLocalCacheBackup: () => undefined,
    localCacheImportInspecting: false,
    localCacheImporting: false,
    inspectLocalCacheBackup: () => undefined,
    openStrategyPanel: () => undefined,
    activeTitle: '上证指数',
    openIndicatorDialog: () => undefined
  }
}

function createMenuCallbacks() {
  return {
    onOpenSourceTestDialog: vi.fn(),
    onOpenProxyDialog: vi.fn(),
    onOpenAiSettings: vi.fn(),
    onExportLocalCacheBackup: vi.fn(),
    onInspectLocalCacheBackup: vi.fn(),
    onCheckForUpdates: vi.fn(),
    onSetCheckUpdatesOnStartup: vi.fn()
  }
}

function menuKeys(items: NonNullable<ReturnType<typeof createTopToolbarMoreMenuItems>>): string[] {
  return items.map((item) => String(item?.key))
}

function menuItem(
  items: NonNullable<ReturnType<typeof createTopToolbarMoreMenuItems>>,
  key: string
): any {
  return items.find((item) => item?.key === key)
}

function menuLabel(
  items: NonNullable<ReturnType<typeof createTopToolbarMoreMenuItems>>,
  key: string
): string {
  return String(menuItem(items, key).label)
}
