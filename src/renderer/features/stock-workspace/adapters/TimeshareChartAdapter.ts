import type {
  EnrichedStockTimeshareDataset,
  EnrichedStockTimesharePoint,
  TimeshareIndicatorSettingsMap
} from '../models/stock-types'
import { createDefaultTimeshareIndicatorSettings } from '../models/timeshare-indicator-definitions'

const MORNING_START = 9 * 60 + 30
const MORNING_END = 11 * 60 + 30
const AFTERNOON_START = 13 * 60
const AFTERNOON_END = 15 * 60
const TRADING_MINUTES = 240

const colors = {
  background: '#0d131d',
  grid: '#263241',
  axis: '#95a3b8',
  tooltipBackground: 'rgba(15, 23, 42, 0.92)',
  tooltipBorder: '#334155',
  tooltipText: '#d7e0ea',
  price: '#ef5350',
  avgPrice: '#facc15',
  previousClose: '#64748b',
  volume: '#334155',
  ma: ['#60a5fa', '#f97316', '#a78bfa', '#34d399'],
  ema: ['#38bdf8', '#fb7185'],
  boll: {
    upper: '#c084fc',
    mid: '#fbbf24',
    lower: '#c084fc'
  },
  volumeMa: ['#60a5fa', '#facc15', '#fb7185'],
  volumeRatio: '#22c55e',
  turnoverRate: '#e879f9',
  kdj: {
    k: '#facc15',
    d: '#60a5fa',
    j: '#fb7185'
  },
  macd: {
    dif: '#facc15',
    dea: '#60a5fa',
    up: '#ef5350',
    down: '#26a69a'
  },
  rsi: ['#facc15', '#60a5fa', '#fb7185']
}

interface PointCoordinate {
  point: EnrichedStockTimesharePoint
  x: number
  y: number
}

interface SubPaneLayout {
  id: 'macd' | 'rsi' | 'kdj'
  top: number
  bottom: number
  height: number
}

interface ChartLayout {
  left: number
  top: number
  right: number
  bottom: number
  priceBottom: number
  volumeTop: number
  volumeBottom: number
  volumeHeight: number
  volumeVisible: boolean
  width: number
  priceHeight: number
  subPanes: SubPaneLayout[]
  contentBottom: number
  axisLabelY: number
}

interface PriceRange {
  min: number
  max: number
}

interface ValueRange {
  min: number
  max: number
}

interface LegendItem {
  label: string
  color: string
  dashed?: boolean
  marker?: string
}

export class TimeshareChartAdapter {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private dataset: EnrichedStockTimeshareDataset | null = null
  private crosshair: { x: number; y: number } | null = null

  mount(container: HTMLElement): void {
    this.container = container
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'timeshare-chart-canvas'
    this.context = this.canvas.getContext('2d')
    this.container.appendChild(this.canvas)
    this.canvas.addEventListener('mousemove', this.handleMouseMove)
    this.canvas.addEventListener('mouseleave', this.handleMouseLeave)
    this.resize()
  }

  setDataset(dataset: EnrichedStockTimeshareDataset): void {
    this.dataset = dataset
    this.draw()
  }

  resize(): void {
    if (!this.container || !this.canvas) {
      return
    }
    const rect = this.container.getBoundingClientRect()
    const width = Math.max(1, rect.width)
    const height = Math.max(1, rect.height)
    const dpr = window.devicePixelRatio || 1
    this.canvas.width = Math.floor(width * dpr)
    this.canvas.height = Math.floor(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.context?.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.draw()
  }

  dispose(): void {
    if (this.canvas) {
      this.canvas.removeEventListener('mousemove', this.handleMouseMove)
      this.canvas.removeEventListener('mouseleave', this.handleMouseLeave)
      this.canvas.remove()
    }
    this.container = null
    this.canvas = null
    this.context = null
    this.dataset = null
    this.crosshair = null
  }

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (!this.canvas) {
      return
    }
    const rect = this.canvas.getBoundingClientRect()
    this.crosshair = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    }
    this.draw()
  }

  private readonly handleMouseLeave = (): void => {
    this.crosshair = null
    this.draw()
  }

  private draw(): void {
    if (!this.canvas || !this.context) {
      return
    }
    const width = this.canvas.clientWidth
    const height = this.canvas.clientHeight
    const context = this.context
    context.clearRect(0, 0, width, height)
    context.fillStyle = colors.background
    context.fillRect(0, 0, width, height)

    const dataset = this.dataset
    if (!dataset || dataset.points.length === 0) {
      return
    }

    const settings = dataset.indicatorSettings ?? createDefaultTimeshareIndicatorSettings()
    const layout = createLayout(width, height, settings)
    const priceRange = createPriceRange(dataset, settings)
    const coordinates = createCoordinates(dataset, layout, priceRange)

    drawGrid(context, layout)
    drawAxes(context, layout, priceRange, dataset.previousClose)
    drawPriceLines(context, layout, priceRange, coordinates, dataset, settings)
    drawPriceLegend(context, layout, settings)
    drawVolume(context, layout, coordinates, settings)
    drawSubPanes(context, layout, coordinates, settings)

    if (this.crosshair && coordinates.length > 0) {
      drawCrosshair(context, layout, coordinates, this.crosshair, priceRange, dataset, settings)
    }
  }
}

export function getTradingMinuteIndex(timestamp: number): number | null {
  const date = new Date(timestamp)
  const minutes = date.getHours() * 60 + date.getMinutes()
  if (minutes >= MORNING_START && minutes <= MORNING_END) {
    return minutes - MORNING_START
  }
  if (minutes >= AFTERNOON_START && minutes <= AFTERNOON_END) {
    return MORNING_END - MORNING_START + (minutes - AFTERNOON_START)
  }
  return null
}

function createLayout(
  width: number,
  height: number,
  settings: TimeshareIndicatorSettingsMap
): ChartLayout {
  const left = 64
  const right = 64
  const top = createPriceTop(width, settings)
  const bottom = 28
  const gap = 10
  const volumeVisible =
    settings.volume.enabled ||
    settings.volumeMa.enabled ||
    settings.volumeRatio.enabled ||
    settings.turnoverRate.enabled
  const enabledSubPanes = [
    settings.macd.enabled ? ('macd' as const) : null,
    settings.rsi.enabled ? ('rsi' as const) : null,
    settings.kdj.enabled ? ('kdj' as const) : null
  ].filter((item): item is SubPaneLayout['id'] => item !== null)

  const volumeHeight = volumeVisible ? clamp(height * 0.18, 60, 104) : 0
  const subPaneHeight =
    enabledSubPanes.length === 0 ? 0 : clamp(height * (enabledSubPanes.length === 1 ? 0.18 : 0.14), 64, 96)
  const subGap = enabledSubPanes.length > 1 ? 6 : 0
  const subTotalHeight = enabledSubPanes.length * subPaneHeight + subGap
  let cursor = height - bottom

  const subAreaBottom = cursor
  const subAreaTop = subAreaBottom - subTotalHeight
  const subPanes = enabledSubPanes.map((id, index) => {
    const paneTop = subAreaTop + index * (subPaneHeight + (enabledSubPanes.length > 1 ? 6 : 0))
    return {
      id,
      top: paneTop,
      bottom: paneTop + subPaneHeight,
      height: subPaneHeight
    }
  })
  if (enabledSubPanes.length > 0) {
    cursor = subAreaTop - gap
  }

  const volumeBottom = cursor
  const volumeTop = volumeVisible ? volumeBottom - volumeHeight : volumeBottom
  if (volumeVisible) {
    cursor = volumeTop - gap
  }

  const priceBottom = Math.max(top + 80, cursor)
  const contentBottom =
    subPanes.at(-1)?.bottom ?? (volumeVisible ? volumeBottom : priceBottom)

  return {
    left,
    top,
    right,
    bottom,
    priceBottom,
    volumeTop,
    volumeBottom,
    volumeHeight,
    volumeVisible,
    width: Math.max(1, width - left - right),
    priceHeight: Math.max(1, priceBottom - top),
    subPanes,
    contentBottom,
    axisLabelY: height - bottom + 8
  }
}

function createPriceTop(width: number, settings: TimeshareIndicatorSettingsMap): number {
  const availableWidth = Math.max(1, width - 64 - 64 - 12)
  const itemsPerRow = Math.max(2, Math.floor(availableWidth / 72))
  const rowCount = Math.ceil(createPriceLegendItems(settings).length / itemsPerRow)
  return 24 + Math.max(0, rowCount - 1) * 16
}

function createPriceRange(
  dataset: EnrichedStockTimeshareDataset,
  settings: TimeshareIndicatorSettingsMap
): PriceRange {
  const values: number[] = []
  dataset.points.forEach((point) => {
    pushFinite(values, point.price)
    if (settings.avgPriceLine.enabled) {
      pushFinite(values, point.avgPrice)
    }
    if (settings.ma.enabled) {
      pushRecordValues(values, point.indicators.ma)
    }
    if (settings.ema.enabled) {
      pushRecordValues(values, point.indicators.ema)
    }
    if (settings.boll.enabled && point.indicators.boll) {
      pushFinite(values, point.indicators.boll.upper)
      pushFinite(values, point.indicators.boll.mid)
      pushFinite(values, point.indicators.boll.lower)
    }
  })
  if (settings.previousCloseLine.enabled) {
    pushFinite(values, dataset.previousClose)
  }

  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 1
  const center = dataset.previousClose > 0 ? dataset.previousClose : (min + max) / 2
  const span = Math.max(Math.abs(max - center), Math.abs(center - min), Math.abs(center) * 0.003, 0.01)
  return {
    min: center - span,
    max: center + span
  }
}

function createCoordinates(
  dataset: EnrichedStockTimeshareDataset,
  layout: ChartLayout,
  priceRange: PriceRange
): PointCoordinate[] {
  return dataset.points
    .map((point) => {
      const minuteIndex = getTradingMinuteIndex(point.timestamp)
      if (minuteIndex === null || !Number.isFinite(point.price)) {
        return null
      }
      return {
        point,
        x: layout.left + (minuteIndex / TRADING_MINUTES) * layout.width,
        y: priceToY(point.price, layout, priceRange)
      }
    })
    .filter((coordinate): coordinate is PointCoordinate => coordinate !== null)
}

function drawGrid(context: CanvasRenderingContext2D, layout: ChartLayout): void {
  context.strokeStyle = colors.grid
  context.lineWidth = 1
  context.beginPath()

  for (let index = 0; index <= 4; index += 1) {
    const y = layout.top + (layout.priceHeight / 4) * index
    context.moveTo(layout.left, y)
    context.lineTo(layout.left + layout.width, y)
  }

  ;[0, 60, 120, 180, 240].forEach((minuteIndex) => {
    const x = layout.left + (minuteIndex / TRADING_MINUTES) * layout.width
    context.moveTo(x, layout.top)
    context.lineTo(x, layout.contentBottom)
  })

  if (layout.volumeVisible) {
    context.moveTo(layout.left, layout.volumeTop)
    context.lineTo(layout.left + layout.width, layout.volumeTop)
  }

  layout.subPanes.forEach((pane) => {
    context.moveTo(layout.left, pane.top)
    context.lineTo(layout.left + layout.width, pane.top)
  })

  context.stroke()

  const labels = [
    { minute: 0, label: '09:30' },
    { minute: 120, label: '11:30/13:00' },
    { minute: 240, label: '15:00' }
  ]
  context.fillStyle = colors.axis
  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  context.textBaseline = 'top'
  context.textAlign = 'center'
  labels.forEach((item) => {
    const x = layout.left + (item.minute / TRADING_MINUTES) * layout.width
    context.fillText(item.label, x, layout.axisLabelY)
  })
}

function drawAxes(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceRange: PriceRange,
  previousClose: number
): void {
  context.fillStyle = colors.axis
  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  context.textBaseline = 'middle'

  for (let index = 0; index <= 4; index += 1) {
    const price = priceRange.max - ((priceRange.max - priceRange.min) / 4) * index
    const y = layout.top + (layout.priceHeight / 4) * index
    context.textAlign = 'right'
    context.fillText(price.toFixed(2), layout.left - 8, y)
    context.textAlign = 'left'
    const percent = previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0
    context.fillText(`${formatSigned(percent)}%`, layout.left + layout.width + 8, y)
  }
}

function drawPriceLines(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceRange: PriceRange,
  coordinates: PointCoordinate[],
  dataset: EnrichedStockTimeshareDataset,
  settings: TimeshareIndicatorSettingsMap
): void {
  drawValueLine(context, coordinates, (coordinate) => coordinate.point.price, {
    color: colors.price,
    toY: (value) => priceToY(value, layout, priceRange),
    lineWidth: 1.4
  })

  if (settings.avgPriceLine.enabled) {
    drawValueLine(context, coordinates, (coordinate) => finiteOrUndefined(coordinate.point.avgPrice), {
      color: colors.avgPrice,
      toY: (value) => priceToY(value, layout, priceRange)
    })
  }

  if (settings.ma.enabled) {
    settings.ma.params.forEach((period, index) => {
      drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.ma?.[period], {
        color: colors.ma[index % colors.ma.length],
        toY: (value) => priceToY(value, layout, priceRange)
      })
    })
  }

  if (settings.ema.enabled) {
    settings.ema.params.forEach((period, index) => {
      drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.ema?.[period], {
        color: colors.ema[index % colors.ema.length],
        toY: (value) => priceToY(value, layout, priceRange)
      })
    })
  }

  if (settings.boll.enabled) {
    drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.boll?.upper, {
      color: colors.boll.upper,
      toY: (value) => priceToY(value, layout, priceRange)
    })
    drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.boll?.mid, {
      color: colors.boll.mid,
      toY: (value) => priceToY(value, layout, priceRange)
    })
    drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.boll?.lower, {
      color: colors.boll.lower,
      toY: (value) => priceToY(value, layout, priceRange)
    })
  }

  if (settings.previousCloseLine.enabled) {
    drawPreviousClose(context, layout, priceRange, dataset.previousClose)
  }

}

function drawVolume(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  coordinates: PointCoordinate[],
  settings: TimeshareIndicatorSettingsMap
): void {
  if (!layout.volumeVisible || coordinates.length === 0) {
    return
  }

  const maxVolume = createVolumeMax(coordinates, settings)
  const barWidth = Math.max(1, Math.min(4, coordinates[1]?.x - coordinates[0].x || 2))

  if (settings.volume.enabled) {
    context.fillStyle = colors.volume
    coordinates.forEach((coordinate) => {
      const volume = finiteOrUndefined(coordinate.point.volume)
      if (volume === undefined || volume < 0) {
        return
      }
      const y = volumeToY(volume, layout, maxVolume)
      const height = layout.volumeBottom - y
      context.fillRect(coordinate.x - barWidth / 2, y, barWidth, Math.max(1, height))
    })
  }

  if (settings.volumeMa.enabled) {
    settings.volumeMa.params.forEach((period, index) => {
      drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.volumeMa?.[period], {
        color: colors.volumeMa[index % colors.volumeMa.length],
        toY: (value) => volumeToY(value, layout, maxVolume)
      })
    })
  }

  drawVolumeLegend(context, layout, settings)
}

function drawSubPanes(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  coordinates: PointCoordinate[],
  settings: TimeshareIndicatorSettingsMap
): void {
  layout.subPanes.forEach((pane) => {
    if (pane.id === 'macd') {
      drawMacdPane(context, pane, layout, coordinates)
    } else if (pane.id === 'rsi') {
      drawRsiPane(context, pane, layout, coordinates, settings)
    } else {
      drawKdjPane(context, pane, layout, coordinates)
    }
  })
}

function drawMacdPane(
  context: CanvasRenderingContext2D,
  pane: SubPaneLayout,
  layout: ChartLayout,
  coordinates: PointCoordinate[]
): void {
  const values: number[] = []
  coordinates.forEach((coordinate) => {
    const macd = coordinate.point.indicators.macd
    if (!macd) {
      return
    }
    pushFinite(values, macd.dif)
    pushFinite(values, macd.dea)
    pushFinite(values, macd.macd)
  })
  const range = createCenteredRange(values)
  const zeroY = valueToPaneY(0, pane, range)
  const barWidth = Math.max(1, Math.min(4, coordinates[1]?.x - coordinates[0].x || 2))

  drawLegend(context, createMacdLegendItems(), layout.left + 6, pane.top + 6, layout.width - 12)
  context.strokeStyle = colors.grid
  context.beginPath()
  context.moveTo(layout.left, zeroY)
  context.lineTo(layout.left + layout.width, zeroY)
  context.stroke()

  coordinates.forEach((coordinate) => {
    const value = finiteOrUndefined(coordinate.point.indicators.macd?.macd)
    if (value === undefined) {
      return
    }
    const y = valueToPaneY(value, pane, range)
    context.fillStyle = value >= 0 ? colors.macd.up : colors.macd.down
    context.fillRect(coordinate.x - barWidth / 2, Math.min(y, zeroY), barWidth, Math.max(1, Math.abs(y - zeroY)))
  })

  drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.macd?.dif, {
    color: colors.macd.dif,
    toY: (value) => valueToPaneY(value, pane, range)
  })
  drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.macd?.dea, {
    color: colors.macd.dea,
    toY: (value) => valueToPaneY(value, pane, range)
  })
}

function drawRsiPane(
  context: CanvasRenderingContext2D,
  pane: SubPaneLayout,
  layout: ChartLayout,
  coordinates: PointCoordinate[],
  settings: TimeshareIndicatorSettingsMap
): void {
  const range = { min: 0, max: 100 }
  drawLegend(
    context,
    createRsiLegendItems(settings),
    layout.left + 6,
    pane.top + 6,
    layout.width - 12
  )
  context.strokeStyle = colors.grid
  context.beginPath()
  ;[20, 50, 80].forEach((value) => {
    const y = valueToPaneY(value, pane, range)
    context.moveTo(layout.left, y)
    context.lineTo(layout.left + layout.width, y)
  })
  context.stroke()

  settings.rsi.params.forEach((period, index) => {
    drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.rsi?.[period], {
      color: colors.rsi[index % colors.rsi.length],
      toY: (value) => valueToPaneY(value, pane, range)
    })
  })
}

function drawKdjPane(
  context: CanvasRenderingContext2D,
  pane: SubPaneLayout,
  layout: ChartLayout,
  coordinates: PointCoordinate[]
): void {
  const values: number[] = []
  coordinates.forEach((coordinate) => {
    const kdj = coordinate.point.indicators.kdj
    if (!kdj) {
      return
    }
    pushFinite(values, kdj.k)
    pushFinite(values, kdj.d)
    pushFinite(values, kdj.j)
  })
  const range = createPaddedRange(values, { min: 0, max: 100 })
  drawLegend(context, createKdjLegendItems(), layout.left + 6, pane.top + 6, layout.width - 12)
  context.strokeStyle = colors.grid
  context.beginPath()
  ;[20, 50, 80].forEach((value) => {
    const y = valueToPaneY(value, pane, range)
    context.moveTo(layout.left, y)
    context.lineTo(layout.left + layout.width, y)
  })
  context.stroke()

  drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.kdj?.k, {
    color: colors.kdj.k,
    toY: (value) => valueToPaneY(value, pane, range)
  })
  drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.kdj?.d, {
    color: colors.kdj.d,
    toY: (value) => valueToPaneY(value, pane, range)
  })
  drawValueLine(context, coordinates, (coordinate) => coordinate.point.indicators.kdj?.j, {
    color: colors.kdj.j,
    toY: (value) => valueToPaneY(value, pane, range)
  })
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  coordinates: PointCoordinate[],
  crosshair: { x: number; y: number },
  priceRange: PriceRange,
  dataset: EnrichedStockTimeshareDataset,
  settings: TimeshareIndicatorSettingsMap
): void {
  const nearest = coordinates.reduce((current, item) =>
    Math.abs(item.x - crosshair.x) < Math.abs(current.x - crosshair.x) ? item : current
  )
  context.strokeStyle = colors.previousClose
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(nearest.x, layout.top)
  context.lineTo(nearest.x, layout.contentBottom)
  context.moveTo(layout.left, crosshair.y)
  context.lineTo(layout.left + layout.width, crosshair.y)
  context.stroke()

  const lines = createTooltipLines(nearest, crosshair.y, layout, dataset, settings)
  drawTooltip(context, layout, nearest.x, priceToY(nearest.point.price, layout, priceRange), lines)
}

function createTooltipLines(
  coordinate: PointCoordinate,
  y: number,
  layout: ChartLayout,
  dataset: EnrichedStockTimeshareDataset,
  settings: TimeshareIndicatorSettingsMap
): string[] {
  const point = coordinate.point
  const changePercent =
    dataset.previousClose > 0 ? ((point.price - dataset.previousClose) / dataset.previousClose) * 100 : 0
  const lines = [
    formatPointTime(point.timestamp),
    `价 ${formatNumber(point.price)}`,
    `${formatSigned(changePercent)}%`
  ]
  const pane = getPointerPane(y, layout)

  if (pane === 'price') {
    if (settings.avgPriceLine.enabled && Number.isFinite(point.avgPrice)) {
      lines.push(`均 ${formatNumber(point.avgPrice)}`)
    }
    if (settings.ma.enabled) {
      pushRecordTooltipLines(lines, 'MA', point.indicators.ma, settings.ma.params)
    }
    if (settings.ema.enabled) {
      pushRecordTooltipLines(lines, 'EMA', point.indicators.ema, settings.ema.params)
    }
    if (settings.boll.enabled && point.indicators.boll) {
      lines.push(`BOLL上 ${formatNumber(point.indicators.boll.upper)}`)
      lines.push(`BOLL中 ${formatNumber(point.indicators.boll.mid)}`)
      lines.push(`BOLL下 ${formatNumber(point.indicators.boll.lower)}`)
    }
  } else if (pane === 'volume') {
    lines.push(`量 ${formatNumber(point.volume, 0)}`)
    if (settings.volumeMa.enabled) {
      pushRecordTooltipLines(lines, 'VOL MA', point.indicators.volumeMa, settings.volumeMa.params, 0)
    }
    if (settings.volumeRatio.enabled && point.indicators.volumeRatio) {
      lines.push(`量比 ${formatNumber(point.indicators.volumeRatio.value)}`)
    }
    if (settings.turnoverRate.enabled && point.indicators.turnoverRate) {
      lines.push(`换手 ${formatNumber(point.indicators.turnoverRate.value)}%`)
    }
  } else if (pane === 'macd' && point.indicators.macd) {
    lines.push(`DIF ${formatNumber(point.indicators.macd.dif, 3)}`)
    lines.push(`DEA ${formatNumber(point.indicators.macd.dea, 3)}`)
    lines.push(`MACD ${formatNumber(point.indicators.macd.macd, 3)}`)
  } else if (pane === 'rsi') {
    pushRecordTooltipLines(lines, 'RSI', point.indicators.rsi, settings.rsi.params)
  } else if (pane === 'kdj' && point.indicators.kdj) {
    lines.push(`K ${formatNumber(point.indicators.kdj.k, 2)}`)
    lines.push(`D ${formatNumber(point.indicators.kdj.d, 2)}`)
    lines.push(`J ${formatNumber(point.indicators.kdj.j, 2)}`)
  }

  return lines.slice(0, 10)
}

function getPointerPane(y: number, layout: ChartLayout): 'price' | 'volume' | SubPaneLayout['id'] {
  const subPane = layout.subPanes.find((pane) => y >= pane.top && y <= pane.bottom)
  if (subPane) {
    return subPane.id
  }
  if (layout.volumeVisible && y >= layout.volumeTop && y <= layout.volumeBottom) {
    return 'volume'
  }
  return 'price'
}

function drawValueLine(
  context: CanvasRenderingContext2D,
  coordinates: PointCoordinate[],
  getValue: (coordinate: PointCoordinate) => number | undefined,
  options: {
    color: string
    toY: (value: number) => number
    lineWidth?: number
  }
): void {
  context.strokeStyle = options.color
  context.lineWidth = options.lineWidth ?? 1.2
  context.beginPath()
  let started = false

  coordinates.forEach((coordinate) => {
    const value = finiteOrUndefined(getValue(coordinate))
    if (value === undefined) {
      started = false
      return
    }
    const y = options.toY(value)
    if (!started) {
      context.moveTo(coordinate.x, y)
      started = true
    } else {
      context.lineTo(coordinate.x, y)
    }
  })

  context.stroke()
}

function drawPreviousClose(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceRange: PriceRange,
  previousClose: number
): void {
  if (previousClose <= 0 || !Number.isFinite(previousClose)) {
    return
  }
  const y = priceToY(previousClose, layout, priceRange)
  context.strokeStyle = colors.previousClose
  context.setLineDash([4, 4])
  context.beginPath()
  context.moveTo(layout.left, y)
  context.lineTo(layout.left + layout.width, y)
  context.stroke()
  context.setLineDash([])
}

function drawPriceLegend(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  settings: TimeshareIndicatorSettingsMap
): void {
  drawLegend(context, createPriceLegendItems(settings), layout.left + 6, 6, layout.width - 12)
}

function drawVolumeLegend(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  settings: TimeshareIndicatorSettingsMap
): void {
  if (!layout.volumeVisible) {
    return
  }
  drawLegend(
    context,
    createVolumeLegendItems(settings),
    layout.left + 6,
    layout.volumeTop + 6,
    layout.width - 12
  )
}

function drawLegend(
  context: CanvasRenderingContext2D,
  items: LegendItem[],
  left: number,
  top: number,
  maxWidth: number
): void {
  if (items.length === 0) {
    return
  }

  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  context.textBaseline = 'middle'
  let x = left
  let y = top + 7
  const rowHeight = 16
  const swatchWidth = 14
  const itemGap = 10

  items.forEach((item) => {
    const textWidth = context.measureText(item.label).width
    const itemWidth = swatchWidth + 4 + textWidth + itemGap
    if (x > left && x + itemWidth > left + maxWidth) {
      x = left
      y += rowHeight
    }

    if (item.marker) {
      context.fillStyle = item.color
      context.beginPath()
      context.arc(x + swatchWidth / 2, y, 6, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = '#ffffff'
      context.font = '9px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      context.textAlign = 'center'
      context.fillText(item.marker, x + swatchWidth / 2, y)
      context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    } else {
      context.strokeStyle = item.color
      context.lineWidth = 1.4
      if (item.dashed) {
        context.setLineDash([4, 4])
      }
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x + swatchWidth, y)
      context.stroke()
      if (item.dashed) {
        context.setLineDash([])
      }
    }

    context.fillStyle = colors.tooltipText
    context.textAlign = 'left'
    context.fillText(item.label, x + swatchWidth + 4, y)
    x += itemWidth
  })
}

function createPriceLegendItems(settings: TimeshareIndicatorSettingsMap): LegendItem[] {
  const items: LegendItem[] = [{ label: '价格', color: colors.price }]
  if (settings.avgPriceLine.enabled) {
    items.push({ label: '均价', color: colors.avgPrice })
  }
  if (settings.previousCloseLine.enabled) {
    items.push({ label: '昨收', color: colors.previousClose, dashed: true })
  }
  if (settings.ma.enabled) {
    settings.ma.params.forEach((period, index) => {
      items.push({ label: `MA${period}`, color: colors.ma[index % colors.ma.length] })
    })
  }
  if (settings.ema.enabled) {
    settings.ema.params.forEach((period, index) => {
      items.push({ label: `EMA${period}`, color: colors.ema[index % colors.ema.length] })
    })
  }
  if (settings.boll.enabled) {
    items.push({ label: 'BOLL上', color: colors.boll.upper })
    items.push({ label: 'BOLL中', color: colors.boll.mid })
    items.push({ label: 'BOLL下', color: colors.boll.lower })
  }
  return items
}

function createVolumeLegendItems(settings: TimeshareIndicatorSettingsMap): LegendItem[] {
  const items: LegendItem[] = []
  if (settings.volume.enabled) {
    items.push({ label: '成交量', color: colors.volume })
  }
  if (settings.volumeMa.enabled) {
    settings.volumeMa.params.forEach((period, index) => {
      items.push({ label: `VOL MA${period}`, color: colors.volumeMa[index % colors.volumeMa.length] })
    })
  }
  if (settings.volumeRatio.enabled) {
    items.push({ label: '量比', color: colors.volumeRatio })
  }
  if (settings.turnoverRate.enabled) {
    items.push({ label: '换手率', color: colors.turnoverRate })
  }
  return items
}

function createMacdLegendItems(): LegendItem[] {
  return [
    { label: 'DIF', color: colors.macd.dif },
    { label: 'DEA', color: colors.macd.dea },
    { label: 'MACD柱', color: colors.macd.up }
  ]
}

function createRsiLegendItems(settings: TimeshareIndicatorSettingsMap): LegendItem[] {
  return settings.rsi.params.map((period, index) => ({
    label: `RSI${period}`,
    color: colors.rsi[index % colors.rsi.length]
  }))
}

function createKdjLegendItems(): LegendItem[] {
  return [
    { label: 'K', color: colors.kdj.k },
    { label: 'D', color: colors.kdj.d },
    { label: 'J', color: colors.kdj.j }
  ]
}

function drawTooltip(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  x: number,
  y: number,
  lines: string[]
): void {
  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  const width = Math.max(132, Math.min(220, Math.max(...lines.map((line) => context.measureText(line).width)) + 20))
  const height = lines.length * 18 + 14
  const left = x + width + 12 > layout.left + layout.width ? x - width - 12 : x + 12
  const top = Math.max(layout.top + 6, Math.min(y - height / 2, layout.contentBottom - height - 6))

  context.fillStyle = colors.tooltipBackground
  context.strokeStyle = colors.tooltipBorder
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(left, top, width, height, 6)
  context.fill()
  context.stroke()

  context.fillStyle = colors.tooltipText
  context.textAlign = 'left'
  context.textBaseline = 'top'
  lines.forEach((line, index) => {
    context.fillText(line, left + 10, top + 8 + index * 18)
  })
}

function priceToY(value: number, layout: ChartLayout, range: PriceRange): number {
  return layout.top + ((range.max - value) / (range.max - range.min)) * layout.priceHeight
}

function volumeToY(value: number, layout: ChartLayout, maxVolume: number): number {
  return layout.volumeBottom - (value / maxVolume) * layout.volumeHeight
}

function valueToPaneY(value: number, pane: SubPaneLayout, range: ValueRange): number {
  return pane.top + ((range.max - value) / (range.max - range.min)) * pane.height
}

function createVolumeMax(
  coordinates: PointCoordinate[],
  settings: TimeshareIndicatorSettingsMap
): number {
  const values: number[] = []
  coordinates.forEach((coordinate) => {
    if (settings.volume.enabled) {
      pushFinite(values, coordinate.point.volume)
    }
    if (settings.volumeMa.enabled) {
      pushRecordValues(values, coordinate.point.indicators.volumeMa)
    }
  })
  return Math.max(...values.filter((value) => value >= 0), 1)
}

function createCenteredRange(values: number[]): ValueRange {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) {
    return { min: -1, max: 1 }
  }
  const maxAbs = Math.max(...finiteValues.map((value) => Math.abs(value)), 0.01)
  return {
    min: -maxAbs,
    max: maxAbs
  }
}

function createPaddedRange(values: number[], fallback: ValueRange): ValueRange {
  const finiteValues = values.filter((value) => Number.isFinite(value))
  if (finiteValues.length === 0) {
    return fallback
  }
  const min = Math.min(fallback.min, ...finiteValues)
  const max = Math.max(fallback.max, ...finiteValues)
  const padding = Math.max((max - min) * 0.08, 1)
  return {
    min: min - padding,
    max: max + padding
  }
}

function pushFinite(values: number[], value: number | undefined): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    values.push(value)
  }
}

function pushRecordValues(values: number[], record: Record<string, number | undefined> | undefined): void {
  if (!record) {
    return
  }
  Object.values(record).forEach((value) => pushFinite(values, value))
}

function pushRecordTooltipLines(
  lines: string[],
  label: string,
  record: Record<string, number | undefined> | undefined,
  periods: number[],
  digits = 2
): void {
  periods.forEach((period) => {
    const value = record?.[period]
    if (typeof value === 'number' && Number.isFinite(value)) {
      lines.push(`${label}${period} ${formatNumber(value, digits)}`)
    }
  })
}

function finiteOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function formatSigned(value: number): string {
  if (value > 0) {
    return `+${value.toFixed(2)}`
  }
  if (value < 0) {
    return value.toFixed(2)
  }
  return '0.00'
}

function formatPointTime(timestamp: number): string {
  const date = new Date(timestamp)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
