import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WatchlistItem } from '../src/renderer/features/stock-workspace/models/stock-types'
import {
  addWatchlistItems,
  createWatchlistItem,
  normalizeWatchlist,
  parseWatchlistText,
  removeWatchlistSymbols,
  WATCHLIST_MAX_BATCH_LINES,
  WATCHLIST_MAX_ITEMS
} from '../src/renderer/features/stock-workspace/models/watchlist'

describe('watchlist model', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 11, 9, 30))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('parses single and batch add input formats', () => {
    const result = parseWatchlistText(
      ['sh600519', '600519 贵州茅台', 'sz000001 平安银行', '000001,平安银行', '000300\t沪深300'].join(
        '\n'
      ),
      []
    )

    expect(result.previews.map((preview) => preview.status)).toEqual([
      'ready',
      'duplicate',
      'ready',
      'duplicate',
      'ready'
    ])
    expect(result.previews.map((preview) => preview.symbol)).toEqual([
      'sh600519',
      'sh600519',
      'sz000001',
      'sz000001',
      'sz000300'
    ])
    expect(result.previews[2].name).toBe('平安银行')
    expect(result.previews[4].name).toBe('沪深300')
  })

  it('infers market prefixes for bare six-digit symbols', () => {
    const result = parseWatchlistText(['600519', '510300', '830799', '000001'].join('\n'), [])

    expect(result.previews.map((preview) => preview.symbol)).toEqual([
      'sh600519',
      'sh510300',
      'bj830799',
      'sz000001'
    ])
  })

  it('marks invalid lines and ignores blank lines', () => {
    const result = parseWatchlistText(['', 'xx600519', '12345', 'sh600519'].join('\n'), [])

    expect(result.previews).toHaveLength(3)
    expect(result.previews[0]).toMatchObject({
      status: 'invalid',
      message: '证券代码前缀仅支持 sh、sz、bj'
    })
    expect(result.previews[1]).toMatchObject({
      status: 'invalid',
      message: '证券代码应为 6 位数字，或带 sh/sz/bj 前缀'
    })
    expect(result.previews[2]).toMatchObject({
      status: 'ready',
      symbol: 'sh600519'
    })
  })

  it('marks existing symbols as duplicates without moving them', () => {
    const existing = [createItem('sh600519', '贵州茅台')]
    const result = parseWatchlistText('600519 贵州茅台', existing)
    const next = addWatchlistItems(existing, result.previews.flatMap((preview) => preview.item ?? []))

    expect(result.previews[0]).toMatchObject({
      status: 'duplicate',
      symbol: 'sh600519'
    })
    expect(next).toEqual(existing)
  })

  it('caps batch parsing to two hundred lines', () => {
    const text = Array.from({ length: WATCHLIST_MAX_BATCH_LINES + 1 }, (_, index) =>
      String(100000 + index).padStart(6, '0')
    ).join('\n')
    const result = parseWatchlistText(text, [])

    expect(result.totalLineCount).toBe(WATCHLIST_MAX_BATCH_LINES + 1)
    expect(result.parsedLineCount).toBe(WATCHLIST_MAX_BATCH_LINES)
    expect(result.truncated).toBe(true)
    expect(result.previews).toHaveLength(WATCHLIST_MAX_BATCH_LINES)
  })

  it('does not allow additions beyond the watchlist size limit', () => {
    const existing = Array.from({ length: WATCHLIST_MAX_ITEMS - 1 }, (_, index) =>
      createItem(`sz${String(100000 + index).padStart(6, '0')}`)
    )
    const result = parseWatchlistText(['600519 贵州茅台', '000001 平安银行'].join('\n'), existing)
    const next = addWatchlistItems(existing, result.previews.flatMap((preview) => preview.item ?? []))

    expect(result.previews.map((preview) => preview.status)).toEqual(['ready', 'invalid'])
    expect(next).toHaveLength(WATCHLIST_MAX_ITEMS)
    expect(next[0].symbol).toBe('sh600519')
  })

  it('normalizes stored watchlist values', () => {
    const normalized = normalizeWatchlist([
      { symbol: 'SH600519', name: ' 贵州   茅台 ', createdAt: 0 },
      { symbol: 'xx000001', name: 'bad', createdAt: 1 },
      { symbol: '600519', name: 'duplicate', createdAt: 2 },
      { symbol: '000001', name: null, createdAt: 3 }
    ])

    expect(normalized).toEqual([
      {
        symbol: 'sh600519',
        name: '贵州 茅台',
        createdAt: new Date(2026, 7, 11, 9, 30).getTime()
      },
      {
        symbol: 'sz000001',
        name: '',
        createdAt: 3
      }
    ])
  })

  it('removes multiple selected symbols and ignores unknown values', () => {
    const items = [createItem('sh600519'), createItem('sz000001'), createItem('bj830799')]

    expect(removeWatchlistSymbols(items, ['600519', 'bj830799', 'sh999999'])).toEqual([
      createItem('sz000001')
    ])
  })
})

function createItem(symbol: string, name = ''): WatchlistItem {
  const item = createWatchlistItem(symbol, name, 1)
  if (!item) {
    throw new Error(`Invalid test symbol: ${symbol}`)
  }
  return item
}
