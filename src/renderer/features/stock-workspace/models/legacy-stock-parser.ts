import type { IntervalType, StockCandle, StockDataset } from './stock-types'

const LEGACY_FIELD_MIN_COUNT = 5

export function parseLegacyStockText(
  text: string,
  options: { sourcePath?: string; encoding?: string } = {}
): StockDataset {
  const rows = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((cells) => cells.some(Boolean))

  if (rows.length < 3) {
    throw new Error('文件行数不足，无法解析旧版行情文本')
  }

  const metaRow = rows[0]
  const lineType = requiredCell(metaRow, 0, '周期')
  const symbol = requiredCell(metaRow, 1, '证券代码')
  const name = requiredCell(metaRow, 2, '证券名称')
  const interval = parseIntervalType(lineType)
  const columns = rows[1].filter(Boolean)

  const candles = rows
    .slice(2)
    .map((cells, index) => parseDataRow(cells, interval, index + 3))
    .filter((candle): candle is StockCandle => candle !== null)
    .sort((left, right) => left.timestamp - right.timestamp)

  if (candles.length === 0) {
    throw new Error('没有解析到有效行情数据')
  }

  return {
    meta: { lineType, symbol, name },
    interval,
    columns,
    candles,
    sourcePath: options.sourcePath,
    encoding: options.encoding
  }
}

export function parseIntervalType(lineType: string): IntervalType {
  if (lineType.includes('分钟')) {
    return 'minute'
  }
  if (lineType === '日线') {
    return 'day'
  }
  if (lineType === '周线') {
    return 'week'
  }
  if (lineType === '月线') {
    return 'month'
  }
  throw new Error(`暂不支持的周期类型：${lineType}`)
}

export function parseLegacyTimestamp(timeKey: string, interval: IntervalType): number {
  if (interval === 'minute') {
    return parseMinuteTimestamp(timeKey)
  }

  if (interval === 'month') {
    if (!/^\d{6}$/.test(timeKey)) {
      throw new Error(`月线时间格式错误：${timeKey}`)
    }
    const year = Number(timeKey.slice(0, 4))
    const month = Number(timeKey.slice(4, 6))
    return new Date(year, month - 1, 1).getTime()
  }

  if (!/^\d{8}$/.test(timeKey)) {
    throw new Error(`日/周线时间格式错误：${timeKey}`)
  }
  const year = Number(timeKey.slice(0, 4))
  const month = Number(timeKey.slice(4, 6))
  const day = Number(timeKey.slice(6, 8))
  return new Date(year, month - 1, day).getTime()
}

function parseMinuteTimestamp(timeKey: string): number {
  if (/^\d{12}$/.test(timeKey)) {
    const year = Number(timeKey.slice(0, 4))
    const month = Number(timeKey.slice(4, 6))
    const day = Number(timeKey.slice(6, 8))
    const hour = Number(timeKey.slice(8, 10))
    const minute = Number(timeKey.slice(10, 12))
    return new Date(year, month - 1, day, hour, minute).getTime()
  }

  if (/^\d{7}$/.test(timeKey)) {
    const month = Number(timeKey.slice(0, 1))
    const day = Number(timeKey.slice(1, 3))
    const hour = Number(timeKey.slice(3, 5))
    const minute = Number(timeKey.slice(5, 7))
    return new Date(1970, month - 1, day, hour, minute).getTime()
  }

  throw new Error(`分钟线时间格式错误：${timeKey}`)
}

function parseDataRow(cells: string[], interval: IntervalType, rowNumber: number): StockCandle | null {
  if (cells.length < LEGACY_FIELD_MIN_COUNT || !cells[0]) {
    return null
  }

  try {
    const timeKey = cells[0]
    return {
      timeKey,
      timestamp: parseLegacyTimestamp(timeKey, interval),
      open: parseRequiredNumber(cells[1], rowNumber, '开盘价'),
      high: parseRequiredNumber(cells[2], rowNumber, '最高价'),
      low: parseRequiredNumber(cells[3], rowNumber, '最低价'),
      close: parseRequiredNumber(cells[4], rowNumber, '收盘价'),
      volume: parseOptionalNumber(cells[5]),
      turnover: parseOptionalNumber(cells[6])
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`第 ${rowNumber} 行解析失败：${message}`)
  }
}

function parseRequiredNumber(value: string | undefined, rowNumber: number, fieldName: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} 不是有效数字，行号 ${rowNumber}`)
  }
  return parsed
}

function parseOptionalNumber(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function requiredCell(row: string[], index: number, fieldName: string): string {
  const value = row[index]
  if (!value) {
    throw new Error(`缺少${fieldName}`)
  }
  return value
}
