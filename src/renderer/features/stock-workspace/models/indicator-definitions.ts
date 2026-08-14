import type {
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorLineVisualStyle,
  IndicatorMarkerVisualStyle,
  IndicatorName,
  IndicatorPane,
  IndicatorSettings,
  IndicatorSettingsMap,
  IndicatorVisualSettings
} from './stock-types'

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
  defaultPrecision?: number
  params: IndicatorParamDefinition[]
  lineStyleLabels?: string[]
  dynamicLineStylePrefix?: string
  hasBarStyle?: boolean
  hasMarkerStyle?: boolean
  uniqueParams?: boolean
  fastLessThanSlow?: boolean
}

export const SUB_INDICATOR_LIMIT = 3
export const INDICATOR_PRECISION_MIN = 0
export const INDICATOR_PRECISION_MAX = 6
export const indicatorLineStyleValues: IndicatorLineStyle[] = ['solid', 'dashed', 'dotted']
export const defaultIndicatorLineColors = [
  '#FF9600',
  '#935EBD',
  '#1677FF',
  '#E11D74',
  '#01C5C4'
]
export const defaultIndicatorBarStyle: IndicatorBarVisualStyle = {
  upColor: '#ef5350',
  downColor: '#26a69a',
  noChangeColor: '#8f9bb3'
}
export const defaultIndicatorMarkerStyle: IndicatorMarkerVisualStyle = {
  buyColor: '#ff4d4f',
  sellColor: '#13c2c2'
}

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
    defaultPrecision: 2,
    lineStyleLabels: ['UP', 'MID', 'DN'],
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
    defaultPrecision: 2,
    dynamicLineStylePrefix: 'MA',
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
    defaultPrecision: 2,
    dynamicLineStylePrefix: 'EMA',
    params: [periodParam('周期1'), periodParam('周期2')],
    uniqueParams: true
  },
  {
    name: 'bsSignal',
    label: 'B/S',
    pane: 'overlay',
    defaultEnabled: true,
    defaultParams: [5, 20],
    hasMarkerStyle: true,
    params: [periodParam('快线'), periodParam('慢线')],
    uniqueParams: true
  },
  {
    name: 'strategySignal',
    label: '策略',
    pane: 'overlay',
    defaultEnabled: false,
    defaultParams: [],
    params: []
  },
  {
    name: 'volumeMa',
    label: 'VOL',
    pane: 'sub',
    chartName: 'VOL',
    defaultEnabled: true,
    defaultParams: [5, 10, 20],
    defaultPrecision: 0,
    dynamicLineStylePrefix: 'MA',
    hasBarStyle: true,
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
    defaultPrecision: 2,
    lineStyleLabels: ['DIF', 'DEA'],
    hasBarStyle: true,
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
    defaultPrecision: 2,
    lineStyleLabels: ['K', 'D', 'J'],
    params: [periodParam('N'), periodParam('M1'), periodParam('M2')]
  },
  {
    name: 'rsi',
    label: 'RSI',
    pane: 'sub',
    chartName: 'RSI',
    defaultEnabled: false,
    defaultParams: [6, 12, 24],
    defaultPrecision: 2,
    dynamicLineStylePrefix: 'RSI',
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
        params: [...definition.defaultParams],
        precision: definition.defaultPrecision,
        styles: createDefaultIndicatorStyles(definition.name)
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
        params: [...(settings[definition.name]?.params ?? definition.defaultParams)],
        precision: settings[definition.name]?.precision ?? definition.defaultPrecision,
        styles: cloneIndicatorStyles(
          settings[definition.name]?.styles ?? createDefaultIndicatorStyles(definition.name)
        )
      }
    ])
  ) as IndicatorSettingsMap
}

export function createDefaultIndicatorStyles(name: IndicatorName): IndicatorVisualSettings {
  const definition = getIndicatorDefinition(name)
  const styles: IndicatorVisualSettings = {}
  const lineCount = getIndicatorLineStyleLabels(name, definition.defaultParams).length

  if (lineCount > 0) {
    styles.lines = Array.from({ length: lineCount }, (_, index) => ({
      color: defaultIndicatorLineColors[index % defaultIndicatorLineColors.length],
      lineStyle: 'solid' as const
    }))
  }

  if (definition.hasBarStyle) {
    styles.bar = { ...defaultIndicatorBarStyle }
  }

  if (definition.hasMarkerStyle) {
    styles.marker = { ...defaultIndicatorMarkerStyle }
  }

  return styles
}

export function cloneIndicatorStyles(styles: IndicatorVisualSettings): IndicatorVisualSettings {
  return {
    lines: styles.lines?.map((line) => ({ ...line })),
    bar: styles.bar ? { ...styles.bar } : undefined,
    marker: styles.marker ? { ...styles.marker } : undefined
  }
}

export function getIndicatorLineStyleLabels(name: IndicatorName, params?: number[]): string[] {
  const definition = getIndicatorDefinition(name)
  if (definition.lineStyleLabels) {
    return [...definition.lineStyleLabels]
  }
  if (!definition.dynamicLineStylePrefix) {
    return []
  }
  return (params ?? definition.defaultParams).map(
    (param, index) => `${definition.dynamicLineStylePrefix}${Number.isFinite(param) ? param : index + 1}`
  )
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
          params: normalizeIndicatorParams(definition.name, current?.params),
          precision: normalizeIndicatorPrecision(definition.name, current?.precision),
          styles: normalizeIndicatorStyles(definition.name, current?.styles)
        }
      ]
    })
  ) as IndicatorSettingsMap

  enforceSubIndicatorLimit(normalized)
  enforceSignalIndicatorExclusivity(normalized)
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

export function normalizeIndicatorPrecision(name: IndicatorName, precision: unknown): number | undefined {
  const definition = getIndicatorDefinition(name)
  if (definition.defaultPrecision === undefined) {
    return undefined
  }
  const numeric = Number(precision)
  return Number.isInteger(numeric) &&
    numeric >= INDICATOR_PRECISION_MIN &&
    numeric <= INDICATOR_PRECISION_MAX
    ? numeric
    : definition.defaultPrecision
}

export function normalizeIndicatorStyles(
  name: IndicatorName,
  styles: unknown
): IndicatorVisualSettings {
  const definition = getIndicatorDefinition(name)
  const defaults = createDefaultIndicatorStyles(name)
  const source = isRecord(styles) ? styles : {}
  const normalized: IndicatorVisualSettings = {}

  const lineLabels = getIndicatorLineStyleLabels(name, definition.defaultParams)
  if (lineLabels.length > 0) {
    const lines = Array.isArray(source.lines) ? source.lines : []
    normalized.lines = lineLabels.map((_, index) =>
      normalizeLineStyle(lines[index], defaults.lines?.[index])
    )
  }

  if (definition.hasBarStyle) {
    normalized.bar = normalizeBarStyle(source.bar, defaults.bar)
  }

  if (definition.hasMarkerStyle) {
    normalized.marker = normalizeMarkerStyle(source.marker, defaults.marker)
  }

  return normalized
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

export function validateIndicatorSettings(name: IndicatorName, settings: IndicatorSettings): string[] {
  return [
    ...validateIndicatorParams(name, settings.params),
    ...validateIndicatorPrecision(name, settings.precision),
    ...validateIndicatorStyles(name, settings.styles)
  ]
}

export function validateIndicatorPrecision(name: IndicatorName, precision: unknown): string[] {
  const definition = getIndicatorDefinition(name)
  if (definition.defaultPrecision === undefined) {
    return []
  }
  const numeric = Number(precision)
  if (
    Number.isInteger(numeric) &&
    numeric >= INDICATOR_PRECISION_MIN &&
    numeric <= INDICATOR_PRECISION_MAX
  ) {
    return []
  }
  return [`显示精度必须在 ${INDICATOR_PRECISION_MIN}-${INDICATOR_PRECISION_MAX} 之间`]
}

export function validateIndicatorStyles(name: IndicatorName, styles: IndicatorVisualSettings): string[] {
  const definition = getIndicatorDefinition(name)
  const errors: string[] = []
  const lineCount = getIndicatorLineStyleLabels(name, definition.defaultParams).length

  if (lineCount > 0) {
    if (!Array.isArray(styles.lines) || styles.lines.length !== lineCount) {
      errors.push('线条样式数量不匹配')
    } else {
      styles.lines.forEach((line, index) => {
        if (!isHexColor(line.color)) {
          errors.push(`线条${index + 1}颜色必须为 #RRGGBB`)
        }
        if (!indicatorLineStyleValues.includes(line.lineStyle)) {
          errors.push(`线条${index + 1}线型无效`)
        }
      })
    }
  }

  if (definition.hasBarStyle) {
    const bar = styles.bar
    if (!bar || !isHexColor(bar.upColor) || !isHexColor(bar.downColor) || !isHexColor(bar.noChangeColor)) {
      errors.push('柱体颜色必须为 #RRGGBB')
    }
  }

  if (definition.hasMarkerStyle) {
    const marker = styles.marker
    if (!marker || !isHexColor(marker.buyColor) || !isHexColor(marker.sellColor)) {
      errors.push('标记颜色必须为 #RRGGBB')
    }
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

function normalizeLineStyle(
  value: unknown,
  fallback: IndicatorLineVisualStyle | undefined
): IndicatorLineVisualStyle {
  const source = isRecord(value) ? value : {}
  const defaultValue = fallback ?? {
    color: defaultIndicatorLineColors[0],
    lineStyle: 'solid' as const
  }
  return {
    color: normalizeColor(source.color, defaultValue.color),
    lineStyle: indicatorLineStyleValues.includes(source.lineStyle as IndicatorLineStyle)
      ? (source.lineStyle as IndicatorLineStyle)
      : defaultValue.lineStyle
  }
}

function normalizeBarStyle(
  value: unknown,
  fallback: IndicatorBarVisualStyle | undefined
): IndicatorBarVisualStyle {
  const source = isRecord(value) ? value : {}
  const defaultValue = fallback ?? defaultIndicatorBarStyle
  return {
    upColor: normalizeColor(source.upColor, defaultValue.upColor),
    downColor: normalizeColor(source.downColor, defaultValue.downColor),
    noChangeColor: normalizeColor(source.noChangeColor, defaultValue.noChangeColor)
  }
}

function normalizeMarkerStyle(
  value: unknown,
  fallback: IndicatorMarkerVisualStyle | undefined
): IndicatorMarkerVisualStyle {
  const source = isRecord(value) ? value : {}
  const defaultValue = fallback ?? defaultIndicatorMarkerStyle
  return {
    buyColor: normalizeColor(source.buyColor, defaultValue.buyColor),
    sellColor: normalizeColor(source.sellColor, defaultValue.sellColor)
  }
}

function normalizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && isHexColor(value) ? value : fallback
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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

function enforceSignalIndicatorExclusivity(
  settings: IndicatorSettingsMap
): void {
  if (settings.bsSignal?.enabled && settings.strategySignal?.enabled) {
    settings.strategySignal.enabled = false
  }
}
