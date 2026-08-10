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

const periodLabels: Record<SourceTestResult['query']['period'], string> = {
  day: '日线',
  week: '周线',
  month: '月线',
  '5': '5分钟',
  '15': '15分钟',
  '30': '30分钟',
  '60': '60分钟'
}

const adjustLabels: Record<SourceTestResult['query']['adjust'], string> = {
  none: '不复权',
  qfq: '前复权',
  hfq: '后复权'
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
          {stock.query.sourceId === result.sourceId ? <Tag color="blue">当前</Tag> : null}
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
      title: '请求参数',
      dataIndex: 'query',
      width: 220,
      render: (_value, result) => (
        <Space size={6}>
          <span>{result.query.symbol}</span>
          <span>{periodLabels[result.query.period]}</span>
          <span>{adjustLabels[result.query.adjust]}</span>
        </Space>
      )
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
        const active = stock.query.sourceId === result.sourceId
        return (
          <Button
            size="small"
            type={active ? 'default' : 'primary'}
            disabled={active}
            onClick={() => stock.setSourceId(result.sourceId)}
          >
            {active ? '当前' : '使用'}
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
        当前数据源：{stock.selectedSourceName}
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
