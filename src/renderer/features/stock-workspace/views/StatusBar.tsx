import { observer } from 'mobx-react-lite'
import { Space, Tag } from 'antd'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'
import type { AppUpdateViewModel } from '../../app-update/view-models/AppUpdateViewModel'

interface StatusBarProps {
  stock: StockWorkspaceViewModel
  updates: AppUpdateViewModel
}

export const StatusBar = observer(({ stock, updates }: StatusBarProps) => {
  const updateStatus = updates.state.status

  return (
    <div className="status-bar">
      <Space split={<span className="status-separator">|</span>} size={8}>
        <span>{stock.selectedSourceName}</span>
        <span>{stock.query.symbol}</span>
        <span>{stock.recordCount.toLocaleString('zh-CN')} 条记录</span>
        <span>{stock.latestSummary}</span>
        <span title={stock.chart.sourceLabel}>{stock.chart.sourceLabel}</span>
      </Space>
      <Space size={8}>
        {stock.status === 'success' ? <Tag color="success">加载完成</Tag> : null}
        {stock.status === 'loading' ? <Tag color="processing">加载中</Tag> : null}
        {stock.status === 'error' ? <Tag color="error">加载失败</Tag> : null}
        {updateStatus !== 'idle' ? <Tag color="blue">更新：{updates.state.message}</Tag> : null}
      </Space>
    </div>
  )
})
