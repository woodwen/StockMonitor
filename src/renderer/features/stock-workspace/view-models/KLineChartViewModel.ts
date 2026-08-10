import { makeAutoObservable } from 'mobx'
import {
  canEnableIndicator as canEnableIndicatorInSettings,
  cloneIndicatorSettings,
  countEnabledSubIndicators,
  createDefaultIndicatorSettings,
  getIndicatorDefinition,
  indicatorDefinitions,
  normalizeIndicatorSettings,
  validateIndicatorParams
} from '../models/indicator-definitions'
import type {
  EnrichedStockDataset,
  IndicatorName,
  IndicatorSettings,
  IndicatorSettingsMap
} from '../models/stock-types'

export class KLineChartViewModel {
  dataset: EnrichedStockDataset | null = null
  indicatorSettings: IndicatorSettingsMap = createDefaultIndicatorSettings()
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
    this.revision += 1
  }

  setIndicators(enabledIndicators: Partial<Record<IndicatorName, boolean>>): void {
    this.indicatorSettings = normalizeIndicatorSettings(null, enabledIndicators)
    this.revision += 1
  }

  setIndicatorSettings(
    indicatorSettings?: Partial<Record<IndicatorName, Partial<IndicatorSettings>>> | null,
    legacyEnabledIndicators?: Partial<Record<IndicatorName, boolean>> | null
  ): void {
    this.indicatorSettings = normalizeIndicatorSettings(indicatorSettings, legacyEnabledIndicators)
    this.revision += 1
  }

  openIndicatorDialog(): void {
    this.indicatorDraft = cloneIndicatorSettings(this.indicatorSettings)
    this.indicatorDialogOpen = true
  }

  closeIndicatorDialog(): void {
    this.indicatorDialogOpen = false
    this.indicatorDraft = cloneIndicatorSettings(this.indicatorSettings)
  }

  applyIndicatorDraft(): boolean {
    if (this.indicatorDraftHasErrors) {
      return false
    }
    this.indicatorSettings = normalizeIndicatorSettings(this.indicatorDraft)
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
  }

  setIndicatorDraftParams(name: IndicatorName, params: number[]): void {
    this.indicatorDraft = patchIndicatorSetting(this.indicatorDraft, name, {
      params: [...params]
    })
  }

  resetIndicatorDraftParams(name: IndicatorName): void {
    const definition = getIndicatorDefinition(name)
    this.setIndicatorDraftParams(name, definition.defaultParams)
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

  get enabledSubIndicatorCount(): number {
    return countEnabledSubIndicators(this.indicatorSettings)
  }

  get draftEnabledSubIndicatorCount(): number {
    return countEnabledSubIndicators(this.indicatorDraft)
  }

  get indicatorDraftErrors(): Partial<Record<IndicatorName, string[]>> {
    const errors: Partial<Record<IndicatorName, string[]>> = {}
    indicatorDefinitions.forEach((definition) => {
      const indicatorErrors = validateIndicatorParams(
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
      params: patch.params ? [...patch.params] : [...settings[name].params]
    }
  }
}
