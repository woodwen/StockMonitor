import { describe, expect, it } from 'vitest'
import {
  KLineChartsAdapter,
  createSignalOverlayPointFigures
} from '../src/renderer/features/stock-workspace/adapters/KLineChartsAdapter'
import { createDefaultIndicatorSettings } from '../src/renderer/features/stock-workspace/models/indicator-definitions'
import type {
  EnrichedStockDataset,
  IndicatorName,
  IndicatorSettings,
  IndicatorSettingsMap,
  KlineStrategySignal
} from '../src/renderer/features/stock-workspace/models/stock-types'

interface ActiveIndicator {
  paneId: string
  name: string
  calcParams: number[]
  precision?: number
  styles?: any
}

class FakeChart {
  readonly indicators: ActiveIndicator[] = []
  readonly overlays: Array<{ id: string; groupId?: string; name: string; extendData?: any }> = []
  readonly overriddenIndicators: Array<{ value: any; paneId?: string }> = []
  private nextIndicatorId = 1
  private nextOverlayId = 1

  applyNewData(): void {
    return undefined
  }

  createIndicator(
    value: { name: string; paneId?: string; calcParams?: number[]; precision?: number; styles?: any },
    _isStack?: boolean,
    paneOptions?: { id?: string }
  ): string {
    const paneId = paneOptions?.id ?? value.paneId ?? `${value.name}-${this.nextIndicatorId++}`
    this.indicators.push({
      paneId,
      name: value.name,
      calcParams: value.calcParams ?? [],
      precision: value.precision,
      styles: value.styles
    })
    return paneId
  }

  overrideIndicator(value: { name: string; calcParams?: number[]; precision?: number; styles?: any }, paneId?: string): void {
    this.overriddenIndicators.push({ value, paneId })
    const indicator = this.indicators.find((item) => item.paneId === paneId && item.name === value.name)
    if (!indicator) {
      return
    }
    indicator.calcParams = value.calcParams ?? indicator.calcParams
    indicator.precision = value.precision
    indicator.styles = value.styles
  }

  removeIndicator(paneId: string, name?: string): void {
    if (typeof paneId !== 'string') {
      return
    }

    for (let index = this.indicators.length - 1; index >= 0; index -= 1) {
      const item = this.indicators[index]
      if (item.paneId === paneId && (!name || item.name === name)) {
        this.indicators.splice(index, 1)
      }
    }
  }

  createOverlay(values: Array<{ name: string; groupId?: string; extendData?: any }>): string[] {
    return values.map((value) => {
      const id = `overlay-${this.nextOverlayId++}`
      this.overlays.push({
        id,
        name: value.name,
        groupId: value.groupId,
        extendData: value.extendData
      })
      return id
    })
  }

  removeOverlay(remove?: string | { id?: string; groupId?: string; name?: string }): void {
    for (let index = this.overlays.length - 1; index >= 0; index -= 1) {
      const item = this.overlays[index]
      if (
        remove === undefined ||
        remove === item.id ||
        (typeof remove === 'object' &&
          ((remove.id && remove.id === item.id) ||
            (remove.groupId && remove.groupId === item.groupId) ||
            (remove.name && remove.name === item.name)))
      ) {
        this.overlays.splice(index, 1)
      }
    }
  }
}

describe('KLineChartsAdapter', () => {
  it('removes disabled indicators instead of accumulating them', () => {
    const { adapter, fakeChart } = createAdapterWithChart()

    adapter.setDataset(sampleDataset, {
      ...createDefaultIndicatorSettings()
    })
    adapter.setDataset(sampleDataset, createIndicatorSettings({ boll: { enabled: false } }))

    expect(fakeChart.indicators.filter((item) => item.name === 'BOLL')).toHaveLength(0)
    expect(fakeChart.indicators.filter((item) => item.name === 'VOL')).toHaveLength(1)
  })

  it('does not create duplicate indicators or overlays when state is unchanged', () => {
    const { adapter, fakeChart } = createAdapterWithChart()
    const settings = createIndicatorSettings()

    adapter.setDataset(sampleDataset, settings)
    adapter.setDataset(sampleDataset, settings)
    adapter.setDataset(sampleDataset, settings)

    expect(fakeChart.indicators.filter((item) => item.name === 'BOLL')).toHaveLength(1)
    expect(fakeChart.indicators.filter((item) => item.name === 'VOL')).toHaveLength(1)
    expect(fakeChart.overlays).toHaveLength(1)
  })

  it('recreates indicators when calc params change', () => {
    const { adapter, fakeChart } = createAdapterWithChart()

    adapter.setDataset(sampleDataset, createIndicatorSettings())
    adapter.setDataset(sampleDataset, createIndicatorSettings({ boll: { params: [30, 2] } }))

    const bollIndicators = fakeChart.indicators.filter((item) => item.name === 'BOLL')
    expect(bollIndicators).toHaveLength(1)
    expect(bollIndicators[0].calcParams).toEqual([30, 2])
  })

  it('passes precision and styles to klinecharts indicators', () => {
    const { adapter, fakeChart } = createAdapterWithChart()
    const settings = createIndicatorSettings({
      boll: {
        precision: 3,
        styles: {
          lines: [
            { color: '#111111', lineStyle: 'solid' },
            { color: '#222222', lineStyle: 'dashed' },
            { color: '#333333', lineStyle: 'dotted' }
          ]
        }
      },
      volumeMa: {
        styles: {
          lines: [
            { color: '#444444', lineStyle: 'solid' },
            { color: '#555555', lineStyle: 'solid' },
            { color: '#666666', lineStyle: 'solid' }
          ],
          bar: {
            upColor: '#aaaaaa',
            downColor: '#bbbbbb',
            noChangeColor: '#cccccc'
          }
        }
      }
    })

    adapter.setDataset(sampleDataset, settings)

    const boll = fakeChart.indicators.find((item) => item.name === 'BOLL')
    const volume = fakeChart.indicators.find((item) => item.name === 'VOL')
    expect(boll?.precision).toBe(3)
    expect(boll?.styles.lines[1]).toMatchObject({
      color: '#222222',
      style: 'dashed',
      dashedValue: [6, 4]
    })
    expect(boll?.styles.lines[2]).toMatchObject({
      color: '#333333',
      style: 'dashed',
      dashedValue: [2, 3]
    })
    expect(volume?.styles.bars[0]).toMatchObject({
      upColor: '#aaaaaa',
      downColor: '#bbbbbb',
      noChangeColor: '#cccccc'
    })
  })

  it('overrides indicators when only styles change', () => {
    const { adapter, fakeChart } = createAdapterWithChart()

    adapter.setDataset(sampleDataset, createIndicatorSettings())
    adapter.setDataset(
      sampleDataset,
      createIndicatorSettings({
        boll: {
          styles: {
            lines: [
              { color: '#111111', lineStyle: 'solid' },
              { color: '#935EBD', lineStyle: 'solid' },
              { color: '#1677FF', lineStyle: 'solid' }
            ]
          }
        }
      })
    )

    expect(fakeChart.indicators.filter((item) => item.name === 'BOLL')).toHaveLength(1)
    expect(fakeChart.overriddenIndicators.find((item) => item.value.name === 'BOLL')).toBeDefined()
  })

  it('uses configured B/S marker colors for overlays', () => {
    const { adapter, fakeChart } = createAdapterWithChart()

    adapter.setDataset(
      sampleDataset,
      createIndicatorSettings({
        bsSignal: {
          styles: {
            marker: {
              buyColor: '#123456',
              sellColor: '#654321'
            }
          }
        }
      })
    )

    expect(fakeChart.overlays[0].extendData).toMatchObject({
      side: 'buy',
      buyColor: '#123456',
      sellColor: '#654321'
    })
  })

  it('renders strategy signals in a separate overlay group', () => {
    const { adapter, fakeChart } = createAdapterWithChart()

    adapter.setDataset(sampleDataset, createIndicatorSettings(), [sampleStrategySignal])

    expect(fakeChart.overlays).toHaveLength(2)
    expect(fakeChart.overlays.map((overlay) => overlay.groupId)).toEqual([
      'bs-signal',
      'strategy-signal'
    ])
    expect(fakeChart.overlays[1].extendData).toMatchObject({
      side: 'sell',
      buyColor: '#ff4d4f',
      sellColor: '#1677ff'
    })
  })

  it('draws buy and sell B/S markers with visibly distinct colors', () => {
    const buyFigures = createSignalOverlayPointFigures({
      coordinates: [{ x: 10, y: 20 }],
      overlay: {
        extendData: {
          side: 'buy',
          buyColor: '#ff4d4f',
          sellColor: '#1677ff'
        }
      }
    })
    const sellFigures = createSignalOverlayPointFigures({
      coordinates: [{ x: 10, y: 20 }],
      overlay: {
        extendData: {
          side: 'sell',
          buyColor: '#ff4d4f',
          sellColor: '#1677ff'
        }
      }
    })

    expect(buyFigures[0]).toMatchObject({
      type: 'circle',
      attrs: { r: 10 },
      styles: {
        color: '#ff4d4f',
        borderColor: '#fff1f0',
        borderSize: 2
      }
    })
    expect(sellFigures[0]).toMatchObject({
      type: 'circle',
      attrs: { r: 10 },
      styles: {
        color: '#1677ff',
        borderColor: '#e6f4ff',
        borderSize: 2
      }
    })
    expect(buyFigures[0].styles.color).not.toBe(sellFigures[0].styles.color)
    expect(buyFigures[1]).toMatchObject({
      type: 'text',
      attrs: { text: 'B' },
      styles: { color: '#ffffff', weight: 'bold' }
    })
    expect(sellFigures[1]).toMatchObject({
      type: 'text',
      attrs: { text: 'S' },
      styles: { color: '#ffffff', weight: 'bold' }
    })
  })
})

function createAdapterWithChart(): { adapter: KLineChartsAdapter; fakeChart: FakeChart } {
  const adapter = new KLineChartsAdapter()
  const fakeChart = new FakeChart()
  ;(adapter as unknown as { chart: FakeChart }).chart = fakeChart
  return { adapter, fakeChart }
}

function createIndicatorSettings(
  patch: Partial<Record<IndicatorName, Partial<IndicatorSettings>>> = {}
): IndicatorSettingsMap {
  const settings = createDefaultIndicatorSettings()
  Object.entries(patch).forEach(([name, value]) => {
    const indicatorName = name as IndicatorName
    settings[indicatorName] = {
      ...settings[indicatorName],
      ...value,
      params: value.params ? [...value.params] : [...settings[indicatorName].params],
      styles: value.styles
        ? {
            ...settings[indicatorName].styles,
            ...value.styles
          }
        : settings[indicatorName].styles
    }
  })
  return settings
}

const sampleDataset: EnrichedStockDataset = {
  meta: {
    lineType: '日线',
    symbol: '000001',
    name: '测试'
  },
  interval: 'day',
  columns: [],
  candles: [
    {
      timeKey: '20240101',
      timestamp: new Date(2024, 0, 1).getTime(),
      open: 1,
      high: 2,
      low: 0.5,
      close: 1.5,
      volume: 100,
      turnover: 200,
      volumeMa: {},
      bsSignal: {
        side: 'buy',
        value: 0.5
      }
    }
  ]
}

const sampleStrategySignal: KlineStrategySignal = {
  side: 'sell',
  timeKey: '20240101',
  timestamp: new Date(2024, 0, 1).getTime(),
  price: 2,
  templateId: 'ma-cross',
  templateName: '均线交叉',
  explanation: '历史信号',
  indicatorValues: {
    shortMa: 1,
    longMa: 2
  }
}
