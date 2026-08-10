import { describe, expect, it } from 'vitest'
import {
  countEnabledSubIndicators,
  createDefaultIndicatorSettings,
  indicatorNames,
  normalizeIndicatorParams,
  normalizeIndicatorSettings,
  subIndicatorNames,
  validateIndicatorParams
} from '../src/renderer/features/stock-workspace/models/indicator-definitions'

describe('indicator-definitions', () => {
  it('defines the default indicator set and enabled states', () => {
    const settings = createDefaultIndicatorSettings()

    expect(indicatorNames).toEqual([
      'boll',
      'ma',
      'ema',
      'bsSignal',
      'volumeMa',
      'macd',
      'kdj',
      'rsi'
    ])
    expect(subIndicatorNames).toEqual(['volumeMa', 'macd', 'kdj', 'rsi'])
    expect(settings.boll.enabled).toBe(true)
    expect(settings.volumeMa.enabled).toBe(true)
    expect(settings.bsSignal.enabled).toBe(true)
    expect(settings.macd.enabled).toBe(false)
  })

  it('validates parameter ranges and MACD fast/slow order', () => {
    expect(validateIndicatorParams('ma', [5, 10, 20, 60])).toEqual([])
    expect(validateIndicatorParams('ma', [5, 10, 10, 60])).toContain('参数不能重复')
    expect(validateIndicatorParams('boll', [20, 0])).toContain('倍数 必须在 0.1-10 之间')
    expect(validateIndicatorParams('macd', [26, 12, 9])).toContain('快线必须小于慢线')
  })

  it('normalizes invalid params to defaults', () => {
    expect(normalizeIndicatorParams('boll', [20, 2.25])).toEqual([20, 2.3])
    expect(normalizeIndicatorParams('macd', [26, 12, 9])).toEqual([12, 26, 9])
    expect(normalizeIndicatorParams('rsi', [6, 6, 24])).toEqual([6, 12, 24])
  })

  it('migrates legacy enabled indicators and enforces the sub indicator limit', () => {
    const settings = normalizeIndicatorSettings(
      {
        volumeMa: { enabled: true },
        macd: { enabled: true },
        kdj: { enabled: true },
        rsi: { enabled: true }
      },
      {
        boll: false,
        bsSignal: false
      }
    )

    expect(settings.boll.enabled).toBe(false)
    expect(settings.bsSignal.enabled).toBe(false)
    expect(countEnabledSubIndicators(settings)).toBe(3)
    expect(settings.volumeMa.enabled).toBe(true)
    expect(settings.macd.enabled).toBe(true)
    expect(settings.kdj.enabled).toBe(true)
    expect(settings.rsi.enabled).toBe(false)
  })
})
