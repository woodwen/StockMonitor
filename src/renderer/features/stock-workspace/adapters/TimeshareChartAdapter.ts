import type { StockTimeshareDataset, StockTimesharePoint } from '../models/stock-types'

const MORNING_START = 9 * 60 + 30
const MORNING_END = 11 * 60 + 30
const AFTERNOON_START = 13 * 60
const AFTERNOON_END = 15 * 60
const TRADING_MINUTES = 240

interface PointCoordinate {
  point: StockTimesharePoint
  x: number
  y: number
  volumeY: number
  volumeHeight: number
}

interface ChartLayout {
  left: number
  top: number
  right: number
  bottom: number
  priceBottom: number
  volumeTop: number
  width: number
  priceHeight: number
  volumeHeight: number
}

interface PriceRange {
  min: number
  max: number
}

export class TimeshareChartAdapter {
  private container: HTMLElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private dataset: StockTimeshareDataset | null = null
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

  setDataset(dataset: StockTimeshareDataset): void {
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
    context.fillStyle = '#0d131d'
    context.fillRect(0, 0, width, height)

    const dataset = this.dataset
    if (!dataset || dataset.points.length === 0) {
      return
    }

    const layout = createLayout(width, height)
    const priceRange = createPriceRange(dataset)
    const coordinates = createCoordinates(dataset, layout, priceRange)

    drawGrid(context, layout)
    drawAxes(context, layout, priceRange, dataset.previousClose)
    drawVolume(context, coordinates)
    drawLine(context, layout, priceRange, coordinates, 'price', '#ef5350')
    drawLine(context, layout, priceRange, coordinates, 'avgPrice', '#facc15')
    drawPreviousClose(context, layout, priceRange, dataset.previousClose)

    if (this.crosshair) {
      drawCrosshair(context, layout, coordinates, this.crosshair, priceRange, dataset.previousClose)
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

function createLayout(width: number, height: number): ChartLayout {
  const left = 64
  const right = 64
  const top = 24
  const bottom = 28
  const volumeHeight = Math.max(72, Math.min(108, height * 0.24))
  const volumeTop = height - bottom - volumeHeight
  const priceBottom = volumeTop - 12
  return {
    left,
    top,
    right,
    bottom,
    priceBottom,
    volumeTop,
    width: Math.max(1, width - left - right),
    priceHeight: Math.max(1, priceBottom - top),
    volumeHeight
  }
}

function createPriceRange(dataset: StockTimeshareDataset): PriceRange {
  const values = dataset.points.flatMap((point) => [point.price, point.avgPrice])
  if (dataset.previousClose > 0) {
    values.push(dataset.previousClose)
  }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const center = dataset.previousClose > 0 ? dataset.previousClose : (min + max) / 2
  const span = Math.max(Math.abs(max - center), Math.abs(center - min), center * 0.003, 0.01)
  return {
    min: center - span,
    max: center + span
  }
}

function createCoordinates(
  dataset: StockTimeshareDataset,
  layout: ChartLayout,
  priceRange: PriceRange
): PointCoordinate[] {
  const maxVolume = Math.max(...dataset.points.map((point) => point.volume), 1)

  return dataset.points
    .map((point) => {
      const minuteIndex = getTradingMinuteIndex(point.timestamp)
      if (minuteIndex === null) {
        return null
      }
      const x = layout.left + (minuteIndex / TRADING_MINUTES) * layout.width
      const volumeHeight = Math.max(1, (point.volume / maxVolume) * layout.volumeHeight)
      return {
        point,
        x,
        y: priceToY(point.price, layout, priceRange),
        volumeY: layout.volumeTop + layout.volumeHeight - volumeHeight,
        volumeHeight
      }
    })
    .filter((coordinate): coordinate is PointCoordinate => coordinate !== null)
}

function drawGrid(context: CanvasRenderingContext2D, layout: ChartLayout): void {
  context.strokeStyle = '#263241'
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
    context.lineTo(x, layout.volumeTop + layout.volumeHeight)
  })

  context.moveTo(layout.left, layout.volumeTop)
  context.lineTo(layout.left + layout.width, layout.volumeTop)
  context.stroke()
}

function drawAxes(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceRange: PriceRange,
  previousClose: number
): void {
  context.fillStyle = '#95a3b8'
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

  const labels = [
    { minute: 0, label: '09:30' },
    { minute: 120, label: '11:30/13:00' },
    { minute: 240, label: '15:00' }
  ]
  context.textBaseline = 'top'
  context.textAlign = 'center'
  labels.forEach((item) => {
    const x = layout.left + (item.minute / TRADING_MINUTES) * layout.width
    context.fillText(item.label, x, layout.volumeTop + layout.volumeHeight + 8)
  })
}

function drawVolume(context: CanvasRenderingContext2D, coordinates: PointCoordinate[]): void {
  if (coordinates.length === 0) {
    return
  }
  const barWidth = Math.max(1, Math.min(4, coordinates[1]?.x - coordinates[0].x || 2))
  context.fillStyle = '#334155'
  coordinates.forEach((coordinate) => {
    context.fillRect(coordinate.x - barWidth / 2, coordinate.volumeY, barWidth, coordinate.volumeHeight)
  })
}

function drawLine(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceRange: PriceRange,
  coordinates: PointCoordinate[],
  field: 'price' | 'avgPrice',
  color: string
): void {
  context.strokeStyle = color
  context.lineWidth = 1.4
  context.beginPath()
  coordinates.forEach((coordinate, index) => {
    const y =
      field === 'price' ? coordinate.y : priceToY(coordinate.point.avgPrice, layout, priceRange)
    if (index === 0) {
      context.moveTo(coordinate.x, y)
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
  if (previousClose <= 0) {
    return
  }
  const y = priceToY(previousClose, layout, priceRange)
  context.strokeStyle = '#64748b'
  context.setLineDash([4, 4])
  context.beginPath()
  context.moveTo(layout.left, y)
  context.lineTo(layout.left + layout.width, y)
  context.stroke()
  context.setLineDash([])
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  coordinates: PointCoordinate[],
  crosshair: { x: number; y: number },
  priceRange: PriceRange,
  previousClose: number
): void {
  const nearest = coordinates.reduce((current, item) =>
    Math.abs(item.x - crosshair.x) < Math.abs(current.x - crosshair.x) ? item : current
  )
  context.strokeStyle = '#64748b'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(nearest.x, layout.top)
  context.lineTo(nearest.x, layout.volumeTop + layout.volumeHeight)
  context.moveTo(layout.left, crosshair.y)
  context.lineTo(layout.left + layout.width, crosshair.y)
  context.stroke()

  const changePercent =
    previousClose > 0 ? ((nearest.point.price - previousClose) / previousClose) * 100 : 0
  const lines = [
    formatPointTime(nearest.point.timestamp),
    `价 ${nearest.point.price.toFixed(2)}`,
    `均 ${nearest.point.avgPrice.toFixed(2)}`,
    `${formatSigned(changePercent)}%`,
    `量 ${Math.round(nearest.point.volume).toLocaleString('zh-CN')}`
  ]
  drawTooltip(context, layout, nearest.x, priceToY(nearest.point.price, layout, priceRange), lines)
}

function drawTooltip(
  context: CanvasRenderingContext2D,
  layout: ChartLayout,
  x: number,
  y: number,
  lines: string[]
): void {
  const width = 132
  const height = lines.length * 18 + 14
  const left = x + width + 12 > layout.left + layout.width ? x - width - 12 : x + 12
  const top = Math.max(layout.top + 6, Math.min(y - height / 2, layout.priceBottom - height - 6))

  context.fillStyle = 'rgba(15, 23, 42, 0.92)'
  context.strokeStyle = '#334155'
  context.lineWidth = 1
  context.beginPath()
  context.roundRect(left, top, width, height, 6)
  context.fill()
  context.stroke()

  context.fillStyle = '#d7e0ea'
  context.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  context.textAlign = 'left'
  context.textBaseline = 'top'
  lines.forEach((line, index) => {
    context.fillText(line, left + 10, top + 8 + index * 18)
  })
}

function priceToY(value: number, layout: ChartLayout, range: PriceRange): number {
  return layout.top + ((range.max - value) / (range.max - range.min)) * layout.priceHeight
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
