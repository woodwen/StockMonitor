export interface TradeProfitInput {
  buyPrice: number
  sellPrice: number
  quantity: number
  commissionRate: number
  stampTaxRate: number
  minimumCommission: number
  isEtf: boolean
}

export interface TradeProfitResult {
  buyAmount: number
  sellAmount: number
  buyCommission: number
  sellCommission: number
  stampTax: number
  profit: number
}

export interface TradeProfitRecord {
  id: string
  createdAt: number
  input: TradeProfitInput
  result: TradeProfitResult
  symbol?: string
  stockName?: string
}

export interface TradeProfitSettings {
  draft: TradeProfitInput
  records: TradeProfitRecord[]
}

export interface TradeProfitRecordContext {
  symbol?: string
  stockName?: string
}

interface TradeProfitRecordOptions {
  createdAt?: number
  id?: string
}

export const TRADE_PROFIT_MAX_RECORDS = 200

const defaultTradeProfitInput: TradeProfitInput = {
  buyPrice: 10,
  sellPrice: 11,
  quantity: 1000,
  commissionRate: 2,
  stampTaxRate: 5,
  minimumCommission: 5,
  isEtf: false
}

export function createDefaultTradeProfitInput(): TradeProfitInput {
  return { ...defaultTradeProfitInput }
}

export function createDefaultTradeProfitSettings(): TradeProfitSettings {
  return {
    draft: createDefaultTradeProfitInput(),
    records: []
  }
}

export function normalizeTradeProfitInput(input: unknown): TradeProfitInput {
  const value = asObject(input)
  return {
    buyPrice: normalizeNonNegativeNumber(value?.buyPrice, defaultTradeProfitInput.buyPrice),
    sellPrice: normalizeNonNegativeNumber(value?.sellPrice, defaultTradeProfitInput.sellPrice),
    quantity: normalizePositiveInteger(value?.quantity, defaultTradeProfitInput.quantity),
    commissionRate: normalizeNonNegativeNumber(
      value?.commissionRate,
      defaultTradeProfitInput.commissionRate
    ),
    stampTaxRate: normalizeNonNegativeNumber(
      value?.stampTaxRate,
      defaultTradeProfitInput.stampTaxRate
    ),
    minimumCommission: normalizeNonNegativeNumber(
      value?.minimumCommission,
      defaultTradeProfitInput.minimumCommission
    ),
    isEtf: value?.isEtf === true
  }
}

export function calculateTradeProfit(input: TradeProfitInput): TradeProfitResult {
  const normalized = normalizeTradeProfitInput(input)
  const buyAmount = normalized.buyPrice * normalized.quantity
  const sellAmount = normalized.sellPrice * normalized.quantity
  const buyCommission = Math.max(
    buyAmount * (normalized.commissionRate / 10000),
    normalized.minimumCommission
  )
  const sellCommission = Math.max(
    sellAmount * (normalized.commissionRate / 10000),
    normalized.minimumCommission
  )
  const stampTax = normalized.isEtf ? 0 : sellAmount * (normalized.stampTaxRate / 10000)
  const profit = sellAmount - buyAmount - buyCommission - sellCommission - stampTax

  return {
    buyAmount,
    sellAmount,
    buyCommission,
    sellCommission,
    stampTax,
    profit
  }
}

export function createTradeProfitRecord(
  input: TradeProfitInput,
  context: TradeProfitRecordContext = {},
  options: TradeProfitRecordOptions = {}
): TradeProfitRecord {
  const createdAt = normalizeTimestamp(options.createdAt, Date.now())
  const normalizedInput = normalizeTradeProfitInput(input)
  const record: TradeProfitRecord = {
    id: normalizeRecordId(options.id) ?? createRecordId(createdAt),
    createdAt,
    input: normalizedInput,
    result: calculateTradeProfit(normalizedInput)
  }
  const symbol = normalizeSnapshotText(context.symbol)
  const stockName = normalizeSnapshotText(context.stockName)
  if (symbol) {
    record.symbol = symbol
  }
  if (stockName && stockName !== symbol) {
    record.stockName = stockName
  }
  return record
}

export function normalizeTradeProfitSettings(settings: unknown): TradeProfitSettings {
  const value = asObject(settings)
  const records = Array.isArray(value?.records)
    ? value.records
        .map(normalizeTradeProfitRecord)
        .filter((record): record is TradeProfitRecord => Boolean(record))
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, TRADE_PROFIT_MAX_RECORDS)
    : []

  return {
    draft: normalizeTradeProfitInput(value?.draft),
    records
  }
}

export function sumTradeProfit(records: TradeProfitRecord[]): number {
  return records.reduce((total, record) => total + record.result.profit, 0)
}

export function isTradeProfitInputReady(input: TradeProfitInput): boolean {
  const normalized = normalizeTradeProfitInput(input)
  return normalized.buyPrice > 0 && normalized.sellPrice > 0 && normalized.quantity > 0
}

function normalizeTradeProfitRecord(value: unknown): TradeProfitRecord | undefined {
  const record = asObject(value)
  const inputValue = asObject(record?.input)
  const createdAt = normalizeTimestamp(record?.createdAt)
  const id = normalizeRecordId(record?.id)

  if (!record || !inputValue || !createdAt || !id || !isPersistedInputUsable(inputValue)) {
    return undefined
  }

  return createTradeProfitRecord(
    normalizeTradeProfitInput(inputValue),
    {
      symbol: normalizeSnapshotText(record.symbol),
      stockName: normalizeSnapshotText(record.stockName)
    },
    {
      createdAt,
      id
    }
  )
}

function isPersistedInputUsable(value: Record<string, unknown>): boolean {
  return (
    isPositiveFiniteNumber(value.buyPrice) &&
    isPositiveFiniteNumber(value.sellPrice) &&
    isPositiveFiniteNumber(value.quantity) &&
    isNonNegativeFiniteNumber(value.commissionRate) &&
    isNonNegativeFiniteNumber(value.stampTaxRate) &&
    isNonNegativeFiniteNumber(value.minimumCommission)
  )
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined
}

function normalizeNonNegativeNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 1 ? Math.floor(numeric) : fallback
}

function isPositiveFiniteNumber(value: unknown): boolean {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0
}

function isNonNegativeFiniteNumber(value: unknown): boolean {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0
}

function normalizeTimestamp(value: unknown, fallback?: number): number {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.floor(numeric)
  }
  return fallback ?? 0
}

function normalizeRecordId(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : undefined
}

function normalizeSnapshotText(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 80) : ''
}

function createRecordId(createdAt: number): string {
  return `trade-${createdAt}-${Math.random().toString(36).slice(2, 8)}`
}
