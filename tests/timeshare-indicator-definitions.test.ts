import { describe, expect, it } from 'vitest'
import {
  TIMESHARE_SUB_INDICATOR_LIMIT,
  countEnabledTimeshareSubIndicators,
  createDefaultTimeshareIndicatorSettings,
  normalizeTimeshareIndicatorParams,
  normalizeTimeshareIndicatorSettings,
  timeshareIndicatorNames,
  timeshareSubIndicatorNames,
  validateTimeshareIndicatorParams
} from '../src/renderer/features/stock-workspace/models/timeshare-indicator-definitions'

describe('timeshare-indicator-definitions', () => {
  it('defines the default timeshare indicator set and enabled states', () => {
    const settings = createDefaultTimeshareIndicatorSettings()

    expect(timeshareIndicatorNames).toEqual([
      'avgPriceLine',
      'previousCloseLine',
      'ma',
      'ema',
      'boll',
      'bsSignal',
      'volume',
      'volumeMa',
      'volumeRatio',
      'turnoverRate',
      'macd',
      'kdj',
      'rsi',
      'orderRatio',
      'inOutVolume',
      'capitalFlow'
    ])
    expect(timeshareSubIndicatorNames).toEqual(['macd', 'kdj', 'rsi'])
    expect(TIMESHARE_SUB_INDICATOR_LIMIT).toBe(2)
    expect(settings.avgPriceLine.enabled).toBe(true)
    expect(settings.previousCloseLine.enabled).toBe(true)
    expect(settings.volume.enabled).toBe(true)
    expect(settings.volumeRatio.enabled).toBe(false)
    expect(settings.turnoverRate.enabled).toBe(false)
    expect(settings.ma.enabled).toBe(false)
    expect(settings.bsSignal.enabled).toBe(false)
    expect(settings.bsSignal.params).toEqual([5, 20])
    expect(settings.kdj.enabled).toBe(false)
    expect(settings.kdj.params).toEqual([9, 3, 3])
    expect(settings.macd.enabled).toBe(false)
    expect(settings.orderRatio.enabled).toBe(false)
    expect(settings.inOutVolume.enabled).toBe(false)
    expect(settings.capitalFlow.enabled).toBe(false)
  })

  it('validates parameter ranges and fast/slow order', () => {
    expect(validateTimeshareIndicatorParams('ma', [5, 10, 20, 60])).toEqual([])
    expect(validateTimeshareIndicatorParams('ma', [5, 10, 10, 60])).toContain('参数不能重复')
    expect(validateTimeshareIndicatorParams('boll', [20, 0])).toContain('倍数 必须在 0.1-10 之间')
    expect(validateTimeshareIndicatorParams('macd', [26, 12, 9])).toContain('快线必须小于慢线')
    expect(validateTimeshareIndicatorParams('bsSignal', [20, 5])).toContain('快线必须小于慢线')
    expect(validateTimeshareIndicatorParams('kdj', [9, 3, 3])).toEqual([])
  })

  it('normalizes invalid params to defaults', () => {
    expect(normalizeTimeshareIndicatorParams('boll', [20, 2.25])).toEqual([20, 2.3])
    expect(normalizeTimeshareIndicatorParams('macd', [26, 12, 9])).toEqual([12, 26, 9])
    expect(normalizeTimeshareIndicatorParams('bsSignal', [20, 5])).toEqual([5, 20])
    expect(normalizeTimeshareIndicatorParams('rsi', [6, 6, 24])).toEqual([6, 12, 24])
    expect(normalizeTimeshareIndicatorParams('kdj', [9, 0, 3])).toEqual([9, 3, 3])
  })

  it('normalizes settings and counts enabled sub indicators', () => {
    const settings = normalizeTimeshareIndicatorSettings({
      avgPriceLine: { enabled: false },
      macd: { enabled: true },
      kdj: { enabled: true },
      rsi: { enabled: true }
    })

    expect(settings.avgPriceLine.enabled).toBe(false)
    expect(settings.previousCloseLine.enabled).toBe(true)
    expect(countEnabledTimeshareSubIndicators(settings)).toBe(2)
    expect(settings.kdj.enabled).toBe(false)
  })
})
