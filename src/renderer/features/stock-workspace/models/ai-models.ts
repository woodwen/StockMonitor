import type {
  StockAdjust,
  StockPeriod,
  WorkspaceViewMode
} from './stock-types'

export type AiConnectorKind = 'http-provider'

export type AiHttpProviderPresetId =
  | 'openai-compatible'
  | 'deepseek'
  | 'minimax'
  | 'zhipu-glm'
  | 'dashscope'
  | 'kimi'
  | 'siliconflow'
  | 'baichuan'
  | 'volcengine-ark'
  | 'custom'

export type AiCredentialStatus = 'not-required' | 'missing' | 'saved' | 'temporary' | 'unsupported'

export type AiConnectorAvailability = 'unknown' | 'available' | 'unavailable'

export type AiAnalysisStatus = 'success' | 'error'

export type AiAnalysisStreamStatus =
  | 'idle'
  | 'running'
  | 'cancelling'
  | 'cancelled'
  | 'success'
  | 'error'

export type AiAnalysisStreamEventType =
  | 'started'
  | 'chunk'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type AiUseCaseId =
  | 'natural-language-strategy'
  | 'backtest-report'
  | 'strategy-diagnosis'
  | 'parameter-optimization'
  | 'natural-language-stock-screening'
  | 'strategy-comparison'
  | 'market-regime'
  | 'daily-review'
  | 'news-kline-analysis'
  | 'price-move-prediction'
  | 'general-question'

export interface AiHttpProviderPreset {
  id: AiHttpProviderPresetId
  displayName: string
  baseUrl: string
  model: string
  models: string[]
}

export interface AiHttpProviderSettings {
  presetId: AiHttpProviderPresetId
  baseUrl: string
  customHeaders: Array<{ name: string; value: string }>
}

export interface AiConnectorSettings {
  connectorId: string
  displayName: string
  enabled: boolean
  kind: AiConnectorKind
  model: string
  profile: string
  temperature: number
  timeoutMs: number
  contextLimit: number
  availability: AiConnectorAvailability
  httpProvider: AiHttpProviderSettings
}

export interface AiConnectorSettingsSnapshot {
  settings: AiConnectorSettings
  credentialStatus: AiCredentialStatus
  presets: {
    httpProviders: AiHttpProviderPreset[]
  }
}

export interface AiConnectorTestResult {
  status: AiConnectorAvailability
  connectorId: string
  displayName: string
  kind: AiConnectorKind
  message: string
  elapsedMs?: number
  baseUrlHost?: string
  model?: string
  credentialStatus: AiCredentialStatus
}

export interface AiStrategyBacktestSummary {
  templateName: string
  period: StockPeriod
  adjust: StockAdjust
  startDate: string
  endDate: string
  sampleSize: number
  totalReturnPercent: number
  maxDrawdownPercent: number
  winRatePercent: number
  profitFactor: number
  tradeCount: number
  assumptions: string[]
}

export interface AiWorkspaceContext {
  generatedAt: string
  viewMode: WorkspaceViewMode
  symbol: string
  stockName: string
  dataSourceName: string
  dataDateRange: {
    startDate?: string
    endDate?: string
    tradeDate?: string
  }
  recordCount: number
  latestSummary: string
  enabledIndicators: string[]
  strategyBacktest?: AiStrategyBacktestSummary
  missingData: string[]
}

export interface AiNewsItemInput {
  title: string
  date: string
  source: string
  summary: string
}

export interface AiAnalysisRequest {
  useCaseId: AiUseCaseId
  question: string
  context: AiWorkspaceContext
  newsItems?: AiNewsItemInput[]
  workflow?: AiUseCaseWorkflow
}

export interface AiAnalysisStreamStartRequest {
  requestId: string
  analysisRequest: AiAnalysisRequest
}

export interface AiConnectorRunInfo {
  connectorId: string
  displayName: string
  kind: AiConnectorKind
  model: string
  profile: string
}

export interface AiAnalysisResult {
  status: AiAnalysisStatus
  useCaseId: AiUseCaseId
  connector: AiConnectorRunInfo
  outputText: string
  warnings: string[]
  errorMessage?: string
  streamingFallback?: boolean
  elapsedMs: number
  completedAt: string
}

interface AiAnalysisStreamEventBase {
  type: AiAnalysisStreamEventType
  requestId: string
  useCaseId: AiUseCaseId
  connector: AiConnectorRunInfo
}

export interface AiAnalysisStreamStartedEvent extends AiAnalysisStreamEventBase {
  type: 'started'
  startedAt: string
}

export interface AiAnalysisStreamChunkEvent extends AiAnalysisStreamEventBase {
  type: 'chunk'
  chunkText: string
  elapsedMs: number
}

export interface AiAnalysisStreamCompletedEvent extends AiAnalysisStreamEventBase {
  type: 'completed'
  outputText: string
  warnings: string[]
  streamingFallback?: boolean
  elapsedMs: number
  completedAt: string
}

export interface AiAnalysisStreamFailedEvent extends AiAnalysisStreamEventBase {
  type: 'failed'
  outputText: string
  warnings: string[]
  errorMessage: string
  elapsedMs: number
  completedAt: string
}

export interface AiAnalysisStreamCancelledEvent extends AiAnalysisStreamEventBase {
  type: 'cancelled'
  outputText: string
  warnings: string[]
  elapsedMs: number
  completedAt: string
}

export type AiAnalysisStreamEvent =
  | AiAnalysisStreamStartedEvent
  | AiAnalysisStreamChunkEvent
  | AiAnalysisStreamCompletedEvent
  | AiAnalysisStreamFailedEvent
  | AiAnalysisStreamCancelledEvent

export interface AiAnalysisStreamStartResult {
  requestId: string
  useCaseId: AiUseCaseId
  connector: AiConnectorRunInfo
}

export interface AiAnalysisCancelResult {
  requestId: string
  status: 'cancelled' | 'not-found'
}

export interface AiUseCaseDefinition {
  id: AiUseCaseId
  title: string
  shortTitle: string
  description: string
  requiresMarketData: boolean
  requiresBacktest: boolean
  requiresNews: boolean
  minPredictionSamples?: number
  confirmationLabel?: string
  confirmationRequiredBeforeRequest?: boolean
  outputSchema: string[]
  promptGuidance: string[]
}

export interface AiPromptMessage {
  role: 'system' | 'user'
  content: string
}

export interface AiUseCaseWorkflow {
  targetScope: string
  confirmationRequired: boolean
  confirmationLabel: string
  confirmedByUser: boolean
  localValidationNotes: string[]
  localBacktestValidationNotes: string[]
  outputHandlingNotes: string[]
}

export const AI_NON_INVESTMENT_NOTICE = '仅供信息整理和历史数据解释，不构成投资建议'
export const AI_STREAMING_FALLBACK_NOTICE = '当前 connector 不支持流式内容，已转为非流式结果'
export const DEFAULT_AI_CONNECTOR_ID = 'default-ai-connector'
export const DEFAULT_AI_TIMEOUT_MS = 60_000
export const DEFAULT_AI_CONTEXT_LIMIT = 12_000
export const DEFAULT_AI_TEMPERATURE = 0.2
const DEFAULT_NATURAL_LANGUAGE_STRATEGY_QUESTION = '请把我的自然语言策略想法整理成可审查的策略草稿。'

export function createAiConnectorIdForProvider(presetId: AiHttpProviderPresetId): string {
  return `${DEFAULT_AI_CONNECTOR_ID}:${presetId}`
}

export const aiHttpProviderPresets: AiHttpProviderPreset[] = [
  {
    id: 'openai-compatible',
    displayName: 'OpenAI-compatible',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    models: []
  },
  {
    id: 'deepseek',
    displayName: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-v4-pro',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']
  },
  {
    id: 'minimax',
    displayName: 'MiniMax',
    baseUrl: 'https://api.minimaxi.com/v1',
    model: 'MiniMax-M2.7',
    models: [
      'MiniMax-M2.7',
      'MiniMax-M2.7-highspeed',
      'MiniMax-M2.5',
      'MiniMax-M2.5-highspeed',
      'MiniMax-M2.1',
      'MiniMax-M2.1-highspeed',
      'MiniMax-M2'
    ]
  },
  {
    id: 'zhipu-glm',
    displayName: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-5.2',
    models: ['glm-5.2', 'glm-5.1', 'glm-5-turbo', 'glm-5', 'glm-4.7', 'glm-4.6', 'glm-4.5']
  },
  {
    id: 'dashscope',
    displayName: '通义千问/DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    models: ['qwen-plus', 'qwen-turbo', 'qwen-max', 'qwen-long']
  },
  {
    id: 'kimi',
    displayName: 'Kimi/Moonshot',
    baseUrl: 'https://api.moonshot.ai/v1',
    model: 'kimi-k2.6',
    models: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2-thinking', 'kimi-k2-thinking-turbo']
  },
  {
    id: 'siliconflow',
    displayName: '硅基流动/SiliconFlow',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    models: [
      'Qwen/Qwen2.5-72B-Instruct',
      'Pro/deepseek-ai/DeepSeek-R1',
      'deepseek-ai/DeepSeek-V3'
    ]
  },
  {
    id: 'baichuan',
    displayName: '百川智能/Baichuan',
    baseUrl: 'https://api.baichuan-ai.com/v1',
    model: 'Baichuan2-Turbo',
    models: ['Baichuan2-Turbo', 'Baichuan2-Turbo-192k']
  },
  {
    id: 'volcengine-ark',
    displayName: '火山方舟/Ark',
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    model: '',
    models: []
  },
  {
    id: 'custom',
    displayName: '自定义 provider',
    baseUrl: '',
    model: '',
    models: []
  }
]

export const aiUseCaseDefinitions: AiUseCaseDefinition[] = [
  {
    id: 'natural-language-strategy',
    title: '自然语言生成策略',
    shortTitle: '策略生成',
    description: '把自然语言策略想法整理成可审查草稿。',
    requiresMarketData: false,
    requiresBacktest: false,
    requiresNews: false,
    confirmationLabel: '我确认 AI 只生成策略草稿，后续回测或保存前仍需本地校验与人工确认',
    promptGuidance: [
      '输出策略名称、适用市场/周期、入场条件、出场条件、风控条件、参数草稿、不支持项和本地校验结果。',
      '只能生成可审查草稿；通过本地校验并经用户确认后，才可进入回测或保存流程。'
    ],
    outputSchema: [
      'strategyName',
      'marketScope',
      'period',
      'entryRules',
      'exitRules',
      'riskRules',
      'parameterDrafts',
      'unsupportedItems',
      'localValidationNotes'
    ]
  },
  {
    id: 'backtest-report',
    title: 'AI 解读回测报告',
    shortTitle: '回测解读',
    description: '基于本地回测事实解释收益、回撤和交易统计。',
    requiresMarketData: true,
    requiresBacktest: true,
    requiresNews: false,
    promptGuidance: [
      '只引用本地回测摘要、交易统计、收益、回撤、胜率、盈亏比、数据区间和策略参数。',
      '必须区分本地事实、模型推断、风险点和待核实问题。'
    ],
    outputSchema: ['facts', 'inferences', 'risks', 'dataLimits', 'questionsToVerify']
  },
  {
    id: 'strategy-diagnosis',
    title: 'AI 策略诊断',
    shortTitle: '策略诊断',
    description: '分析策略失效原因、过拟合风险和待验证问题。',
    requiresMarketData: true,
    requiresBacktest: true,
    requiresNews: false,
    promptGuidance: [
      '只基于已运行策略回测事实诊断，不得编造未运行回测。',
      '输出可能失效原因、过拟合风险、数据不足点和后续验证建议。'
    ],
    outputSchema: ['failureReasons', 'overfittingRisks', 'dataGaps', 'nextValidationSteps']
  },
  {
    id: 'parameter-optimization',
    title: 'AI 参数优化助手',
    shortTitle: '参数优化',
    description: '生成参数候选和风险说明，排序依据必须来自本地回测。',
    requiresMarketData: true,
    requiresBacktest: true,
    requiresNews: false,
    confirmationLabel: '我确认候选参数返回后必须先经本地批量回测验证，排序不采用 AI 自称结论',
    confirmationRequiredBeforeRequest: true,
    promptGuidance: [
      '输出候选参数集合、优化目标、调整理由、风险说明和本地回测验证要求。',
      '候选参数排序、采纳和展示依据必须来自本地批量回测，不得声明 AI 自称最佳参数。'
    ],
    outputSchema: ['candidateParameters', 'optimizationGoal', 'riskNotes', 'localBacktestRequired']
  },
  {
    id: 'natural-language-stock-screening',
    title: '自然语言智能选股',
    shortTitle: '智能选股',
    description: '把自然语言条件转成可审查筛选草稿和数据需求。',
    requiresMarketData: false,
    requiresBacktest: false,
    requiresNews: false,
    confirmationLabel: '我确认该场景会按我选择的标的范围生成筛选草稿，不使用默认单证券上下文扩展范围',
    confirmationRequiredBeforeRequest: true,
    promptGuidance: [
      '将自然语言条件转换为筛选草稿，包括标的范围、周期、指标条件、回测条件、排序字段和数据需求。',
      '只有用户明确选择该场景并确认标的范围后，才可扩展到多标的数据；结果需要展示匹配原因、排序依据、数据新鲜度和缺失项。'
    ],
    outputSchema: ['scope', 'period', 'indicatorConditions', 'backtestConditions', 'sortFields', 'dataNeeds']
  },
  {
    id: 'strategy-comparison',
    title: '策略多周期/多股票对比',
    shortTitle: '策略对比',
    description: '基于统一指标集合解释多周期或多股票差异。',
    requiresMarketData: true,
    requiresBacktest: true,
    requiresNews: false,
    confirmationLabel: '我确认已选择需要对比的周期或股票范围，并按统一指标集合解释差异',
    confirmationRequiredBeforeRequest: true,
    promptGuidance: [
      '只有用户明确选择该场景并确认对比范围后，才处理多周期或多股票数据。',
      '使用统一指标集合和可比日期范围输出事实差异、适用条件和风险点，不得给出买卖结论。'
    ],
    outputSchema: ['comparisonFacts', 'differences', 'applicableConditions', 'risks', 'missingData']
  },
  {
    id: 'market-regime',
    title: '市场环境识别',
    shortTitle: '市场环境',
    description: '基于行情、成交量、波动和趋势摘要识别市场环境。',
    requiresMarketData: true,
    requiresBacktest: false,
    requiresNews: false,
    promptGuidance: [
      '只基于当前证券的价格、成交量、波动和趋势摘要识别环境。',
      '输出环境标签、依据、置信度、适用前提和待观察指标。'
    ],
    outputSchema: ['regimeLabel', 'evidence', 'confidence', 'assumptions', 'watchItems']
  },
  {
    id: 'daily-review',
    title: 'AI 每日复盘',
    shortTitle: '每日复盘',
    description: '手动汇总当前证券行情、策略和异常波动。',
    requiresMarketData: true,
    requiresBacktest: false,
    requiresNews: false,
    promptGuidance: [
      '只汇总当前证券当日行情、策略信号摘要、异常波动、缓存/数据缺失和待关注事项。',
      '标注生成时间、数据日期和数据来源，不要扩展到自选股列表或其它证券。'
    ],
    outputSchema: ['generatedAt', 'dataDate', 'marketSummary', 'currentStockSummary', 'strategySummary', 'missingData']
  },
  {
    id: 'news-kline-analysis',
    title: '新闻/公告 + K 线联合分析',
    shortTitle: '新闻K线',
    description: '把用户提供或已接入新闻公告摘要与 K 线事实关联分析。',
    requiresMarketData: true,
    requiresBacktest: false,
    requiresNews: true,
    promptGuidance: [
      '只使用用户提供或系统已有的新闻公告摘要，不自动抓取或补写新闻公告。',
      '区分新闻/公告事实、K 线事实和二者之间的关联推断；缺失来源必须标记未验证。'
    ],
    outputSchema: ['newsFacts', 'klineFacts', 'relationshipInferences', 'sourceNotes', 'unverifiedItems']
  },
  {
    id: 'price-move-prediction',
    title: 'AI/ML 预测涨跌',
    shortTitle: '涨跌预测',
    description: '实验性概率/风险分析，不进入交易信号或选股推荐。',
    requiresMarketData: true,
    requiresBacktest: false,
    requiresNews: false,
    minPredictionSamples: 60,
    promptGuidance: [
      '输出预测周期、样本窗口、特征摘要、概率/方向假设、置信度和验证指标。',
      '结果必须保持实验性说明，不得进入交易建议、策略信号、智能选股推荐或收益承诺。'
    ],
    outputSchema: [
      'horizon',
      'sampleWindow',
      'features',
      'probabilityHypothesis',
      'directionHypothesis',
      'confidence',
      'validationMetrics',
      'experimentalNotice'
    ]
  },
  {
    id: 'general-question',
    title: '通用自由问答',
    shortTitle: '自由问答',
    description: '补充说明入口，高风险场景仍使用对应结构化入口。',
    requiresMarketData: false,
    requiresBacktest: false,
    requiresNews: false,
    promptGuidance: [
      '只作为补充解释入口；高风险能力应引导用户选择对应结构化场景。',
      '即使没有行情数据，也必须明确标注缺失数据，不得补造事实。'
    ],
    outputSchema: ['facts', 'inferences', 'risks', 'questionsToVerify']
  }
]

export function createDefaultAiConnectorSettings(): AiConnectorSettings {
  const defaultProvider = getAiHttpProviderPreset('deepseek')
  return {
    connectorId: createAiConnectorIdForProvider(defaultProvider.id),
    displayName: defaultProvider.displayName,
    enabled: false,
    kind: 'http-provider',
    model: defaultProvider.model,
    profile: '',
    temperature: DEFAULT_AI_TEMPERATURE,
    timeoutMs: DEFAULT_AI_TIMEOUT_MS,
    contextLimit: DEFAULT_AI_CONTEXT_LIMIT,
    availability: 'unknown',
    httpProvider: {
      presetId: defaultProvider.id,
      baseUrl: defaultProvider.baseUrl,
      customHeaders: []
    }
  }
}

export function createDefaultAiConnectorSettingsSnapshot(): AiConnectorSettingsSnapshot {
  return {
    settings: createDefaultAiConnectorSettings(),
    credentialStatus: 'missing',
    presets: {
      httpProviders: aiHttpProviderPresets
    }
  }
}

export function cloneAiConnectorSettings(settings: AiConnectorSettings): AiConnectorSettings {
  return {
    ...settings,
    httpProvider: {
      ...settings.httpProvider,
      customHeaders: settings.httpProvider.customHeaders.map((header) => ({ ...header }))
    }
  }
}

export function normalizeAiConnectorSettings(
  settings: Partial<AiConnectorSettings> | undefined
): AiConnectorSettings {
  const defaults = createDefaultAiConnectorSettings()
  const sourceKind = readConnectorKind(settings)
  const migratedFromLocalRuntime = sourceKind === 'local-runtime'
  const httpProviderPreset = migratedFromLocalRuntime
    ? defaults.httpProvider.presetId
    : normalizeHttpProviderPresetId(settings?.httpProvider?.presetId)
  const httpProviderDefault = getAiHttpProviderPreset(httpProviderPreset)
  const displayName = migratedFromLocalRuntime
    ? httpProviderDefault.displayName
    : normalizeText(settings?.displayName, httpProviderDefault.displayName, 80)
  const model = migratedFromLocalRuntime
    ? httpProviderDefault.model
    : normalizeText(settings?.model, httpProviderDefault.model, 120)
  const profile = normalizeText(settings?.profile, defaults.profile, 120)

  return {
    connectorId: migratedFromLocalRuntime
      ? createAiConnectorIdForProvider(httpProviderPreset)
      : normalizeConnectorId(settings?.connectorId, httpProviderPreset),
    displayName,
    enabled: migratedFromLocalRuntime ? false : Boolean(settings?.enabled),
    kind: 'http-provider',
    model,
    profile,
    temperature: normalizeNumber(settings?.temperature, defaults.temperature, 0, 2),
    timeoutMs: normalizeNumber(settings?.timeoutMs, defaults.timeoutMs, 5_000, 300_000),
    contextLimit: normalizeNumber(settings?.contextLimit, defaults.contextLimit, 1_000, 60_000),
    availability: normalizeAvailability(settings?.availability),
    httpProvider: {
      presetId: httpProviderPreset,
      baseUrl: normalizeText(settings?.httpProvider?.baseUrl, httpProviderDefault.baseUrl, 500),
      customHeaders: normalizeCustomHeaders(settings?.httpProvider?.customHeaders)
    }
  }
}

export function normalizeAiConnectorSettingsForExport(
  settings: Partial<AiConnectorSettings> | undefined
): AiConnectorSettings {
  const normalized = normalizeAiConnectorSettings(settings)
  return {
    ...normalized,
    availability: 'unknown'
  }
}

export function isSafeAiCustomHeaderName(name: string): boolean {
  const normalizedName = name.trim().toLowerCase()
  return !/(^|[-_])(authorization|cookie|key|secret|token)([-_]|$)/.test(normalizedName)
}

export function getAiUseCaseDefinition(useCaseId: AiUseCaseId): AiUseCaseDefinition {
  return aiUseCaseDefinitions.find((useCase) => useCase.id === useCaseId) ?? aiUseCaseDefinitions[0]
}

export function getAiHttpProviderPreset(presetId: AiHttpProviderPresetId): AiHttpProviderPreset {
  return aiHttpProviderPresets.find((preset) => preset.id === presetId) ?? aiHttpProviderPresets[0]
}

export function createAiUseCaseWorkflow(
  request: AiAnalysisRequest,
  confirmedByUser = false
): AiUseCaseWorkflow {
  const useCase = getAiUseCaseDefinition(request.useCaseId)
  const notes: string[] = []
  const backtestNotes: string[] = []
  const outputHandlingNotes: string[] = [AI_NON_INVESTMENT_NOTICE]

  if (request.context.recordCount <= 0) {
    notes.push('当前没有已加载行情数据；需要行情的场景只能展示缺失数据，不能补造事实')
  }
  if (request.context.missingData.length > 0) {
    notes.push(`缺失数据：${request.context.missingData.join('；')}`)
  }

  switch (useCase.id) {
    case 'natural-language-strategy':
      notes.push('本地校验会检查策略名称、周期、入场/出场/风控条件、参数草稿和不支持项是否完整')
      notes.push('草稿无法映射到现有 K 线策略模板时，只能作为说明草稿展示')
      outputHandlingNotes.push('用户确认前不得保存为可运行策略，也不得启动回测')
      break
    case 'parameter-optimization':
      notes.push('AI 只能生成候选参数、优化目标和风险说明')
      backtestNotes.push('候选参数返回后必须交给本地批量回测验证，并按本地回测指标排序')
      if (request.context.strategyBacktest) {
        backtestNotes.push(
          `当前基准回测：${request.context.strategyBacktest.templateName}，样本 ${request.context.strategyBacktest.sampleSize}，交易 ${request.context.strategyBacktest.tradeCount}`
        )
      }
      outputHandlingNotes.push('不得把 AI 自称最优参数作为排序或采纳依据')
      break
    case 'natural-language-stock-screening':
      notes.push('第一步只生成可审查筛选草稿，包括标的范围、周期、指标条件、回测条件、排序字段和数据需求')
      notes.push('执行筛选时只能使用已加载、可刷新或已缓存的数据，并展示数据新鲜度和缺失项')
      outputHandlingNotes.push('含买入、卖出或收益保证倾向的自然语言条件只能被当作筛选条件处理')
      break
    case 'strategy-comparison':
      notes.push('对比范围必须由用户明确选择，不能从默认单证券上下文隐式扩展')
      backtestNotes.push('对比应使用统一指标集合、可比日期范围、样本数量和缺失项')
      outputHandlingNotes.push('输出只解释差异、适用条件和风险点，不得给出买卖结论')
      break
    case 'news-kline-analysis':
      if ((request.newsItems ?? []).some((item) => !item.date || !item.source)) {
        notes.push('存在缺少日期或来源的新闻公告材料，必须标记为未验证')
      }
      break
    case 'price-move-prediction':
      outputHandlingNotes.push('实验性预测不得写入策略信号、回测收益、智能选股推荐或自动交易动作')
      break
    default:
      break
  }

  return {
    targetScope: getAiUseCaseTargetScope(useCase.id, request.context),
    confirmationRequired: Boolean(useCase.confirmationRequiredBeforeRequest),
    confirmationLabel: useCase.confirmationLabel ?? '',
    confirmedByUser,
    localValidationNotes: uniqueStrings(notes),
    localBacktestValidationNotes: uniqueStrings(backtestNotes),
    outputHandlingNotes: uniqueStrings(outputHandlingNotes)
  }
}

export function createAiPromptMessages(request: AiAnalysisRequest): AiPromptMessage[] {
  const useCase = getAiUseCaseDefinition(request.useCaseId)
  const workflow = request.workflow ?? createAiUseCaseWorkflow(request)
  const system = [
    '你是 Stock Monitor 的 AI 分析助手。',
    `定位：${AI_NON_INVESTMENT_NOTICE}。`,
    '只基于用户提供的结构化上下文、新闻公告摘要和问题进行整理。',
    '必须区分本地事实、模型推断、缺失数据和待核实问题。',
    '不得输出买卖建议、荐股服务、保证收益、未来表现保证或自动交易动作。',
    '不得伪造新闻、公告、实时行情、未运行的回测或不存在的数据源。'
  ].join('\n')
  const userPayload = {
    useCase: {
      id: useCase.id,
      title: useCase.title,
      outputSchema: useCase.outputSchema,
      promptGuidance: useCase.promptGuidance
    },
    question: request.question.trim(),
    context: request.context,
    newsItems: request.newsItems ?? [],
    workflow
  }
  const user = [
    '请用简体中文可读小节组织结果，不要输出 JSON、JSON 代码块或原始对象。',
    '每个字段用独立小节展示；字段名可以翻译成自然中文标题，内容用短段落或要点。',
    '默认只分析 context.symbol/context.stockName 对应的当前证券；不要分析自选股列表或其它证券。',
    `场景约束：${useCase.promptGuidance.join('；')}`,
    `输出字段：${useCase.outputSchema.join(', ')}`,
    '每个结果末尾都要保留非投资建议边界。',
    JSON.stringify(userPayload, null, 2)
  ].join('\n\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]
}

export function validateAiAnalysisRequest(request: AiAnalysisRequest): string[] {
  const useCase = getAiUseCaseDefinition(request.useCaseId)
  const errors: string[] = []
  const question = request.question.trim()
  const workflow = request.workflow ?? createAiUseCaseWorkflow(request)

  if (!question) {
    errors.push('请输入要分析的问题或目标')
  }
  if (useCase.id === 'natural-language-strategy' && isGenericStrategyDraftQuestion(question)) {
    errors.push('请输入具体自然语言策略描述，不能只使用默认策略草稿说明')
  }
  if (useCase.requiresMarketData && request.context.recordCount <= 0) {
    errors.push('当前没有可用行情数据，请先刷新行情')
  }
  if (useCase.requiresBacktest && !request.context.strategyBacktest) {
    errors.push('当前没有可用策略回测结果，请先运行回测')
  }
  if (
    useCase.id === 'parameter-optimization' &&
    request.context.strategyBacktest &&
    request.context.strategyBacktest.tradeCount <= 0
  ) {
    errors.push('当前回测没有已平仓交易，候选参数无法形成本地排序基准')
  }
  if (useCase.requiresNews && (request.newsItems ?? []).length === 0) {
    errors.push('请先提供新闻或公告摘要')
  }
  if (useCase.confirmationRequiredBeforeRequest && !workflow.confirmedByUser) {
    errors.push(`请先确认：${useCase.confirmationLabel}`)
  }
  if (
    useCase.minPredictionSamples &&
    request.context.recordCount < useCase.minPredictionSamples
  ) {
    errors.push(`样本数量不足，实验性预测至少需要 ${useCase.minPredictionSamples} 条记录`)
  }

  return errors
}

export function validateAiStructuredOutput(
  useCaseId: AiUseCaseId,
  output: unknown
): string[] {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return []
  }
  const values = output as Record<string, unknown>
  const notes: string[] = []

  if (useCaseId === 'natural-language-strategy') {
    const missingFields = [
      'strategyName',
      'marketScope',
      'period',
      'entryRules',
      'exitRules',
      'riskRules',
      'parameterDrafts',
      'unsupportedItems'
    ].filter((field) => isEmptyAiOutputValue(values[field]))
    if (missingFields.length > 0) {
      notes.push(`策略草稿字段不完整：${missingFields.join(', ')}`)
    } else {
      notes.push('策略草稿字段完整性检查通过')
    }
    notes.push('尚未映射为可执行策略；保存或回测前仍需用户确认和本地参数校验')
  }

  if (useCaseId === 'parameter-optimization') {
    if (isEmptyAiOutputValue(values.candidateParameters)) {
      notes.push('未返回候选参数，无法进入本地批量回测验证')
    } else {
      notes.push('候选参数必须先经过本地批量回测，排序依据不得来自 AI 自称最优判断')
    }
  }

  if (useCaseId === 'natural-language-stock-screening') {
    const missingFields = ['scope', 'period', 'indicatorConditions', 'sortFields', 'dataNeeds'].filter(
      (field) => isEmptyAiOutputValue(values[field])
    )
    if (missingFields.length > 0) {
      notes.push(`筛选草稿字段不完整：${missingFields.join(', ')}`)
    }
    notes.push('执行筛选前仍需确认标的范围，并检查数据新鲜度和缺失项')
  }

  if (useCaseId === 'strategy-comparison') {
    const missingFields = ['comparisonFacts', 'differences', 'risks'].filter((field) =>
      isEmptyAiOutputValue(values[field])
    )
    if (missingFields.length > 0) {
      notes.push(`对比结果字段不完整：${missingFields.join(', ')}`)
    }
    notes.push('对比结果只能解释差异和风险，不得转成买卖结论')
  }

  if (useCaseId === 'price-move-prediction') {
    notes.push('预测结果保持实验性，不得写入策略信号、回测收益或智能选股推荐')
  }

  return uniqueStrings(notes)
}

export function limitAiText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text
  }
  return `${text.slice(0, Math.max(0, limit - 42))}\n...[已按上下文长度限制截断]`
}

export function parseAiNewsItems(text: string): AiNewsItemInput[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((line) => {
      const parts = line.split('|').map((part) => part.trim())
      if (parts.length >= 4) {
        return {
          title: parts[0],
          date: parts[1],
          source: parts[2],
          summary: parts.slice(3).join(' | ')
        }
      }
      return {
        title: parts[0] || '未命名材料',
        date: '',
        source: '',
        summary: parts.slice(1).join(' | ') || parts[0] || ''
      }
    })
}

export function hasUnsafeInvestmentLanguage(text: string): boolean {
  return /必涨|必跌|稳赚|保证收益|建议买入|建议卖出|推荐买入|推荐卖出/.test(text)
}

function getAiUseCaseTargetScope(
  useCaseId: AiUseCaseId,
  context: AiWorkspaceContext
): string {
  if (useCaseId === 'natural-language-stock-screening') {
    return '用户确认后的标的范围；默认请求不隐式发送自选股列表或其它股票样本'
  }
  if (useCaseId === 'strategy-comparison') {
    return '用户确认后的多周期或多股票对比范围；使用统一指标集合和可比日期范围'
  }
  return `当前证券 ${context.stockName}(${context.symbol})`
}

function isGenericStrategyDraftQuestion(question: string): boolean {
  const normalized = question.replace(/\s+/g, '')
  return (
    !normalized ||
    normalized === DEFAULT_NATURAL_LANGUAGE_STRATEGY_QUESTION.replace(/\s+/g, '') ||
    normalized === '请分析' ||
    normalized === '生成策略' ||
    normalized === '帮我生成策略'
  )
}

function isEmptyAiOutputValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeAvailability(value: unknown): AiConnectorAvailability {
  return value === 'available' || value === 'unavailable' ? value : 'unknown'
}

function readConnectorKind(settings: Partial<AiConnectorSettings> | undefined): unknown {
  return settings && typeof settings === 'object' && 'kind' in settings ? settings.kind : undefined
}

function normalizeHttpProviderPresetId(value: unknown): AiHttpProviderPresetId {
  return aiHttpProviderPresets.some((preset) => preset.id === value)
    ? (value as AiHttpProviderPresetId)
    : 'deepseek'
}

function normalizeConnectorId(value: unknown, presetId: AiHttpProviderPresetId): string {
  const fallback = createAiConnectorIdForProvider(presetId)
  const normalized = normalizeText(value, fallback, 80)
  return normalized === DEFAULT_AI_CONNECTOR_ID ? fallback : normalized
}

function normalizeText(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) {
    return fallback
  }
  return Math.min(max, Math.max(min, numberValue))
}

function normalizeCustomHeaders(value: unknown): Array<{ name: string; value: string }> {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(isHeaderLike)
    .map((header) => ({
      name: header.name.trim().slice(0, 80),
      value: header.value.trim().slice(0, 500)
    }))
    .filter((header) => header.name && header.value && isSafeAiCustomHeaderName(header.name))
    .slice(0, 20)
}

function isHeaderLike(value: unknown): value is { name: string; value: string } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'name' in value &&
      typeof value.name === 'string' &&
      'value' in value &&
      typeof value.value === 'string'
  )
}
