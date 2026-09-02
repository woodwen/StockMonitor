import type {
  AiAnalysisRequest,
  AiAnalysisResult,
  AiAnalysisCancelResult,
  AiAnalysisStreamCompletedEvent,
  AiAnalysisStreamEvent,
  AiAnalysisStreamFailedEvent,
  AiAnalysisStreamStartRequest,
  AiAnalysisStreamStartResult,
  AiConnectorRunInfo,
  AiConnectorSettings,
  AiConnectorSettingsSnapshot,
  AiConnectorTestResult,
  AiCredentialStatus,
  AiPromptMessage
} from '../renderer/features/stock-workspace/models/ai-models'
import {
  AI_NON_INVESTMENT_NOTICE,
  AI_STREAMING_FALLBACK_NOTICE,
  aiHttpProviderPresets,
  createAiPromptMessages,
  createDefaultAiConnectorSettingsSnapshot,
  getAiHttpProviderPreset,
  hasUnsafeInvestmentLanguage,
  normalizeAiConnectorSettings,
  validateAiAnalysisRequest
} from '../renderer/features/stock-workspace/models/ai-models'
import { clearAiApiKey, getAiApiKey, getAiCredentialStatus, saveAiApiKey } from './ai-credentials'
import {
  getAiHttpProviderHost,
  isAiStreamingUnsupportedError,
  runAiHttpChatCompletion,
  runAiHttpChatCompletionStream
} from './ai-http-provider'
import { logger } from './logger'
import { getSettings, setAiConnectorSettings } from './store'

export type AiAnalysisStreamEventEmitter = (event: AiAnalysisStreamEvent) => void

interface ActiveAiAnalysisStream {
  requestId: string
  useCaseId: AiAnalysisRequest['useCaseId']
  connector: AiConnectorRunInfo
  startedAt: number
  abortController: AbortController
  warnings: string[]
  outputText: string
  chunkCount: number
  outputCharCount: number
  closed: boolean
  cancelled: boolean
  emit: AiAnalysisStreamEventEmitter
}

const activeAiAnalysisStreams = new Map<string, ActiveAiAnalysisStream>()

export async function getAiConnectorSettingsSnapshot(): Promise<AiConnectorSettingsSnapshot> {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  return createSnapshot(settings, await getCredentialStatus(settings))
}

export async function saveAiConnectorSettingsSnapshot(
  settings: AiConnectorSettings
): Promise<AiConnectorSettingsSnapshot> {
  const saved = setAiConnectorSettings(normalizeAiConnectorSettings(settings)).aiConnector
  return createSnapshot(saved, await getCredentialStatus(saved))
}

export async function saveAiConnectorApiKey(
  connectorId: string,
  apiKey: string
): Promise<AiConnectorSettingsSnapshot> {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  if (settings.connectorId !== connectorId) {
    throw new Error('AI connector id 不匹配')
  }
  const saved = setAiConnectorSettings({
    ...settings,
    availability: 'unknown'
  }).aiConnector
  await saveAiApiKey(connectorId, apiKey)
  return createSnapshot(saved, await getCredentialStatus(saved))
}

export async function clearAiConnectorApiKey(
  connectorId: string
): Promise<AiConnectorSettingsSnapshot> {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  let saved = settings
  if (settings.connectorId === connectorId) {
    await clearAiApiKey(connectorId)
    saved = setAiConnectorSettings({
      ...settings,
      availability: 'unknown'
    }).aiConnector
  }
  return createSnapshot(saved, await getCredentialStatus(saved))
}

export async function testAiConnector(): Promise<AiConnectorTestResult> {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  const startedAt = performance.now()
  logger.info('Testing AI connector', createConnectorLogMeta(settings))

  const credentialStatus = await getCredentialStatus(settings)
  if (credentialStatus !== 'saved' && credentialStatus !== 'temporary') {
    setAiConnectorSettings({
      ...settings,
      availability: 'unavailable'
    })
    return {
      status: 'unavailable',
      connectorId: settings.connectorId,
      displayName: settings.displayName,
      kind: settings.kind,
      message: 'HTTP provider 缺少可用 API key',
      elapsedMs: Math.round(performance.now() - startedAt),
      baseUrlHost: getAiHttpProviderHost(settings.httpProvider),
      model: settings.model,
      credentialStatus
    }
  }

  try {
    const apiKey = await getAiApiKey(settings.connectorId)
    await runAiHttpChatCompletion({
      provider: settings.httpProvider,
      model: settings.model,
      apiKey: apiKey ?? '',
      messages: createConnectorTestMessages(),
      temperature: 0,
      timeoutMs: settings.timeoutMs,
      proxy: getSettings().networkProxy
    })
    setAiConnectorSettings({
      ...settings,
      availability: 'available'
    })
    return {
      status: 'available',
      connectorId: settings.connectorId,
      displayName: settings.displayName,
      kind: settings.kind,
      message: 'HTTP provider 可用',
      elapsedMs: Math.round(performance.now() - startedAt),
      baseUrlHost: getAiHttpProviderHost(settings.httpProvider),
      model: settings.model,
      credentialStatus
    }
  } catch (error) {
    setAiConnectorSettings({
      ...settings,
      availability: 'unavailable'
    })
    return {
      status: 'unavailable',
      connectorId: settings.connectorId,
      displayName: settings.displayName,
      kind: settings.kind,
      message: formatErrorMessage(error),
      elapsedMs: Math.round(performance.now() - startedAt),
      baseUrlHost: getAiHttpProviderHost(settings.httpProvider),
      model: settings.model,
      credentialStatus
    }
  }
}

export async function runAiAnalysis(request: AiAnalysisRequest): Promise<AiAnalysisResult> {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  const startedAt = performance.now()
  const connector = createRunInfo(settings)
  const warnings = [AI_NON_INVESTMENT_NOTICE]

  logger.info('Running AI analysis', {
    ...createConnectorLogMeta(settings),
    useCaseId: request.useCaseId
  })

  try {
    if (!settings.enabled) {
      throw new Error('AI connector 未启用，请先在 AI 设置中完成配置并启用')
    }
    const validationErrors = validateAiAnalysisRequest(request)
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('；'))
    }

    const messages = createAiPromptMessages(request)
    const outputText = await runHttpAnalysis(settings, messages)
    if (hasUnsafeInvestmentLanguage(outputText)) {
      warnings.push('模型输出含高风险投资措辞，请按非投资建议边界审查后使用')
    }

    return {
      status: 'success',
      useCaseId: request.useCaseId,
      connector,
      outputText: ensureNotice(outputText),
      warnings,
      elapsedMs: Math.round(performance.now() - startedAt),
      completedAt: new Date().toISOString()
    }
  } catch (error) {
    return {
      status: 'error',
      useCaseId: request.useCaseId,
      connector,
      outputText: '',
      warnings,
      errorMessage: formatErrorMessage(error),
      elapsedMs: Math.round(performance.now() - startedAt),
      completedAt: new Date().toISOString()
    }
  }
}

export function startAiAnalysisStream(
  request: AiAnalysisStreamStartRequest,
  emit: AiAnalysisStreamEventEmitter
): AiAnalysisStreamStartResult {
  const settings = normalizeAiConnectorSettings(getSettings().aiConnector)
  const connector = createRunInfo(settings)
  const requestId = normalizeStreamRequestId(request.requestId)
  if (activeAiAnalysisStreams.has(requestId)) {
    throw new Error('AI 分析 request id 已在运行，请重试')
  }
  const active: ActiveAiAnalysisStream = {
    requestId,
    useCaseId: request.analysisRequest.useCaseId,
    connector,
    startedAt: performance.now(),
    abortController: new AbortController(),
    warnings: [AI_NON_INVESTMENT_NOTICE],
    outputText: '',
    chunkCount: 0,
    outputCharCount: 0,
    closed: false,
    cancelled: false,
    emit
  }
  activeAiAnalysisStreams.set(requestId, active)
  queueMicrotask(() => {
    void runAiAnalysisStream(active, settings, request.analysisRequest)
  })

  return {
    requestId,
    useCaseId: request.analysisRequest.useCaseId,
    connector
  }
}

export function cancelAiAnalysis(requestId: string): AiAnalysisCancelResult {
  const active = activeAiAnalysisStreams.get(requestId)
  if (!active || active.closed) {
    return {
      requestId,
      status: 'not-found'
    }
  }

  active.cancelled = true
  active.abortController.abort()
  finishAiAnalysisStream(active, {
    type: 'cancelled',
    requestId: active.requestId,
    useCaseId: active.useCaseId,
    connector: active.connector,
    outputText: active.outputText,
    warnings: active.warnings,
    elapsedMs: getElapsedMs(active),
    completedAt: new Date().toISOString()
  })
  logger.info('Cancelled AI stream analysis', createStreamLogMeta(active))

  return {
    requestId,
    status: 'cancelled'
  }
}

function createSnapshot(
  settings: AiConnectorSettings,
  credentialStatus: AiCredentialStatus
): AiConnectorSettingsSnapshot {
  return {
    ...createDefaultAiConnectorSettingsSnapshot(),
    settings,
    credentialStatus,
    presets: {
      httpProviders: aiHttpProviderPresets
    }
  }
}

async function runHttpAnalysis(
  settings: AiConnectorSettings,
  messages: AiPromptMessage[],
  signal?: AbortSignal
): Promise<string> {
  const credentialStatus = await getCredentialStatus(settings)
  if (credentialStatus !== 'saved' && credentialStatus !== 'temporary') {
    throw new Error('HTTP provider 缺少可用 API key')
  }
  const result = await runAiHttpChatCompletion({
    provider: settings.httpProvider,
    model: settings.model,
    apiKey: (await getAiApiKey(settings.connectorId)) ?? '',
    messages,
    temperature: settings.temperature,
    timeoutMs: settings.timeoutMs,
    proxy: getSettings().networkProxy,
    signal
  })
  return result.outputText
}

async function runAiAnalysisStream(
  active: ActiveAiAnalysisStream,
  settings: AiConnectorSettings,
  request: AiAnalysisRequest
): Promise<void> {
  logger.info('Running AI stream analysis', {
    ...createConnectorLogMeta(settings),
    requestId: active.requestId,
    useCaseId: request.useCaseId
  })

  try {
    emitAiAnalysisStreamEvent(active, {
      type: 'started',
      requestId: active.requestId,
      useCaseId: request.useCaseId,
      connector: active.connector,
      startedAt: new Date().toISOString()
    })
    if (!settings.enabled) {
      throw new Error('AI connector 未启用，请先在 AI 设置中完成配置并启用')
    }
    const validationErrors = validateAiAnalysisRequest(request)
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('；'))
    }

    const messages = createAiPromptMessages(request)
    const outputText = await runHttpAnalysisStreamWithFallback(active, settings, messages)
    if (active.cancelled) {
      return
    }
    if (hasUnsafeInvestmentLanguage(outputText)) {
      active.warnings.push('模型输出含高风险投资措辞，请按非投资建议边界审查后使用')
    }
    finishAiAnalysisStream(active, createCompletedStreamEvent(active, ensureNotice(outputText)))
    logger.info('Completed AI stream analysis', createStreamLogMeta(active))
  } catch (error) {
    if (active.cancelled) {
      return
    }
    finishAiAnalysisStream(active, createFailedStreamEvent(active, formatErrorMessage(error)))
    logger.info('Failed AI stream analysis', createStreamLogMeta(active))
  }
}

async function runHttpAnalysisStreamWithFallback(
  active: ActiveAiAnalysisStream,
  settings: AiConnectorSettings,
  messages: AiPromptMessage[]
): Promise<string> {
  const credentialStatus = await getCredentialStatus(settings)
  if (credentialStatus !== 'saved' && credentialStatus !== 'temporary') {
    throw new Error('HTTP provider 缺少可用 API key')
  }

  const apiKey = (await getAiApiKey(settings.connectorId)) ?? ''
  try {
    const result = await runAiHttpChatCompletionStream({
      provider: settings.httpProvider,
      model: settings.model,
      apiKey,
      messages,
      temperature: settings.temperature,
      timeoutMs: settings.timeoutMs,
      proxy: getSettings().networkProxy,
      signal: active.abortController.signal,
      onChunk: (chunkText) => emitAiAnalysisStreamChunk(active, chunkText)
    })
    active.connector = {
      ...active.connector,
      model: result.model || active.connector.model
    }
    return result.outputText
  } catch (error) {
    if (!isAiStreamingUnsupportedError(error)) {
      throw error
    }
    active.warnings.push(AI_STREAMING_FALLBACK_NOTICE)
    const outputText = await runHttpAnalysis(settings, messages, active.abortController.signal)
    return outputText
  }
}

async function getCredentialStatus(settings: AiConnectorSettings): Promise<AiCredentialStatus> {
  return getAiCredentialStatus(settings.connectorId, true)
}

function createConnectorTestMessages(): AiPromptMessage[] {
  return [
    {
      role: 'system',
      content: '你是 Stock Monitor 的连接测试助手，只用于确认 provider 可用。'
    },
    {
      role: 'user',
      content: '请只返回 OK。'
    }
  ]
}

function createRunInfo(settings: AiConnectorSettings): AiConnectorRunInfo {
  return {
    connectorId: settings.connectorId,
    displayName: settings.displayName,
    kind: settings.kind,
    model: settings.model || getAiHttpProviderPreset(settings.httpProvider.presetId).model,
    profile: settings.profile
  }
}

function normalizeStreamRequestId(requestId: string): string {
  const trimmed = requestId.trim()
  if (/^[A-Za-z0-9:_-]{1,120}$/.test(trimmed)) {
    return trimmed
  }
  return `ai-stream-${Date.now()}`
}

function emitAiAnalysisStreamChunk(
  active: ActiveAiAnalysisStream,
  chunkText: string
): void {
  if (!chunkText || active.closed || active.cancelled) {
    return
  }
  active.outputText += chunkText
  active.chunkCount += 1
  active.outputCharCount += chunkText.length
  emitAiAnalysisStreamEvent(active, {
    type: 'chunk',
    requestId: active.requestId,
    useCaseId: active.useCaseId,
    connector: active.connector,
    chunkText,
    elapsedMs: getElapsedMs(active)
  })
}

function emitAiAnalysisStreamEvent(
  active: ActiveAiAnalysisStream,
  event: AiAnalysisStreamEvent
): void {
  if (active.closed) {
    return
  }
  active.emit(event)
}

function finishAiAnalysisStream(
  active: ActiveAiAnalysisStream,
  event: AiAnalysisStreamCompletedEvent | AiAnalysisStreamFailedEvent | AiAnalysisStreamEvent
): void {
  if (active.closed) {
    return
  }
  active.closed = true
  activeAiAnalysisStreams.delete(active.requestId)
  active.emit(event)
}

function createCompletedStreamEvent(
  active: ActiveAiAnalysisStream,
  outputText: string
): AiAnalysisStreamCompletedEvent {
  const streamingFallback = active.warnings.includes(AI_STREAMING_FALLBACK_NOTICE)
  return {
    type: 'completed',
    requestId: active.requestId,
    useCaseId: active.useCaseId,
    connector: active.connector,
    outputText,
    warnings: uniqueStrings(active.warnings),
    streamingFallback: streamingFallback || undefined,
    elapsedMs: getElapsedMs(active),
    completedAt: new Date().toISOString()
  }
}

function createFailedStreamEvent(
  active: ActiveAiAnalysisStream,
  errorMessage: string
): AiAnalysisStreamFailedEvent {
  return {
    type: 'failed',
    requestId: active.requestId,
    useCaseId: active.useCaseId,
    connector: active.connector,
    outputText: active.outputText,
    warnings: uniqueStrings(active.warnings),
    errorMessage,
    elapsedMs: getElapsedMs(active),
    completedAt: new Date().toISOString()
  }
}

function getElapsedMs(active: ActiveAiAnalysisStream): number {
  return Math.round(performance.now() - active.startedAt)
}

function createStreamLogMeta(active: ActiveAiAnalysisStream): Record<string, string | number | boolean> {
  return {
    requestId: active.requestId,
    connectorId: active.connector.connectorId,
    kind: active.connector.kind,
    model: active.connector.model,
    profile: active.connector.profile,
    useCaseId: active.useCaseId,
    chunkCount: active.chunkCount,
    outputCharCount: active.outputCharCount,
    elapsedMs: getElapsedMs(active),
    cancelled: active.cancelled
  }
}

function createConnectorLogMeta(settings: AiConnectorSettings): Record<string, string> {
  return {
    connectorId: settings.connectorId,
    kind: settings.kind,
    preset: settings.httpProvider.presetId,
    model: settings.model,
    baseUrlHost: getAiHttpProviderHost(settings.httpProvider)
  }
}

function ensureNotice(outputText: string): string {
  return outputText.includes(AI_NON_INVESTMENT_NOTICE)
    ? outputText
    : `${outputText.trim()}\n\n${AI_NON_INVESTMENT_NOTICE}`
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}
