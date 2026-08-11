import type {
  StockMeta,
  WatchlistAddPreview,
  WatchlistItem,
  WatchlistParseResult
} from './stock-types'

export const WATCHLIST_MAX_ITEMS = 300
export const WATCHLIST_MAX_BATCH_LINES = 200
export const WATCHLIST_MAX_NAME_LENGTH = 40

type MarketPrefix = 'sh' | 'sz' | 'bj'

export function normalizeWatchlist(value: unknown): WatchlistItem[] {
  if (!Array.isArray(value)) {
    return []
  }

  const items: WatchlistItem[] = []
  const seen = new Set<string>()

  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object' || items.length >= WATCHLIST_MAX_ITEMS) {
      return
    }

    const candidate = entry as Partial<WatchlistItem>
    const symbol = normalizeWatchlistSymbol(candidate.symbol)
    if (!symbol || seen.has(symbol)) {
      return
    }

    const createdAt = normalizeTimestamp(candidate.createdAt) ?? Date.now()
    const updatedAt = normalizeTimestamp(candidate.updatedAt)
    const item: WatchlistItem = {
      symbol,
      name: normalizeWatchlistName(candidate.name),
      createdAt
    }

    if (updatedAt !== undefined) {
      item.updatedAt = updatedAt
    }

    seen.add(symbol)
    items.push(item)
  })

  return items
}

export function parseWatchlistText(
  text: string,
  existingItems: WatchlistItem[]
): WatchlistParseResult {
  const lines = text.split(/\r?\n/)
  const parsedLines = lines.slice(0, WATCHLIST_MAX_BATCH_LINES)
  const existingSymbols = new Set(normalizeWatchlist(existingItems).map((item) => item.symbol))
  const previewSymbols = new Set<string>()
  const previews: WatchlistAddPreview[] = []
  let readyCount = 0

  parsedLines.forEach((line, index) => {
    const raw = line.trim()
    if (!raw) {
      return
    }

    const parsed = parseWatchlistLine(raw)
    if (!parsed.symbol) {
      previews.push({
        lineNumber: index + 1,
        raw,
        symbol: '',
        name: '',
        status: 'invalid',
        message: parsed.message
      })
      return
    }

    if (existingSymbols.has(parsed.symbol) || previewSymbols.has(parsed.symbol)) {
      previews.push({
        lineNumber: index + 1,
        raw,
        symbol: parsed.symbol,
        name: parsed.name,
        status: 'duplicate',
        message: '已存在'
      })
      return
    }

    if (existingSymbols.size + readyCount >= WATCHLIST_MAX_ITEMS) {
      previews.push({
        lineNumber: index + 1,
        raw,
        symbol: parsed.symbol,
        name: parsed.name,
        status: 'invalid',
        message: `自选股最多保存 ${WATCHLIST_MAX_ITEMS} 只`
      })
      return
    }

    const item = createWatchlistItem(parsed.symbol, parsed.name)
    if (!item) {
      previews.push({
        lineNumber: index + 1,
        raw,
        symbol: parsed.symbol,
        name: parsed.name,
        status: 'invalid',
        message: '证券代码格式错误'
      })
      return
    }

    previewSymbols.add(parsed.symbol)
    readyCount += 1
    previews.push({
      lineNumber: index + 1,
      raw,
      symbol: item.symbol,
      name: item.name,
      status: 'ready',
      message: '可添加',
      item
    })
  })

  return {
    previews,
    totalLineCount: lines.length,
    parsedLineCount: parsedLines.length,
    truncated: lines.length > WATCHLIST_MAX_BATCH_LINES
  }
}

export function addWatchlistItems(
  items: WatchlistItem[],
  additions: WatchlistItem[]
): WatchlistItem[] {
  const existing = normalizeWatchlist(items)
  const seen = new Set(existing.map((item) => item.symbol))
  const normalizedAdditions = normalizeWatchlist(additions)
  const accepted: WatchlistItem[] = []

  normalizedAdditions.forEach((item) => {
    if (seen.has(item.symbol) || accepted.length + existing.length >= WATCHLIST_MAX_ITEMS) {
      return
    }
    seen.add(item.symbol)
    accepted.push(item)
  })

  return [...accepted, ...existing].slice(0, WATCHLIST_MAX_ITEMS)
}

export function removeWatchlistSymbols(
  items: WatchlistItem[],
  symbols: string[]
): WatchlistItem[] {
  const normalizedSymbols = new Set(
    symbols
      .map((symbol) => normalizeWatchlistSymbol(symbol))
      .filter((symbol): symbol is string => symbol !== null)
  )

  if (normalizedSymbols.size === 0) {
    return normalizeWatchlist(items)
  }

  return normalizeWatchlist(items).filter((item) => !normalizedSymbols.has(item.symbol))
}

export function createWatchlistItem(
  symbol: string,
  name = '',
  now = Date.now()
): WatchlistItem | null {
  const normalizedSymbol = normalizeWatchlistSymbol(symbol)
  if (!normalizedSymbol) {
    return null
  }

  return {
    symbol: normalizedSymbol,
    name: normalizeWatchlistName(name),
    createdAt: now
  }
}

export function createWatchlistItemFromMeta(meta: StockMeta, now = Date.now()): WatchlistItem | null {
  return createWatchlistItem(meta.symbol, meta.name, now)
}

export function normalizeWatchlistSymbol(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const symbol = value.trim().toLowerCase()
  const prefixedMatch = /^(sh|sz|bj)(\d{6})$/.exec(symbol)
  if (prefixedMatch) {
    return `${prefixedMatch[1]}${prefixedMatch[2]}`
  }

  if (/^[a-z]{2}\d{6}$/.test(symbol)) {
    return null
  }

  if (/^\d{6}$/.test(symbol)) {
    return `${inferMarketPrefix(symbol)}${symbol}`
  }

  return null
}

export function normalizeWatchlistName(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim().replace(/\s+/g, ' ').slice(0, WATCHLIST_MAX_NAME_LENGTH)
}

function parseWatchlistLine(raw: string): { symbol: string | null; name: string; message: string } {
  const match = /^([a-zA-Z]{2}\d{6}|\d{6})(?:[\s,\t，]+(.+))?$/.exec(raw)
  if (!match) {
    return {
      symbol: null,
      name: '',
      message: '证券代码应为 6 位数字，或带 sh/sz/bj 前缀'
    }
  }

  const symbol = normalizeWatchlistSymbol(match[1])
  if (!symbol) {
    return {
      symbol: null,
      name: '',
      message: '证券代码前缀仅支持 sh、sz、bj'
    }
  }

  return {
    symbol,
    name: normalizeWatchlistName(match[2] ?? ''),
    message: '可添加'
  }
}

function inferMarketPrefix(code: string): MarketPrefix {
  if (/^[65]/.test(code)) {
    return 'sh'
  }
  if (/^(4|8|9)/.test(code)) {
    return 'bj'
  }
  return 'sz'
}

function normalizeTimestamp(value: unknown, fallback?: number): number | undefined {
  const timestamp = Number(value)
  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp
  }
  return fallback
}
