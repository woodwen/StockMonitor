import { describe, expect, it } from 'vitest'
import { KLineChartsAdapter } from '../src/renderer/features/stock-workspace/adapters/KLineChartsAdapter'
import type { EnrichedStockDataset, IndicatorName } from '../src/renderer/features/stock-workspace/models/stock-types'

interface ActiveIndicator {
  paneId: string
  name: string
}

class FakeChart {
  readonly indicators: ActiveIndicator[] = []
  readonly overlays: Array<{ id: string; groupId?: string; name: string }> = []
  private nextIndicatorId = 1
  private nextOverlayId = 1

  applyNewData(): void {
    return undefined
  }

  createIndicator(
    value: { name: string; paneId?: string },
    _isStack?: boolean,
    paneOptions?: { id?: string }
  ): string {
    const paneId = paneOptions?.id ?? value.paneId ?? `${value.name}-${this.nextIndicatorId++}`
    this.indicators.push({ paneId, name: value.name })
    return paneId
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

  createOverlay(values: Array<{ name: string; groupId?: string }>): string[] {
    return values.map((value) => {
      const id = `overlay-${this.nextOverlayId++}`
      this.overlays.push({
        id,
        name: value.name,
        groupId: value.groupId
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
      boll: true,
      volumeMa: true,
      bsSignal: true
    })
    adapter.setDataset(sampleDataset, {
      boll: false,
      volumeMa: true,
      bsSignal: true
    })

    expect(fakeChart.indicators.filter((item) => item.name === 'BOLL')).toHaveLength(0)
    expect(fakeChart.indicators.filter((item) => item.name === 'VOL')).toHaveLength(1)
  })

  it('does not create duplicate indicators or overlays when state is unchanged', () => {
    const { adapter, fakeChart } = createAdapterWithChart()
    const enabled: Record<IndicatorName, boolean> = {
      boll: true,
      volumeMa: true,
      bsSignal: true
    }

    adapter.setDataset(sampleDataset, enabled)
    adapter.setDataset(sampleDataset, enabled)
    adapter.setDataset(sampleDataset, enabled)

    expect(fakeChart.indicators.filter((item) => item.name === 'BOLL')).toHaveLength(1)
    expect(fakeChart.indicators.filter((item) => item.name === 'VOL')).toHaveLength(1)
    expect(fakeChart.overlays).toHaveLength(1)
  })
})

function createAdapterWithChart(): { adapter: KLineChartsAdapter; fakeChart: FakeChart } {
  const adapter = new KLineChartsAdapter()
  const fakeChart = new FakeChart()
  ;(adapter as unknown as { chart: FakeChart }).chart = fakeChart
  return { adapter, fakeChart }
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
