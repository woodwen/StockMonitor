import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings, NetworkProxySettings, WorkspaceSettings } from '../src/preload/stock-api'
import type { StockDataAdapter } from '../src/renderer/features/stock-workspace/adapters/ElectronStockDataAdapter'
import { createDefaultIndicatorSettings } from '../src/renderer/features/stock-workspace/models/indicator-definitions'
import type {
  StockDataset,
  StockDataSourceMeta,
  StockQuery,
  StockTimeshareQuery
} from '../src/renderer/features/stock-workspace/models/stock-types'
import { StockWorkspaceViewModel } from '../src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel'

class FakeDataAdapter implements StockDataAdapter {
  private settings: AppSettings = createDefaultSettings()
  savedWorkspaceSettings: WorkspaceSettings[] = []
  stockQueries: StockQuery[] = []
  timeshareQueries: StockTimeshareQuery[] = []

  constructor(private readonly failingSourceIds: string[] = [], settings?: AppSettings) {
    if (settings) {
      this.settings = settings
    }
  }

  async getStockDataSources(): Promise<StockDataSourceMeta[]> {
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
      },
      {
        id: 'tencent',
        name: '腾讯/QQ 财经',
        capabilities: {
          periods: ['day', 'week', 'month'],
          adjusts: ['none', 'qfq', 'hfq'],
          markets: ['stock', 'etf', 'index'],
          timeshare: true
        }
      },
      {
        id: 'sina',
        name: '新浪财经',
        capabilities: {
          periods: ['day', 'week'],
          adjusts: ['none'],
          markets: ['stock', 'etf', 'index'],
          timeshare: false
        }
      },
      {
        id: 'netease163',
        name: '网易财经 163',
        capabilities: {
          periods: ['day'],
          adjusts: ['none'],
          markets: ['stock'],
          timeshare: false
        }
      }
    ]
  }

  async fetchStockDataset(query: StockQuery) {
    this.stockQueries.push(query)
    if (this.failingSourceIds.includes(query.sourceId)) {
      throw new Error(`${query.sourceId} failed`)
    }

    return {
      ...createSampleStockDataset(),
      sourceId: query.sourceId,
      sourceName: sourceNameById[query.sourceId],
      adjust: query.adjust
    }
  }

  async fetchStockTimeshareDataset(query: StockTimeshareQuery) {
    this.timeshareQueries.push(query)
    if (this.failingSourceIds.includes(query.sourceId)) {
      throw new Error(`${query.sourceId} failed`)
    }

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
        },
        {
          timeKey: '202608100931',
          timestamp: new Date(2026, 7, 10, 9, 31).getTime(),
          price: 10.2,
          avgPrice: 10.08,
          volume: 120,
          turnover: 1224
        }
      ],
      sourceId: query.sourceId,
      sourceName: sourceNameById[query.sourceId],
      sourceUrl: 'https://example.com/timeshare'
    }
  }

  async getSettings(): Promise<AppSettings> {
    return this.settings
  }

  async setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings> {
    this.settings = {
      ...this.settings,
      networkProxy: proxy
    }
    return this.settings
  }

  async setWorkspaceSettings(workspace: WorkspaceSettings): Promise<AppSettings> {
    this.savedWorkspaceSettings.push(workspace)
    this.settings = {
      ...this.settings,
      workspace
    }
    return this.settings
  }
}

const sourceNameById: Record<StockQuery['sourceId'], string> = {
  eastmoney: '东方财富',
  sina: '新浪财经',
  netease163: '网易财经 163',
  tencent: '腾讯/QQ 财经'
}

afterEach(() => {
  vi.useRealTimers()
})

describe('StockWorkspaceViewModel', () => {
  it('loads default timeshare data into timeshare state', async () => {
    const viewModel = new StockWorkspaceViewModel(new FakeDataAdapter())

    await viewModel.initialize()

    expect(viewModel.viewMode).toBe('timeshare')
    expect(viewModel.timeshare.dataset?.meta.name).toBe('上证指数')
    expect(viewModel.recordCount).toBe(2)
    expect(viewModel.status).toBe('success')
    expect(viewModel.selectedSourceName).toBe('东方财富')
  })

  it('falls back to Tencent during startup when Eastmoney fails', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter(['eastmoney'], createKlineSettings())
    )

    await viewModel.initialize()

    expect(viewModel.status).toBe('success')
    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.selectedSourceName).toBe('腾讯/QQ 财经')
  })

  it('tests all data sources and records request status', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter(['eastmoney'], createKlineSettings())
    )

    await viewModel.initialize()
    await viewModel.testDataSources()
    viewModel.openSourceTestDialog()

    expect(viewModel.sourceTestOpen).toBe(true)
    expect(viewModel.sourceTestRunning).toBe(false)
    expect(viewModel.sourceTestResults).toHaveLength(4)
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'eastmoney')).toMatchObject({
      status: 'error',
      message: 'eastmoney failed'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'tencent')).toMatchObject({
      status: 'success',
      recordCount: expect.any(Number)
    })
  })

  it('normalizes query options when switching data sources', async () => {
    const viewModel = new StockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.setSourceId('sina')

    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.query.adjust).toBe('none')
  })

  it('restores cached workspace query and indicator settings on startup', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          query: {
            sourceId: 'sina',
            symbol: 'sz000002',
            period: 'month',
            adjust: 'hfq',
            startDate: '20250101',
            endDate: '20251231'
          },
          viewMode: 'kline',
          enabledIndicators: {
            boll: false,
            volumeMa: true,
            bsSignal: false
          }
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.query).toEqual({
      sourceId: 'sina',
      symbol: 'sz000002',
      period: 'day',
      adjust: 'none',
      startDate: '20250101',
      endDate: '20251231'
    })
    expect(viewModel.chart.indicatorSettings.boll.enabled).toBe(false)
    expect(viewModel.chart.indicatorSettings.volumeMa.enabled).toBe(true)
    expect(viewModel.chart.indicatorSettings.bsSignal.enabled).toBe(false)
    expect(viewModel.chart.indicatorSettings.macd.enabled).toBe(false)
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
  })

  it('restores timeshare mode and loads timeshare data on startup', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare'
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.viewMode).toBe('timeshare')
    expect(viewModel.timeshare.dataset?.meta.lineType).toBe('分时')
    expect(viewModel.recordCount).toBe(2)
    expect(viewModel.latestSummary).toContain('价 10.20')
  })

  it('restores cached Tencent timeshare source on startup', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare',
          timeshareSourceId: 'tencent'
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.timeshare.dataset?.sourceId).toBe('tencent')
  })

  it('does not reuse a legacy kline source as the default timeshare source', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: undefined,
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
  })

  it('falls back unsupported cached timeshare source without changing the kline source', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'sina',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
  })

  it('tests timeshare-capable sources in timeshare mode', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'timeshare'
        }
      })
    )

    await viewModel.initialize()
    await viewModel.testDataSources()

    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'eastmoney')).toMatchObject({
      status: 'success',
      recordCount: 2,
      requestLabel: 'sh000001 分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'tencent')).toMatchObject({
      status: 'success',
      recordCount: 2,
      requestLabel: 'sh000001 分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'sina')).toMatchObject({
      status: 'error',
      message: '不支持分时'
    })
    expect(viewModel.sourceTestResults.find((result) => result.sourceId === 'netease163')).toMatchObject({
      status: 'error',
      message: '不支持分时'
    })
  })

  it('keeps kline source and timeshare source independent when refreshing timeshare', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'eastmoney',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.timeshareQueries.at(-1)?.sourceId).toBe('eastmoney')
    expect(viewModel.activeSourceName).toBe('东方财富')
  })

  it('keeps Tencent timeshare source independent while refreshing Sina kline data', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'kline',
        timeshareSourceId: 'tencent',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'sina'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(adapter.stockQueries.at(-1)?.sourceId).toBe('sina')
    expect(adapter.timeshareQueries).toHaveLength(0)
    expect(viewModel.query.sourceId).toBe('sina')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.activeSourceName).toBe('新浪财经')
  })

  it('keeps Netease kline source independent while refreshing Tencent timeshare data', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        timeshareSourceId: 'tencent',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'netease163',
          symbol: 'sh600519'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()

    expect(adapter.stockQueries).toHaveLength(0)
    expect(adapter.timeshareQueries.at(-1)).toMatchObject({
      sourceId: 'tencent',
      symbol: 'sh600519'
    })
    expect(viewModel.query.sourceId).toBe('netease163')
    expect(viewModel.query.period).toBe('day')
    expect(viewModel.query.adjust).toBe('none')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(viewModel.activeSourceName).toBe('腾讯/QQ 财经')
  })

  it('uses the current view mode when marking the active source', async () => {
    const viewModel = new StockWorkspaceViewModel(
      new FakeDataAdapter([], {
        ...createDefaultSettings(),
        workspace: {
          ...createDefaultSettings().workspace,
          viewMode: 'kline',
          timeshareSourceId: 'tencent',
          query: {
            ...createDefaultSettings().workspace.query,
            sourceId: 'sina'
          }
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.isSourceActiveForCurrentMode('sina')).toBe(true)
    expect(viewModel.isSourceActiveForCurrentMode('tencent')).toBe(false)
    expect(viewModel.selectedKlineSourceName).toBe('新浪财经')
    expect(viewModel.selectedTimeshareSourceName).toBe('腾讯/QQ 财经')
    expect(viewModel.activeSourceName).toBe('新浪财经')
  })

  it('switches only the kline source in kline mode', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSourceId('netease163')

    expect(viewModel.query.sourceId).toBe('netease163')
    expect(viewModel.query.period).toBe('day')
    expect(viewModel.query.adjust).toBe('none')
    expect(viewModel.timeshareSourceId).toBe('eastmoney')
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        sourceId: 'netease163',
        period: 'day',
        adjust: 'none'
      },
      timeshareSourceId: 'eastmoney'
    })
  })

  it('switches only the timeshare source in timeshare mode and rejects unsupported sources', async () => {
    const adapter = new FakeDataAdapter([], {
      ...createDefaultSettings(),
      workspace: {
        ...createDefaultSettings().workspace,
        viewMode: 'timeshare',
        query: {
          ...createDefaultSettings().workspace.query,
          sourceId: 'tencent'
        }
      }
    })
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSourceId('tencent')

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('tencent')

    viewModel.setSourceId('sina')

    expect(viewModel.query.sourceId).toBe('tencent')
    expect(viewModel.timeshareSourceId).toBe('tencent')
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        sourceId: 'tencent'
      },
      timeshareSourceId: 'tencent'
    })
  })

  it('saves workspace settings when users change controls', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setPeriod('week')
    viewModel.toggleIndicator('boll', false)

    expect(adapter.savedWorkspaceSettings).toHaveLength(2)
    expect(adapter.savedWorkspaceSettings.at(-1)).toMatchObject({
      query: {
        period: 'week'
      },
      indicatorSettings: {
        boll: {
          enabled: false
        }
      }
    })
  })

  it('debounces workspace saves for text inputs', async () => {
    vi.useFakeTimers()
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.setSymbol('s')
    viewModel.setSymbol('sz')
    viewModel.setSymbol('sz000002')

    expect(adapter.savedWorkspaceSettings).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(500)

    expect(adapter.savedWorkspaceSettings).toHaveLength(1)
    expect(adapter.savedWorkspaceSettings[0].query.symbol).toBe('sz000002')
  })

  it('saves proxy settings from the workspace state', async () => {
    const viewModel = new StockWorkspaceViewModel(new FakeDataAdapter([], createKlineSettings()))

    await viewModel.initialize()
    viewModel.openProxyDialog()
    viewModel.setProxyEnabled(true)
    viewModel.setProxyProtocol('http')
    viewModel.setProxyHost('localhost')
    viewModel.setProxyPort(8080)
    await viewModel.saveProxySettings()

    expect(viewModel.proxyDialogOpen).toBe(false)
    expect(viewModel.networkProxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'localhost',
      port: 8080
    })
  })

  it('toggles chart indicators', () => {
    const viewModel = new StockWorkspaceViewModel(new FakeDataAdapter())

    viewModel.toggleIndicator('boll', false)

    expect(viewModel.chart.indicatorSettings.boll.enabled).toBe(false)
  })

  it('applies indicator dialog drafts and saves indicator params', async () => {
    const adapter = new FakeDataAdapter([], createKlineSettings())
    const viewModel = new StockWorkspaceViewModel(adapter)

    await viewModel.initialize()
    viewModel.openIndicatorDialog()
    viewModel.chart.setIndicatorDraftParam('boll', 0, 30)
    viewModel.chart.setIndicatorDraftEnabled('macd', true)
    viewModel.applyIndicatorSettingsDraft()

    expect(viewModel.chart.indicatorDialogOpen).toBe(false)
    expect(viewModel.chart.indicatorSettings.boll.params).toEqual([30, 2])
    expect(viewModel.chart.indicatorSettings.macd.enabled).toBe(true)
    expect(adapter.savedWorkspaceSettings.at(-1)?.indicatorSettings?.boll.params).toEqual([30, 2])
  })

  it('prevents enabling more than three sub indicators in the draft', () => {
    const viewModel = new StockWorkspaceViewModel(new FakeDataAdapter())

    viewModel.openIndicatorDialog()
    viewModel.chart.setIndicatorDraftEnabled('macd', true)
    viewModel.chart.setIndicatorDraftEnabled('kdj', true)
    viewModel.chart.setIndicatorDraftEnabled('rsi', true)

    expect(viewModel.chart.draftEnabledSubIndicatorCount).toBe(3)
    expect(viewModel.chart.indicatorDraft.rsi.enabled).toBe(false)
  })
})

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
        startDate: '20240101',
        endDate: '20260101'
      },
      indicatorSettings: createDefaultIndicatorSettings()
    }
  }
}

function createKlineSettings(): AppSettings {
  return {
    ...createDefaultSettings(),
    workspace: {
      ...createDefaultSettings().workspace,
      viewMode: 'kline'
    }
  }
}

function createSampleStockDataset(): StockDataset {
  return {
    meta: {
      lineType: '日线',
      symbol: '000001',
      name: '上证指数'
    },
    interval: 'day',
    columns: ['时间', '开盘价', '最高价', '最低价', '收盘价', '成交量', '成交额'],
    candles: Array.from({ length: 130 }, (_, index) => {
      const date = new Date(2024, 0, index + 1)
      const value = 3000 + index
      return {
        timeKey: formatDateKey(date),
        timestamp: date.getTime(),
        open: value,
        high: value + 10,
        low: value - 10,
        close: value + 2,
        volume: 1000 + index,
        turnover: 2000 + index
      }
    })
  }
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
