import type {
  TimeshareIndicatorName,
  TimeshareIndicatorPane,
  TimeshareIndicatorSettings,
  TimeshareIndicatorSettingsMap
} from './stock-types'

export type TimeshareIndicatorParamKind = 'period' | 'decimal'

export interface TimeshareIndicatorParamDefinition {
  label: string
  kind: TimeshareIndicatorParamKind
  min: number
  max: number
  step: number
  precision?: number
}

export interface TimeshareIndicatorDefinition {
  name: TimeshareIndicatorName
  label: string
  pane: TimeshareIndicatorPane
  defaultEnabled: boolean
  defaultParams: number[]
  params: TimeshareIndicatorParamDefinition[]
  uniqueParams?: boolean
  fastLessThanSlow?: boolean
}

export const TIMESHARE_SUB_INDICATOR_LIMIT = 2

const periodParam = (label: string): TimeshareIndicatorParamDefinition => ({
  label,
  kind: 'period',
  min: 1,
  max: 250,
  step: 1
})

export const timeshareIndicatorDefinitions: TimeshareIndicatorDefinition[] = [
  {
    name: 'avgPriceLine',
    label: '均价线',
    pane: 'base',
    defaultEnabled: true,
    defaultParams: [],
    params: []
  },
  {
    name: 'previousCloseLine',
    label: '昨收线',
    pane: 'base',
    defaultEnabled: true,
    defaultParams: [],
    params: []
  },
  {
    name: 'ma',
    label: 'MA',
    pane: 'main',
    defaultEnabled: false,
    defaultParams: [5, 10, 20, 60],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3'), periodParam('周期4')],
    uniqueParams: true
  },
  {
    name: 'ema',
    label: 'EMA',
    pane: 'main',
    defaultEnabled: false,
    defaultParams: [12, 26],
    params: [periodParam('周期1'), periodParam('周期2')],
    uniqueParams: true
  },
  {
    name: 'boll',
    label: 'BOLL',
    pane: 'main',
    defaultEnabled: false,
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
    name: 'bsSignal',
    label: 'B/S',
    pane: 'signal',
    defaultEnabled: false,
    defaultParams: [5, 20],
    params: [periodParam('快线'), periodParam('慢线')],
    uniqueParams: true,
    fastLessThanSlow: true
  },
  {
    name: 'volume',
    label: '成交量',
    pane: 'volume',
    defaultEnabled: true,
    defaultParams: [],
    params: []
  },
  {
    name: 'volumeMa',
    label: 'VOL MA',
    pane: 'volume',
    defaultEnabled: false,
    defaultParams: [5, 10, 20],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3')],
    uniqueParams: true
  },
  {
    name: 'macd',
    label: 'MACD',
    pane: 'sub',
    defaultEnabled: false,
    defaultParams: [12, 26, 9],
    params: [periodParam('快线'), periodParam('慢线'), periodParam('信号')],
    uniqueParams: true,
    fastLessThanSlow: true
  },
  {
    name: 'rsi',
    label: 'RSI',
    pane: 'sub',
    defaultEnabled: false,
    defaultParams: [6, 12, 24],
    params: [periodParam('周期1'), periodParam('周期2'), periodParam('周期3')],
    uniqueParams: true
  }
]

export const timeshareIndicatorNames = timeshareIndicatorDefinitions.map(
  (definition) => definition.name
)

export const timeshareSubIndicatorNames = timeshareIndicatorDefinitions
  .filter((definition) => definition.pane === 'sub')
  .map((definition) => definition.name)

export const timeshareSubIndicatorPriority: TimeshareIndicatorName[] = ['macd', 'rsi']

export function getTimeshareIndicatorDefinition(
  name: TimeshareIndicatorName
): TimeshareIndicatorDefinition {
  const definition = timeshareIndicatorDefinitions.find((item) => item.name === name)
  if (!definition) {
    throw new Error(`未知分时指标：${name}`)
  }
  return definition
}

export function createDefaultTimeshareIndicatorSettings(): TimeshareIndicatorSettingsMap {
  return Object.fromEntries(
    timeshareIndicatorDefinitions.map((definition) => [
      definition.name,
      {
        enabled: definition.defaultEnabled,
        params: [...definition.defaultParams]
      }
    ])
  ) as TimeshareIndicatorSettingsMap
}

export function cloneTimeshareIndicatorSettings(
  settings: TimeshareIndicatorSettingsMap
): TimeshareIndicatorSettingsMap {
  return Object.fromEntries(
    timeshareIndicatorDefinitions.map((definition) => [
      definition.name,
      {
        enabled: settings[definition.name]?.enabled ?? definition.defaultEnabled,
        params: [...(settings[definition.name]?.params ?? definition.defaultParams)]
      }
    ])
  ) as TimeshareIndicatorSettingsMap
}

export function normalizeTimeshareIndicatorSettings(
  settings?: Partial<Record<TimeshareIndicatorName, Partial<TimeshareIndicatorSettings>>> | null
): TimeshareIndicatorSettingsMap {
  const normalized = Object.fromEntries(
    timeshareIndicatorDefinitions.map((definition) => {
      const current = settings?.[definition.name]
      return [
        definition.name,
        {
          enabled:
            typeof current?.enabled === 'boolean' ? current.enabled : definition.defaultEnabled,
          params: normalizeTimeshareIndicatorParams(definition.name, current?.params)
        }
      ]
    })
  ) as TimeshareIndicatorSettingsMap

  enforceTimeshareSubIndicatorLimit(normalized)
  return normalized
}

export function normalizeTimeshareIndicatorParams(
  name: TimeshareIndicatorName,
  params: unknown
): number[] {
  const definition = getTimeshareIndicatorDefinition(name)
  if (!Array.isArray(params) || params.length !== definition.params.length) {
    return [...definition.defaultParams]
  }

  const normalized = params.map((value, index) =>
    normalizeParamValue(value, definition.params[index])
  )

  return validateTimeshareIndicatorParams(name, normalized).length === 0
    ? normalized
    : [...definition.defaultParams]
}

export function validateTimeshareIndicatorParams(
  name: TimeshareIndicatorName,
  params: number[]
): string[] {
  const definition = getTimeshareIndicatorDefinition(name)
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

export function countEnabledTimeshareSubIndicators(
  settings: TimeshareIndicatorSettingsMap
): number {
  return timeshareSubIndicatorNames.filter((name) => settings[name]?.enabled).length
}

export function isTimeshareSubIndicator(name: TimeshareIndicatorName): boolean {
  return timeshareSubIndicatorNames.includes(name)
}

export function canEnableTimeshareIndicator(
  settings: TimeshareIndicatorSettingsMap,
  name: TimeshareIndicatorName
): boolean {
  if (!isTimeshareSubIndicator(name) || settings[name]?.enabled) {
    return true
  }
  return countEnabledTimeshareSubIndicators(settings) < TIMESHARE_SUB_INDICATOR_LIMIT
}

function normalizeParamValue(
  value: unknown,
  definition: TimeshareIndicatorParamDefinition
): number {
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

function enforceTimeshareSubIndicatorLimit(settings: TimeshareIndicatorSettingsMap): void {
  let enabledCount = 0
  timeshareSubIndicatorPriority.forEach((name) => {
    if (!settings[name]?.enabled) {
      return
    }
    enabledCount += 1
    if (enabledCount > TIMESHARE_SUB_INDICATOR_LIMIT) {
      settings[name].enabled = false
    }
  })
}
