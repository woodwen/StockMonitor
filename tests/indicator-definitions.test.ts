import { describe, expect, it } from 'vitest'
import {
  countEnabledSubIndicators,
  createDefaultIndicatorSettings,
  defaultIndicatorBarStyle,
  defaultIndicatorLineColors,
  indicatorNames,
  normalizeIndicatorParams,
  normalizeIndicatorSettings,
  subIndicatorNames,
  validateIndicatorPrecision,
  validateIndicatorParams
} from '../src/renderer/features/stock-workspace/models/indicator-definitions'

describe('indicator-definitions', () => {
  it('defines the default indicator set and enabled states', () => {
    const settings = createDefaultIndicatorSettings()

    expect(indicatorNames).toEqual([
      'boll',
      'ma',
      'ema',
      'strategySignal',
      'volumeMa',
      'macd',
      'kdj',
      'rsi'
    ])
    expect(subIndicatorNames).toEqual(['volumeMa', 'macd', 'kdj', 'rsi'])
    expect(settings.boll.enabled).toBe(true)
    expect(settings.volumeMa.enabled).toBe(true)
    expect(settings.strategySignal.enabled).toBe(true)
    expect(settings.macd.enabled).toBe(false)
    expect(settings.boll.precision).toBe(2)
    expect(settings.volumeMa.precision).toBe(0)
    expect(settings.strategySignal.params).toEqual([])
    expect(settings.strategySignal.precision).toBeUndefined()
    expect(settings.boll.styles.lines?.map((line) => line.color)).toEqual(
      defaultIndicatorLineColors.slice(0, 3)
    )
    expect(settings.volumeMa.styles.bar).toEqual(defaultIndicatorBarStyle)
  })

  it('validates parameter ranges and MACD fast/slow order', () => {
    expect(validateIndicatorParams('ma', [5, 10, 20, 60])).toEqual([])
    expect(validateIndicatorParams('ma', [5, 10, 10, 60])).toContain('参数不能重复')
    expect(validateIndicatorParams('boll', [20, 0])).toContain('倍数 必须在 0.1-10 之间')
    expect(validateIndicatorParams('macd', [26, 12, 9])).toContain('快线必须小于慢线')
    expect(validateIndicatorPrecision('boll', 7)).toContain('显示精度必须在 0-6 之间')
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
    expect(settings.strategySignal.enabled).toBe(true)
    expect('bsSignal' in settings).toBe(false)
    expect(countEnabledSubIndicators(settings)).toBe(3)
    expect(settings.volumeMa.enabled).toBe(true)
    expect(settings.macd.enabled).toBe(true)
    expect(settings.kdj.enabled).toBe(true)
    expect(settings.rsi.enabled).toBe(false)
    expect(settings.boll.precision).toBe(2)
    expect(settings.boll.styles.lines?.[0]).toEqual({
      color: '#FF9600',
      lineStyle: 'solid'
    })
  })

  it('normalizes invalid style and precision values to defaults', () => {
    const settings = normalizeIndicatorSettings({
      boll: {
        precision: 9,
        styles: {
          lines: [
            { color: 'red', lineStyle: 'zigzag' },
            { color: '#123456', lineStyle: 'dashed' }
          ]
        } as any
      }
    })

    expect(settings.boll.precision).toBe(2)
    expect(settings.boll.styles.lines?.[0]).toEqual({
      color: '#FF9600',
      lineStyle: 'solid'
    })
    expect(settings.boll.styles.lines?.[1]).toEqual({
      color: '#123456',
      lineStyle: 'dashed'
    })
    expect(settings.boll.styles.lines).toHaveLength(3)
  })

  it('ignores legacy B/S settings and preserves explicit strategy state', () => {
    const legacy = normalizeIndicatorSettings({
      bsSignal: { enabled: false }
    })
    expect('bsSignal' in legacy).toBe(false)
    expect(legacy.strategySignal.enabled).toBe(true)

    const partialStrategyOnly = normalizeIndicatorSettings({
      strategySignal: { enabled: true }
    })
    expect(partialStrategyOnly.strategySignal.enabled).toBe(true)

    const explicitStrategyDisabled = normalizeIndicatorSettings({
      bsSignal: { enabled: true },
      strategySignal: { enabled: false }
    })
    expect('bsSignal' in explicitStrategyDisabled).toBe(false)
    expect(explicitStrategyDisabled.strategySignal.enabled).toBe(false)
  })
})
