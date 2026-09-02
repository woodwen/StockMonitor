import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const settings: any = {
    networkProxy: {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    aiConnector: {
      connectorId: 'default-ai-connector:deepseek',
      displayName: 'DeepSeek',
      enabled: false,
      kind: 'http-provider',
      model: 'deepseek-v4-pro',
      profile: '',
      temperature: 0.2,
      timeoutMs: 60000,
      contextLimit: 12000,
      availability: 'unknown',
      httpProvider: {
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        customHeaders: []
      }
    }
  }
  return {
    settings,
    credentialStatus: 'missing',
    apiKey: undefined as string | undefined,
    httpRun: vi.fn(async () => ({ outputText: '分析结果', model: 'test-model' })),
    httpStream: vi.fn(async (request: { onChunk: (chunkText: string) => void }) => {
      request.onChunk('流式结果')
      return { outputText: '流式结果', model: 'test-model' }
    }),
    createStreamingUnsupportedError: () => {
      const error = new Error('HTTP provider 不支持流式内容')
      error.name = 'AiStreamingUnsupportedError'
      return error
    },
    log: {
      error: vi.fn(),
      info: vi.fn(),
      initialize: vi.fn(),
      transports: {
        console: { level: 'debug' },
        file: { level: 'info' }
      },
      warn: vi.fn()
    },
    setAiConnectorSettings: vi.fn((aiConnector: unknown) => {
      settings.aiConnector = aiConnector
      return settings
    })
  }
})

vi.mock('../src/main/store', () => ({
  getSettings: () => mocks.settings,
  setAiConnectorSettings: mocks.setAiConnectorSettings
}))

vi.mock('../src/main/ai-credentials', () => ({
  clearAiApiKey: vi.fn(async () => 'missing'),
  getAiApiKey: vi.fn(async () => mocks.apiKey),
  getAiCredentialStatus: vi.fn(async () => mocks.credentialStatus),
  saveAiApiKey: vi.fn(async () => mocks.credentialStatus)
}))

vi.mock('../src/main/ai-http-provider', () => ({
  getAiHttpProviderHost: () => 'api.example.com',
  isAiStreamingUnsupportedError: (error: unknown) =>
    error instanceof Error && error.name === 'AiStreamingUnsupportedError',
  runAiHttpChatCompletion: mocks.httpRun,
  runAiHttpChatCompletionStream: mocks.httpStream
}))

vi.mock('electron-log/main', () => ({
  default: mocks.log
}))

import {
  cancelAiAnalysis,
  clearAiConnectorApiKey,
  runAiAnalysis,
  saveAiConnectorApiKey,
  startAiAnalysisStream,
  testAiConnector
} from '../src/main/ai-connector'
import {
  AI_NON_INVESTMENT_NOTICE,
  AI_STREAMING_FALLBACK_NOTICE,
  createDefaultAiConnectorSettings,
  type AiAnalysisRequest,
  type AiAnalysisStreamEvent
} from '../src/renderer/features/stock-workspace/models/ai-models'

describe('AI connector coordinator', () => {
  beforeEach(() => {
    mocks.credentialStatus = 'missing'
    mocks.apiKey = undefined
    mocks.settings.networkProxy = {
      enabled: false,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    }
    mocks.settings.aiConnector = createDefaultAiConnectorSettings()
    vi.clearAllMocks()
  })

  it('blocks analysis while the connector is disabled', async () => {
    const result = await runAiAnalysis(createRequest())

    expect(result.status).toBe('error')
    expect(result.errorMessage).toContain('AI connector 未启用')
    expect(mocks.httpRun).not.toHaveBeenCalled()
  })

  it('reports HTTP provider tests as unavailable when API key is missing', async () => {
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      kind: 'http-provider',
      enabled: true,
      model: 'test-model'
    }

    const result = await testAiConnector()

    expect(result.status).toBe('unavailable')
    expect(result.message).toBe('HTTP provider 缺少可用 API key')
    expect(mocks.httpRun).not.toHaveBeenCalled()
  })

  it('resets connector availability when the API key changes or is cleared', async () => {
    mocks.credentialStatus = 'saved'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      availability: 'available'
    }

    const saved = await saveAiConnectorApiKey('default-ai-connector:deepseek', 'sk-new')

    expect(saved.settings.availability).toBe('unknown')
    expect(mocks.setAiConnectorSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ availability: 'unknown' })
    )

    mocks.settings.aiConnector = {
      ...mocks.settings.aiConnector,
      availability: 'available'
    }
    mocks.credentialStatus = 'missing'

    const cleared = await clearAiConnectorApiKey('default-ai-connector:deepseek')

    expect(cleared.settings.availability).toBe('unknown')
    expect(cleared.credentialStatus).toBe('missing')
  })

  it('runs HTTP analysis with structured prompts and appends the boundary notice', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.networkProxy = {
      enabled: true,
      protocol: 'http',
      host: '127.0.0.1',
      port: 8080
    }
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }

    const result = await runAiAnalysis(createRequest())

    expect(result.status).toBe('success')
    expect(result.outputText).toContain('分析结果')
    expect(result.outputText).toContain(AI_NON_INVESTMENT_NOTICE)
    expect(mocks.httpRun).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'sk-test',
        model: 'test-model',
        proxy: mocks.settings.networkProxy,
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Stock Monitor')
          })
        ])
      })
    )
    const logged = JSON.stringify(mocks.log.info.mock.calls)
    expect(logged).not.toContain('sk-test')
    expect(logged).not.toContain('价 3000')
  })

  it('emits HTTP stream chunks and the final completed event by request id', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }
    mocks.httpStream.mockImplementationOnce(async (request: { onChunk: (chunkText: string) => void }) => {
      request.onChunk('第一段')
      request.onChunk('第二段')
      return { outputText: '第一段第二段', model: 'test-model' }
    })
    const events: AiAnalysisStreamEvent[] = []

    const started = startAiAnalysisStream(
      { requestId: 'stream-1', analysisRequest: createRequest() },
      (event) => events.push(event)
    )
    await waitForMicrotasks()

    expect(started.requestId).toBe('stream-1')
    expect(events.map((event) => event.type)).toEqual(['started', 'chunk', 'chunk', 'completed'])
    expect(events.every((event) => event.requestId === 'stream-1')).toBe(true)
    expect(events[1]).toMatchObject({ type: 'chunk', chunkText: '第一段' })
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      outputText: expect.stringContaining('第一段第二段')
    })
    expect(cancelAiAnalysis('stream-1').status).toBe('not-found')
    const logged = JSON.stringify(mocks.log.info.mock.calls)
    expect(logged).toContain('chunkCount')
    expect(logged).not.toContain('sk-test')
    expect(logged).not.toContain('请复盘')
  })

  it('falls back only when the HTTP provider explicitly does not support streaming', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }
    mocks.httpStream.mockRejectedValueOnce(mocks.createStreamingUnsupportedError())
    mocks.httpRun.mockResolvedValueOnce({ outputText: '非流式结果', model: 'test-model' })
    const events: AiAnalysisStreamEvent[] = []

    startAiAnalysisStream(
      { requestId: 'stream-fallback', analysisRequest: createRequest() },
      (event) => events.push(event)
    )
    await waitForMicrotasks()

    expect(mocks.httpRun).toHaveBeenCalledTimes(1)
    expect(events.at(-1)).toMatchObject({
      type: 'completed',
      outputText: expect.stringContaining('非流式结果'),
      warnings: expect.arrayContaining([AI_STREAMING_FALLBACK_NOTICE]),
      streamingFallback: true
    })
  })

  it('does not silently retry non-streaming provider failures as fallback', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }
    mocks.httpStream.mockRejectedValueOnce(new Error('HTTP provider 鉴权失败（HTTP 401）'))
    const events: AiAnalysisStreamEvent[] = []

    startAiAnalysisStream(
      { requestId: 'stream-auth-error', analysisRequest: createRequest() },
      (event) => events.push(event)
    )
    await waitForMicrotasks()

    expect(mocks.httpRun).not.toHaveBeenCalled()
    expect(events.at(-1)).toMatchObject({
      type: 'failed',
      errorMessage: 'HTTP provider 鉴权失败（HTTP 401）'
    })
  })

  it('cancels an active AI stream without emitting a later failure', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }
    let streamStarted: () => void = () => undefined
    const streamStartedPromise = new Promise<void>((resolve) => {
      streamStarted = resolve
    })
    mocks.httpStream.mockImplementationOnce(
      async (request: { signal?: AbortSignal; onChunk: (chunkText: string) => void }) => {
        streamStarted()
        request.onChunk('已生成')
        return new Promise((resolve, reject) => {
          request.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true
          })
          void resolve
        })
      }
    )
    const events: AiAnalysisStreamEvent[] = []

    startAiAnalysisStream(
      { requestId: 'stream-cancel', analysisRequest: createRequest() },
      (event) => events.push(event)
    )
    await streamStartedPromise
    const result = cancelAiAnalysis('stream-cancel')
    await waitForMicrotasks()

    expect(result.status).toBe('cancelled')
    expect(events.map((event) => event.type)).toEqual(['started', 'chunk', 'cancelled'])
    expect(events.at(-1)).toMatchObject({
      type: 'cancelled',
      outputText: '已生成'
    })
  })

  it('rejects duplicate active stream request ids without replacing the running stream', async () => {
    mocks.credentialStatus = 'saved'
    mocks.apiKey = 'sk-test'
    mocks.settings.aiConnector = {
      ...createDefaultAiConnectorSettings(),
      enabled: true,
      kind: 'http-provider',
      model: 'test-model'
    }
    let streamStarted: () => void = () => undefined
    const streamStartedPromise = new Promise<void>((resolve) => {
      streamStarted = resolve
    })
    mocks.httpStream.mockImplementationOnce(
      async (request: { signal?: AbortSignal; onChunk: (chunkText: string) => void }) => {
        streamStarted()
        request.onChunk('第一段')
        return new Promise((resolve, reject) => {
          request.signal?.addEventListener('abort', () => reject(new Error('aborted')), {
            once: true
          })
          void resolve
        })
      }
    )
    const firstEvents: AiAnalysisStreamEvent[] = []
    const secondEvents: AiAnalysisStreamEvent[] = []

    startAiAnalysisStream(
      { requestId: 'stream-duplicate', analysisRequest: createRequest() },
      (event) => firstEvents.push(event)
    )
    await streamStartedPromise

    expect(() =>
      startAiAnalysisStream(
        { requestId: 'stream-duplicate', analysisRequest: createRequest() },
        (event) => secondEvents.push(event)
      )
    ).toThrow('AI 分析 request id 已在运行')

    expect(cancelAiAnalysis('stream-duplicate').status).toBe('cancelled')
    await waitForMicrotasks()
    expect(firstEvents.map((event) => event.type)).toEqual(['started', 'chunk', 'cancelled'])
    expect(secondEvents).toEqual([])
  })
})

function createRequest(): AiAnalysisRequest {
  return {
    useCaseId: 'daily-review',
    question: '请复盘',
    context: {
      generatedAt: '2026-08-25T00:00:00.000Z',
      viewMode: 'timeshare',
      symbol: 'sh000001',
      stockName: '上证指数',
      dataSourceName: '东方财富',
      dataDateRange: { tradeDate: '20260825' },
      recordCount: 10,
      latestSummary: '价 3000',
      enabledIndicators: ['ma'],
      missingData: []
    }
  }
}

function waitForMicrotasks(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}
