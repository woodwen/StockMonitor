import { Alert, Layout } from 'antd'
import { observer } from 'mobx-react-lite'
import type { RootViewModel } from '../../../app/RootViewModel'
import { UpdateStatusView } from '../../app-update/views/UpdateStatusView'
import { DataSourceStatusModal } from './DataSourceStatusModal'
import { KLineChartView } from './KLineChartView'
import { NetworkProxyModal } from './NetworkProxyModal'
import { StatusBar } from './StatusBar'
import { TopToolbar } from './TopToolbar'

interface WorkspacePageProps {
  root: RootViewModel
}

export const WorkspacePage = observer(({ root }: WorkspacePageProps) => {
  const stock = root.stockWorkspace

  return (
    <Layout className="workspace-layout">
      <Layout.Header className="workspace-header">
        <TopToolbar stock={stock} updates={root.appUpdate} />
      </Layout.Header>
      <Layout.Content className="workspace-content">
        {stock.error ? (
          <Alert className="workspace-alert" type="error" showIcon message={stock.error} />
        ) : null}
        <KLineChartView viewModel={stock.chart} loading={stock.loading} />
      </Layout.Content>
      <Layout.Footer className="workspace-footer">
        <StatusBar stock={stock} updates={root.appUpdate} />
      </Layout.Footer>
      <DataSourceStatusModal stock={stock} />
      <NetworkProxyModal stock={stock} />
      <UpdateStatusView viewModel={root.appUpdate} />
    </Layout>
  )
})
