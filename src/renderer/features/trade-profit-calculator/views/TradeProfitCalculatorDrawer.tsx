import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { App, Button, Drawer, Form, InputNumber, Space, Switch, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { observer } from 'mobx-react-lite'
import type { TradeProfitRecord } from '../models/trade-profit'
import type { TradeProfitCalculatorViewModel } from '../view-models/TradeProfitCalculatorViewModel'

interface TradeProfitCalculatorDrawerProps {
  calculator: TradeProfitCalculatorViewModel
  symbol: string
  stockName: string
}

export const TradeProfitCalculatorDrawer = observer(
  ({ calculator, symbol, stockName }: TradeProfitCalculatorDrawerProps) => {
    const antdApp = App.useApp()
    const currentResult = calculator.currentResult
    const totalProfitClassName = profitClassName(calculator.totalProfit)

    const columns: TableColumnsType<TradeProfitRecord> = [
      {
        title: '时间',
        dataIndex: 'createdAt',
        width: 150,
        render: (value: number) => formatDateTime(value)
      },
      {
        title: '证券',
        width: 130,
        render: (_, record) => (
          <div className="trade-profit-symbol">
            <span>{record.stockName || record.symbol || '未关联'}</span>
            {record.symbol ? <span>{record.symbol}</span> : null}
          </div>
        )
      },
      {
        title: '类型',
        width: 74,
        render: (_, record) => (
          <Tag color={record.input.isEtf ? 'blue' : 'default'}>
            {record.input.isEtf ? 'ETF' : '股票'}
          </Tag>
        )
      },
      {
        title: '买入价',
        dataIndex: ['input', 'buyPrice'],
        width: 86,
        render: formatPrice
      },
      {
        title: '卖出价',
        dataIndex: ['input', 'sellPrice'],
        width: 86,
        render: formatPrice
      },
      {
        title: '股数',
        dataIndex: ['input', 'quantity'],
        width: 86,
        render: (value: number) => value.toLocaleString('zh-CN')
      },
      {
        title: '买入金额',
        dataIndex: ['result', 'buyAmount'],
        width: 104,
        render: formatMoney
      },
      {
        title: '卖出金额',
        dataIndex: ['result', 'sellAmount'],
        width: 104,
        render: formatMoney
      },
      {
        title: '买入佣金',
        dataIndex: ['result', 'buyCommission'],
        width: 98,
        render: formatMoney
      },
      {
        title: '卖出佣金',
        dataIndex: ['result', 'sellCommission'],
        width: 98,
        render: formatMoney
      },
      {
        title: '印花税',
        dataIndex: ['result', 'stampTax'],
        width: 88,
        render: formatMoney
      },
      {
        title: '盈亏',
        dataIndex: ['result', 'profit'],
        fixed: 'right',
        width: 98,
        render: (value: number) => (
          <span className={profitClassName(value)}>{formatMoney(value)}</span>
        )
      },
      {
        title: '操作',
        fixed: 'right',
        width: 70,
        render: (_, record) => (
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            type="text"
            onClick={() => calculator.removeRecord(record.id)}
          />
        )
      }
    ]

    const confirmClearRecords = (): void => {
      antdApp.modal.confirm({
        title: '清空做T测算记录',
        content: `将删除全部 ${calculator.recordCount} 条测算记录。`,
        okText: '清空',
        okButtonProps: { danger: true },
        cancelText: '取消',
        onOk: (close) => {
          calculator.clearRecords()
          close()
        }
      })
    }

    return (
      <Drawer
        className="trade-profit-drawer"
        title="做T盈亏测算"
        open={calculator.open}
        width={880}
        onClose={calculator.closeCalculator}
      >
        <div className="trade-profit-shell">
          <div className="trade-profit-form-panel">
            <Form layout="vertical">
              <Form.Item label="买入价（元）">
                <InputNumber<number>
                  min={0}
                  precision={3}
                  step={0.01}
                  value={calculator.draft.buyPrice}
                  onChange={(value) => calculator.setDraftField('buyPrice', value)}
                />
              </Form.Item>
              <Form.Item label="卖出价（元）">
                <InputNumber<number>
                  min={0}
                  precision={3}
                  step={0.01}
                  value={calculator.draft.sellPrice}
                  onChange={(value) => calculator.setDraftField('sellPrice', value)}
                />
              </Form.Item>
              <Form.Item label="股数">
                <InputNumber<number>
                  min={1}
                  precision={0}
                  step={100}
                  value={calculator.draft.quantity}
                  onChange={(value) => calculator.setDraftField('quantity', value)}
                />
              </Form.Item>
              <Form.Item label="手续费（万分之）">
                <InputNumber<number>
                  min={0}
                  precision={3}
                  step={0.1}
                  value={calculator.draft.commissionRate}
                  onChange={(value) => calculator.setDraftField('commissionRate', value)}
                />
              </Form.Item>
              <Form.Item label="印花税（万分之）">
                <InputNumber<number>
                  min={0}
                  precision={3}
                  step={0.1}
                  value={calculator.draft.stampTaxRate}
                  onChange={(value) => calculator.setDraftField('stampTaxRate', value)}
                />
              </Form.Item>
              <Form.Item label="最低佣金（元）">
                <InputNumber<number>
                  min={0}
                  precision={2}
                  step={1}
                  value={calculator.draft.minimumCommission}
                  onChange={(value) => calculator.setDraftField('minimumCommission', value)}
                />
              </Form.Item>
              <Form.Item label="ETF 交易">
                <Switch checked={calculator.draft.isEtf} onChange={calculator.setEtf} />
              </Form.Item>
            </Form>
          </div>

          <div className="trade-profit-result-panel">
            <div className="trade-profit-current-result">
              <div>
                <Typography.Text type="secondary">买入金额</Typography.Text>
                <strong>{formatMoney(currentResult.buyAmount)}</strong>
              </div>
              <div>
                <Typography.Text type="secondary">卖出金额</Typography.Text>
                <strong>{formatMoney(currentResult.sellAmount)}</strong>
              </div>
              <div>
                <Typography.Text type="secondary">费用合计</Typography.Text>
                <strong>
                  {formatMoney(
                    currentResult.buyCommission +
                      currentResult.sellCommission +
                      currentResult.stampTax
                  )}
                </strong>
              </div>
              <div>
                <Typography.Text type="secondary">本次盈亏</Typography.Text>
                <strong className={profitClassName(currentResult.profit)}>
                  {formatMoney(currentResult.profit)}
                </strong>
              </div>
            </div>

            {calculator.saveError ? (
              <Typography.Text className="trade-profit-save-error" type="danger">
                {calculator.saveError}
              </Typography.Text>
            ) : null}

            <Space className="trade-profit-actions" size={8}>
              <Button
                icon={<PlusOutlined />}
                type="primary"
                disabled={!calculator.canAddRecord}
                onClick={() => calculator.addRecord({ symbol, stockName })}
              >
                新增记录
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={calculator.recordCount === 0}
                onClick={confirmClearRecords}
              >
                清空全部
              </Button>
              <Typography.Text className={totalProfitClassName}>
                总盈亏：{formatMoney(calculator.totalProfit)}
              </Typography.Text>
            </Space>

            <Table<TradeProfitRecord>
              className="trade-profit-table"
              columns={columns}
              dataSource={calculator.records}
              pagination={false}
              rowKey="id"
              scroll={{ x: 1280, y: 360 }}
              size="small"
            />
          </div>
        </div>
      </Drawer>
    )
  }
)

function profitClassName(value: number): string {
  if (value > 0) {
    return 'trade-profit-positive'
  }
  if (value < 0) {
    return 'trade-profit-negative'
  }
  return 'trade-profit-neutral'
}

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatPrice(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  })
}

function formatDateTime(value: number): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}
