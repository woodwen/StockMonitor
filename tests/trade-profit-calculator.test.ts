import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateTradeProfit,
  createDefaultTradeProfitInput,
  createTradeProfitRecord,
  normalizeTradeProfitInput,
  normalizeTradeProfitSettings,
  sumTradeProfit,
  TRADE_PROFIT_MAX_RECORDS
} from '../src/renderer/features/trade-profit-calculator/models/trade-profit'

describe('trade profit calculator model', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 12, 10, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calculates stock trade profit with commission and stamp tax', () => {
    const result = calculateTradeProfit(createDefaultTradeProfitInput())

    expect(result).toEqual({
      buyAmount: 10000,
      sellAmount: 11000,
      buyCommission: 5,
      sellCommission: 5,
      stampTax: 5.5,
      profit: 984.5
    })
  })

  it('does not charge stamp tax for ETF trades', () => {
    const result = calculateTradeProfit({
      ...createDefaultTradeProfitInput(),
      isEtf: true
    })

    expect(result.stampTax).toBe(0)
    expect(result.profit).toBe(990)
  })

  it('uses rate-based commission when it exceeds the minimum commission', () => {
    const result = calculateTradeProfit({
      buyPrice: 100,
      sellPrice: 101,
      quantity: 1000,
      commissionRate: 2,
      stampTaxRate: 5,
      minimumCommission: 5,
      isEtf: false
    })

    expect(result.buyCommission).toBe(20)
    expect(result.sellCommission).toBe(20.2)
    expect(result.stampTax).toBe(50.5)
    expect(result.profit).toBeCloseTo(909.3)
  })

  it('sums profit across records', () => {
    const records = [
      createTradeProfitRecord(createDefaultTradeProfitInput(), {}, { id: 'a', createdAt: 1 }),
      createTradeProfitRecord(
        {
          ...createDefaultTradeProfitInput(),
          sellPrice: 9
        },
        {},
        { id: 'b', createdAt: 2 }
      )
    ]

    expect(sumTradeProfit(records)).toBeCloseTo(-30)
  })

  it('normalizes invalid draft input to defaults', () => {
    expect(
      normalizeTradeProfitInput({
        buyPrice: -1,
        sellPrice: Number.NaN,
        quantity: 0,
        commissionRate: -2,
        stampTaxRate: Number.POSITIVE_INFINITY,
        minimumCommission: -5,
        isEtf: true
      })
    ).toEqual({
      ...createDefaultTradeProfitInput(),
      isEtf: true
    })
  })

  it('normalizes persisted settings and keeps the most recent two hundred records', () => {
    const settings = normalizeTradeProfitSettings({
      draft: {
        ...createDefaultTradeProfitInput(),
        quantity: 888.9
      },
      records: [
        { id: 'bad', createdAt: 1, input: { buyPrice: -1 }, result: {} },
        ...Array.from({ length: TRADE_PROFIT_MAX_RECORDS + 1 }, (_, index) =>
          createTradeProfitRecord(
            createDefaultTradeProfitInput(),
            { symbol: `sz${String(100000 + index).padStart(6, '0')}` },
            { id: `record-${index}`, createdAt: index + 2 }
          )
        )
      ]
    })

    expect(settings.draft.quantity).toBe(888)
    expect(settings.records).toHaveLength(TRADE_PROFIT_MAX_RECORDS)
    expect(settings.records[0].id).toBe(`record-${TRADE_PROFIT_MAX_RECORDS}`)
    expect(settings.records.at(-1)?.id).toBe('record-1')
    expect(settings.records.some((record) => record.id === 'bad')).toBe(false)
  })
})
