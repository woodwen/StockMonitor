import type { Key } from 'react'
import type { TableProps } from 'antd'
import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  Modal,
  Popconfirm,
  Progress,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd'
import {
  DatabaseOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined
} from '@ant-design/icons'
import { observer } from 'mobx-react-lite'
import type {
  KlineCacheDateRange,
  KlineCacheJob,
  KlineCacheStatus,
  KlineCacheStatusRow,
  StockAdjust,
  StockPeriod
} from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface KlineCacheManagementModalProps {
  stock: StockWorkspaceViewModel
}

const statusMeta: Record<KlineCacheStatus, { color: string; label: string }> = {
  complete: { color: 'success', label: '完整' },
  partial: { color: 'warning', label: '部分' },
  empty: { color: 'default', label: '未缓存' },
  unsupported: { color: 'error', label: '不支持' },
  error: { color: 'error', label: '错误' }
}

export const KlineCacheManagementModal = observer(({ stock }: KlineCacheManagementModalProps) => {
  const columns: TableProps<KlineCacheStatusRow>['columns'] = [
    {
      title: '名称',
      dataIndex: 'name',
      width: 130,
      render: (_, row) => (
        <div className="kline-cache-symbol-cell">
          <span className="kline-cache-name">{row.name || row.symbol}</span>
          <span className="kline-cache-symbol">{row.symbol}</span>
        </div>
      )
    },
    {
      title: '周期',
      width: 76,
      render: (_, row) => periodLabel(row.query.period)
    },
    {
      title: '复权',
      width: 86,
      render: (_, row) => adjustLabel(row.query.adjust)
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 86,
      render: (status: KlineCacheStatus) => {
        const meta = statusMeta[status]
        return <Tag color={meta.color}>{meta.label}</Tag>
      }
    },
    {
      title: '记录',
      dataIndex: 'recordCount',
      width: 76,
      align: 'right'
    },
    {
      title: '缓存范围',
      width: 170,
      render: (_, row) => formatRanges(row.coveredRanges)
    },
    {
      title: '缺失范围',
      width: 220,
      render: (_, row) => formatRanges(row.missingRanges)
    },
    {
      title: '最近刷新',
      dataIndex: 'lastRefreshedAt',
      width: 150,
      render: (value?: number) => (value ? new Date(value).toLocaleString('zh-CN') : '-')
    },
    {
      title: '消息',
      width: 220,
      render: (_, row) => row.message || row.lastError?.message || '-'
    }
  ]

  const rowSelection: TableProps<KlineCacheStatusRow>['rowSelection'] = {
    selectedRowKeys: stock.klineCacheSelectedRowIds,
    onChange: (keys: Key[]) => stock.setKlineCacheSelectedRowIds(keys.map(String))
  }

  return (
    <Modal
      className="kline-cache-modal"
      title={
        <Space size={8}>
          <DatabaseOutlined />
          <span>历史 K 线缓存</span>
        </Space>
      }
      open={stock.klineCacheDialogOpen}
      width={980}
      footer={null}
      onCancel={stock.closeKlineCacheDialog}
    >
      <div className="kline-cache-shell">
        <div className="kline-cache-controls">
          <Select
            className="kline-cache-source-select"
            value={stock.klineCacheQuery.sourceId}
            options={stock.sources.map((source) => ({ value: source.id, label: source.name }))}
            onChange={stock.setKlineCacheSourceId}
          />
          <div className="kline-cache-check-group">
            <Typography.Text type="secondary">周期</Typography.Text>
            <Checkbox.Group
              options={stock.klineCachePeriodOptions}
              value={stock.klineCacheQuery.periods}
              onChange={(values) => stock.setKlineCachePeriods(values as StockPeriod[])}
            />
          </div>
          <div className="kline-cache-check-group">
            <Typography.Text type="secondary">复权</Typography.Text>
            <Checkbox.Group
              options={stock.klineCacheAdjustOptions}
              value={stock.klineCacheQuery.adjusts}
              onChange={(values) => stock.setKlineCacheAdjusts(values as StockAdjust[])}
            />
          </div>
          <Input
            className="kline-cache-date-input"
            value={stock.klineCacheQuery.startDate}
            maxLength={8}
            status={stock.klineCacheFormError ? 'error' : undefined}
            onChange={(event) => stock.setKlineCacheStartDate(event.target.value)}
          />
          <Input
            className="kline-cache-date-input"
            value={stock.klineCacheQuery.endDate}
            maxLength={8}
            status={stock.klineCacheFormError ? 'error' : undefined}
            onChange={(event) => stock.setKlineCacheEndDate(event.target.value)}
          />
          <Button
            icon={<SearchOutlined />}
            disabled={Boolean(stock.klineCacheFormError)}
            onClick={() => void stock.loadKlineCacheStatus()}
          >
            查询
          </Button>
        </div>

        <div className="kline-cache-actions">
          <Space size={8} wrap>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              disabled={!stock.canRefreshKlineCache}
              onClick={() => void stock.refreshAllKlineCache()}
            >
              刷新全部
            </Button>
            <Button
              icon={<ReloadOutlined />}
              disabled={!stock.canRefreshSelectedKlineCache}
              onClick={() => void stock.refreshSelectedKlineCache()}
            >
              刷新选中 {stock.selectedKlineCacheCount}
            </Button>
            <Popconfirm
              title="清理缓存"
              description={`确认清理选中的 ${stock.selectedKlineCacheCount} 条缓存？`}
              okText="清理"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => void stock.clearSelectedKlineCache()}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={!stock.canClearSelectedKlineCache}
              >
                清理选中
              </Button>
            </Popconfirm>
            <Button
              icon={<StopOutlined />}
              disabled={!stock.klineCacheRunning}
              onClick={() => void stock.cancelKlineCacheRefresh()}
            >
              取消任务
            </Button>
          </Space>
          <Space size={8} wrap>
            <Button size="small" disabled={stock.klineCacheRows.length === 0} onClick={stock.selectAllKlineCacheRows}>
              全选
            </Button>
            <Button size="small" disabled={stock.selectedKlineCacheCount === 0} onClick={stock.clearKlineCacheSelection}>
              清空选择
            </Button>
          </Space>
        </div>

        {stock.klineCacheJob ? <JobProgress job={stock.klineCacheJob} percent={stock.klineCacheProgressPercent} /> : null}
        {stock.klineCacheError || stock.klineCacheFormError ? (
          <Alert
            type="error"
            showIcon
            message={stock.klineCacheError || stock.klineCacheFormError}
          />
        ) : null}

        {stock.watchlist.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无自选股" />
        ) : (
          <Table
            size="small"
            rowKey="id"
            loading={stock.klineCacheLoading}
            dataSource={stock.klineCacheRows}
            columns={columns}
            rowSelection={rowSelection}
            pagination={false}
            scroll={{ x: 1120, y: 360 }}
          />
        )}
      </div>
    </Modal>
  )
})

const JobProgress = ({ job, percent }: { job: KlineCacheJob; percent: number }) => {
  const currentRow = job.currentRowId
    ? job.rows.find((row) => row.id === job.currentRowId)
    : undefined
  const currentLabel = currentRow
    ? `${currentRow.symbol} ${periodLabel(currentRow.query.period)} ${adjustLabel(currentRow.query.adjust)}`
    : ''

  return (
    <div className="kline-cache-job">
      <Space size={10} wrap>
        <Typography.Text strong>{jobStatusLabel(job)}</Typography.Text>
        <Typography.Text type="secondary">
          {job.completed}/{job.total}
          {currentLabel ? ` ${currentLabel}` : ''}
        </Typography.Text>
      </Space>
      <Progress percent={percent} size="small" status={job.status === 'cancelled' ? 'exception' : undefined} />
    </div>
  )
}

function formatRanges(ranges: KlineCacheDateRange[]): string {
  if (ranges.length === 0) {
    return '-'
  }
  return ranges.map((range) => `${range.startDate} - ${range.endDate}`).join('；')
}

function jobStatusLabel(job: KlineCacheJob): string {
  if (job.status === 'queued') {
    return '等待刷新'
  }
  if (job.status === 'running') {
    return '刷新中'
  }
  if (job.status === 'cancelled') {
    return '已取消'
  }
  return '已完成'
}

function periodLabel(period: StockPeriod): string {
  const labels: Record<StockPeriod, string> = {
    day: '日线',
    week: '周线',
    month: '月线',
    '5': '5分钟',
    '15': '15分钟',
    '30': '30分钟',
    '60': '60分钟'
  }
  return labels[period] ?? period
}

function adjustLabel(adjust: StockAdjust): string {
  const labels: Record<StockAdjust, string> = {
    qfq: '前复权',
    none: '不复权',
    hfq: '后复权'
  }
  return labels[adjust] ?? adjust
}
