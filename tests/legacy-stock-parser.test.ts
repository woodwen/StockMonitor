import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import iconv from 'iconv-lite'
import { parseLegacyStockText } from '../src/renderer/features/stock-workspace/models/legacy-stock-parser'

describe('parseLegacyStockText', () => {
  it('parses the bundled GBK legacy sample and sorts candles ascending', () => {
    const buffer = readFileSync(resolve(process.cwd(), 'fixtures/legacy/000002.txt'))
    const text = iconv.decode(buffer, 'gbk')
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
