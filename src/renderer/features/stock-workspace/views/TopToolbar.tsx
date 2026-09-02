import { observer } from 'mobx-react-lite'
import { Badge, Button, Dropdown, Input, Segmented, Select, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import {
  ApiOutlined,
  BarChartOutlined,
  BulbOutlined,
  CalculatorOutlined,
  CloudDownloadOutlined,
  DownloadOutlined,
  FundProjectionScreenOutlined,
  GlobalOutlined,
  LineChartOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons'
import type { StockAdjust, StockPeriod, WorkspaceViewMode } from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'
import type { TradeProfitCalculatorViewModel } from '../../trade-profit-calculator/view-models/TradeProfitCalculatorViewModel'

interface TopToolbarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
  tradeProfit: TradeProfitCalculatorViewModel
}

interface TopToolbarMoreMenuOptions {
  activeSourceName: string
  networkProxyEnabled: boolean
  localCacheExporting: boolean
  localCacheImportInspecting: boolean
  localCacheImporting: boolean
  checkUpdatesOnStartup: boolean
  isCheckingForUpdates: boolean
  aiConnectorStatusLabel: string
  onOpenSourceTestDialog: () => void
  onOpenProxyDialog: () => void
  onOpenAiSettings: () => void
  onExportLocalCacheBackup: () => void | Promise<void>
  onInspectLocalCacheBackup: () => void | Promise<void>
  onCheckForUpdates: () => void | Promise<void>
  onSetCheckUpdatesOnStartup: (enabled: boolean) => void | Promise<void>
}

export function createTopToolbarMoreMenuItems(
  options: TopToolbarMoreMenuOptions
): NonNullable<MenuProps['items']> {
  const importBusy = options.localCacheImportInspecting || options.localCacheImporting

  return [
    {
      key: 'data-source',
      icon: <ApiOutlined />,
      label: `数据源：${options.activeSourceName}`,
      onClick: options.onOpenSourceTestDialog
    },
    {
      key: 'network-proxy',
      icon: <GlobalOutlined />,
      label: options.networkProxyEnabled ? '代理：已启用' : '代理：直连',
      onClick: options.onOpenProxyDialog
    },
    {
      key: 'ai-settings',
      icon: <BulbOutlined />,
      label: `AI 设置：${options.aiConnectorStatusLabel}`,
      onClick: options.onOpenAiSettings
    },
    {
      key: 'cache-divider',
      type: 'divider'
    },
    {
      key: 'export-cache',
      icon: <DownloadOutlined />,
      label: options.localCacheExporting ? '正在导出缓存' : '导出缓存',
      disabled: options.localCacheExporting,
      onClick: () => {
        void options.onExportLocalCacheBackup()
      }
    },
    {
      key: 'import-cache',
      icon: <UploadOutlined />,
      label: options.localCacheImportInspecting
        ? '正在检查备份'
        : options.localCacheImporting
          ? '正在导入缓存'
          : '导入缓存',
      disabled: importBusy,
      onClick: () => {
        void options.onInspectLocalCacheBackup()
      }
    },
    {
      key: 'updates-divider',
      type: 'divider'
    },
    {
      key: 'check-updates',
      icon: <CloudDownloadOutlined />,
      label: options.isCheckingForUpdates ? '正在检查更新' : '检查更新',
      disabled: options.isCheckingForUpdates,
      onClick: () => {
        void options.onCheckForUpdates()
      }
    },
    {
      key: 'check-updates-on-startup',
      icon: <CloudDownloadOutlined />,
      label: options.checkUpdatesOnStartup ? '启动检查更新：已开启' : '启动检查更新：已关闭',
      onClick: () => {
        void options.onSetCheckUpdatesOnStartup(!options.checkUpdatesOnStartup)
      }
    }
  ]
}

export const TopToolbar = observer(({ stock, updates, tradeProfit }: TopToolbarProps) => {
  const moreMenuItems = createTopToolbarMoreMenuItems({
    activeSourceName: stock.activeSourceName,
    networkProxyEnabled: stock.networkProxy.enabled,
    localCacheExporting: stock.localCacheExporting,
    localCacheImportInspecting: stock.localCacheImportInspecting,
    localCacheImporting: stock.localCacheImporting,
    checkUpdatesOnStartup: updates.settings.checkUpdatesOnStartup,
    isCheckingForUpdates: updates.state.status === 'checking',
    aiConnectorStatusLabel: stock.aiConnectorStatusLabel,
    onOpenSourceTestDialog: stock.openSourceTestDialog,
    onOpenProxyDialog: stock.openProxyDialog,
    onOpenAiSettings: stock.openAiSettings,
    onExportLocalCacheBackup: stock.exportLocalCacheBackup,
    onInspectLocalCacheBackup: stock.inspectLocalCacheBackup,
    onCheckForUpdates: updates.checkForUpdates,
    onSetCheckUpdatesOnStartup: updates.setCheckUpdatesOnStartup
  })

  return (
    <div className="top-toolbar">
      <div className="toolbar-group toolbar-query-group">
        <Input
          className="toolbar-symbol-input"
          prefix={<SearchOutlined />}
          value={stock.query.symbol}
          onChange={(event) => stock.setSymbol(event.target.value)}
          onPressEnter={() => stock.refreshStock()}
        />
        <Tooltip title={stock.isCurrentSymbolWatched ? '当前股票已在自选股' : '打开自选股'}>
          <Badge count={stock.watchlist.length} size="small" overflowCount={999}>
            <Button
              icon={stock.isCurrentSymbolWatched ? <StarFilled /> : <StarOutlined />}
              type={stock.watchlistOpen ? 'primary' : 'default'}
              onClick={stock.toggleWatchlistOpen}
              aria-label="自选"
            >
              <span className="toolbar-button-text">自选</span>
            </Button>
          </Badge>
        </Tooltip>
        <Segmented<WorkspaceViewMode>
          size="small"
          value={stock.viewMode}
          options={[
            { label: '分时', value: 'timeshare' },
            { label: 'K线', value: 'kline' }
          ]}
          onChange={stock.setViewMode}
        />
      </div>

      {stock.viewMode === 'kline' ? (
        <div className="toolbar-group toolbar-kline-params">
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
        </div>
      ) : null}

      <div className="toolbar-group toolbar-primary-actions">
        <Tooltip title="刷新远端行情">
          <Button
            icon={<ReloadOutlined />}
            type="primary"
            loading={stock.loading}
            onClick={() => stock.refreshStock()}
            aria-label="刷新"
          >
            <span className="toolbar-button-text">刷新</span>
          </Button>
        </Tooltip>
        <Tooltip title="管理指标开关和参数">
          <Button icon={<LineChartOutlined />} onClick={stock.openIndicatorDialog} aria-label="指标">
            <span className="toolbar-button-text">指标</span>
          </Button>
        </Tooltip>
        <Tooltip title="测算买入卖出费用和盈亏">
          <Button icon={<CalculatorOutlined />} onClick={tradeProfit.openCalculator} aria-label="做T">
            <span className="toolbar-button-text">做T</span>
          </Button>
        </Tooltip>
        <Tooltip title="AI 分析（测试中）：手动发送当前工作区摘要给 AI">
          <Button
            icon={<BulbOutlined />}
            onClick={stock.openAiAnalysisPanel}
            aria-label="AI 分析（测试中）"
          >
            <span className="toolbar-button-text">AI（测试中）</span>
          </Button>
        </Tooltip>
        {stock.viewMode === 'kline' ? (
          <Tooltip title="查看 K 线历史回测和候选策略">
            <Button
              icon={<FundProjectionScreenOutlined />}
              onClick={stock.openStrategyPanel}
              aria-label="策略"
            >
              <span className="toolbar-button-text">策略</span>
            </Button>
          </Tooltip>
        ) : null}
      </div>

      <div className="toolbar-symbol-title" title={stock.activeTitle}>
        <BarChartOutlined />
        <span>{stock.activeTitle}</span>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group toolbar-more-group">
        <Dropdown menu={{ items: moreMenuItems }} trigger={['click']} placement="bottomRight">
          <Button icon={<MoreOutlined />} aria-label="更多">
            更多
          </Button>
        </Dropdown>
      </div>
    </div>
  )
})
