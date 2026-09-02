import { ProxyAgent, fetch as undiciFetch } from 'undici'
import type { NetworkProxySettings } from '../preload/stock-api'
import type { AiHttpProviderSettings, AiPromptMessage } from '../renderer/features/stock-workspace/models/ai-models'
import { isSafeAiCustomHeaderName } from '../renderer/features/stock-workspace/models/ai-models'
import { getElectronProxyRules, getHttpProxyUrl } from './network-proxy'

interface AiHttpProviderRequest {
  provider: AiHttpProviderSettings
  model: string
  apiKey: string
  messages: AiPromptMessage[]
  temperature: number
  timeoutMs: number
  proxy: NetworkProxySettings
  signal?: AbortSignal
}

interface AiHttpProviderStreamRequest extends AiHttpProviderRequest {
  onChunk: (chunkText: string) => void
}

export interface AiHttpProviderResult {
  outputText: string
  model: string
}

interface AiHttpResponse {
  ok: boolean
  status: number
  statusText?: string
  body?: AiReadableStream | null
  text(): Promise<string>
}

interface AiReadableStream {
  getReader(): AiReadableStreamReader
}

interface AiReadableStreamReader {
  read(): Promise<{ done: boolean; value?: Uint8Array }>
  cancel?(): Promise<void>
}

interface AiHttpRequestInit {
  method: 'POST'
  headers: Record<string, string>
  body: string
  signal: AbortSignal
}

interface ChatCompletionChoice {
  delta?: {
    content?: string | Array<{ text?: string; type?: string }>
    reasoning_content?: string
  }
  message?: {
    content?: string | Array<{ text?: string; type?: string }>
    reasoning_content?: string
  }
  text?: string
}

interface ChatCompletionResponse {
  model?: string
  choices?: ChatCompletionChoice[]
  token?: string
  content?: string | Array<{ text?: string; type?: string }>
  text?: string
  response?: string
  result?: string
  output_text?: string
  output?: string | {
    text?: string
    content?: string
    choices?: ChatCompletionChoice[]
  }
}

interface StreamingController {
  controller: AbortController
  timeout: ReturnType<typeof setTimeout>
  cleanup: () => void
}

const AI_REASONING_STREAM_NOTICE = '模型正在推理，等待可展示内容...\n\n'

export class AiStreamingUnsupportedError extends Error {
  constructor(message = 'HTTP provider 不支持流式内容') {
    super(message)
    this.name = 'AiStreamingUnsupportedError'
  }
}

export function isAiStreamingUnsupportedError(error: unknown): error is AiStreamingUnsupportedError {
  return error instanceof AiStreamingUnsupportedError
}

export async function runAiHttpChatCompletion(
  request: AiHttpProviderRequest
): Promise<AiHttpProviderResult> {
  const baseUrl = request.provider.baseUrl.trim()
  const model = request.model.trim()
  const apiKey = request.apiKey.trim()

  if (!baseUrl) {
    throw new Error('HTTP provider 缺少 base URL')
  }
  if (!model) {
    throw new Error('HTTP provider 缺少 model')
  }
  if (!apiKey) {
    throw new Error('HTTP provider 缺少 API key')
  }

  const streaming = createStreamingController(request.timeoutMs, request.signal)
  try {
    const response = await fetchWithProxy(
      createChatCompletionsUrl(baseUrl),
      {
        method: 'POST',
        headers: createHeaders(apiKey, request.provider.customHeaders),
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature,
          stream: false
        }),
        signal: streaming.controller.signal
      },
      request.proxy
    )
    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(formatProviderHttpError(response.status, responseText))
    }
    const parsed = parseJsonResponse(responseText)
    const outputText = extractOutputText(parsed)
    if (!outputText) {
      throw new Error('HTTP provider 响应格式不兼容：未找到文本输出')
    }
    return {
      outputText,
      model: parsed.model ?? model
    }
  } catch (error) {
    if (isAbortError(error)) {
      if (request.signal?.aborted) {
        throw new Error('HTTP provider 请求已取消')
      }
      throw new Error('HTTP provider 请求超时')
    }
    throw error
  } finally {
    streaming.cleanup()
  }
}

export async function runAiHttpChatCompletionStream(
  request: AiHttpProviderStreamRequest
): Promise<AiHttpProviderResult> {
  const baseUrl = request.provider.baseUrl.trim()
  const model = request.model.trim()
  const apiKey = request.apiKey.trim()

  if (!baseUrl) {
    throw new Error('HTTP provider 缺少 base URL')
  }
  if (!model) {
    throw new Error('HTTP provider 缺少 model')
  }
  if (!apiKey) {
    throw new Error('HTTP provider 缺少 API key')
  }

  const streaming = createStreamingController(request.timeoutMs, request.signal)
  try {
    const response = await fetchWithProxy(
      createChatCompletionsUrl(baseUrl),
      {
        method: 'POST',
        headers: createHeaders(apiKey, request.provider.customHeaders),
        body: JSON.stringify({
          model,
          messages: request.messages,
          temperature: request.temperature,
          stream: true
        }),
        signal: streaming.controller.signal
      },
      request.proxy
    )
    if (!response.ok) {
      const responseText = await response.text()
      if (isStreamingUnsupportedHttpError(response.status, responseText)) {
        throw new AiStreamingUnsupportedError()
      }
      throw new Error(formatProviderHttpError(response.status, responseText))
    }
    if (!response.body?.getReader) {
      throw new AiStreamingUnsupportedError()
    }

    const outputText = await readOpenAiStreamingResponse(response.body, request.onChunk)
    if (!outputText) {
      throw new Error('HTTP provider 流式响应格式不兼容：未找到文本输出')
    }
    return {
      outputText,
      model
    }
  } catch (error) {
    if (isAbortError(error)) {
      if (request.signal?.aborted) {
        throw new Error('HTTP provider 请求已取消')
      }
      throw new Error('HTTP provider 请求超时')
    }
    throw error
  } finally {
    streaming.cleanup()
  }
}

export function getAiHttpProviderHost(provider: AiHttpProviderSettings): string {
  try {
    return new URL(provider.baseUrl).host
  } catch {
    return ''
  }
}

function createChatCompletionsUrl(baseUrl: string): string {
  const normalized = baseUrl.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//.test(normalized)) {
    throw new Error('HTTP provider base URL 必须以 http:// 或 https:// 开头')
  }
  if (normalized.endsWith('/chat/completions')) {
    return normalized
  }
  return `${normalized}/chat/completions`
}

function createStreamingController(timeoutMs: number, signal?: AbortSignal): StreamingController {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const abort = (): void => controller.abort()

  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', abort, { once: true })
  }

  return {
    controller,
    timeout,
    cleanup: () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
    }
  }
}

function createHeaders(
  apiKey: string,
  customHeaders: Array<{ name: string; value: string }>
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
  customHeaders.forEach((header) => {
    const name = header.name.trim()
    const value = header.value.trim()
    const normalizedName = name.toLowerCase()
    if (!/^[A-Za-z0-9-]+$/.test(name) || !value || !isSafeAiCustomHeaderName(name)) {
      return
    }
    if (normalizedName === 'authorization' || normalizedName === 'content-type') {
      return
    }
    headers[name] = value
  })
  return headers
}

async function fetchWithProxy(
  url: string,
  init: AiHttpRequestInit,
  proxy: NetworkProxySettings
): Promise<AiHttpResponse> {
  const httpProxyUrl = getHttpProxyUrl(proxy)
  if (httpProxyUrl) {
    return (await undiciFetch(url, {
      ...init,
      dispatcher: new ProxyAgent(httpProxyUrl)
    })) as unknown as AiHttpResponse
  }

  if (proxy.enabled) {
    const electronFetch = await getElectronFetch(proxy)
    if (!electronFetch) {
      throw new Error('Electron session fetch 不可用，无法使用当前代理')
    }
    return electronFetch(url, init)
  }

  return (await fetch(url, init as RequestInit)) as AiHttpResponse
}

async function getElectronFetch(proxy: NetworkProxySettings): Promise<
  ((input: string, init: AiHttpRequestInit) => Promise<AiHttpResponse>) | null
> {
  try {
    const electron = (await import('electron')) as unknown as {
      session?: {
        defaultSession?: {
          fetch?: (input: string, init: RequestInit) => Promise<AiHttpResponse>
          setProxy?: (config: { proxyRules: string }) => Promise<void>
        }
      }
    }
    const defaultSession = electron.session?.defaultSession
    if (defaultSession?.setProxy) {
      await defaultSession.setProxy({ proxyRules: getElectronProxyRules(proxy) })
    }
    const electronFetch = defaultSession?.fetch?.bind(defaultSession)
    return electronFetch
      ? (input, init) => electronFetch(input, init as RequestInit)
      : null
  } catch {
    return null
  }
}

function parseJsonResponse(text: string): ChatCompletionResponse {
  try {
    return JSON.parse(text) as ChatCompletionResponse
  } catch {
    throw new Error('HTTP provider 响应不是合法 JSON')
  }
}

async function readOpenAiStreamingResponse(
  body: AiReadableStream,
  onChunk: (chunkText: string) => void
): Promise<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let outputText = ''
  let streamDone = false
  let reasoningNoticeEmitted = false

  const handleLine = (line: string): void => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith(':')) {
      return
    }
    if (!trimmed.startsWith('data:')) {
      return
    }
    const payload = trimmed.slice(5).trim()
    if (!payload) {
      return
    }
    if (payload === '[DONE]') {
      streamDone = true
      return
    }
    const parsed = parseStreamingJson(payload)
    const chunkText = extractStreamingChunkText(parsed)
    if (!chunkText) {
      if (!reasoningNoticeEmitted && hasStreamingReasoningChunk(parsed)) {
        reasoningNoticeEmitted = true
        onChunk(AI_REASONING_STREAM_NOTICE)
      }
      return
    }
    outputText += chunkText
    onChunk(chunkText)
  }

  while (!streamDone) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    lines.forEach(handleLine)
  }

  const tail = decoder.decode()
  if (tail) {
    buffer += tail
  }
  if (buffer.trim() && !streamDone) {
    handleLine(buffer)
  }
  if (streamDone) {
    await reader.cancel?.()
  }

  return outputText.trim()
}

function parseStreamingJson(payload: string): ChatCompletionResponse {
  try {
    return JSON.parse(payload) as ChatCompletionResponse
  } catch {
    throw new Error('HTTP provider 流式响应不是合法 JSON')
  }
}

function extractStreamingChunkText(response: ChatCompletionResponse): string {
  const choice = response.choices?.[0]
  const deltaContent = choice?.delta?.content
  if (deltaContent) {
    return extractContentText(deltaContent)
  }
  if (choice?.message?.content) {
    return extractContentText(choice.message.content)
  }
  if (typeof choice?.text === 'string') {
    return choice.text
  }
  if (typeof response.token === 'string') {
    return response.token
  }
  if (response.content) {
    return extractContentText(response.content)
  }
  if (typeof response.text === 'string') {
    return response.text
  }
  if (typeof response.response === 'string') {
    return response.response
  }
  if (typeof response.result === 'string') {
    return response.result
  }
  if (typeof response.output_text === 'string') {
    return response.output_text
  }
  if (typeof response.output === 'string') {
    return response.output
  }
  const nestedOutput = response.output
  if (nestedOutput && typeof nestedOutput === 'object') {
    if (nestedOutput.choices?.[0]) {
      return extractStreamingChunkText({ choices: nestedOutput.choices })
    }
    if (typeof nestedOutput.content === 'string') {
      return nestedOutput.content
    }
    if (typeof nestedOutput.text === 'string') {
      return nestedOutput.text
    }
  }
  return ''
}

function hasStreamingReasoningChunk(response: ChatCompletionResponse): boolean {
  const choice = response.choices?.[0]
  return Boolean(
    choice?.delta?.reasoning_content?.trim() ||
      choice?.message?.reasoning_content?.trim()
  )
}

function extractOutputText(response: ChatCompletionResponse): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim()
  }
  const choice = response.choices?.[0]
  if (typeof choice?.text === 'string' && choice.text.trim()) {
    return choice.text.trim()
  }
  const content = choice?.message?.content
  if (typeof content === 'string') {
    return content.trim()
  }
  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim() ?? '')
      .filter(Boolean)
      .join('\n')
  }
  if (typeof response.token === 'string' && response.token.trim()) {
    return response.token.trim()
  }
  if (response.content) {
    return extractContentText(response.content).trim()
  }
  if (typeof response.text === 'string' && response.text.trim()) {
    return response.text.trim()
  }
  if (typeof response.response === 'string' && response.response.trim()) {
    return response.response.trim()
  }
  if (typeof response.result === 'string' && response.result.trim()) {
    return response.result.trim()
  }
  if (typeof response.output === 'string' && response.output.trim()) {
    return response.output.trim()
  }
  const nestedOutput = response.output
  if (nestedOutput && typeof nestedOutput === 'object') {
    if (typeof nestedOutput.content === 'string' && nestedOutput.content.trim()) {
      return nestedOutput.content.trim()
    }
    if (typeof nestedOutput.text === 'string' && nestedOutput.text.trim()) {
      return nestedOutput.text.trim()
    }
    if (nestedOutput.choices?.[0]) {
      return extractOutputText({ choices: nestedOutput.choices })
    }
  }
  return ''
}

function extractContentText(content: string | Array<{ text?: string; type?: string }>): string {
  if (typeof content === 'string') {
    return content
  }
  return content
    .map((item) => item.text ?? '')
    .filter(Boolean)
    .join('')
}

function formatProviderHttpError(status: number, responseText: string): string {
  const summary = responseText.replace(/\s+/g, ' ').slice(0, 200)
  if (status === 401 || status === 403) {
    return `HTTP provider 鉴权失败（HTTP ${status}）`
  }
  return `HTTP provider 请求失败（HTTP ${status}${summary ? `：${summary}` : ''}）`
}

function isStreamingUnsupportedHttpError(status: number, responseText: string): boolean {
  if (status !== 400 && status !== 404 && status !== 422) {
    return false
  }
  return /stream(ing)?[^。；，,.!?]*not support|not support[^。；，,.!?]*stream(ing)?|不支持[^。；，,.!?]*流式|不支持[^。；，,.!?]*stream/i.test(
    responseText
  )
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}
