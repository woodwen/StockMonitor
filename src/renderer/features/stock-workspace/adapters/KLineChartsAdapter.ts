import { dispose, init, registerOverlay } from 'klinecharts'
import type { EnrichedStockDataset, IndicatorName } from '../models/stock-types'

const CANDLE_PANE_ID = 'candle_pane'
const BS_SIGNAL_GROUP_ID = 'bs-signal'
const BS_SIGNAL_OVERLAY_NAME = 'stockMonitorBsSignal'

let signalOverlayRegistered = false

export class KLineChartsAdapter {
  private chart: any = null
  private container: HTMLElement | null = null

  mount(container: HTMLElement): void {
    this.container = container
    registerSignalOverlay()
    this.chart = init(container, {
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      thousandsSeparator: {
        sign: ',',
        format: (value: number | string) => Number(value).toLocaleString('zh-CN')
      },
      styles: {
        grid: {
          show: true,
          horizontal: {
            show: true,
            color: '#263241',
            size: 1
          },
          vertical: {
            show: true,
            color: '#263241',
            size: 1
          }
        },
        candle: {
          bar: {
            upColor: '#ef5350',
            downColor: '#26a69a',
            noChangeColor: '#8f9bb3',
            upBorderColor: '#ef5350',
            downBorderColor: '#26a69a',
            noChangeBorderColor: '#8f9bb3',
            upWickColor: '#ef5350',
            downWickColor: '#26a69a',
            noChangeWickColor: '#8f9bb3'
          }
        },
        xAxis: {
          axisLine: { color: '#334155' },
          tickText: { color: '#95a3b8' }
        },
        yAxis: {
          axisLine: { color: '#334155' },
          tickText: { color: '#95a3b8' }
        },
        separator: {
          color: '#334155',
          size: 1
        }
      }
    } as any)
  }

  setDataset(dataset: EnrichedStockDataset, enabledIndicators: Record<IndicatorName, boolean>): void {
    if (!this.chart) {
      return
    }

    this.chart.applyNewData(
      dataset.candles.map((item) => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        turnover: item.turnover
      })),
      true
    )
    this.syncIndicators(enabledIndicators)
    this.syncSignalOverlays(dataset, enabledIndicators.bsSignal)
  }

  resize(): void {
    this.chart?.resize?.()
  }

  dispose(): void {
    if (this.container) {
      dispose(this.container)
    }
    this.chart = null
    this.container = null
  }

  private syncIndicators(enabledIndicators: Record<IndicatorName, boolean>): void {
    this.chart.removeIndicator?.({ paneId: CANDLE_PANE_ID, name: 'BOLL' })
    this.chart.removeIndicator?.({ name: 'VOL' })

    if (enabledIndicators.boll) {
      this.chart.createIndicator?.(
        {
          name: 'BOLL',
          paneId: CANDLE_PANE_ID,
          calcParams: [20, 2]
        },
        true
      )
    }

    if (enabledIndicators.volumeMa) {
      this.chart.createIndicator?.({
        name: 'VOL',
        calcParams: [5, 10, 20]
      })
    }
  }

  private syncSignalOverlays(dataset: EnrichedStockDataset, enabled: boolean): void {
    this.chart.removeOverlay?.({ groupId: BS_SIGNAL_GROUP_ID })

    if (!enabled) {
      return
    }

    const overlays = dataset.candles
      .filter((item) => item.bsSignal)
      .map((item) => ({
        name: BS_SIGNAL_OVERLAY_NAME,
        groupId: BS_SIGNAL_GROUP_ID,
        paneId: CANDLE_PANE_ID,
        lock: true,
        needDefaultPointFigure: false,
        needDefaultXAxisFigure: false,
        needDefaultYAxisFigure: false,
        points: [
          {
            timestamp: item.timestamp,
            value: item.bsSignal?.value
          }
        ],
        extendData: {
          side: item.bsSignal?.side
        }
      }))

    if (overlays.length > 0) {
      this.chart.createOverlay?.(overlays)
    }
  }
}

function registerSignalOverlay(): void {
  if (signalOverlayRegistered) {
    return
  }
  signalOverlayRegistered = true

  registerOverlay({
    name: BS_SIGNAL_OVERLAY_NAME,
    totalStep: 2,
    lock: true,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates, overlay }: any) => {
      const coordinate = coordinates[0]
      if (!coordinate) {
        return []
      }

      const side = overlay.extendData?.side === 'sell' ? 'sell' : 'buy'
      const label = side === 'buy' ? 'B' : 'S'
      const color = side === 'buy' ? '#ff4d4f' : '#13c2c2'
      const offsetY = side === 'buy' ? 18 : -18
      const y = coordinate.y + offsetY

      return [
        {
          type: 'circle',
          attrs: {
            x: coordinate.x,
            y,
            r: 9
          },
          styles: {
            style: 'fill',
            color
          },
          ignoreEvent: true
        },
        {
          type: 'text',
          attrs: {
            x: coordinate.x,
            y,
            text: label,
            align: 'center',
            baseline: 'middle'
          },
          styles: {
            color: '#ffffff',
            size: 11,
            weight: 'bold'
          },
          ignoreEvent: true
        }
      ]
    }
  } as any)
}
