import { Alert, Button, Checkbox, Drawer, Empty, InputNumber, Space, Table, Tag, Typography } from 'antd'
import type { TableColumnsType } from 'antd'
import { FundProjectionScreenOutlined, ReloadOutlined } from '@ant-design/icons'
import { observer } from 'mobx-react-lite'
import type {
  KlineStrategyBacktestResult,
  KlineStrategySignal,
  KlineStrategyTemplateId,
  KlineStrategyTrade,
  StockAdjust,
  StockPeriod,
  StockSourceId
} from '../models/stock-types'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface KlineStrategyPanelProps {
  stock: StockWorkspaceViewModel
}

export const KlineStrategyPanel = observer(({ stock }: KlineStrategyPanelProps) => {
  const resultColumns: TableColumnsType<KlineStrategyBacktestResult> = [
    {
      title: '排名',
      width: 70,
      render: (_, result) => (result.rank ? `#${result.rank}` : '-')
    },
    {
      title: '策略',
      width: 150,
      render: (_, result) => (
        <div className="strategy-result-name">
          <span>{result.templateName}</span>
          <Typography.Text type="secondary">{result.description}</Typography.Text>
        </div>
      )
    },
    {
      title: '状态',
      width: 96,
      render: (_, result) =>
        result.status === 'success' ? (
          <Tag color="success">已回测</Tag>
        ) : (
          <Tag color="warning">不可用</Tag>
        )
    },
    {
      title: '总收益',
      width: 96,
      render: (_, result) =>
        result.status === 'success' ? formatPercent(result.metrics?.totalReturn) : '-'
    },
    {
      title: '最大回撤',
      width: 96,
      render: (_, result) =>
        result.status === 'success' ? formatPercent(result.metrics?.maxDrawdown) : '-'
    },
    {
      title: '交易',
      width: 72,
      render: (_, result) => (result.status === 'success' ? (result.metrics?.tradeCount ?? '-') : '-')
    },
    {
      title: '评分',
      width: 86,
      render: (_, result) => formatNumber(result.score)
    },
    {
      title: '区间说明',
      render: (_, result) => formatResultMessage(result)
    }
  ]

  const tradeColumns: TableColumnsType<KlineStrategyTrade> = [
    {
      title: '买入时间',
      width: 120,
      dataIndex: 'entryTimeKey'
    },
    {
      title: '卖出时间',
      width: 120,
      render: (_, trade) => trade.exitTimeKey ?? '未平仓'
    },
    {
      title: '成交价',
      width: 150,
      render: (_, trade) =>
        `${formatPrice(trade.entryPrice)} / ${trade.exitPrice ? formatPrice(trade.exitPrice) : '-'}`
    },
    {
      title: '持仓 K 线',
      width: 92,
      dataIndex: 'holdingBars'
    },
    {
      title: '单笔收益',
      width: 96,
      render: (_, trade) => formatPercent(trade.returnRate)
    },
    {
      title: '触发说明',
      render: (_, trade) => trade.exitSignal?.explanation ?? trade.entrySignal.explanation
    }
  ]

  const signalColumns: TableColumnsType<KlineStrategySignal> = [
    {
      title: '时间',
      width: 120,
      dataIndex: 'timeKey'
    },
    {
      title: '方向',
      width: 86,
      render: (_, signal) => (
        <Tag color={signal.side === 'buy' ? 'orange' : 'cyan'}>
          {signal.side === 'buy' ? '买入信号' : '卖出信号'}
        </Tag>
      )
    },
    {
      title: '触发价参考',
      width: 110,
      render: (_, signal) => formatPrice(signal.price)
    },
    {
      title: '说明',
      render: (_, signal) => signal.explanation
    }
  ]

  const selectedResult = stock.selectedStrategyResult
  const bestRankedResult = stock.bestRankedStrategyResult

  return (
    <Drawer
      className="strategy-drawer"
      title={
        <Space size={8}>
          <FundProjectionScreenOutlined />
          <span>K 线历史回测</span>
        </Space>
      }
      open={stock.strategyPanelOpen}
      width={920}
      onClose={stock.closeStrategyPanel}
    >
      <div className="strategy-shell">
        <Alert
          type="info"
          showIcon
          message="历史回测不代表未来表现；这里展示的是候选策略在所选区间的历史信号和表现排名。"
        />

        <section className="strategy-section">
          <div className="strategy-section-title">策略模板</div>
          <Checkbox.Group
            options={stock.strategyTemplateOptions}
            value={stock.strategyDraft.selectedTemplateIds}
            onChange={(values) =>
              stock.setStrategySelectedTemplateIds(values as KlineStrategyTemplateId[])
            }
          />
        </section>

        <section className="strategy-section">
          <div className="strategy-section-title">模板参数</div>
          <div className="strategy-template-list">
            {stock.strategyTemplateDraftRows.map((template) => (
              <div className="strategy-template-row" key={template.id}>
                <div className="strategy-template-meta">
                  <Typography.Text strong>{template.name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {template.description}；支持{template.compatiblePeriodLabel}；至少{' '}
                    {template.minSampleSize} 根 K 线
                  </Typography.Text>
                  <Typography.Text type="secondary">{template.signalDescription}</Typography.Text>
                </div>
                <Space size={10} wrap>
                  {template.parameters.map((parameter) => (
                    <label className="strategy-param" key={`${template.id}-${parameter.key}`}>
                      <span>{parameter.label}</span>
                      <InputNumber<number>
                        min={parameter.min}
                        max={parameter.max}
                        step={parameter.step}
                        precision={parameter.precision ?? 0}
                        value={template.params[parameter.key]}
                        onChange={(value) =>
                          stock.setStrategyDraftParam(template.id, parameter.key, value)
                        }
                      />
                    </label>
                  ))}
                </Space>
                {template.errors.length > 0 ? (
                  <Typography.Text className="strategy-error" type="danger">
                    {template.errors.join('；')}
                  </Typography.Text>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="strategy-section">
          <div className="strategy-section-title">回测设置</div>
          <Space size={12} wrap>
            <label className="strategy-param">
              <span>回测区间</span>
              <Typography.Text className="strategy-date-range" type="secondary">
                {stock.strategyBacktestDateRangeLabel}
              </Typography.Text>
              <Typography.Text className="strategy-date-source" type="secondary">
                使用顶部 K 线日期范围
              </Typography.Text>
            </label>
            <label className="strategy-param">
              <span>初始资金</span>
              <InputNumber<number>
                min={1}
                precision={2}
                value={stock.strategyInitialCapitalInput}
                onChange={stock.setStrategyInitialCapital}
              />
            </label>
            <label className="strategy-param">
              <span>费用率 %</span>
              <InputNumber<number>
                min={0}
                max={20}
                precision={3}
                step={0.01}
                value={stock.strategyFeeRatePercentInput}
                onChange={stock.setStrategyFeeRatePercent}
              />
            </label>
            <label className="strategy-param">
              <span>滑点率 %</span>
              <InputNumber<number>
                min={0}
                max={20}
                precision={3}
                step={0.01}
                value={stock.strategySlippageRatePercentInput}
                onChange={stock.setStrategySlippageRatePercent}
              />
            </label>
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={stock.strategyRunning}
              disabled={!stock.canRunStrategyBacktest}
              onClick={() => void stock.runStrategyBacktest()}
            >
              运行历史回测
            </Button>
          </Space>
          {stock.strategyFormErrors.length > 0 ? (
            <Typography.Text className="strategy-error" type="danger">
              {stock.strategyFormErrors.join('；')}
            </Typography.Text>
          ) : null}
          {stock.strategyStatusMessage ? (
            <Typography.Text className="strategy-status" type="secondary">
              {stock.strategyStatusMessage}
            </Typography.Text>
          ) : null}
        </section>

        {stock.strategyError ? <Alert type="error" showIcon message={stock.strategyError} /> : null}

        <section className="strategy-section">
          <div className="strategy-section-title">历史表现排名</div>
          {bestRankedResult ? (
            <Alert
              type="success"
              showIcon
              message={`所选区间内历史表现最佳的候选策略：${bestRankedResult.templateName}`}
            />
          ) : null}
          {stock.strategyResults.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无回测结果" />
          ) : (
            <Table<KlineStrategyBacktestResult>
              size="small"
              rowKey="id"
              dataSource={stock.rankedStrategyResults}
              columns={resultColumns}
              pagination={false}
              scroll={{ x: 900, y: 260 }}
              rowClassName={(result) =>
                result.id === stock.selectedStrategyResultId ? 'strategy-row-selected' : ''
              }
              onRow={(result) => ({
                onClick: () => stock.selectStrategyResult(result.id)
              })}
            />
          )}
        </section>

        {selectedResult?.status === 'success' && selectedResult.metrics ? (
          <section className="strategy-section">
            <div className="strategy-section-title">选中策略摘要</div>
            <div className="strategy-metrics">
              <Metric label="总收益" value={formatPercent(selectedResult.metrics.totalReturn)} />
              <Metric label="年化收益" value={formatPercent(selectedResult.metrics.annualizedReturn)} />
              <Metric label="最大回撤" value={formatPercent(selectedResult.metrics.maxDrawdown)} />
              <Metric label="胜率" value={formatPercent(selectedResult.metrics.winRate)} />
              <Metric label="交易次数" value={String(selectedResult.metrics.tradeCount)} />
              <Metric label="盈亏比" value={formatNumber(selectedResult.metrics.profitLossRatio)} />
              <Metric
                label="平均持仓 K 线"
                value={formatNumber(selectedResult.metrics.averageHoldingBars)}
              />
              <Metric label="期末权益" value={formatMoney(selectedResult.metrics.finalEquity)} />
              <Metric label="基准涨跌" value={formatPercent(selectedResult.metrics.benchmarkReturn)} />
            </div>
            <div className="strategy-assumptions">
              <Metric
                label="回测区间"
                value={`${selectedResult.query.startDate} - ${selectedResult.query.endDate}`}
              />
              <Metric label="实际数据区间" value={formatActualDataRange(selectedResult)} />
              <Metric
                label="数据源"
                value={formatSourceName(stock, selectedResult.query.sourceId)}
              />
              <Metric label="周期" value={formatPeriodLabel(selectedResult.query.period)} />
              <Metric label="复权" value={formatAdjustLabel(selectedResult.query.adjust)} />
              <Metric label="成交规则" value="下一根 K 线开盘价成交" />
              <Metric label="初始资金" value={formatMoney(selectedResult.assumptions.initialCapital)} />
              <Metric label="费用率" value={formatRatePercent(selectedResult.assumptions.feeRate)} />
              <Metric label="滑点率" value={formatRatePercent(selectedResult.assumptions.slippageRate)} />
              <Metric
                label="权益曲线"
                value={`已生成 ${selectedResult.equityCurve.length} 个权益点`}
              />
              <Metric
                label="回撤状态"
                value={`最大回撤 ${formatPercent(selectedResult.metrics.maxDrawdown)}`}
              />
              <Metric label="限制说明" value="历史回测不代表未来表现" />
            </div>
            <Typography.Text className="strategy-subtitle">交易明细</Typography.Text>
            <Table<KlineStrategyTrade>
              size="small"
              rowKey="id"
              dataSource={selectedResult.trades}
              columns={tradeColumns}
              pagination={false}
              scroll={{ x: 760, y: 220 }}
            />
            <Typography.Text className="strategy-subtitle">信号列表</Typography.Text>
            <Table<KlineStrategySignal>
              size="small"
              rowKey={(signal) => `${signal.templateId}-${signal.side}-${signal.timeKey}`}
              dataSource={selectedResult.signals}
              columns={signalColumns}
              pagination={false}
              scroll={{ x: 560, y: 180 }}
            />
          </section>
        ) : null}
      </div>
    </Drawer>
  )
})

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="strategy-metric">
    <Typography.Text type="secondary">{label}</Typography.Text>
    <strong>{value}</strong>
  </div>
)

function formatPercent(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return `${(value * 100).toFixed(2)}%`
}

function formatNumber(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return '-'
  }
  return value.toFixed(2)
}

function formatRatePercent(value: number): string {
  return `${(value * 100).toFixed(3)}%`
}

function formatPrice(value: number): string {
  return value.toFixed(3)
}

function formatMoney(value: number): string {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatResultMessage(result: KlineStrategyBacktestResult): string {
  if (result.unavailableReason) {
    return result.unavailableReason
  }
  const queryRange = `${result.query.startDate} - ${result.query.endDate}`
  if (result.dataStartDate && result.dataEndDate) {
    const dataRange = `${result.dataStartDate} - ${result.dataEndDate}`
    if (dataRange !== queryRange) {
      return `回测区间 ${queryRange}；实际数据 ${dataRange}`
    }
  }
  return `回测区间 ${queryRange}`
}

function formatActualDataRange(result: KlineStrategyBacktestResult): string {
  if (!result.dataStartDate || !result.dataEndDate) {
    return '-'
  }
  return `${result.dataStartDate} - ${result.dataEndDate}`
}

function formatSourceName(stock: StockWorkspaceViewModel, sourceId: StockSourceId): string {
  return stock.sources.find((source) => source.id === sourceId)?.name ?? sourceId
}

function formatPeriodLabel(period: StockPeriod): string {
  return periodLabelByValue[period] ?? period
}

function formatAdjustLabel(adjust: StockAdjust): string {
  return adjustLabelByValue[adjust] ?? adjust
}

const periodLabelByValue: Record<StockPeriod, string> = {
  day: '日线',
  week: '周线',
  month: '月线',
  '5': '5分钟',
  '15': '15分钟',
  '30': '30分钟',
  '60': '60分钟'
}

const adjustLabelByValue: Record<StockAdjust, string> = {
  none: '不复权',
  qfq: '前复权',
  hfq: '后复权'
}
