import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({}))

import {
  clearRemoteStockSourceCachesForTest,
  fetchRemoteStockDataset,
  fetchRemoteStockTimeshareDataset,
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
    clearRemoteStockSourceCachesForTest()
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
    expect(sources.find((source) => source.id === 'eastmoney')?.capabilities.timeshare).toBe(true)
    expect(
      sources.find((source) => source.id === 'eastmoney')?.capabilities.timeshareAdvanced
        ?.minuteOhlc.status
    ).toBe('supported')
    expect(
      sources.find((source) => source.id === 'eastmoney')?.capabilities.timeshareAdvanced
        ?.floatShares.markets
    ).toEqual(['stock'])
    expect(sources.find((source) => source.id === 'tencent')?.capabilities.timeshare).toBe(true)
    expect(
      sources.find((source) => source.id === 'tencent')?.capabilities.timeshareAdvanced?.minuteOhlc
        .status
    ).toBe('unknown')
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

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/qt/stock/kline/get')
    expect(url).toContain('secid=1.000001')
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

  it('normalizes Eastmoney timeshare rows into StockTimeshareDataset', async () => {
    const fetchMock = vi.fn(createEastmoneyAdvancedFetchMock())
    vi.stubGlobal('fetch', fetchMock)

    const dataset = await fetchRemoteStockTimeshareDataset({
      sourceId: 'eastmoney',
      symbol: 'sh600519'
    })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/api/qt/stock/trends2/get')
    expect(url).toContain('secid=1.600519')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(dataset.sourceName).toBe('东方财富')
    expect(dataset.previousClose).toBe(3943.82)
    expect(dataset.meta).toMatchObject({
      lineType: '分时',
      symbol: 'sh600519',
      name: '贵州茅台'
    })
    expect(dataset.points[0]).toMatchObject({
      timeKey: '202608100930',
      price: 3947.97,
      avgPrice: 3947.1,
      volume: 360926,
      turnover: 799001147.5,
      open: 3943.82,
      high: 3966.36,
      low: 3943.81,
      close: 3947.97
    })
    expect(dataset.advanced?.historicalVolumeBaseline).toMatchObject({
      basis: 'fiveDayAverageMinuteVolume',
      tradeDays: 5,
      sampleStartDate: '20260803',
      sampleEndDate: '20260807',
      source: '东方财富'
    })
    expect(dataset.advanced?.floatShares).toBe(100000000)
    expect(dataset.advanced?.orderBook).toMatchObject({
      bidVolume: 1500,
      askVolume: 1000,
      source: '东方财富'
    })
    expect(dataset.advanced?.inOutVolume).toMatchObject({
      inwardVolume: 1200,
      outwardVolume: 1800
    })
    expect(dataset.advanced?.capitalFlow).toMatchObject({
      totalInflow: 500000,
      totalOutflow: 300000,
      netInflow: 200000
    })
  })

  it('falls back to the Eastmoney delayed timeshare host when the primary host fails', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input)
      if (url.includes('push2.eastmoney.com')) {
        throw new TypeError('fetch failed', {
          cause: new Error('getaddrinfo ENOTFOUND push2.eastmoney.com')
        })
      }
      if (url.includes('/api/qt/stock/kline/get')) {
        return createEastmoneyHistoryResponse()
      }
      if (url.includes('/api/qt/stock/get')) {
        return createEastmoneyQuoteResponse()
      }

      return new Response(
        JSON.stringify({
          data: {
            name: '贵州茅台',
            preClose: 3943.82,
            trends: [
              '2026-08-10 09:30,3943.82,3947.97,3966.36,3943.81,360926,799001147.50,3947.10'
            ]
          }
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataset = await fetchRemoteStockTimeshareDataset({
      sourceId: 'eastmoney',
      symbol: 'sh600519'
    })

    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(String(fetchMock.mock.calls[0][0])).toContain('push2.eastmoney.com')
    expect(String(fetchMock.mock.calls[1][0])).toContain('push2delay.eastmoney.com')
    expect(dataset.sourceName).toBe('东方财富')
    expect(dataset.sourceUrl).toContain('push2delay.eastmoney.com')
    expect(dataset.points).toHaveLength(1)
  })

  it('reuses cached Eastmoney historical volume and float shares by source, symbol and date', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/qt/stock/trends2/get')) {
        return createEastmoneyTimeshareResponse()
      }
      if (url.includes('/api/qt/stock/kline/get')) {
        return createEastmoneyHistoryResponse()
      }
      if (url.includes('/api/qt/stock/get')) {
        return fetchMock.mock.calls.filter((call) => String(call[0]).includes('/api/qt/stock/get'))
          .length === 1
          ? createEastmoneyQuoteResponse()
          : createEastmoneyQuoteResponse({
              f85: undefined,
              f20: 500,
              f18: 0,
              f16: 0,
              f14: 0,
              f12: 0,
              f40: 500,
              f38: 0,
              f36: 0,
              f34: 0,
              f32: 0
            })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const query = {
      sourceId: 'eastmoney' as const,
      symbol: 'sh600519'
    }
    const first = await fetchRemoteStockTimeshareDataset(query)
    const second = await fetchRemoteStockTimeshareDataset(query)

    const historyCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/qt/stock/kline/get')
    )
    const quoteCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes('/api/qt/stock/get')
    )
    expect(historyCalls).toHaveLength(1)
    expect(quoteCalls).toHaveLength(2)
    expect(first.advanced?.floatShares).toBe(100000000)
    expect(second.advanced?.floatShares).toBe(100000000)
    expect(second.advanced?.orderBook?.bidVolume).toBe(500)
    expect(second.advanced?.orderBook?.askVolume).toBe(500)
  })

  it('normalizes Tencent timeshare rows into StockTimeshareDataset', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: {
            sh600519: {
              data: {
                date: '20260810',
                data: [
                  '0930 10.00 5 5000.00',
                  '0931 10.20 8 8120.00',
                  '1506 10.30 9 9270.00'
                ]
              },
              qt: {
                sh600519: ['1', '贵州茅台', '600519', '10.20', '9.90', '10.00']
              }
            }
          }
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const dataset = await fetchRemoteStockTimeshareDataset({
      sourceId: 'tencent',
      symbol: 'sh600519'
    })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('/appstock/app/minute/query')
    expect(url).toContain('code=sh600519')
    expect(dataset.sourceName).toBe('腾讯/QQ 财经')
    expect(dataset.previousClose).toBe(9.9)
    expect(dataset.meta).toMatchObject({
      lineType: '分时',
      symbol: 'sh600519',
      name: '贵州茅台'
    })
    expect(dataset.points).toHaveLength(2)
    expect(dataset.points[0]).toMatchObject({
      timeKey: '202608100930',
      price: 10,
      avgPrice: 10,
      volume: 5,
      turnover: 5000
    })
    expect(dataset.points[1]).toMatchObject({
      timeKey: '202608100931',
      price: 10.2,
      avgPrice: 10.15,
      volume: 3,
      turnover: 3120
    })
  })

  it('rejects Tencent timeshare rows without previous close', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          data: {
            sh600519: {
              data: {
                date: '20260810',
                data: ['0930 10.00 5 5000.00']
              },
              qt: {
                sh600519: ['1', '贵州茅台', '600519', '10.00', '0']
              }
            }
          }
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchRemoteStockTimeshareDataset({
        sourceId: 'tencent',
        symbol: 'sh600519'
      })
    ).rejects.toThrow('腾讯/QQ 财经 没有返回昨收价')
  })

  it('rejects unsupported timeshare sources before hitting the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchRemoteStockTimeshareDataset({
        sourceId: 'sina',
        symbol: 'sh000001'
      })
    ).rejects.toThrow('新浪财经 暂不支持分时')

    expect(fetchMock).not.toHaveBeenCalled()
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

function createEastmoneyAdvancedFetchMock(): (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response> {
  return async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input)
    if (url.includes('/api/qt/stock/trends2/get')) {
      return createEastmoneyTimeshareResponse()
    }
    if (url.includes('/api/qt/stock/kline/get')) {
      return createEastmoneyHistoryResponse()
    }
    if (url.includes('/api/qt/stock/get')) {
      return createEastmoneyQuoteResponse()
    }
    return new Response('{}', { status: 404 })
  }
}

function createEastmoneyTimeshareResponse(): Response {
  return new Response(
    JSON.stringify({
      data: {
        name: '贵州茅台',
        preClose: 3943.82,
        trends: [
          '2026-08-10 09:30,3943.82,3947.97,3966.36,3943.81,360926,799001147.50,3947.10',
          '2026-08-10 09:31,3947.97,3948.22,3950.10,3946.20,120926,299001147.50,3947.65'
        ]
      }
    }),
    { status: 200 }
  )
}

function createEastmoneyHistoryResponse(): Response {
  return new Response(
    JSON.stringify({
      data: {
        name: '贵州茅台',
        klines: [
          '2026-08-03,10,10,10,10,240000,1000',
          '2026-08-04,10,10,10,10,480000,1000',
          '2026-08-05,10,10,10,10,720000,1000',
          '2026-08-06,10,10,10,10,960000,1000',
          '2026-08-07,10,10,10,10,1200000,1000'
        ]
      }
    }),
    { status: 200 }
  )
}

function createEastmoneyQuoteResponse(patch: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      data: {
        f85: 100000000,
        f20: 100,
        f18: 200,
        f16: 300,
        f14: 400,
        f12: 500,
        f40: 100,
        f38: 200,
        f36: 200,
        f34: 200,
        f32: 300,
        inwardVolume: 1200,
        outwardVolume: 1800,
        totalInflow: 500000,
        totalOutflow: 300000,
        netInflow: 200000,
        ...patch
      }
    }),
    { status: 200 }
  )
}
