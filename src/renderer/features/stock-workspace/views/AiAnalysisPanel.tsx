import { Alert, Button, Checkbox, Input, Modal, Select, Space, Tag, Typography } from 'antd'
import { BulbOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { observer } from 'mobx-react-lite'
import {
  AI_NON_INVESTMENT_NOTICE,
  validateAiStructuredOutput,
  type AiAnalysisResult,
  type AiUseCaseId
} from '../models/ai-models'
import type { StockWorkspaceViewModel } from '../view-models/StockWorkspaceViewModel'

interface AiAnalysisPanelProps {
  stock: StockWorkspaceViewModel
}

export const AiAnalysisPanel = observer(({ stock }: AiAnalysisPanelProps) => {
  const useCase = stock.selectedAiUseCase
  const result = stock.aiAnalysisResult
  const resultErrorMessage = getAiAnalysisResultErrorMessage(result)
  const validationErrors = stock.aiAnalysisValidationErrors
  const outputText = getAiAnalysisDisplayOutput(stock.aiAnalysisPartialOutput, result)
  const visibleWarnings = stock.aiAnalysisWarnings.filter(
    (warning) => warning !== stock.aiAnalysisFallbackWarning
  )
  const showResultSection =
    Boolean(outputText) ||
    Boolean(result) ||
    stock.aiAnalysisRunning ||
    stock.aiAnalysisStreamStatus === 'cancelled'

  return (
    <Modal
      className="ai-analysis-modal"
      title={
        <Space size={8}>
          <BulbOutlined />
          <span>AI 分析（测试中）</span>
        </Space>
      }
      open={stock.aiAnalysisOpen}
      width={760}
      footer={null}
      onCancel={stock.closeAiAnalysisPanel}
    >
      <div className="ai-analysis-shell">
        <Alert
          type="info"
          showIcon
          message={AI_NON_INVESTMENT_NOTICE}
          description="当前弹窗只在点击分析后发送摘要上下文；启动、刷新、日期切换和打开弹窗不会自动请求 AI。"
        />

        <section className="ai-analysis-section">
          <div className="ai-analysis-section-title">connector</div>
          <Space size={8} wrap>
            <Tag color={stock.aiConnectorSettings.enabled ? 'blue' : 'default'}>
              {stock.aiConnectorSettings.displayName}
            </Tag>
            <Tag>HTTP provider</Tag>
            <Tag>{stock.aiConnectorStatusLabel}</Tag>
            <Tag color={stock.aiAnalysisRunning ? 'processing' : 'default'}>
              {stock.aiAnalysisStatusLabel}
            </Tag>
            {!stock.aiConnectorSettings.enabled ? (
              <Button size="small" onClick={stock.openAiSettings}>
                AI 设置
              </Button>
            ) : null}
          </Space>
        </section>

        <section className="ai-analysis-section">
          <div className="ai-analysis-section-title">场景</div>
          <Select
            className="ai-use-case-select"
            value={stock.aiUseCaseId}
            options={stock.aiUseCaseOptions.map((item) => ({
              value: item.id,
              label: item.title
            }))}
            onChange={stock.setAiUseCaseId}
          />
          <Typography.Paragraph type="secondary">{useCase.description}</Typography.Paragraph>
          <Space size={6} wrap>
            {useCase.outputSchema.map((field) => (
              <Tag key={field}>{field}</Tag>
            ))}
          </Space>
          {stock.aiUseCaseWorkflowNotes.length > 0 ? (
            <Alert
              className="ai-analysis-warning"
              type="info"
              showIcon
              message={stock.aiUseCaseWorkflowNotes.join('；')}
            />
          ) : null}
          {stock.aiUseCaseConfirmationLabel ? (
            <Checkbox
              checked={stock.aiUseCaseConfirmed}
              onChange={(event) => stock.setAiUseCaseConfirmed(event.target.checked)}
            >
              {stock.aiUseCaseConfirmationLabel}
            </Checkbox>
          ) : null}
        </section>

        <section className="ai-analysis-section">
          <div className="ai-analysis-section-title">当前仅分析</div>
          <Typography.Paragraph className="ai-context-summary">
            {stock.aiCurrentAnalysisScope}
          </Typography.Paragraph>
        </section>

        <section className="ai-analysis-section">
          <div className="ai-analysis-section-title">上下文摘要</div>
          <Typography.Paragraph className="ai-context-summary">
            {stock.aiContextSummary}
          </Typography.Paragraph>
        </section>

        {useCase.requiresNews ? (
          <section className="ai-analysis-section">
            <div className="ai-analysis-section-title">新闻/公告摘要</div>
            <Input.TextArea
              rows={4}
              placeholder="每行一条：标题 | 日期 | 来源 | 摘要"
              value={stock.aiNewsText}
              onChange={(event) => stock.setAiNewsText(event.target.value)}
            />
          </section>
        ) : null}

        <section className="ai-analysis-section">
          <div className="ai-analysis-section-title">问题</div>
          <Input.TextArea
            rows={5}
            value={stock.aiQuestion}
            onChange={(event) => stock.setAiQuestion(event.target.value)}
          />
          {stock.aiAnalysisError ? (
            <Alert className="ai-analysis-error" type="error" showIcon message={stock.aiAnalysisError} />
          ) : validationErrors.length > 0 ? (
            <Alert className="ai-analysis-error" type="warning" showIcon message={validationErrors.join('；')} />
          ) : null}
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            loading={stock.aiAnalysisRunning}
            disabled={!stock.canRunAiAnalysis}
            onClick={stock.runAiAnalysis}
          >
            分析
          </Button>
          {stock.aiAnalysisRunning ? (
            <Button danger icon={<StopOutlined />} onClick={stock.cancelAiAnalysis}>
              取消
            </Button>
          ) : null}
        </section>

        {showResultSection ? (
          <section className="ai-analysis-section">
            <div className="ai-analysis-section-title">结果</div>
            <Space size={6} wrap>
              <Tag color={getAiAnalysisStatusColor(stock.aiAnalysisStreamStatus)}>
                {stock.aiAnalysisStatusLabel}
              </Tag>
              {result ? <Tag>{result.connector.displayName}</Tag> : null}
              {result?.connector.model ? <Tag>{result.connector.model}</Tag> : null}
              {result?.connector.profile ? <Tag>{result.connector.profile}</Tag> : null}
              {result ? <Tag>{formatCompletedAt(result.completedAt)}</Tag> : null}
              {result ? <Tag>{Math.round(result.elapsedMs)} ms</Tag> : null}
            </Space>
            {resultErrorMessage ? (
              <Alert
                className="ai-analysis-error"
                type="error"
                showIcon
                message={resultErrorMessage}
              />
            ) : null}
            {stock.aiAnalysisFallbackWarning ? (
              <Alert
                className="ai-analysis-warning"
                type="warning"
                showIcon
                message={stock.aiAnalysisFallbackWarning}
              />
            ) : null}
            {visibleWarnings.length > 0 ? (
              <Alert
                className="ai-analysis-warning"
                type="warning"
                showIcon
                message={visibleWarnings.join('；')}
              />
            ) : null}
            {stock.aiAnalysisRunning ? (
              <Typography.Text type="secondary">内容正在生成中</Typography.Text>
            ) : null}
            {outputText ? (
              <Typography.Paragraph className="ai-analysis-output">
                {outputText}
              </Typography.Paragraph>
            ) : null}
          </section>
        ) : null}
      </div>
    </Modal>
  )
})

function formatCompletedAt(completedAt: string): string {
  return completedAt.slice(0, 19).replace('T', ' ')
}

export function getAiAnalysisResultErrorMessage(result: AiAnalysisResult | null): string {
  if (result?.status !== 'error') {
    return ''
  }
  return result.errorMessage?.trim() || 'AI 分析失败'
}

export function getAiAnalysisDisplayOutput(
  partialOutput: string,
  result: AiAnalysisResult | null
): string {
  return formatAiAnalysisOutput(result?.outputText || partialOutput, result?.useCaseId)
}

export function formatAiAnalysisOutput(outputText: string, useCaseId?: AiUseCaseId): string {
  const parsed = parseAiAnalysisJsonOutput(outputText)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return outputText
  }
  const validationNotes = useCaseId ? validateAiStructuredOutput(useCaseId, parsed) : []
  const sections = Object.entries(parsed)
    .filter(([, value]) => !isEmptyAiOutputValue(value))
    .map(([key, value]) => `${getAiOutputFieldLabel(key)}\n${formatAiOutputValue(value)}`)

  if (validationNotes.length > 0) {
    sections.push(`本地校验\n${validationNotes.map((note) => `- ${note}`).join('\n')}`)
  }
  const remainder = extractTextOutsideFirstJsonObject(outputText)
  if (remainder) {
    sections.push(remainder)
  }

  return sections.length > 0 ? sections.join('\n\n') : outputText
}

function getAiAnalysisStatusColor(status: string): string {
  if (status === 'success') {
    return 'success'
  }
  if (status === 'error') {
    return 'error'
  }
  if (status === 'running' || status === 'cancelling') {
    return 'processing'
  }
  return 'default'
}

function parseAiAnalysisJsonOutput(outputText: string): unknown {
  const trimmed = outputText.trim()
  if (!trimmed) {
    return null
  }
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim()
  const candidates = uniqueOutputCandidates([
    fencedJson,
    trimmed,
    extractFirstJsonObject(trimmed)
  ])

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      // Keep the raw model output when it is not a complete JSON object yet.
    }
  }
  return null
}

function uniqueOutputCandidates(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]))
}

function extractFirstJsonObject(text: string): string | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return undefined
  }
  return text.slice(start, end + 1)
}

function extractTextOutsideFirstJsonObject(text: string): string {
  const trimmed = text.trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) {
    return ''
  }
  return [trimmed.slice(0, start), trimmed.slice(end + 1)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n')
}

function formatAiOutputValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((item) => `- ${formatAiOutputInlineValue(item)}`).join('\n')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, childValue]) => !isEmptyAiOutputValue(childValue))
      .map(
        ([key, childValue]) =>
          `${getAiOutputFieldLabel(key)}：${formatAiOutputInlineValue(childValue)}`
      )
      .join('\n')
  }
  return String(value)
}

function formatAiOutputInlineValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatAiOutputInlineValue).join('；')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(([, childValue]) => !isEmptyAiOutputValue(childValue))
      .map(
        ([key, childValue]) =>
          `${getAiOutputFieldLabel(key)}：${formatAiOutputInlineValue(childValue)}`
      )
      .join('；')
  }
  return String(value)
}

function isEmptyAiOutputValue(value: unknown): boolean {
  return value === null || value === undefined || value === ''
}

function getAiOutputFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    generatedAt: '生成时间',
    dataDate: '数据日期',
    marketSummary: '市场概况',
    watchlistSummary: '自选股摘要',
    currentStockSummary: '当前证券摘要',
    strategySummary: '策略摘要',
    missingData: '缺失数据',
    strategyName: '策略名称',
    marketScope: '适用市场',
    period: '周期',
    entryRules: '入场条件',
    exitRules: '出场条件',
    riskRules: '风控条件',
    parameterDrafts: '参数草稿',
    unsupportedItems: '不支持项',
    localValidationNotes: '本地校验结果',
    failureReasons: '失效原因',
    overfittingRisks: '过拟合风险',
    dataGaps: '数据缺口',
    nextValidationSteps: '后续验证步骤',
    candidateParameters: '候选参数',
    optimizationGoal: '优化目标',
    riskNotes: '风险说明',
    localBacktestRequired: '本地回测要求',
    scope: '标的范围',
    indicatorConditions: '指标条件',
    backtestConditions: '回测条件',
    sortFields: '排序字段',
    dataNeeds: '数据需求',
    comparisonFacts: '对比事实',
    differences: '差异解释',
    applicableConditions: '适用条件',
    regimeLabel: '环境标签',
    newsFacts: '新闻公告事实',
    klineFacts: 'K 线事实',
    relationshipInferences: '关联推断',
    horizon: '预测周期',
    sampleWindow: '样本窗口',
    features: '特征摘要',
    probabilityHypothesis: '概率假设',
    directionHypothesis: '方向假设',
    validationMetrics: '验证指标',
    facts: '事实',
    inferences: '推断',
    risks: '风险',
    dataLimits: '数据限制',
    questionsToVerify: '待核实问题',
    evidence: '依据',
    confidence: '置信度',
    assumptions: '假设',
    watchItems: '关注项',
    sourceNotes: '来源说明',
    unverifiedItems: '未核实事项',
    experimentalNotice: '实验性说明'
  }
  return labels[field] ?? field
}
