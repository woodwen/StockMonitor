import { Button, Modal, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { observer } from 'mobx-react-lite'
import type {
  SourceTestResult,
  StockWorkspaceViewModel
} from '../view-models/StockWorkspaceViewModel'

interface DataSourceStatusModalProps {
  stock: StockWorkspaceViewModel
}

const statusTags: Record<SourceTestResult['status'], { color: string; label: string }> = {
  testing: { color: 'processing', label: '请求中' },
  success: { color: 'success', label: '可用' },
  error: { color: 'error', label: '失败' }
}

export const DataSourceStatusModal = observer(({ stock }: DataSourceStatusModalProps) => {
  const columns: ColumnsType<SourceTestResult> = [
    {
      title: '数据源',
      dataIndex: 'sourceName',
      width: 150,
      render: (sourceName: string, result) => (
        <Space size={6}>
          <span>{sourceName}</span>
          {stock.isSourceActiveForCurrentMode(result.sourceId) ? (
            <Tag color="blue">当前</Tag>
          ) : null}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 88,
      render: (status: SourceTestResult['status']) => {
        const tag = statusTags[status]
        return <Tag color={tag.color}>{tag.label}</Tag>
      }
    },
    {
      title: '分时',
      dataIndex: 'supportsTimeshare',
      width: 74,
      render: (supportsTimeshare: boolean) =>
        supportsTimeshare ? <Tag color="success">支持</Tag> : <Tag>不支持</Tag>
    },
    {
      title: '请求参数',
      dataIndex: 'requestLabel',
      width: 220,
      render: (requestLabel: string) => requestLabel
    },
    {
      title: '记录',
      dataIndex: 'recordCount',
      width: 82,
      render: (recordCount?: number) => (recordCount === undefined ? '-' : recordCount)
    },
    {
      title: '耗时',
      dataIndex: 'elapsedMs',
      width: 82,
      render: (elapsedMs?: number) => (elapsedMs === undefined ? '-' : `${elapsedMs} ms`)
    },
    {
      title: '详情',
      dataIndex: 'message',
      render: (message: string, result) => (
        <Typography.Text
          className="source-test-message"
          type={result.status === 'error' ? 'danger' : undefined}
          title={message}
        >
          {message}
        </Typography.Text>
      )
    },
    {
      title: '操作',
      dataIndex: 'sourceId',
      width: 88,
      render: (_value, result) => {
        const active = stock.isSourceActiveForCurrentMode(result.sourceId)
        const usable = stock.canUseSourceForCurrentMode(result.sourceId)
        return (
          <Button
            size="small"
            type={active ? 'default' : 'primary'}
            disabled={active || !usable}
            onClick={() => stock.setSourceId(result.sourceId)}
          >
            {active ? '当前' : usable ? '使用' : '不支持'}
          </Button>
        )
      }
    }
  ]

  return (
    <Modal
      title="数据源"
      open={stock.sourceTestOpen}
      width={920}
      onCancel={stock.closeSourceTestDialog}
      footer={[
        <Button key="close" onClick={stock.closeSourceTestDialog}>
          关闭
        </Button>,
        <Button
          key="test"
          type="primary"
          loading={stock.sourceTestRunning}
          onClick={stock.testDataSources}
        >
          测试状态
        </Button>
      ]}
    >
      <Typography.Paragraph className="source-test-summary">
        K线数据源：{stock.selectedKlineSourceName}；分时数据源：
        {stock.selectedTimeshareSourceName}；当前模式：
        {stock.viewMode === 'timeshare' ? '分时' : 'K线'}
      </Typography.Paragraph>
      <Table<SourceTestResult>
        rowKey="sourceId"
        size="small"
        pagination={false}
        columns={columns}
        dataSource={stock.sourceTestResults}
      />
    </Modal>
  )
})
