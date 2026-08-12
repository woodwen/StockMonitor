import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, MenuCommand, StockApi } from '../src/preload/stock-api'
import type {
  StockDataset,
  StockDataSourceMeta,
  StockQuery,
  StockTimeshareDataset,
  StockTimeshareQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'
import { RootViewModel } from '../src/renderer/app/RootViewModel'

describe('RootViewModel', () => {
  let root: RootViewModel | undefined

  afterEach(() => {
    root?.dispose()
    root = undefined
    vi.unstubAllGlobals()
    vi.clearAllMocks()
  })

  it('opens and closes the user manual from the menu command', async () => {
    const stockApi = createFakeStockApi()
    vi.stubGlobal('window', { stockApi })
    root = new RootViewModel()

    await root.initialize()
    expect(root.isUserManualOpen).toBe(false)

    stockApi.emitMenuCommand('open-user-manual')
    expect(root.isUserManualOpen).toBe(true)

    root.closeUserManual()
    expect(root.isUserManualOpen).toBe(false)
  })
})

function createFakeStockApi(): StockApi & {
  emitMenuCommand(command: MenuCommand): void
} {
  let menuListener: ((command: MenuCommand) => void) | undefined
  const settings = createDefaultSettings()

  return {
    cancelUpdateDownload: vi.fn(async () => undefined),
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async () => undefined),
    fetchStockDataset: vi.fn(async (query: StockQuery) => createStockDataset(query)),
    fetchStockTimeshareDataset: vi.fn(async (query: StockTimeshareQuery) =>
      createTimeshareDataset(query)
    ),
    getSettings: vi.fn(async () => settings),
    getStockDataSources: vi.fn(async () => createDataSources()),
    onMenuCommand: vi.fn((callback: (command: MenuCommand) => void) => {
      menuListener = callback
      return () => {
        menuListener = undefined
      }
    }),
    onUpdateEvent: vi.fn(() => () => undefined),
    openUpdateDownloadPage: vi.fn(async () => undefined),
    quitAndInstallUpdate: vi.fn(async () => undefined),
    setCheckUpdatesOnStartup: vi.fn(async () => settings),
    setNetworkProxy: vi.fn(async () => settings),
    setWorkspaceSettings: vi.fn(async () => settings),
    emitMenuCommand(command: MenuCommand): void {
      menuListener?.(command)
    }
  }
}

function createDataSources(): StockDataSourceMeta[] {
  return [
    {
      id: 'eastmoney',
      name: '东方财富',
      capabilities: {
        periods: ['day', 'week', 'month', '5', '15', '30', '60'],
        adjusts: ['none', 'qfq', 'hfq'],
        markets: ['stock', 'etf', 'index'],
        timeshare: true
      }
    }
  ]
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
      viewMode: 'timeshare',
      timeshareSourceId: 'eastmoney',
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

function createStockDataset(query: StockQuery): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: query.symbol,
      name: '上证指数'
    },
    interval: 'day',
    columns: [],
    candles: [
      {
        timeKey: '20260810',
        timestamp: new Date(2026, 7, 10).getTime(),
        open: 10,
        high: 11,
        low: 9,
        close: 10.5,
        volume: 100,
        turnover: 1000
      }
    ],
    sourceId: query.sourceId,
    sourceName: '东方财富'
  }
}

function createTimeshareDataset(query: StockTimeshareQuery): StockTimeshareDataset {
  return {
    meta: {
      lineType: '分时',
      symbol: query.symbol,
      name: '上证指数'
    },
    previousClose: 10,
    points: [
      {
        timeKey: '202608100930',
        timestamp: new Date(2026, 7, 10, 9, 30).getTime(),
        price: 10.1,
        avgPrice: 10.05,
        volume: 100,
        turnover: 1000
      }
    ],
    sourceId: query.sourceId,
    sourceName: '东方财富'
  }
}
