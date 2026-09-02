import { describe, expect, it } from 'vitest'
import {
  AI_NON_INVESTMENT_NOTICE,
  AI_STREAMING_FALLBACK_NOTICE,
  aiHttpProviderPresets,
  aiUseCaseDefinitions,
  createAiPromptMessages,
  createAiUseCaseWorkflow,
  createDefaultAiConnectorSettings,
  getAiHttpProviderPreset,
  hasUnsafeInvestmentLanguage,
  normalizeAiConnectorSettings,
  parseAiNewsItems,
  validateAiAnalysisRequest,
  validateAiStructuredOutput,
  type AiAnalysisRequest,
  type AiAnalysisStreamEvent,
  type AiAnalysisStreamStatus
} from '../src/renderer/features/stock-workspace/models/ai-models'

describe('AI model integration domain', () => {
  it('defaults to a disabled HTTP provider connector and known provider presets', () => {
    const settings = createDefaultAiConnectorSettings()

    expect(settings).toMatchObject({
      connectorId: 'default-ai-connector:deepseek',
      enabled: false,
      kind: 'http-provider',
      displayName: 'DeepSeek',
      model: 'deepseek-v4-pro',
      httpProvider: { presetId: 'deepseek', baseUrl: 'https://api.deepseek.com' }
    })
    expect(aiHttpProviderPresets.map((preset) => preset.id)).toEqual([
      'openai-compatible',
      'deepseek',
      'minimax',
      'zhipu-glm',
      'dashscope',
      'kimi',
      'siliconflow',
      'baichuan',
      'volcengine-ark',
      'custom'
    ])
    expect(getAiHttpProviderPreset('deepseek').models).toContain('deepseek-v4-pro')
    expect(getAiHttpProviderPreset('minimax').models).toContain('MiniMax-M2.7')
    expect(getAiHttpProviderPreset('minimax').models).toContain('MiniMax-M2.5-highspeed')
    expect(getAiHttpProviderPreset('zhipu-glm').models).toContain('glm-5.2')
    expect(getAiHttpProviderPreset('zhipu-glm').models).toContain('glm-4.7')
    expect(getAiHttpProviderPreset('kimi').baseUrl).toBe('https://api.moonshot.ai/v1')
    expect(getAiHttpProviderPreset('kimi').models).toContain('kimi-k2.5')
    expect(getAiHttpProviderPreset('kimi').models).not.toContain('kimi-k3')
  })

  it('normalizes invalid connector settings back to the safe disabled shape', () => {
    const settings = normalizeAiConnectorSettings({
      enabled: true,
      kind: 'http-provider',
      temperature: 9,
      timeoutMs: 1,
      contextLimit: 1,
      httpProvider: {
        presetId: 'bad-provider' as never,
        baseUrl: '  https://api.example.com/v1  ',
        customHeaders: [
          { name: ' Authorization ', value: ' secret ' },
          { name: ' X-Trace ', value: ' trace-1 ' }
        ]
      }
    })

    expect(settings.kind).toBe('http-provider')
    expect(settings.temperature).toBe(2)
    expect(settings.timeoutMs).toBe(5000)
    expect(settings.contextLimit).toBe(1000)
    expect(settings.httpProvider.presetId).toBe('deepseek')
    expect(settings.httpProvider.customHeaders).toEqual([{ name: 'X-Trace', value: 'trace-1' }])
  })

  it('migrates old local runtime settings to a disabled HTTP provider default', () => {
    const settings = normalizeAiConnectorSettings({
      enabled: true,
      kind: 'local-runtime',
      displayName: 'Codex CLI',
      model: 'gpt-test'
    } as never)

    expect(settings).toMatchObject({
      connectorId: 'default-ai-connector:deepseek',
      enabled: false,
      kind: 'http-provider',
      displayName: 'DeepSeek',
      model: 'deepseek-v4-pro',
      httpProvider: { presetId: 'deepseek', baseUrl: 'https://api.deepseek.com' }
    })
  })

  it('scopes default connector ids by HTTP provider preset', () => {
    const settings = normalizeAiConnectorSettings({
      connectorId: 'default-ai-connector',
      httpProvider: {
        presetId: 'minimax',
        baseUrl: 'https://api.minimaxi.com/v1',
        customHeaders: []
      }
    })

    expect(settings.connectorId).toBe('default-ai-connector:minimax')
  })

  it('validates high-risk use cases before sending them to a connector', () => {
    const request = createRequest('price-move-prediction', {
      recordCount: 12
    })

    expect(validateAiAnalysisRequest(request)).toContain('样本数量不足，实验性预测至少需要 60 条记录')
    expect(validateAiAnalysisRequest(createRequest('backtest-report'))).toContain(
      '当前没有可用策略回测结果，请先运行回测'
    )
    expect(validateAiAnalysisRequest(createRequest('news-kline-analysis'))).toContain(
      '请先提供新闻或公告摘要'
    )
  })

  it('builds structured prompts for all required AI use cases', () => {
    expect(aiUseCaseDefinitions).toHaveLength(11)
    const messages = createAiPromptMessages(createRequest('daily-review'))

    expect(messages[0].content).toContain(AI_NON_INVESTMENT_NOTICE)
    expect(messages[0].content).toContain('Stock Monitor')
    expect(messages[1].content).toContain('marketSummary')
    expect(messages[1].content).toContain('currentStockSummary')
    expect(messages[1].content).not.toContain('watchlistSummary')
    expect(messages[1].content).toContain('默认只分析')
    expect(messages[1].content).toContain('不要输出 JSON')
  })

  it('adds explicit workflow guidance for high-risk AI use cases', () => {
    const strategyPrompt = createAiPromptMessages(createRequest('natural-language-strategy'))[1].content
    const optimizationPrompt = createAiPromptMessages(createRequest('parameter-optimization', {
      strategyBacktest: createBacktestSummary()
    }))[1].content
    const screeningPrompt = createAiPromptMessages(createRequest('natural-language-stock-screening'))[1].content
    const comparisonPrompt = createAiPromptMessages(createRequest('strategy-comparison', {
      strategyBacktest: createBacktestSummary()
    }))[1].content

    expect(strategyPrompt).toContain('策略名称')
    expect(strategyPrompt).toContain('入场条件')
    expect(strategyPrompt).toContain('本地校验')
    expect(strategyPrompt).toContain('用户确认')
    expect(optimizationPrompt).toContain('候选参数')
    expect(optimizationPrompt).toContain('本地批量回测')
    expect(optimizationPrompt).not.toContain('最佳买卖参数')
    expect(screeningPrompt).toContain('确认标的范围')
    expect(screeningPrompt).toContain('数据新鲜度')
    expect(comparisonPrompt).toContain('统一指标集合')
    expect(comparisonPrompt).toContain('可比日期范围')
    expect(comparisonPrompt).toContain('不得给出买卖结论')
  })

  it('validates strategy drafts locally before they can be treated as executable', () => {
    const errors = validateAiAnalysisRequest(createRequest('natural-language-strategy', {}, {
      question: '请把我的自然语言策略想法整理成可审查的策略草稿。'
    }))
    const completeDraftNotes = validateAiStructuredOutput('natural-language-strategy', {
      strategyName: '均线突破草稿',
      marketScope: 'A 股日线',
      period: 'day',
      entryRules: ['收盘价突破 MA20'],
      exitRules: ['跌破 MA20'],
      riskRules: ['单笔亏损上限 3%'],
      parameterDrafts: [{ name: 'maPeriod', value: 20 }],
      unsupportedItems: ['暂未映射到可执行模板']
    })
    const incompleteDraftNotes = validateAiStructuredOutput('natural-language-strategy', {
      strategyName: '缺字段草稿'
    })

    expect(errors).toContain('请输入具体自然语言策略描述，不能只使用默认策略草稿说明')
    expect(completeDraftNotes).toContain('策略草稿字段完整性检查通过')
    expect(completeDraftNotes).toContain('尚未映射为可执行策略；保存或回测前仍需用户确认和本地参数校验')
    expect(incompleteDraftNotes.join('；')).toContain('entryRules')
  })

  it('requires confirmation for parameter optimization and multi-target workflows', () => {
    const backtest = createBacktestSummary()
    const optimizationRequest = createRequest('parameter-optimization', {
      strategyBacktest: backtest
    })
    const confirmedOptimization = createRequest('parameter-optimization', {
      strategyBacktest: backtest
    }, {
      workflow: createAiUseCaseWorkflow(optimizationRequest, true)
    })
    const screeningRequest = createRequest('natural-language-stock-screening')
    const comparisonRequest = createRequest('strategy-comparison', {
      strategyBacktest: backtest
    })

    expect(validateAiAnalysisRequest(optimizationRequest).join('；')).toContain('请先确认')
    expect(validateAiAnalysisRequest(confirmedOptimization)).toEqual([])
    expect(validateAiAnalysisRequest(screeningRequest).join('；')).toContain('标的范围')
    expect(validateAiAnalysisRequest(comparisonRequest).join('；')).toContain('对比的周期或股票范围')
  })

  it('records local workflow boundaries for stock screening, news sources, and predictions', () => {
    const screeningWorkflow = createAiUseCaseWorkflow(createRequest(
      'natural-language-stock-screening',
      {
        recordCount: 0,
        missingData: ['自选股缓存缺失']
      }
    ))
    const newsWorkflow = createAiUseCaseWorkflow(createRequest('news-kline-analysis', {}, {
      newsItems: parseAiNewsItems('缺来源材料')
    }))
    const predictionPrompt = createAiPromptMessages(createRequest('price-move-prediction'))[1].content

    expect(screeningWorkflow.targetScope).toContain('用户确认后的标的范围')
    expect(screeningWorkflow.localValidationNotes.join('；')).toContain('自选股缓存缺失')
    expect(newsWorkflow.localValidationNotes.join('；')).toContain('未验证')
    expect(validateAiAnalysisRequest(createRequest('price-move-prediction', { recordCount: 12 }))).toContain(
      '样本数量不足，实验性预测至少需要 60 条记录'
    )
    expect(predictionPrompt).toContain('不得写入策略信号')
    expect(hasUnsafeInvestmentLanguage('建议买入并保证收益')).toBe(true)
  })

  it('marks parameter candidates as requiring local backtest verification before ranking', () => {
    const notes = validateAiStructuredOutput('parameter-optimization', {
      candidateParameters: [
        {
          templateName: '均线交叉',
          params: { shortPeriod: 5, longPeriod: 20 }
        }
      ],
      optimizationGoal: '控制回撤',
      riskNotes: ['样本可能偏少'],
      localBacktestRequired: true
    })

    expect(notes).toContain('候选参数必须先经过本地批量回测，排序依据不得来自 AI 自称最优判断')
  })

  it('allows general questions with empty market data while blocking market-dependent use cases', () => {
    const emptyData = { recordCount: 0, missingData: ['当前没有已加载行情数据'] }

    expect(validateAiAnalysisRequest(createRequest('general-question', emptyData))).toEqual([])
    expect(validateAiAnalysisRequest(createRequest('daily-review', emptyData))).toContain(
      '当前没有可用行情数据，请先刷新行情'
    )
  })

  it('parses user supplied news lines without inventing missing sources', () => {
    expect(parseAiNewsItems('公告标题 | 2026-08-25 | 交易所 | 摘要内容\n缺来源材料')).toEqual([
      {
        title: '公告标题',
        date: '2026-08-25',
        source: '交易所',
        summary: '摘要内容'
      },
      {
        title: '缺来源材料',
        date: '',
        source: '',
        summary: '缺来源材料'
      }
    ])
  })

  it('defines stream events, fallback notices, and cancel-capable statuses', () => {
    const event: AiAnalysisStreamEvent = {
      type: 'chunk',
      requestId: 'request-1',
      useCaseId: 'daily-review',
      connector: {
        connectorId: 'default-ai-connector:deepseek',
        displayName: 'DeepSeek',
        kind: 'http-provider',
        model: 'deepseek-v4-pro',
        profile: ''
      },
      chunkText: '实时内容',
      elapsedMs: 12
    }
    const statuses: AiAnalysisStreamStatus[] = ['idle', 'running', 'cancelling', 'cancelled', 'success', 'error']

    expect(event.chunkText).toBe('实时内容')
    expect(statuses).toContain('cancelled')
    expect(AI_STREAMING_FALLBACK_NOTICE).toContain('不支持流式内容')
  })
})

function createRequest(
  useCaseId: AiAnalysisRequest['useCaseId'],
  patch: Partial<AiAnalysisRequest['context']> = {},
  requestPatch: Partial<Pick<AiAnalysisRequest, 'question' | 'newsItems' | 'workflow'>> = {}
): AiAnalysisRequest {
  return {
    useCaseId,
    question: requestPatch.question ?? '请分析',
    context: {
      generatedAt: '2026-08-25T00:00:00.000Z',
      viewMode: 'kline',
      symbol: 'sh000001',
      stockName: '上证指数',
      dataSourceName: '东方财富',
      dataDateRange: {
        startDate: '20260101',
        endDate: '20260825'
      },
      recordCount: 120,
      latestSummary: '收 3000',
      enabledIndicators: ['ma'],
      missingData: [],
      ...patch
    },
    newsItems: requestPatch.newsItems,
    workflow: requestPatch.workflow
  }
}

function createBacktestSummary(): AiAnalysisRequest['context']['strategyBacktest'] {
  return {
    templateName: '均线交叉',
    period: 'day',
    adjust: 'qfq',
    startDate: '20260101',
    endDate: '20260825',
    sampleSize: 120,
    totalReturnPercent: 12,
    maxDrawdownPercent: -6,
    winRatePercent: 55,
    profitFactor: 1.5,
    tradeCount: 8,
    assumptions: ['手续费 0.03%']
  }
}
