import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultKlineStrategySettings } from '../src/renderer/features/stock-workspace/models/kline-strategy-backtesting'
import { createDefaultTradeProfitInput } from '../src/renderer/features/trade-profit-calculator/models/trade-profit'
import { createDefaultAiConnectorSettings } from '../src/renderer/features/stock-workspace/models/ai-models'

const mocks = vi.hoisted(() => {
  const stores: Array<Map<string, unknown>> = []

  class TestStore {
    private readonly values = new Map<string, unknown>()

    constructor(options?: { defaults?: Record<string, unknown> }) {
      Object.entries(options?.defaults ?? {}).forEach(([key, value]) => {
        this.values.set(key, value)
      })
      stores.push(this.values)
    }

    get(key: string): unknown {
      return this.values.get(key)
    }

    set(key: string, value: unknown): void {
      this.values.set(key, value)
    }
  }

  return { stores, TestStore }
})

vi.mock('electron-store', () => ({
  default: mocks.TestStore
}))

vi.mock('electron-log/main', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    initialize: vi.fn(),
    transports: {
      console: { level: 'debug' },
      file: { level: 'info' }
    },
    warn: vi.fn()
  }
}))

import {
  getSettings,
  setAiConnectorSettings,
  setNetworkProxy,
  setTradeProfitSettings,
  setWorkspaceSettings
} from '../src/main/store'

describe('app store', () => {
  beforeEach(() => {
    setNetworkProxy({
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    })
    setTradeProfitSettings({
      draft: createDefaultTradeProfitInput(),
      records: []
    })
    setAiConnectorSettings(createDefaultAiConnectorSettings())
    vi.clearAllMocks()
  })

  it('provides default trade profit settings', () => {
    expect(mocks.stores).toHaveLength(1)

    const settings = getSettings()

    expect(settings.tradeProfit).toEqual({
      draft: createDefaultTradeProfitInput(),
      records: []
    })
  })

  it('provides default disabled AI connector settings', () => {
    const settings = getSettings()

    expect(settings.aiConnector).toMatchObject({
      enabled: false,
      kind: 'http-provider',
      displayName: 'DeepSeek',
      model: 'deepseek-v4-pro',
      httpProvider: {
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com'
      }
    })
  })

  it('saves trade profit settings without replacing other app settings', () => {
    setNetworkProxy({
      enabled: true,
      protocol: 'http',
      host: 'localhost',
      port: 8080
    })

    const next = setTradeProfitSettings({
      draft: {
        ...createDefaultTradeProfitInput(),
        quantity: 2000
      },
      records: []
    })

    expect(next.networkProxy).toEqual({
      enabled: true,
      protocol: 'http',
      host: 'localhost',
      port: 8080
    })
    expect(next.workspace.query.symbol).toBe('sh000001')
    expect(next.tradeProfit.draft.quantity).toBe(2000)
  })

  it('normalizes missing kline strategy workspace settings', () => {
    const defaults = createDefaultKlineStrategySettings()
    const current = getSettings().workspace

    const next = setWorkspaceSettings({
      query: current.query
    })

    expect(next.workspace.klineStrategySettings).toMatchObject({
      selectedTemplateIds: defaults.selectedTemplateIds,
      assumptions: defaults.assumptions
    })
  })

  it('saves non-sensitive AI connector settings without replacing other settings', () => {
    setNetworkProxy({
      enabled: true,
      protocol: 'http',
      host: 'localhost',
      port: 8080
    })

    const next = setAiConnectorSettings({
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      displayName: 'DeepSeek',
      model: 'deepseek-chat',
      httpProvider: {
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        customHeaders: [{ name: 'X-Test', value: 'ok' }]
      }
    })

    expect(next.networkProxy.enabled).toBe(true)
    expect(next.aiConnector).toMatchObject({
      enabled: true,
      kind: 'http-provider',
      model: 'deepseek-chat',
      httpProvider: {
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        customHeaders: [{ name: 'X-Test', value: 'ok' }]
      }
    })
  })
})
