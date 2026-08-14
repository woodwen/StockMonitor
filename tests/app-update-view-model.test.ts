import { describe, expect, it, vi } from 'vitest'
import type { AppSettings, StockApi } from '../src/preload/stock-api'
import type { AppUpdateEvent } from '../src/renderer/features/app-update/models/update-types'
import { createDefaultTradeProfitSettings } from '../src/renderer/features/trade-profit-calculator/models/trade-profit'
import { AppUpdateViewModel } from '../src/renderer/features/app-update/view-models/AppUpdateViewModel'

describe('AppUpdateViewModel', () => {
  it('keeps update downloads running in the background when the dialog is hidden', async () => {
    const stockApi = createFakeStockApi()
    const viewModel = new AppUpdateViewModel(stockApi)
    await viewModel.initialize()

    stockApi.emitUpdateEvent({
      type: 'progress',
      progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }
    })
    expect(viewModel.state.status).toBe('downloading')
    expect(viewModel.isDownloadDialogVisible).toBe(true)

    viewModel.downloadInBackground()
    stockApi.emitUpdateEvent({
      type: 'progress',
      progress: { percent: 5, transferred: 1, total: 20, bytesPerSecond: 1 }
    })

    expect(viewModel.state.status).toBe('downloading')
    expect(viewModel.isDownloadDialogVisible).toBe(false)
  })

  it('cancels update downloads and leaves the downloading state', async () => {
    const stockApi = createFakeStockApi()
    const viewModel = new AppUpdateViewModel(stockApi)
    await viewModel.initialize()

    stockApi.emitUpdateEvent({
      type: 'progress',
      progress: { percent: 0, transferred: 0, total: 0, bytesPerSecond: 0 }
    })

    await viewModel.cancelDownload()

    expect(stockApi.cancelUpdateDownload).toHaveBeenCalledTimes(1)
    expect(viewModel.state.status).toBe('idle')
    expect(viewModel.isDownloadDialogVisible).toBe(true)
  })

  it('opens the release page for manual macOS updates', async () => {
    const stockApi = createFakeStockApi()
    const viewModel = new AppUpdateViewModel(stockApi)
    await viewModel.initialize()

    stockApi.emitUpdateEvent({
      type: 'manual-download',
      version: '0.1.6',
      message: '请手动下载最新版'
    })

    expect(viewModel.state.status).toBe('manual-download')

    await viewModel.openManualDownloadPage()

    expect(stockApi.openUpdateDownloadPage).toHaveBeenCalledWith('0.1.6')
    expect(viewModel.state.status).toBe('idle')
  })
})

function createFakeStockApi(): StockApi & {
  cancelUpdateDownload: ReturnType<typeof vi.fn>
  emitUpdateEvent(event: AppUpdateEvent): void
  openUpdateDownloadPage: ReturnType<typeof vi.fn>
} {
  let updateListener: ((event: AppUpdateEvent) => void) | undefined
  const settings = createDefaultSettings()

  return {
    cancelUpdateDownload: vi.fn(async () => undefined),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    fetchStockDataset: vi.fn(),
    fetchStockTimeshareDataset: vi.fn(),
    getKlineCacheStatus: vi.fn(async () => []),
    startKlineCacheRefresh: vi.fn(async () => ({
      id: 'job-1',
      status: 'completed' as const,
      total: 0,
      completed: 0,
      rows: [],
      startedAt: 1,
      finishedAt: 1
    })),
    getKlineCacheJob: vi.fn(async () => null),
    cancelKlineCacheJob: vi.fn(async () => null),
    getCachedKlineDataset: vi.fn(async (query) => ({
      status: 'empty' as const,
      query,
      missingRanges: []
    })),
    clearKlineCache: vi.fn(async () => []),
    exportLocalCacheBackup: vi.fn(async () => ({ status: 'cancelled' as const })),
    inspectLocalCacheBackup: vi.fn(async () => ({ status: 'cancelled' as const })),
    importLocalCacheBackup: vi.fn(async () => ({ status: 'error' as const })),
    getSettings: vi.fn(async () => settings),
    getStockDataSources: vi.fn(),
    onMenuCommand: vi.fn(() => () => undefined),
    onUpdateEvent: vi.fn((callback: (event: AppUpdateEvent) => void) => {
      updateListener = callback
      return () => {
        updateListener = undefined
      }
    }),
    openUpdateDownloadPage: vi.fn(async () => undefined),
    quitAndInstallUpdate: vi.fn(async () => undefined),
    setCheckUpdatesOnStartup: vi.fn(async () => settings),
    setNetworkProxy: vi.fn(async () => settings),
    setTradeProfitSettings: vi.fn(async () => settings),
    setWorkspaceSettings: vi.fn(async () => settings),
    emitUpdateEvent(event: AppUpdateEvent): void {
      updateListener?.(event)
    }
  }
}

function createDefaultSettings(): AppSettings {
  return {
    checkUpdatesOnStartup: true,
    networkProxy: {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    workspace: {
      query: {
        sourceId: 'eastmoney',
        symbol: 'sh000001',
        period: 'day',
        adjust: 'qfq',
        startDate: '20240811',
        endDate: '20260811'
      }
    },
    tradeProfit: createDefaultTradeProfitSettings()
  }
}
