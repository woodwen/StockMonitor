import { observer } from 'mobx-react-lite'
import { Space, Tag } from 'antd'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'

interface StatusBarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
}

export const StatusBar = observer(({ stock, updates }: StatusBarProps) => {
  const importState = stock.importFile
  const updateStatus = updates.state.status

  return (
    <div className="status-bar">
      <Space split={<span className="status-separator">|</span>} size={8}>
        <span>{stock.recordCount.toLocaleString('zh-CN')} 条记录</span>
        <span>{stock.latestSummary}</span>
        <span>编码 {importState.encoding || '-'}</span>
        <span title={stock.chart.sourceLabel}>{stock.chart.sourceLabel}</span>
      </Space>
      <Space size={8}>
        {importState.status === 'success' ? <Tag color="success">导入完成</Tag> : null}
        {importState.status === 'loading' ? <Tag color="processing">导入中</Tag> : null}
        {importState.status === 'error' ? <Tag color="error">导入失败</Tag> : null}
        {updateStatus !== 'idle' ? <Tag color="blue">更新：{updates.state.message}</Tag> : null}
      </Space>
    </div>
  )
})
