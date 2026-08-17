import { Button, ColorPicker, InputNumber, Modal, Popover, Select, Space, Switch, Tooltip } from 'antd'
import { observer } from 'mobx-react-lite'
import {
  INDICATOR_PRECISION_MAX,
  INDICATOR_PRECISION_MIN,
  SUB_INDICATOR_LIMIT,
  getIndicatorLineStyleLabels,
  indicatorDefinitions,
  isSubIndicator
} from '../models/indicator-definitions'
import type { IndicatorDefinition } from '../models/indicator-definitions'
import {
  TIMESHARE_SUB_INDICATOR_LIMIT,
  isTimeshareSubIndicator,
  timeshareIndicatorDefinitions
} from '../models/timeshare-indicator-definitions'
import type { TimeshareIndicatorDefinition } from '../models/timeshare-indicator-definitions'
import type {
  IndicatorBarVisualStyle,
  IndicatorLineStyle,
  IndicatorName,
  IndicatorSettings,
  TimeshareIndicatorName
} from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface IndicatorSettingsModalProps {
  stock: StockWorkspaceViewModel
}

export const IndicatorSettingsModal = observer(({ stock }: IndicatorSettingsModalProps) => {
  const isTimeshare = stock.viewMode === 'timeshare'
  const open = isTimeshare ? stock.timeshare.indicatorDialogOpen : stock.chart.indicatorDialogOpen
  const hasErrors = isTimeshare
    ? stock.timeshare.indicatorDraftHasErrors
    : stock.chart.indicatorDraftHasErrors

  return (
    <Modal
      title="指标设置"
      open={open}
      width={720}
      okText="应用"
      cancelText="取消"
      onOk={stock.applyIndicatorSettingsDraft}
      onCancel={stock.closeIndicatorDialog}
      okButtonProps={{ disabled: hasErrors }}
      destroyOnHidden
    >
      {isTimeshare ? <TimeshareIndicatorSettings stock={stock} /> : <KLineIndicatorSettings stock={stock} />}
    </Modal>
  )
})

interface IndicatorSettingsProps {
  stock: StockWorkspaceViewModel
}

const KLineIndicatorSettings = observer(({ stock }: IndicatorSettingsProps) => {
  const chart = stock.chart
  const mainIndicators = indicatorDefinitions.filter((definition) => definition.pane !== 'sub')
  const subIndicators = indicatorDefinitions.filter((definition) => definition.pane === 'sub')

  return (
    <div className="indicator-settings">
      <KLineIndicatorGroup title="主图指标" definitions={mainIndicators} stock={stock} />
      <div className="indicator-group-hint">
        副图指标 {chart.draftEnabledSubIndicatorCount}/{SUB_INDICATOR_LIMIT}
      </div>
      <KLineIndicatorGroup title="副图指标" definitions={subIndicators} stock={stock} />
    </div>
  )
})

const TimeshareIndicatorSettings = observer(({ stock }: IndicatorSettingsProps) => {
  const timeshare = stock.timeshare
  const baseIndicators = timeshareIndicatorDefinitions.filter((definition) => definition.pane === 'base')
  const mainIndicators = timeshareIndicatorDefinitions.filter((definition) => definition.pane === 'main')
  const volumeIndicators = timeshareIndicatorDefinitions.filter(
    (definition) => definition.pane === 'volume'
  )
  const subIndicators = timeshareIndicatorDefinitions.filter((definition) => definition.pane === 'sub')
  const advancedIndicators = timeshareIndicatorDefinitions.filter(
    (definition) => definition.pane === 'advanced'
  )

  return (
    <div className="indicator-settings">
      <TimeshareIndicatorGroup title="基础显示" definitions={baseIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="主图指标" definitions={mainIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="成交量指标" definitions={volumeIndicators} stock={stock} />
      <div className="indicator-group-hint">
        分时副图 {timeshare.draftEnabledSubIndicatorCount}/{TIMESHARE_SUB_INDICATOR_LIMIT}
      </div>
      <TimeshareIndicatorGroup title="副图指标" definitions={subIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="高级指标" definitions={advancedIndicators} stock={stock} />
    </div>
  )
})

interface KLineIndicatorGroupProps {
  title: string
  definitions: IndicatorDefinition[]
  stock: StockWorkspaceViewModel
}

const KLineIndicatorGroup = observer(({ title, definitions, stock }: KLineIndicatorGroupProps) => (
  <section className="indicator-group">
    <div className="indicator-group-title">{title}</div>
    <div className="indicator-rows">
      {definitions.map((definition) => (
        <KLineIndicatorRow key={definition.name} definition={definition} stock={stock} />
      ))}
    </div>
  </section>
))

interface TimeshareIndicatorGroupProps {
  title: string
  definitions: TimeshareIndicatorDefinition[]
  stock: StockWorkspaceViewModel
}

const TimeshareIndicatorGroup = observer(
  ({ title, definitions, stock }: TimeshareIndicatorGroupProps) => (
    <section className="indicator-group">
      <div className="indicator-group-title">{title}</div>
      <div className="indicator-rows">
        {definitions.map((definition) => (
          <TimeshareIndicatorRow key={definition.name} definition={definition} stock={stock} />
        ))}
      </div>
    </section>
  )
)

interface KLineIndicatorRowProps {
  definition: IndicatorDefinition
  stock: StockWorkspaceViewModel
}

const KLineIndicatorRow = observer(({ definition, stock }: KLineIndicatorRowProps) => {
  const chart = stock.chart
  const draft = chart.indicatorDraft[definition.name]
  const enabled = draft.enabled
  const disabledByLimit =
    !enabled && isSubIndicator(definition.name) && !chart.canEnableIndicator(definition.name)
  const errors = chart.indicatorDraftErrors[definition.name] ?? []

  return (
    <div className="indicator-row indicator-row-kline">
      <div className="indicator-row-main">
        <Tooltip title={disabledByLimit ? '副图指标最多开启 3 个' : ''}>
          <Switch
            size="small"
            checked={enabled}
            disabled={disabledByLimit}
            onChange={(checked) => stock.setKLineIndicatorDraftEnabled(definition.name, checked)}
          />
        </Tooltip>
        <div className="indicator-name">{definition.label}</div>
      </div>
      <IndicatorParams
        params={definition.params}
        values={draft.params}
        enabled={enabled}
        onChange={(index, value) => stock.setKLineIndicatorDraftParam(definition.name, index, value)}
      />
      <IndicatorPrecision
        visible={definition.defaultPrecision !== undefined}
        value={draft.precision}
        enabled={enabled}
        onChange={(value) => stock.setKLineIndicatorDraftPrecision(definition.name, value)}
      />
      <KLineIndicatorStyleButton
        definition={definition}
        draft={draft}
        enabled={enabled}
        stock={stock}
      />
      <ResetParamsButton
        visible={definition.params.length > 0}
        onClick={() => stock.resetKLineIndicatorDraftParams(definition.name)}
      />
      <div className="indicator-error">{formatIndicatorErrors(definition.name, errors)}</div>
    </div>
  )
})

interface TimeshareIndicatorRowProps {
  definition: TimeshareIndicatorDefinition
  stock: StockWorkspaceViewModel
}

const TimeshareIndicatorRow = observer(({ definition, stock }: TimeshareIndicatorRowProps) => {
  const timeshare = stock.timeshare
  const draft = timeshare.indicatorDraft[definition.name]
  const enabled = draft.enabled
  const disabledByLimit =
    !enabled &&
    isTimeshareSubIndicator(definition.name) &&
    !timeshare.canEnableIndicator(definition.name)
  const availability = stock.getTimeshareIndicatorAvailability(definition.name)
  const disabledByAvailability = !enabled && !availability.available
  const errors = timeshare.indicatorDraftErrors[definition.name] ?? []
  const tooltip = disabledByLimit
    ? '分时副图最多开启 2 个'
    : disabledByAvailability
      ? availability.message
      : ''

  return (
    <div className="indicator-row">
      <div className="indicator-row-main">
        <Tooltip title={tooltip}>
          <Switch
            size="small"
            checked={enabled}
            disabled={disabledByLimit || disabledByAvailability}
            onChange={(checked) => timeshare.setIndicatorDraftEnabled(definition.name, checked)}
          />
        </Tooltip>
        <div className="indicator-name">{definition.label}</div>
      </div>
      <IndicatorParams
        params={definition.params}
        values={draft.params}
        enabled={enabled}
        onChange={(index, value) => timeshare.setIndicatorDraftParam(definition.name, index, value)}
      />
      <ResetParamsButton
        visible={definition.params.length > 0}
        onClick={() => timeshare.resetIndicatorDraftParams(definition.name)}
      />
      <div className={errors.length > 0 ? 'indicator-error' : 'indicator-availability'}>
        {formatTimeshareIndicatorStatus(definition.name, errors, availability.message)}
      </div>
    </div>
  )
})

interface IndicatorParamsProps {
  params: Array<{
    label: string
    min: number
    max: number
    step: number
    precision?: number
  }>
  values: number[]
  enabled: boolean
  onChange: (index: number, value: number) => void
}

const IndicatorParams = ({ params, values, enabled, onChange }: IndicatorParamsProps) => (
  <Space size={8} className="indicator-param-list">
    {params.map((param, index) => (
      <div className="indicator-param" key={`${param.label}-${index}`}>
        <span>{param.label}</span>
        <InputNumber
          size="small"
          min={param.min}
          max={param.max}
          step={param.step}
          precision={param.precision}
          value={values[index]}
          disabled={!enabled}
          onChange={(value) => onChange(index, normalizeInputNumber(value))}
        />
      </div>
    ))}
  </Space>
)

interface IndicatorPrecisionProps {
  visible: boolean
  value?: number
  enabled: boolean
  onChange: (value: number) => void
}

const IndicatorPrecision = ({ visible, value, enabled, onChange }: IndicatorPrecisionProps) =>
  visible ? (
    <div className="indicator-precision">
      <span>精度</span>
      <InputNumber
        size="small"
        min={INDICATOR_PRECISION_MIN}
        max={INDICATOR_PRECISION_MAX}
        step={1}
        precision={0}
        value={value}
        disabled={!enabled}
        onChange={(nextValue) => onChange(normalizeInputNumber(nextValue))}
      />
    </div>
  ) : (
    <span className="indicator-precision-placeholder" />
  )

interface KLineIndicatorStyleButtonProps {
  definition: IndicatorDefinition
  draft: IndicatorSettings
  enabled: boolean
  stock: StockWorkspaceViewModel
}

const KLineIndicatorStyleButton = ({
  definition,
  draft,
  enabled,
  stock
}: KLineIndicatorStyleButtonProps) => {
  const hasStyles =
    (draft.styles.lines?.length ?? 0) > 0 || Boolean(draft.styles.bar) || Boolean(draft.styles.marker)

  if (!hasStyles) {
    return <span className="indicator-style-placeholder" />
  }

  return (
    <Popover
      trigger="click"
      placement="left"
      content={
        <KLineIndicatorStyleEditor
          definition={definition}
          draft={draft}
          enabled={enabled}
          stock={stock}
        />
      }
    >
      <Button size="small" disabled={!enabled}>
        <span className="indicator-style-summary">
          {collectStyleColors(draft).map((color, index) => (
            <span
              className="indicator-style-swatch"
              style={{ backgroundColor: color }}
              key={`${color}-${index}`}
            />
          ))}
        </span>
        样式
      </Button>
    </Popover>
  )
}

const KLineIndicatorStyleEditor = ({
  definition,
  draft,
  enabled,
  stock
}: KLineIndicatorStyleButtonProps) => {
  const lineLabels = getIndicatorLineStyleLabels(definition.name, draft.params)

  return (
    <div className="indicator-style-editor">
      {draft.styles.lines && draft.styles.lines.length > 0 ? (
        <div className="indicator-style-section">
          {lineLabels.map((label, index) => {
            const line = draft.styles.lines?.[index]
            if (!line) {
              return null
            }
            return (
              <div className="indicator-style-line" key={`${definition.name}-${label}-${index}`}>
                <span className="indicator-style-label">{label}</span>
                <ColorPicker
                  size="small"
                  value={line.color}
                  disabled={!enabled}
                  onChange={(_, hex) =>
                    stock.setKLineIndicatorDraftLineColor(definition.name, index, normalizeHexColor(hex))
                  }
                />
                <Select<IndicatorLineStyle>
                  size="small"
                  value={line.lineStyle}
                  disabled={!enabled}
                  options={lineStyleOptions}
                  onChange={(value) =>
                    stock.setKLineIndicatorDraftLineStyle(definition.name, index, value)
                  }
                />
              </div>
            )
          })}
        </div>
      ) : null}
      {draft.styles.bar ? (
        <div className="indicator-style-section">
          {barStyleFields.map((field) => (
            <div className="indicator-style-line" key={`${definition.name}-${field.key}`}>
              <span className="indicator-style-label">{field.label}</span>
              <ColorPicker
                size="small"
                value={draft.styles.bar?.[field.key]}
                disabled={!enabled}
                onChange={(_, hex) =>
                  stock.setKLineIndicatorDraftBarColor(
                    definition.name,
                    field.key,
                    normalizeHexColor(hex)
                  )
                }
              />
            </div>
          ))}
        </div>
      ) : null}
      {draft.styles.marker ? (
        <div className="indicator-style-section">
          <div className="indicator-style-line">
            <span className="indicator-style-label">买入</span>
            <ColorPicker
              size="small"
              value={draft.styles.marker.buyColor}
              disabled={!enabled}
              onChange={(_, hex) =>
                stock.setKLineIndicatorDraftMarkerColor(
                  definition.name,
                  'buyColor',
                  normalizeHexColor(hex)
                )
              }
            />
          </div>
          <div className="indicator-style-line">
            <span className="indicator-style-label">卖出</span>
            <ColorPicker
              size="small"
              value={draft.styles.marker.sellColor}
              disabled={!enabled}
              onChange={(_, hex) =>
                stock.setKLineIndicatorDraftMarkerColor(
                  definition.name,
                  'sellColor',
                  normalizeHexColor(hex)
                )
              }
            />
          </div>
        </div>
      ) : null}
      <Button
        size="small"
        type="link"
        disabled={!enabled}
        onClick={() => stock.resetKLineIndicatorDraftStyle(definition.name)}
      >
        恢复样式
      </Button>
    </div>
  )
}

interface ResetParamsButtonProps {
  visible: boolean
  onClick: () => void
}

const ResetParamsButton = ({ visible, onClick }: ResetParamsButtonProps) =>
  visible ? (
    <Button size="small" type="link" onClick={onClick}>
      恢复默认
    </Button>
  ) : (
    <span className="indicator-reset-placeholder" />
  )

const lineStyleOptions: Array<{ label: string; value: IndicatorLineStyle }> = [
  { label: '实线', value: 'solid' },
  { label: '虚线', value: 'dashed' },
  { label: '点线', value: 'dotted' }
]

const barStyleFields: Array<{ key: keyof IndicatorBarVisualStyle; label: string }> = [
  { key: 'upColor', label: '上涨' },
  { key: 'downColor', label: '下跌' },
  { key: 'noChangeColor', label: '平盘' }
]

function collectStyleColors(draft: IndicatorSettings): string[] {
  return [
    ...(draft.styles.lines?.map((line) => line.color) ?? []),
    ...(draft.styles.bar
      ? [draft.styles.bar.upColor, draft.styles.bar.downColor, draft.styles.bar.noChangeColor]
      : []),
    ...(draft.styles.marker ? [draft.styles.marker.buyColor, draft.styles.marker.sellColor] : [])
  ]
}

function normalizeHexColor(value: string): string {
  return value.startsWith('#') ? value : `#${value}`
}

function normalizeInputNumber(value: string | number | null): number {
  return value === null ? Number.NaN : Number(value)
}

function formatIndicatorErrors(_name: IndicatorName, errors: string[]): string {
  return errors[0] ?? ''
}

function formatTimeshareIndicatorErrors(_name: TimeshareIndicatorName, errors: string[]): string {
  return errors[0] ?? ''
}

function formatTimeshareIndicatorStatus(
  _name: TimeshareIndicatorName,
  errors: string[],
  availabilityMessage: string
): string {
  return errors[0] ?? availabilityMessage
}
