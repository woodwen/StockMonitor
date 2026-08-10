import { dispose, init, registerOverlay } from 'klinecharts'
import type { EnrichedStockDataset, IndicatorName } from '../models/stock-types'

const CANDLE_PANE_ID = 'candle_pane'
const BS_SIGNAL_GROUP_ID = 'bs-signal'
const BS_SIGNAL_OVERLAY_NAME = 'stockMonitorBsSignal'

let signalOverlayRegistered = false

export class KLineChartsAdapter {
  private chart: any = null
  private container: HTMLElement | null = null
  private readonly indicatorPaneIds = new Map<Exclude<IndicatorName, 'bsSignal'>, string>()
  private overlayIds: string[] = []
  private currentDataset: EnrichedStockDataset | null = null

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
    const datasetChanged = this.currentDataset !== dataset
    this.currentDataset = dataset

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
    this.syncSignalOverlays(dataset, enabledIndicators.bsSignal, datasetChanged)
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
    this.indicatorPaneIds.clear()
    this.overlayIds = []
    this.currentDataset = null
  }

  private syncIndicators(enabledIndicators: Record<IndicatorName, boolean>): void {
    this.syncIndicator('boll', enabledIndicators.boll, {
      name: 'BOLL',
      calcParams: [20, 2],
      isStack: true,
      paneOptions: { id: CANDLE_PANE_ID }
    })

    this.syncIndicator('volumeMa', enabledIndicators.volumeMa, {
      name: 'VOL',
      calcParams: [5, 10, 20],
      isStack: false
    })
  }

  private syncIndicator(
    key: Exclude<IndicatorName, 'bsSignal'>,
    enabled: boolean,
    options: {
      name: string
      calcParams: number[]
      isStack: boolean
      paneOptions?: { id: string }
    }
  ): void {
    const paneId = this.indicatorPaneIds.get(key)

    if (!enabled) {
      if (paneId) {
        this.chart.removeIndicator?.(paneId, options.name)
        this.indicatorPaneIds.delete(key)
      }
      return
    }

    if (paneId) {
      return
    }

    const createdPaneId = this.chart.createIndicator?.(
      {
        name: options.name,
        calcParams: options.calcParams
      },
      options.isStack,
      options.paneOptions
    )

    if (createdPaneId) {
      this.indicatorPaneIds.set(key, createdPaneId)
    }
  }

  private syncSignalOverlays(
    dataset: EnrichedStockDataset,
    enabled: boolean,
    datasetChanged: boolean
  ): void {
    if (!enabled) {
      this.removeSignalOverlays()
      return
    }

    if (this.overlayIds.length > 0 && !datasetChanged) {
      return
    }

    this.removeSignalOverlays()

    const overlays = dataset.candles
      .filter((item) => item.bsSignal)
      .map((item) => ({
        name: BS_SIGNAL_OVERLAY_NAME,
        groupId: BS_SIGNAL_GROUP_ID,
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

    if (overlays.length === 0) {
      return
    }

    const createdIds = this.chart.createOverlay?.(overlays, CANDLE_PANE_ID)
    this.overlayIds = Array.isArray(createdIds)
      ? createdIds.filter((id): id is string => typeof id === 'string')
      : typeof createdIds === 'string'
        ? [createdIds]
        : []
  }

  private removeSignalOverlays(): void {
    if (this.overlayIds.length === 0) {
      this.chart.removeOverlay?.({ groupId: BS_SIGNAL_GROUP_ID })
      return
    }

    this.overlayIds.forEach((id) => this.chart.removeOverlay?.(id))
    this.overlayIds = []
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
