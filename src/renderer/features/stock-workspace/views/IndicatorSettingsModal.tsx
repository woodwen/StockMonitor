import { Button, InputNumber, Modal, Space, Switch, Tooltip } from 'antd'
import { observer } from 'mobx-react-lite'
import {
  SUB_INDICATOR_LIMIT,
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
import type { IndicatorName, TimeshareIndicatorName } from '../models/stock-types'
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
  const signalIndicators = timeshareIndicatorDefinitions.filter(
    (definition) => definition.pane === 'signal'
  )
  const volumeIndicators = timeshareIndicatorDefinitions.filter(
    (definition) => definition.pane === 'volume'
  )
  const subIndicators = timeshareIndicatorDefinitions.filter((definition) => definition.pane === 'sub')

  return (
    <div className="indicator-settings">
      <TimeshareIndicatorGroup title="基础显示" definitions={baseIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="主图指标" definitions={mainIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="信号指标" definitions={signalIndicators} stock={stock} />
      <TimeshareIndicatorGroup title="成交量指标" definitions={volumeIndicators} stock={stock} />
      <div className="indicator-group-hint">
        分时副图 {timeshare.draftEnabledSubIndicatorCount}/{TIMESHARE_SUB_INDICATOR_LIMIT}
      </div>
      <TimeshareIndicatorGroup title="副图指标" definitions={subIndicators} stock={stock} />
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
    <div className="indicator-row">
      <div className="indicator-row-main">
        <Tooltip title={disabledByLimit ? '副图指标最多开启 3 个' : ''}>
          <Switch
            size="small"
            checked={enabled}
            disabled={disabledByLimit}
            onChange={(checked) => chart.setIndicatorDraftEnabled(definition.name, checked)}
          />
        </Tooltip>
        <div className="indicator-name">{definition.label}</div>
      </div>
      <IndicatorParams
        params={definition.params}
        values={draft.params}
        enabled={enabled}
        onChange={(index, value) => chart.setIndicatorDraftParam(definition.name, index, value)}
      />
      <ResetParamsButton
        visible={definition.params.length > 0}
        onClick={() => chart.resetIndicatorDraftParams(definition.name)}
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
  const errors = timeshare.indicatorDraftErrors[definition.name] ?? []

  return (
    <div className="indicator-row">
      <div className="indicator-row-main">
        <Tooltip title={disabledByLimit ? '分时副图最多开启 2 个' : ''}>
          <Switch
            size="small"
            checked={enabled}
            disabled={disabledByLimit}
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
      <div className="indicator-error">{formatTimeshareIndicatorErrors(definition.name, errors)}</div>
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

function normalizeInputNumber(value: string | number | null): number {
  return value === null ? Number.NaN : Number(value)
}

function formatIndicatorErrors(_name: IndicatorName, errors: string[]): string {
  return errors[0] ?? ''
}

function formatTimeshareIndicatorErrors(_name: TimeshareIndicatorName, errors: string[]): string {
  return errors[0] ?? ''
}
