import { describe, expect, it, vi } from 'vitest'
import type { AppSettings, StockApi } from '../src/preload/stock-api'
import type { AppUpdateEvent } from '../src/renderer/features/app-update/models/update-types'
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
})

function createFakeStockApi(): StockApi & {
  cancelUpdateDownload: ReturnType<typeof vi.fn>
  emitUpdateEvent(event: AppUpdateEvent): void
} {
  let updateListener: ((event: AppUpdateEvent) => void) | undefined
  const settings = createDefaultSettings()

  return {
    cancelUpdateDownload: vi.fn(async () => undefined),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    fetchStockDataset: vi.fn(),
    fetchStockTimeshareDataset: vi.fn(),
    getSettings: vi.fn(async () => settings),
    getStockDataSources: vi.fn(),
    onMenuCommand: vi.fn(() => () => undefined),
    onUpdateEvent: vi.fn((callback: (event: AppUpdateEvent) => void) => {
      updateListener = callback
      return () => {
        updateListener = undefined
      }
    }),
    quitAndInstallUpdate: vi.fn(async () => undefined),
    setCheckUpdatesOnStartup: vi.fn(async () => settings),
    setNetworkProxy: vi.fn(async () => settings),
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
    }
  }
}
