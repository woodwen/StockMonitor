import { describe, expect, it } from 'vitest'
import { parseLegacyStockText } from '../src/renderer/features/stock-workspace/models/legacy-stock-parser'

describe('parseLegacyStockText', () => {
  it('parses legacy text and sorts candles ascending', () => {
    const text = createLegacySampleText()
    const dataset = parseLegacyStockText(text, {
      sourcePath: 'fixtures/legacy/000002.txt',
      encoding: 'gbk'
    })

    expect(dataset.meta).toEqual({
      lineType: '日线',
      symbol: '000001',
      name: '上证指数'
    })
    expect(dataset.interval).toBe('day')
    expect(dataset.candles.length).toBeGreaterThan(100)
    expect(dataset.candles[0].timestamp).toBeLessThan(
      dataset.candles[dataset.candles.length - 1].timestamp
    )
    expect(dataset.candles[0].open).toBeGreaterThan(0)
  })

  it('rejects unsupported interval types', () => {
    expect(() =>
      parseLegacyStockText(['未知周期\t000001\t测试', '时间\t开盘价', '20240101\t1'].join('\n'))
    ).toThrow('暂不支持的周期类型')
  })
})

function createLegacySampleText(): string {
  const rows = [
    '日线\t000001\t上证指数',
    '时间\t开盘价\t最高价\t最低价\t收盘价\t成交量\t成交额',
    ...Array.from({ length: 120 }, (_, index) => {
      const date = new Date(2024, 0, index + 1)
      const value = 3000 + index
      return `${formatDateKey(date)}\t${value}\t${value + 10}\t${value - 10}\t${value + 2}\t${1000 + index}\t${2000 + index}`
    })
  ]
  return rows.join('\n')
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
