import { makeAutoObservable } from 'mobx'
import {
  canEnableIndicator as canEnableIndicatorInSettings,
  cloneIndicatorSettings,
  cloneIndicatorStyles,
  countEnabledSubIndicators,
  createDefaultIndicatorSettings,
  createDefaultIndicatorStyles,
  getIndicatorDefinition,
  indicatorDefinitions,
  normalizeIndicatorSettings,
  validateIndicatorSettings
} from '../models/indicator-definitions'
import type {
  EnrichedStockDataset,
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorName,
  IndicatorSettings,
  IndicatorSettingsMap,
  IndicatorVisualSettings
} from '../models/stock-types'

export class KLineChartViewModel {
  dataset: EnrichedStockDataset | null = null
  indicatorSettings: IndicatorSettingsMap = createDefaultIndicatorSettings()
  previewIndicatorSettings: IndicatorSettingsMap | null = null
  indicatorDialogOpen = false
  indicatorDraft: IndicatorSettingsMap = createDefaultIndicatorSettings()
  revision = 0

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  setDataset(dataset: EnrichedStockDataset): void {
    this.dataset = dataset
    this.revision += 1
  }

  setIndicator(name: IndicatorName, enabled: boolean): void {
    if (enabled && !canEnableIndicatorInSettings(this.indicatorSettings, name)) {
      return
    }
    this.indicatorSettings = patchIndicatorSetting(this.indicatorSettings, name, {
      enabled
    })
    this.previewIndicatorSettings = null
    this.revision += 1
  }

  setIndicators(enabledIndicators: Partial<Record<IndicatorName, boolean>>): void {
    this.indicatorSettings = normalizeIndicatorSettings(null, enabledIndicators)
    this.previewIndicatorSettings = null
    this.revision += 1
  }

  setIndicatorSettings(
    indicatorSettings?: Partial<Record<IndicatorName, Partial<IndicatorSettings>>> | null,
    legacyEnabledIndicators?: Partial<Record<IndicatorName, boolean>> | null
  ): void {
    this.indicatorSettings = normalizeIndicatorSettings(indicatorSettings, legacyEnabledIndicators)
    this.previewIndicatorSettings = null
    this.revision += 1
  }

  openIndicatorDialog(): void {
    this.indicatorDraft = cloneIndicatorSettings(this.indicatorSettings)
    this.previewIndicatorSettings = null
    this.indicatorDialogOpen = true
  }

  closeIndicatorDialog(): void {
    this.indicatorDialogOpen = false
    this.indicatorDraft = cloneIndicatorSettings(this.indicatorSettings)
    this.previewIndicatorSettings = null
    this.revision += 1
  }

  applyIndicatorDraft(): boolean {
    if (this.indicatorDraftHasErrors) {
      return false
    }
    this.indicatorSettings = normalizeIndicatorSettings(this.indicatorDraft)
    this.previewIndicatorSettings = null
    this.indicatorDraft = cloneIndicatorSettings(this.indicatorSettings)
    this.indicatorDialogOpen = false
    this.revision += 1
    return true
  }

  setIndicatorDraftEnabled(name: IndicatorName, enabled: boolean): void {
    if (enabled && !canEnableIndicatorInSettings(this.indicatorDraft, name)) {
      return
    }
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      enabled
    })
    this.syncIndicatorPreview()
  }

  setIndicatorDraftParam(name: IndicatorName, index: number, value: number): void {
    const current = this.indicatorDraft[name]
    if (!current || index < 0 || index >= current.params.length) {
      return
    }
    const params = [...current.params]
    params[index] = value
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      params
    })
    this.syncIndicatorPreview()
  }

  setIndicatorDraftParams(name: IndicatorName, params: number[]): void {
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      params: [...params]
    })
    this.syncIndicatorPreview()
  }

  resetIndicatorDraftParams(name: IndicatorName): void {
    const definition = getIndicatorDefinition(name)
    this.setIndicatorDraftParams(name, definition.defaultParams)
  }

  setIndicatorDraftPrecision(name: IndicatorName, precision: number): void {
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      precision
    })
    this.syncIndicatorPreview()
  }

  setIndicatorDraftLineColor(name: IndicatorName, index: number, color: string): void {
    const line = this.indicatorDraft[name].styles.lines?.[index]
    if (!line) {
      return
    }
    this.patchIndicatorDraftStyles(name, {
      lines: this.indicatorDraft[name].styles.lines?.map((item, itemIndex) =>
        itemIndex === index ? { ...item, color } : { ...item }
      )
    })
  }

  setIndicatorDraftLineStyle(name: IndicatorName, index: number, lineStyle: IndicatorLineStyle): void {
    const line = this.indicatorDraft[name].styles.lines?.[index]
    if (!line) {
      return
    }
    this.patchIndicatorDraftStyles(name, {
      lines: this.indicatorDraft[name].styles.lines?.map((item, itemIndex) =>
        itemIndex === index ? { ...item, lineStyle } : { ...item }
      )
    })
  }

  setIndicatorDraftBarColor(
    name: IndicatorName,
    key: keyof IndicatorBarVisualStyle,
    color: string
  ): void {
    const bar = this.indicatorDraft[name].styles.bar
    if (!bar) {
      return
    }
    this.patchIndicatorDraftStyles(name, {
      bar: {
        ...bar,
        [key]: color
      }
    })
  }

  setIndicatorDraftMarkerColor(
    name: IndicatorName,
    key: 'buyColor' | 'sellColor',
    color: string
  ): void {
    const marker = this.indicatorDraft[name].styles.marker
    if (!marker) {
      return
    }
    this.patchIndicatorDraftStyles(name, {
      marker: {
        ...marker,
        [key]: color
      }
    })
  }

  resetIndicatorDraftStyle(name: IndicatorName): void {
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      styles: createDefaultIndicatorStyles(name)
    })
    this.syncIndicatorPreview()
  }

  canEnableIndicator(name: IndicatorName): boolean {
    return canEnableIndicatorInSettings(this.indicatorDraft, name)
  }

  get hasDataset(): boolean {
    return this.dataset !== null && this.dataset.candles.length > 0
  }

  get title(): string {
    if (!this.dataset) {
      return '未加载数据'
    }
    return `${this.dataset.meta.name}(${this.dataset.meta.symbol}) ${this.dataset.meta.lineType}`
  }

  get sourceLabel(): string {
    if (!this.dataset) {
      return '未加载'
    }
    return this.dataset.sourceName ?? this.dataset.sourcePath ?? '远端行情'
  }

  get enabledIndicators(): Record<IndicatorName, boolean> {
    return Object.fromEntries(
      indicatorDefinitions.map((definition) => [
        definition.name,
        this.indicatorSettings[definition.name].enabled
      ])
    ) as Record<IndicatorName, boolean>
  }

  get effectiveIndicatorSettings(): IndicatorSettingsMap {
    return this.previewIndicatorSettings ?? this.indicatorSettings
  }

  get enabledSubIndicatorCount(): number {
    return countEnabledSubIndicators(this.indicatorSettings)
  }

  get draftEnabledSubIndicatorCount(): number {
    return countEnabledSubIndicators(this.indicatorDraft)
  }

  get indicatorDraftErrors(): Partial<Record<IndicatorName, string[]>> {
    const errors: Partial<Record<IndicatorName, string[]>> = {}
    indicatorDefinitions.forEach((definition) => {
      const indicatorErrors = validateIndicatorSettings(definition.name, this.indicatorDraft[definition.name])
      if (indicatorErrors.length > 0) {
        errors[definition.name] = indicatorErrors
      }
    })
    return errors
  }

  get indicatorDraftHasErrors(): boolean {
    return Object.values(this.indicatorDraftErrors).some((errors) => (errors?.length ?? 0) > 0)
  }

  private patchIndicatorDraftStyles(name: IndicatorName, stylesPatch: IndicatorVisualSettings): void {
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      styles: {
        ...this.indicatorDraft[name].styles,
        ...stylesPatch
      }
    })
    this.syncIndicatorPreview()
  }

  private syncIndicatorPreview(): void {
    if (this.indicatorDraftHasErrors) {
      return
    }
    this.previewIndicatorSettings = normalizeIndicatorSettings(this.indicatorDraft)
    this.revision += 1
  }
}

function patchIndicatorSetting(
  settings: IndicatorSettingsMap,
  name: IndicatorName,
  patch: Partial<IndicatorSettings>
): IndicatorSettingsMap {
  return {
    ...settings,
    [name]: {
      ...settings[name],
      ...patch,
      params: patch.params ? [...patch.params] : [...settings[name].params],
      styles: patch.styles ? cloneIndicatorStyles(patch.styles) : cloneIndicatorStyles(settings[name].styles)
    }
  }
}
