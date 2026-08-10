import { Button, InputNumber, Modal, Space, Switch, Tooltip } from 'antd'
import { observer } from 'mobx-react-lite'
import {
  SUB_INDICATOR_LIMIT,
  indicatorDefinitions,
  isSubIndicator
} from '../models/indicator-definitions'
import type { IndicatorDefinition } from '../models/indicator-definitions'
import type { IndicatorName } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface IndicatorSettingsModalProps {
  stock: StockWorkspaceViewModel
}

export const IndicatorSettingsModal = observer(({ stock }: IndicatorSettingsModalProps) => {
  const chart = stock.chart
  const mainIndicators = indicatorDefinitions.filter((definition) => definition.pane !== 'sub')
  const subIndicators = indicatorDefinitions.filter((definition) => definition.pane === 'sub')

  return (
    <Modal
      title="指标设置"
      open={chart.indicatorDialogOpen}
      width={720}
      okText="应用"
      cancelText="取消"
      onOk={stock.applyIndicatorSettingsDraft}
      onCancel={stock.closeIndicatorDialog}
      okButtonProps={{ disabled: chart.indicatorDraftHasErrors }}
      destroyOnHidden
    >
      <div className="indicator-settings">
        <IndicatorGroup title="主图指标" definitions={mainIndicators} stock={stock} />
        <div className="indicator-group-hint">
          副图指标 {chart.draftEnabledSubIndicatorCount}/{SUB_INDICATOR_LIMIT}
        </div>
        <IndicatorGroup title="副图指标" definitions={subIndicators} stock={stock} />
      </div>
    </Modal>
  )
})

interface IndicatorGroupProps {
  title: string
  definitions: IndicatorDefinition[]
  stock: StockWorkspaceViewModel
}

const IndicatorGroup = observer(({ title, definitions, stock }: IndicatorGroupProps) => (
  <section className="indicator-group">
    <div className="indicator-group-title">{title}</div>
    <div className="indicator-rows">
      {definitions.map((definition) => (
        <IndicatorRow key={definition.name} definition={definition} stock={stock} />
      ))}
    </div>
  </section>
))

interface IndicatorRowProps {
  definition: IndicatorDefinition
  stock: StockWorkspaceViewModel
}

const IndicatorRow = observer(({ definition, stock }: IndicatorRowProps) => {
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
      <Space size={8} className="indicator-param-list">
        {definition.params.map((param, index) => (
          <div className="indicator-param" key={`${definition.name}-${param.label}`}>
            <span>{param.label}</span>
            <InputNumber
              size="small"
              min={param.min}
              max={param.max}
              step={param.step}
              precision={param.precision}
              value={draft.params[index]}
              disabled={!enabled}
              onChange={(value) =>
                chart.setIndicatorDraftParam(definition.name, index, normalizeInputNumber(value))
              }
            />
          </div>
        ))}
      </Space>
      <Button size="small" type="link" onClick={() => chart.resetIndicatorDraftParams(definition.name)}>
        恢复默认
      </Button>
      <div className="indicator-error">{formatIndicatorErrors(definition.name, errors)}</div>
    </div>
  )
})

function normalizeInputNumber(value: string | number | null): number {
  return value === null ? Number.NaN : Number(value)
}

function formatIndicatorErrors(_name: IndicatorName, errors: string[]): string {
  return errors[0] ?? ''
}
