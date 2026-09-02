import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '../src/preload/stock-api'
import type { TradeProfitSettingsAdapter } from '../src/renderer/features/trade-profit-calculator/adapters/ElectronTradeProfitSettingsAdapter'
import {
  createDefaultTradeProfitInput,
  createDefaultTradeProfitSettings,
  createTradeProfitRecord,
  type TradeProfitSettings
} from '../src/renderer/features/trade-profit-calculator/models/trade-profit'
import { createDefaultAiConnectorSettings } from '../src/renderer/features/stock-workspace/models/ai-models'
import { TradeProfitCalculatorViewModel } from '../src/renderer/features/trade-profit-calculator/view-models/TradeProfitCalculatorViewModel'

class FakeTradeProfitSettingsAdapter implements TradeProfitSettingsAdapter {
  savedSettings: TradeProfitSettings[] = []

  constructor(
    private settings: AppSettings = createDefaultSettings(),
    private readonly failSaves = false
  ) {}

  async getSettings(): Promise<AppSettings> {
    return this.settings
  }

  async setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings> {
    if (this.failSaves) {
      throw new Error('save failed')
    }
    this.savedSettings.push(settings)
    this.settings = {
      ...this.settings,
      tradeProfit: settings
    }
    return this.settings
  }
}

describe('TradeProfitCalculatorViewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('restores draft and records from persisted settings', async () => {
    const record = createTradeProfitRecord(
      {
        ...createDefaultTradeProfitInput(),
        sellPrice: 12
      },
      { symbol: 'sh600519', stockName: '贵州茅台' },
      { id: 'record-1', createdAt: 1 }
    )
    const viewModel = new TradeProfitCalculatorViewModel(
      new FakeTradeProfitSettingsAdapter({
        ...createDefaultSettings(),
        tradeProfit: {
          draft: {
            ...createDefaultTradeProfitInput(),
            quantity: 2000
          },
          records: [record]
        }
      })
    )

    await viewModel.initialize()

    expect(viewModel.draft.quantity).toBe(2000)
    expect(viewModel.records).toHaveLength(1)
    expect(viewModel.records[0]).toMatchObject({
      id: 'record-1',
      symbol: 'sh600519',
      stockName: '贵州茅台'
    })
  })

  it('updates the current result when draft fields change', async () => {
    const viewModel = new TradeProfitCalculatorViewModel(new FakeTradeProfitSettingsAdapter())

    await viewModel.initialize()
    viewModel.setDraftField('sellPrice', 12)

    expect(viewModel.currentResult.profit).toBe(1984)
  })

  it('debounces draft persistence', async () => {
    const adapter = new FakeTradeProfitSettingsAdapter()
    const viewModel = new TradeProfitCalculatorViewModel(adapter)

    await viewModel.initialize()
    viewModel.setDraftField('buyPrice', 9)
    viewModel.setDraftField('sellPrice', 10)
    viewModel.setDraftField('quantity', 500)

    expect(adapter.savedSettings).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(500)

    expect(adapter.savedSettings).toHaveLength(1)
    expect(adapter.savedSettings[0].draft).toMatchObject({
      buyPrice: 9,
      sellPrice: 10,
      quantity: 500
    })
  })

  it('adds records with the active stock snapshot and persists immediately', async () => {
    const adapter = new FakeTradeProfitSettingsAdapter()
    const viewModel = new TradeProfitCalculatorViewModel(adapter)

    await viewModel.initialize()
    viewModel.addRecord({ symbol: 'sh600519', stockName: '贵州茅台' })

    expect(viewModel.records).toHaveLength(1)
    expect(viewModel.records[0]).toMatchObject({
      symbol: 'sh600519',
      stockName: '贵州茅台'
    })
    expect(adapter.savedSettings).toHaveLength(1)
    expect(adapter.savedSettings[0].records[0]).toMatchObject({
      symbol: 'sh600519',
      stockName: '贵州茅台'
    })
  })

  it('removes one record and clears all records with immediate persistence', async () => {
    const adapter = new FakeTradeProfitSettingsAdapter()
    const viewModel = new TradeProfitCalculatorViewModel(adapter)

    await viewModel.initialize()
    viewModel.addRecord({ symbol: 'sh600519' })
    viewModel.addRecord({ symbol: 'sz000001' })

    const recordToRemove = viewModel.records[0]
    viewModel.removeRecord(recordToRemove.id)

    expect(viewModel.records).toHaveLength(1)
    expect(viewModel.records[0].symbol).toBe('sh600519')
    expect(adapter.savedSettings.at(-1)?.records).toHaveLength(1)

    viewModel.clearRecords()

    expect(viewModel.records).toEqual([])
    expect(adapter.savedSettings.at(-1)?.records).toEqual([])
  })

  it('flushes a pending draft save on dispose', async () => {
    const adapter = new FakeTradeProfitSettingsAdapter()
    const viewModel = new TradeProfitCalculatorViewModel(adapter)

    await viewModel.initialize()
    viewModel.setDraftField('quantity', 300)
    viewModel.dispose()

    expect(adapter.savedSettings).toHaveLength(1)
    expect(adapter.savedSettings[0].draft.quantity).toBe(300)
  })

  it('keeps calculating when persistence fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const viewModel = new TradeProfitCalculatorViewModel(
      new FakeTradeProfitSettingsAdapter(createDefaultSettings(), true)
    )

    await viewModel.initialize()
    viewModel.addRecord({ symbol: 'sh600519' })
    await Promise.resolve()
    await Promise.resolve()

    expect(viewModel.records).toHaveLength(1)
    expect(viewModel.saveError).toBe('做T测算记录保存失败')
    expect(warn).toHaveBeenCalledWith('Failed to save trade profit settings', expect.any(Error))
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
        startDate: '20240812',
        endDate: '20260812'
      },
      watchlist: []
    },
    tradeProfit: createDefaultTradeProfitSettings(),
    aiConnector: createDefaultAiConnectorSettings()
  }
}
