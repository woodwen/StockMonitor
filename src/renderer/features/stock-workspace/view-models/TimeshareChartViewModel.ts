import { makeAutoObservable } from 'mobx'
import {
  canEnableTimeshareIndicator as canEnableIndicatorInSettings,
  cloneTimeshareIndicatorSettings,
  countEnabledTimeshareSubIndicators,
  createDefaultTimeshareIndicatorSettings,
  getTimeshareIndicatorDefinition,
  normalizeTimeshareIndicatorSettings,
  timeshareIndicatorDefinitions,
  validateTimeshareIndicatorParams
} from '../models/timeshare-indicator-definitions'
import { enrichTimeshareDataset } from '../models/timeshare-indicator-engine'
import type {
  EnrichedStockTimeshareDataset,
  StockTimeshareDataset,
  StockTimesharePoint,
  TimeshareIndicatorAvailability,
  TimeshareIndicatorName,
  TimeshareIndicatorSettings,
  TimeshareIndicatorSettingsMap
} from '../models/stock-types'

export class TimeshareChartViewModel {
  dataset: EnrichedStockTimeshareDataset | null = null
  rawDataset: StockTimeshareDataset | null = null
  indicatorSettings: TimeshareIndicatorSettingsMap = createDefaultTimeshareIndicatorSettings()
  indicatorDialogOpen = false
  indicatorDraft: TimeshareIndicatorSettingsMap = createDefaultTimeshareIndicatorSettings()
  revision = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDataset(dataset: StockTimeshareDataset): void {
    this.rawDataset = dataset
    this.dataset = enrichTimeshareDataset(dataset, this.indicatorSettings)
    this.revision += 1
  }

  setIndicatorSettings(
    indicatorSettings?: Partial<Record<TimeshareIndicatorName, Partial<TimeshareIndicatorSettings>>> | null
  ): void {
    this.indicatorSettings = normalizeTimeshareIndicatorSettings(indicatorSettings)
    this.reenrichCurrentDataset()
    this.revision += 1
  }

  openIndicatorDialog(): void {
    this.indicatorDraft = cloneTimeshareIndicatorSettings(this.indicatorSettings)
    this.indicatorDialogOpen = true
  }

  closeIndicatorDialog(): void {
    this.indicatorDialogOpen = false
    this.indicatorDraft = cloneTimeshareIndicatorSettings(this.indicatorSettings)
  }

  applyIndicatorDraft(): boolean {
    if (this.indicatorDraftHasErrors) {
      return false
    }
    this.indicatorSettings = normalizeTimeshareIndicatorSettings(this.indicatorDraft)
    this.indicatorDialogOpen = false
    this.reenrichCurrentDataset()
    this.revision += 1
    return true
  }

  setIndicatorDraftEnabled(name: TimeshareIndicatorName, enabled: boolean): void {
    if (enabled && !canEnableIndicatorInSettings(this.indicatorDraft, name)) {
      return
    }
    this.indicatorDraft = patchTimeshareIndicatorSetting(this.indicatorDraft, name, {
      enabled
    })
  }

  setIndicatorDraftParam(name: TimeshareIndicatorName, index: number, value: number): void {
    const current = this.indicatorDraft[name]
    if (!current || index < 0 || index >= current.params.length) {
      return
    }
    const params = [...current.params]
    params[index] = value
    this.indicatorDraft = patchTimeshareIndicatorSetting(this.indicatorDraft, name, {
      params
    })
  }

  setIndicatorDraftParams(name: TimeshareIndicatorName, params: number[]): void {
    this.indicatorDraft = patchTimeshareIndicatorSetting(this.indicatorDraft, name, {
      params: [...params]
    })
  }

  resetIndicatorDraftParams(name: TimeshareIndicatorName): void {
    const definition = getTimeshareIndicatorDefinition(name)
    this.setIndicatorDraftParams(name, definition.defaultParams)
  }

  canEnableIndicator(name: TimeshareIndicatorName): boolean {
    return canEnableIndicatorInSettings(this.indicatorDraft, name)
  }

  get hasDataset(): boolean {
    return this.dataset !== null && this.dataset.points.length > 0
  }

  get title(): string {
    if (!this.dataset) {
      return '未加载数据'
    }
    return `${this.dataset.meta.name}(${this.dataset.meta.symbol}) 分时`
  }

  get sourceLabel(): string {
    if (!this.dataset) {
      return '未加载'
    }
    return this.dataset.sourceName ?? this.dataset.sourceUrl ?? '远端分时'
  }

  get latestPoint(): StockTimesharePoint | null {
    const points = this.dataset?.points ?? []
    return points.length > 0 ? points[points.length - 1] : null
  }

  get recordCount(): number {
    return this.dataset?.points.length ?? 0
  }

  get enabledSubIndicatorCount(): number {
    return countEnabledTimeshareSubIndicators(this.indicatorSettings)
  }

  get draftEnabledSubIndicatorCount(): number {
    return countEnabledTimeshareSubIndicators(this.indicatorDraft)
  }

  get indicatorDraftErrors(): Partial<Record<TimeshareIndicatorName, string[]>> {
    const errors: Partial<Record<TimeshareIndicatorName, string[]>> = {}
    timeshareIndicatorDefinitions.forEach((definition) => {
      const indicatorErrors = validateTimeshareIndicatorParams(
        definition.name,
        this.indicatorDraft[definition.name].params
      )
      if (indicatorErrors.length > 0) {
        errors[definition.name] = indicatorErrors
      }
    })
    return errors
  }

  get indicatorDraftHasErrors(): boolean {
    return Object.values(this.indicatorDraftErrors).some((errors) => (errors?.length ?? 0) > 0)
  }

  getIndicatorAvailability(name: TimeshareIndicatorName): TimeshareIndicatorAvailability | undefined {
    return this.dataset?.indicatorAvailability[name]
  }

  get latestSummary(): string {
    const latest = this.latestPoint
    if (!latest || !this.dataset) {
      return '暂无分时'
    }

    const previousClose = this.dataset.previousClose
    const change = latest.price - previousClose
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    const advancedSummary = formatLatestAdvancedSummary(this.dataset, latest)
    return [
      `价 ${formatNumber(latest.price)}`,
      `涨跌 ${formatSignedNumber(change)}`,
      `${formatSignedNumber(changePercent)}%`,
      advancedSummary
    ]
      .filter(Boolean)
      .join('  ')
  }

  private reenrichCurrentDataset(): void {
    if (!this.rawDataset) {
      return
    }
    this.dataset = enrichTimeshareDataset(this.rawDataset, this.indicatorSettings)
  }
}

function patchTimeshareIndicatorSetting(
  settings: TimeshareIndicatorSettingsMap,
  name: TimeshareIndicatorName,
  patch: Partial<TimeshareIndicatorSettings>
): TimeshareIndicatorSettingsMap {
  return {
    ...settings,
    [name]: {
      ...settings[name],
      ...patch,
      params: patch.params ? [...patch.params] : [...settings[name].params]
    }
  }
}

function formatNumber(value: number, digits = 2): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

function formatSignedNumber(value: number, digits = 2): string {
  const formatted = formatNumber(Math.abs(value), digits)
  if (value > 0) {
    return `+${formatted}`
  }
  if (value < 0) {
    return `-${formatted}`
  }
  return formatted
}

function formatLatestAdvancedSummary(
  dataset: EnrichedStockTimeshareDataset,
  latest: StockTimesharePoint & {
    indicators?: {
      volumeRatio?: { value: number }
      turnoverRate?: { value: number }
    }
  }
): string {
  const parts: string[] = []
  if (dataset.indicatorSettings.volumeRatio.enabled && latest.indicators?.volumeRatio) {
    parts.push(`量比 ${formatNumber(latest.indicators.volumeRatio.value)}`)
  }
  if (dataset.indicatorSettings.turnoverRate.enabled && latest.indicators?.turnoverRate) {
    parts.push(`换手 ${formatNumber(latest.indicators.turnoverRate.value)}%`)
  }
  if (dataset.indicatorSettings.orderRatio.enabled && dataset.latestIndicators.orderRatio) {
    parts.push(`委比 ${formatSignedNumber(dataset.latestIndicators.orderRatio.value)}%`)
  }
  if (dataset.indicatorSettings.capitalFlow.enabled && dataset.latestIndicators.capitalFlow) {
    parts.push(`净流入 ${formatSignedNumber(dataset.latestIndicators.capitalFlow.netInflow, 0)}`)
  }
  if (dataset.indicatorSettings.inOutVolume.enabled && dataset.latestIndicators.inOutVolume) {
    parts.push(
      `内 ${formatNumber(dataset.latestIndicators.inOutVolume.inwardVolume, 0)} 外 ${formatNumber(dataset.latestIndicators.inOutVolume.outwardVolume, 0)}`
    )
  }
  return parts.slice(0, 3).join('  ')
}
