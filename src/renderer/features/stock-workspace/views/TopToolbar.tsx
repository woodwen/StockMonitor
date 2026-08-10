import { observer } from 'mobx-react-lite'
import { Button, Checkbox, Divider, Input, Select, Space, Switch, Tooltip } from 'antd'
import {
  ApiOutlined,
  BarChartOutlined,
  CloudDownloadOutlined,
  GlobalOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import type { CheckboxChangeEvent } from 'antd/es/checkbox'
import type { IndicatorName, StockAdjust, StockPeriod } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'

interface TopToolbarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
}

const indicatorLabels: Array<{ name: IndicatorName; label: string }> = [
  { name: 'boll', label: 'BOLL' },
  { name: 'volumeMa', label: 'VOL MA' },
  { name: 'bsSignal', label: 'B/S' }
]

export const TopToolbar = observer(({ stock, updates }: TopToolbarProps) => {
  const handleIndicatorChange = (name: IndicatorName) => (event: CheckboxChangeEvent): void => {
    stock.toggleIndicator(name, event.target.checked)
  }

  return (
    <div className="top-toolbar">
      <Space size={8}>
        <Input
          className="toolbar-symbol-input"
          prefix={<SearchOutlined />}
          value={stock.query.symbol}
          onChange={(event) => stock.setSymbol(event.target.value)}
          onPressEnter={() => stock.refreshStock()}
        />
        <Select
          className="toolbar-period-select"
          value={stock.query.period}
          options={stock.availablePeriodOptions}
          onChange={(value: StockPeriod) => stock.setPeriod(value)}
        />
        <Select
          className="toolbar-adjust-select"
          value={stock.query.adjust}
          options={stock.availableAdjustOptions}
          onChange={(value: StockAdjust) => stock.setAdjust(value)}
        />
        <Input
          className="toolbar-date-input"
          value={stock.query.startDate}
          maxLength={8}
          onChange={(event) => stock.setStartDate(event.target.value)}
          onPressEnter={() => stock.refreshStock()}
        />
        <Input
          className="toolbar-date-input"
          value={stock.query.endDate}
          maxLength={8}
          onChange={(event) => stock.setEndDate(event.target.value)}
          onPressEnter={() => stock.refreshStock()}
        />
        <Tooltip title="刷新远端行情">
          <Button
            icon={<ReloadOutlined />}
            type="primary"
            loading={stock.loading}
            onClick={() => stock.refreshStock()}
          >
            刷新
          </Button>
        </Tooltip>
        <Tooltip title={`查看、测试和切换数据源；当前：${stock.selectedSourceName}`}>
          <Button icon={<ApiOutlined />} onClick={stock.openSourceTestDialog}>
            数据源
          </Button>
        </Tooltip>
        <Tooltip title={stock.networkProxy.enabled ? '代理已启用' : '代理未启用，当前直连'}>
          <Button icon={<GlobalOutlined />} onClick={stock.openProxyDialog}>
            代理
          </Button>
        </Tooltip>
        <div className="toolbar-symbol-title" title={stock.chart.title}>
          <BarChartOutlined />
          <span>{stock.chart.title}</span>
        </div>
        <Tooltip title="检查应用更新">
          <Button icon={<CloudDownloadOutlined />} onClick={updates.checkForUpdates}>
            检查更新
          </Button>
        </Tooltip>
      </Space>

      <Divider type="vertical" />

      <Space size={12}>
        {indicatorLabels.map((item) => (
          <Checkbox
            key={item.name}
            checked={stock.chart.enabledIndicators[item.name]}
            onChange={handleIndicatorChange(item.name)}
          >
            {item.label}
          </Checkbox>
        ))}
      </Space>

      <div className="toolbar-spacer" />

      <Space size={12}>
        <Space size={6}>
          <CloudDownloadOutlined />
          <span className="subtle-text">启动检查更新</span>
          <Switch
            size="small"
            checked={updates.settings.checkUpdatesOnStartup}
            onChange={updates.setCheckUpdatesOnStartup}
          />
        </Space>
      </Space>
    </div>
  )
})
