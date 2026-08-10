import { observer } from 'mobx-react-lite'
import { Button, Divider, Input, Segmented, Select, Space, Switch, Tooltip } from 'antd'
import {
  ApiOutlined,
  BarChartOutlined,
  CloudDownloadOutlined,
  GlobalOutlined,
  LineChartOutlined,
  ReloadOutlined,
  SearchOutlined
} from '@ant-design/icons'
import type { StockAdjust, StockPeriod, WorkspaceViewMode } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'

interface TopToolbarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
}

export const TopToolbar = observer(({ stock, updates }: TopToolbarProps) => {
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
        <Segmented<WorkspaceViewMode>
          size="small"
          value={stock.viewMode}
          options={[
            { label: '分时', value: 'timeshare' },
            { label: 'K线', value: 'kline' }
          ]}
          onChange={stock.setViewMode}
        />
        {stock.viewMode === 'kline' ? (
          <>
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
          </>
        ) : null}
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
        <Tooltip title={`查看、测试和切换数据源；当前：${stock.activeSourceName}`}>
          <Button icon={<ApiOutlined />} onClick={stock.openSourceTestDialog}>
            数据源
          </Button>
        </Tooltip>
        <Tooltip title={stock.networkProxy.enabled ? '代理已启用' : '代理未启用，当前直连'}>
          <Button icon={<GlobalOutlined />} onClick={stock.openProxyDialog}>
            代理
          </Button>
        </Tooltip>
        <div className="toolbar-symbol-title" title={stock.activeTitle}>
          <BarChartOutlined />
          <span>{stock.activeTitle}</span>
        </div>
        <Tooltip title="检查应用更新">
          <Button icon={<CloudDownloadOutlined />} onClick={updates.checkForUpdates}>
            检查更新
          </Button>
        </Tooltip>
      </Space>

      {stock.viewMode === 'kline' ? (
        <>
          <Divider type="vertical" />

          <Space size={8}>
            <Tooltip title="管理指标开关和参数">
              <Button icon={<LineChartOutlined />} onClick={stock.openIndicatorDialog}>
                指标
              </Button>
            </Tooltip>
          </Space>
        </>
      ) : null}

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
