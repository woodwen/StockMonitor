import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({}))

import {
  fetchRemoteStockDataset,
  getStockDataSourceMetas
} from '../src/main/remote-stock-sources'

describe('remote stock sources', () => {
  const proxyEnvKeys = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy'
  ] as const
  let previousProxyEnv: Partial<Record<(typeof proxyEnvKeys)[number], string | undefined>>

  beforeEach(() => {
    previousProxyEnv = {}
    proxyEnvKeys.forEach((key) => {
      previousProxyEnv[key] = process.env[key]
      delete process.env[key]
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    proxyEnvKeys.forEach((key) => {
      const value = previousProxyEnv[key]
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    })
  })

  it('exposes the first-phase remote data sources', () => {
    const sources = getStockDataSourceMetas()

    expect(sources.map((source) => source.id)).toEqual([
      'eastmoney',
      'sina',
      'netease163',
      'tencent'
    ])
    expect(sources.find((source) => source.id === 'eastmoney')?.capabilities.adjusts).toContain(
      'qfq'
    )
    expect(sources.find((source) => source.id === 'netease163')?.capabilities.periods).toEqual([
      'day'
    ])
    expect(sources.find((source) => source.id === 'netease163')?.capabilities.markets).toEqual([
      'stock'
    ])
  })

  it('normalizes Eastmoney kline rows into StockDataset', async () => {
    process.env.HTTP_PROXY = 'http://127.0.0.1:1'
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: {
            name: '上证指数',
            klines: ['2026-08-10,3943.82,3947.97,3966.36,3943.81,360926783,799001147996.50']
          }
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataset = await fetchRemoteStockDataset({
      sourceId: 'eastmoney',
      symbol: 'sh000001',
      period: 'day',
      adjust: 'qfq',
      startDate: '20260801',
      endDate: '20260810'
    })

    expect(String(fetchMock.mock.calls[0][0])).toContain('secid=1.000001')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(dataset.sourceName).toBe('东方财富')
    expect(dataset.meta).toMatchObject({
      lineType: '日线',
      symbol: 'sh000001',
      name: '上证指数'
    })
    expect(dataset.candles[0]).toMatchObject({
      timeKey: '20260810',
      open: 3943.82,
      close: 3947.97,
      high: 3966.36,
      low: 3943.81,
      volume: 360926783,
      turnover: 799001147996.5
    })
  })

  it('surfaces the network failure cause from the request layer', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed', {
          cause: new Error('getaddrinfo ENOTFOUND push2his.eastmoney.com')
        })
      })
    )

    await expect(
      fetchRemoteStockDataset({
        sourceId: 'eastmoney',
        symbol: 'sh000001',
        period: 'day',
        adjust: 'qfq',
        startDate: '20260801',
        endDate: '20260810'
      })
    ).rejects.toThrow('getaddrinfo ENOTFOUND push2his.eastmoney.com')
  })

  it('rejects unsupported Netease index requests before hitting the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchRemoteStockDataset({
        sourceId: 'netease163',
        symbol: 'sh000001',
        period: 'day',
        adjust: 'none',
        startDate: '20260801',
        endDate: '20260810'
      })
    ).rejects.toThrow('网易财经 163 暂不支持指数')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
