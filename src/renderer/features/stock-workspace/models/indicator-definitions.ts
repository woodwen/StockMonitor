import type { IndicatorName, IndicatorPane, IndicatorSettings, IndicatorSettingsMap } from './stock-types'

export type IndicatorParamKind = 'period' | 'decimal'

export interface IndicatorParamDefinition {
  label: string
  kind: IndicatorParamKind
  min: number
  max: number
  step: number
  precision?: number
}

export interface IndicatorDefinition {
  name: IndicatorName
  label: string
  pane: IndicatorPane
  chartName?: string
  defaultEnabled: boolean
  defaultParams: number[]
  params: IndicatorParamDefinition[]
  uniqueParams?: boolean
  fastLessThanSlow?: boolean
}

export const SUB_INDICATOR_LIMIT = 3

const periodParam = (label: string): IndicatorParamDefinition => ({
  label,
  kind: 'period',
  min: 1,
  max: 250,
  step: 1
})

export const indicatorDefinitions: IndicatorDefinition[] = [
  {
    name: 'boll',
    label: 'BOLL',
    pane: 'main',
    chartName: 'BOLL',
    defaultEnabled: true,
    defaultParams: [20, 2],
    params: [
      periodParam('周期'),
      {
        label: '倍数',
        kind: 'decimal',
        min: 0.1,
        max: 10,
        step: 0.1,
        precision: 1
      }
    ]
  },
  {
    name: 'ma',
    label: 'MA',
    pane: 'main',
    chartName: 'MA',
    defaultEnabled: false,
    defaultParams: [5, 10, 20, 60],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3'), periodParam('周期4')],
    uniqueParams: true
  },
  {
    name: 'ema',
    label: 'EMA',
    pane: 'main',
    chartName: 'EMA',
    defaultEnabled: false,
    defaultParams: [12, 26],
    params: [periodParam('周期1'), periodParam('周期2')],
    uniqueParams: true
  },
  {
    name: 'bsSignal',
    label: 'B/S',
    pane: 'overlay',
    defaultEnabled: true,
    defaultParams: [5, 20],
    params: [periodParam('快线'), periodParam('慢线')],
    uniqueParams: true
  },
  {
    name: 'volumeMa',
    label: 'VOL',
    pane: 'sub',
    chartName: 'VOL',
    defaultEnabled: true,
    defaultParams: [5, 10, 20],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3')],
    uniqueParams: true
  },
  {
    name: 'macd',
    label: 'MACD',
    pane: 'sub',
    chartName: 'MACD',
    defaultEnabled: false,
    defaultParams: [12, 26, 9],
    params: [periodParam('快线'), periodParam('慢线'), periodParam('信号')],
    uniqueParams: true,
    fastLessThanSlow: true
  },
  {
    name: 'kdj',
    label: 'KDJ',
    pane: 'sub',
    chartName: 'KDJ',
    defaultEnabled: false,
    defaultParams: [9, 3, 3],
    params: [periodParam('N'), periodParam('M1'), periodParam('M2')]
  },
  {
    name: 'rsi',
    label: 'RSI',
    pane: 'sub',
    chartName: 'RSI',
    defaultEnabled: false,
    defaultParams: [6, 12, 24],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3')],
    uniqueParams: true
  }
]

export const indicatorNames = indicatorDefinitions.map((definition) => definition.name)

export const subIndicatorNames = indicatorDefinitions
  .filter((definition) => definition.pane === 'sub')
  .map((definition) => definition.name)

export const subIndicatorPriority: IndicatorName[] = ['volumeMa', 'macd', 'kdj', 'rsi']

export function getIndicatorDefinition(name: IndicatorName): IndicatorDefinition {
  const definition = indicatorDefinitions.find((item) => item.name === name)
  if (!definition) {
    throw new Error(`未知指标：${name}`)
  }
  return definition
}

export function createDefaultIndicatorSettings(): IndicatorSettingsMap {
  return Object.fromEntries(
    indicatorDefinitions.map((definition) => [
      definition.name,
      {
        enabled: definition.defaultEnabled,
        params: [...definition.defaultParams]
      }
    ])
  ) as IndicatorSettingsMap
}

export function cloneIndicatorSettings(settings: IndicatorSettingsMap): IndicatorSettingsMap {
  return Object.fromEntries(
    indicatorDefinitions.map((definition) => [
      definition.name,
      {
        enabled: settings[definition.name]?.enabled ?? definition.defaultEnabled,
        params: [...(settings[definition.name]?.params ?? definition.defaultParams)]
      }
    ])
  ) as IndicatorSettingsMap
}

export function normalizeIndicatorSettings(
  settings?: Partial<Record<IndicatorName, Partial<IndicatorSettings>>> | null,
  legacyEnabledIndicators?: Partial<Record<IndicatorName, boolean>> | null
): IndicatorSettingsMap {
  const normalized = Object.fromEntries(
    indicatorDefinitions.map((definition) => {
      const current = settings?.[definition.name]
      const legacyEnabled = legacyEnabledIndicators?.[definition.name]
      return [
        definition.name,
        {
          enabled:
            typeof current?.enabled === 'boolean'
              ? current.enabled
              : typeof legacyEnabled === 'boolean'
                ? legacyEnabled
                : definition.defaultEnabled,
          params: normalizeIndicatorParams(definition.name, current?.params)
        }
      ]
    })
  ) as IndicatorSettingsMap

  enforceSubIndicatorLimit(normalized)
  return normalized
}

export function normalizeIndicatorParams(name: IndicatorName, params: unknown): number[] {
  const definition = getIndicatorDefinition(name)
  if (!Array.isArray(params) || params.length !== definition.params.length) {
    return [...definition.defaultParams]
  }

  const normalized = params.map((value, index) =>
    normalizeParamValue(value, definition.params[index])
  )

  return validateIndicatorParams(name, normalized).length === 0 ? normalized : [...definition.defaultParams]
}

export function validateIndicatorParams(name: IndicatorName, params: number[]): string[] {
  const definition = getIndicatorDefinition(name)
  const errors: string[] = []

  if (params.length !== definition.params.length) {
    return [`${definition.label} 参数数量必须为 ${definition.params.length} 个`]
  }

  definition.params.forEach((param, index) => {
    const value = params[index]
    if (!Number.isFinite(value)) {
      errors.push(`${param.label} 必须为数字`)
      return
    }
    if (param.kind === 'period' && !Number.isInteger(value)) {
      errors.push(`${param.label} 必须为整数`)
    }
    if (value < param.min || value > param.max) {
      errors.push(`${param.label} 必须在 ${param.min}-${param.max} 之间`)
    }
  })

  if (definition.uniqueParams && new Set(params).size !== params.length) {
    errors.push('参数不能重复')
  }

  if (definition.fastLessThanSlow && params[0] >= params[1]) {
    errors.push('快线必须小于慢线')
  }

  return errors
}

export function countEnabledSubIndicators(settings: IndicatorSettingsMap): number {
  return subIndicatorNames.filter((name) => settings[name]?.enabled).length
}

export function isSubIndicator(name: IndicatorName): boolean {
  return subIndicatorNames.includes(name)
}

export function canEnableIndicator(settings: IndicatorSettingsMap, name: IndicatorName): boolean {
  if (!isSubIndicator(name) || settings[name]?.enabled) {
    return true
  }
  return countEnabledSubIndicators(settings) < SUB_INDICATOR_LIMIT
}

function normalizeParamValue(value: unknown, definition: IndicatorParamDefinition): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return Number.NaN
  }
  if (definition.kind === 'period') {
    return Math.trunc(numeric)
  }
  const precision = definition.precision ?? 0
  return Number(numeric.toFixed(precision))
}

function enforceSubIndicatorLimit(settings: IndicatorSettingsMap): void {
  let enabledCount = 0
  subIndicatorPriority.forEach((name) => {
    if (!settings[name]?.enabled) {
      return
    }
    enabledCount += 1
    if (enabledCount > SUB_INDICATOR_LIMIT) {
      settings[name].enabled = false
    }
  })
}
