import { Alert, Layout } from 'antd'
import { observer } from 'mobx-react-lite'
import type { RootViewModel } from '../../../app/RootViewModel'
import { UpdateStatusView } from '../../app-update/views/UpdateStatusView'
import { UserManualModal } from '../../help/views/UserManualModal'
import { VersionUpdatesModal } from '../../help/views/VersionUpdatesModal'
import { TradeProfitCalculatorDrawer } from '../../trade-profit-calculator/views/TradeProfitCalculatorDrawer'
import { DataSourceStatusModal } from './DataSourceStatusModal'
import { IndicatorSettingsModal } from './IndicatorSettingsModal'
import { KlineCacheManagementModal } from './KlineCacheManagementModal'
import { KLineChartView } from './KLineChartView'
import { NetworkProxyModal } from './NetworkProxyModal'
import { StatusBar } from './StatusBar'
import { TimeshareChartView } from './TimeshareChartView'
import { TopToolbar } from './TopToolbar'
import { WatchlistPanel } from './WatchlistPanel'

interface WorkspacePageProps {
  root: RootViewModel
}

export const WorkspacePage = observer(({ root }: WorkspacePageProps) => {
  const stock = root.stockWorkspace

  return (
    <Layout className="workspace-layout">
      <Layout.Header className="workspace-header">
        <TopToolbar
          stock={stock}
          updates={root.appUpdate}
          tradeProfit={root.tradeProfitCalculator}
        />
      </Layout.Header>
      <Layout.Content className="workspace-content">
        {stock.error ? (
          <Alert className="workspace-alert" type="error" showIcon message={stock.error} />
        ) : null}
        <div className="workspace-main">
          {stock.watchlistOpen ? <WatchlistPanel stock={stock} /> : null}
          <div className="workspace-chart-area">
            {stock.viewMode === 'timeshare' ? (
              <TimeshareChartView viewModel={stock.timeshare} loading={stock.loading} />
            ) : (
              <KLineChartView viewModel={stock.chart} loading={stock.loading} />
            )}
          </div>
        </div>
      </Layout.Content>
      <Layout.Footer className="workspace-footer">
        <StatusBar stock={stock} updates={root.appUpdate} />
      </Layout.Footer>
      <IndicatorSettingsModal stock={stock} />
      <KlineCacheManagementModal stock={stock} />
      <DataSourceStatusModal stock={stock} />
      <NetworkProxyModal stock={stock} />
      <UpdateStatusView viewModel={root.appUpdate} />
      <TradeProfitCalculatorDrawer
        calculator={root.tradeProfitCalculator}
        symbol={stock.normalizedCurrentSymbol}
        stockName={stock.currentStockName}
      />
      <UserManualModal open={root.isUserManualOpen} onClose={root.closeUserManual} />
      <VersionUpdatesModal
        open={root.isVersionUpdatesOpen}
        onClose={root.closeVersionUpdates}
      />
    </Layout>
  )
})
