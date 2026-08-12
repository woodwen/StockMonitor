import { dispose, init, registerOverlay } from 'klinecharts'
import { indicatorDefinitions } from '../models/indicator-definitions'
import type {
  EnrichedStockDataset,
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorLineVisualStyle,
  IndicatorName,
  IndicatorSettings,
  IndicatorSettingsMap
} from '../models/stock-types'

const CANDLE_PANE_ID = 'candle_pane'
const BS_SIGNAL_GROUP_ID = 'bs-signal'
const BS_SIGNAL_OVERLAY_NAME = 'stockMonitorBsSignal'

let signalOverlayRegistered = false

type ChartIndicatorName = Exclude<IndicatorName, 'bsSignal'>

interface ActiveIndicator {
  paneId: string
  name: string
  paramsSignature: string
  styleSignature: string
}

export class KLineChartsAdapter {
  private chart: any = null
  private container: HTMLElement | null = null
  private readonly indicatorStates = new Map<ChartIndicatorName, ActiveIndicator>()
  private overlayIds: string[] = []
  private overlaySignature = ''
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

  setDataset(dataset: EnrichedStockDataset, indicatorSettings: IndicatorSettingsMap): void {
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
    this.syncIndicators(indicatorSettings)
    this.syncSignalOverlays(dataset, indicatorSettings.bsSignal, datasetChanged)
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
    this.indicatorStates.clear()
    this.overlayIds = []
    this.overlaySignature = ''
    this.currentDataset = null
  }

  private syncIndicators(indicatorSettings: IndicatorSettingsMap): void {
    indicatorDefinitions
      .filter((definition) => definition.pane !== 'overlay')
      .forEach((definition) => {
        const chartName = definition.chartName
        if (!chartName) {
          return
        }
        this.syncIndicator(definition.name as ChartIndicatorName, indicatorSettings[definition.name].enabled, {
          name: chartName,
          setting: indicatorSettings[definition.name],
          isStack: definition.pane === 'main',
          paneOptions: definition.pane === 'main' ? { id: CANDLE_PANE_ID } : undefined
        })
      })
  }

  private syncIndicator(
    key: ChartIndicatorName,
    enabled: boolean,
    options: {
      name: string
      setting: IndicatorSettings
      isStack: boolean
      paneOptions?: { id: string }
    }
  ): void {
    const activeIndicator = this.indicatorStates.get(key)
    const paramsSignature = options.setting.params.join(',')
    const styleSignature = createIndicatorStyleSignature(options.setting)

    if (!enabled) {
      if (activeIndicator) {
        this.chart.removeIndicator?.(activeIndicator.paneId, activeIndicator.name)
        this.indicatorStates.delete(key)
      }
      return
    }

    if (activeIndicator?.paramsSignature === paramsSignature) {
      if (activeIndicator.styleSignature === styleSignature) {
        return
      }
      this.chart.overrideIndicator?.(createChartIndicator(options.name, options.setting), activeIndicator.paneId)
      this.indicatorStates.set(key, {
        ...activeIndicator,
        styleSignature
      })
      return
    }

    if (activeIndicator) {
      this.chart.removeIndicator?.(activeIndicator.paneId, activeIndicator.name)
      this.indicatorStates.delete(key)
    }

    const createdPaneId = this.chart.createIndicator?.(
      createChartIndicator(options.name, options.setting),
      options.isStack,
      options.paneOptions
    )

    if (createdPaneId) {
      this.indicatorStates.set(key, {
        paneId: createdPaneId,
        name: options.name,
        paramsSignature,
        styleSignature
      })
    }
  }

  private syncSignalOverlays(
    dataset: EnrichedStockDataset,
    setting: IndicatorSettings,
    datasetChanged: boolean
  ): void {
    if (!setting.enabled) {
      this.removeSignalOverlays()
      return
    }

    const overlaySignature = createSignalOverlaySignature(dataset, setting)
    if (this.overlayIds.length > 0 && !datasetChanged && this.overlaySignature === overlaySignature) {
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
          side: item.bsSignal?.side,
          buyColor: setting.styles.marker?.buyColor,
          sellColor: setting.styles.marker?.sellColor
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
    this.overlaySignature = overlaySignature
  }

  private removeSignalOverlays(): void {
    if (this.overlayIds.length === 0) {
      this.chart.removeOverlay?.({ groupId: BS_SIGNAL_GROUP_ID })
      this.overlaySignature = ''
      return
    }

    this.overlayIds.forEach((id) => this.chart.removeOverlay?.(id))
    this.overlayIds = []
    this.overlaySignature = ''
  }
}

function createChartIndicator(name: string, setting: IndicatorSettings): Record<string, unknown> {
  return {
    name,
    calcParams: [...setting.params],
    precision: setting.precision,
    styles: createChartIndicatorStyles(setting)
  }
}

function createChartIndicatorStyles(setting: IndicatorSettings): Record<string, unknown> {
  const styles: Record<string, unknown> = {}

  if (setting.styles.lines && setting.styles.lines.length > 0) {
    styles.lines = setting.styles.lines.map(createChartLineStyle)
  }

  if (setting.styles.bar) {
    styles.bars = [createChartBarStyle(setting.styles.bar)]
  }

  return styles
}

function createChartLineStyle(style: IndicatorLineVisualStyle): Record<string, unknown> {
  return {
    style: style.lineStyle === 'solid' ? 'solid' : 'dashed',
    smooth: false,
    size: 1,
    dashedValue: getDashedValue(style.lineStyle),
    color: style.color
  }
}

function createChartBarStyle(style: IndicatorBarVisualStyle): Record<string, unknown> {
  return {
    style: 'fill',
    borderStyle: 'solid',
    borderSize: 1,
    borderDashedValue: [2, 2],
    upColor: style.upColor,
    downColor: style.downColor,
    noChangeColor: style.noChangeColor
  }
}

function getDashedValue(lineStyle: IndicatorLineStyle): number[] {
  if (lineStyle === 'dashed') {
    return [6, 4]
  }
  if (lineStyle === 'dotted') {
    return [2, 3]
  }
  return [2, 2]
}

function createIndicatorStyleSignature(setting: IndicatorSettings): string {
  return JSON.stringify({
    precision: setting.precision,
    styles: setting.styles
  })
}

function createSignalOverlaySignature(
  dataset: EnrichedStockDataset,
  setting: IndicatorSettings
): string {
  return JSON.stringify({
    marker: setting.styles.marker,
    signals: dataset.candles
      .filter((item) => item.bsSignal)
      .map((item) => [item.timestamp, item.bsSignal?.value, item.bsSignal?.side])
  })
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
      const color =
        side === 'buy'
          ? (overlay.extendData?.buyColor ?? '#ff4d4f')
          : (overlay.extendData?.sellColor ?? '#13c2c2')
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
