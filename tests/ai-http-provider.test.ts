import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const proxyAgentUrls: string[] = []
  class TestProxyAgent {
    constructor(url: string) {
      proxyAgentUrls.push(url)
    }
  }
  return {
    proxyAgentUrls,
    TestProxyAgent,
    undiciFetch: vi.fn()
  }
})

vi.mock('undici', () => ({
  ProxyAgent: mocks.TestProxyAgent,
  fetch: mocks.undiciFetch
}))

import {
  AiStreamingUnsupportedError,
  getAiHttpProviderHost,
  runAiHttpChatCompletion,
  runAiHttpChatCompletionStream
} from '../src/main/ai-http-provider'
import type { NetworkProxySettings } from '../src/preload/stock-api'

describe('AI HTTP provider client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.clearAllMocks()
    mocks.proxyAgentUrls.splice(0)
  })

  it('runs a non-streaming OpenAI-compatible chat completion request', async () => {
    const fetchMock = vi.fn(async () => createResponse(200, {
      model: 'test-model',
      choices: [{ message: { content: '分析结果' } }]
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAiHttpChatCompletion({
      provider: {
        presetId: 'custom',
        baseUrl: 'https://api.example.com/v1',
        customHeaders: [{ name: 'X-Trace', value: 'trace-1' }]
      },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.2,
      timeoutMs: 5000,
      proxy: directProxy()
    })

    expect(result).toEqual({ outputText: '分析结果', model: 'test-model' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
          'X-Trace': 'trace-1'
        })
      })
    )
    const requestInit = (fetchMock.mock.calls as unknown as Array<[string, { body: string }]>)[0][1]
    expect(JSON.parse(requestInit.body)).toMatchObject({
      model: 'test-model',
      stream: false
    })
  })

  it('drops unsafe custom auth headers before provider requests', async () => {
    const fetchMock = vi.fn(async () => createResponse(200, {
      choices: [{ message: { content: 'ok' } }]
    }))
    vi.stubGlobal('fetch', fetchMock)

    await runAiHttpChatCompletion({
      provider: {
        presetId: 'custom',
        baseUrl: 'https://api.example.com/v1',
        customHeaders: [
          { name: 'X-Api-Key', value: 'leak' },
          { name: 'X-Trace', value: 'trace-1' }
        ]
      },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0,
      timeoutMs: 5000,
      proxy: directProxy()
    })

    const headers = (
      fetchMock.mock.calls as unknown as Array<[string, { headers: Record<string, string> }]>
    )[0][1].headers
    expect(headers['X-Api-Key']).toBeUndefined()
    expect(headers['X-Trace']).toBe('trace-1')
  })

  it('blocks missing provider configuration before making a request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      runAiHttpChatCompletion({
        provider: { presetId: 'custom', baseUrl: '', customHeaders: [] },
        model: '',
        apiKey: '',
        messages: [],
        temperature: 0,
        timeoutMs: 5000,
        proxy: directProxy()
      })
    ).rejects.toThrow('HTTP provider 缺少 base URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('normalizes provider auth errors without echoing API keys', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createResponse(401, { error: 'bad sk-secret' })))

    await expect(
      runAiHttpChatCompletion({
        provider: { presetId: 'custom', baseUrl: 'https://api.example.com/v1', customHeaders: [] },
        model: 'test-model',
        apiKey: 'sk-secret',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        timeoutMs: 5000,
        proxy: directProxy()
      })
    ).rejects.toThrow('HTTP provider 鉴权失败（HTTP 401）')
  })

  it('reports incompatible provider response formats clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => createResponse(200, { choices: [{}] })))

    await expect(
      runAiHttpChatCompletion({
        provider: { presetId: 'custom', baseUrl: 'https://api.example.com/v1', customHeaders: [] },
        model: 'test-model',
        apiKey: 'sk-test',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        timeoutMs: 5000,
        proxy: directProxy()
      })
    ).rejects.toThrow('HTTP provider 响应格式不兼容：未找到文本输出')
  })

  it('uses the configured HTTP proxy for provider requests', async () => {
    mocks.undiciFetch.mockResolvedValue(createResponse(200, {
      choices: [{ message: { content: 'ok' } }]
    }))

    await runAiHttpChatCompletion({
      provider: { presetId: 'custom', baseUrl: 'https://api.example.com/v1', customHeaders: [] },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0,
      timeoutMs: 5000,
      proxy: {
        enabled: true,
        protocol: 'http',
        host: '127.0.0.1',
        port: 8080
      }
    })

    expect(mocks.proxyAgentUrls).toEqual(['http://127.0.0.1:8080'])
    expect(mocks.undiciFetch).toHaveBeenCalledTimes(1)
  })

  it('streams OpenAI-compatible SSE delta chunks and stops at DONE', async () => {
    const onChunk = vi.fn()
    const fetchMock = vi.fn(async () =>
      createStreamResponse([
        'data: {"choices":[{"delta":{"content":"第一',
        '段"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"第二段"}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAiHttpChatCompletionStream({
      provider: {
        presetId: 'custom',
        baseUrl: 'https://api.example.com/v1',
        customHeaders: []
      },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0,
      timeoutMs: 5000,
      proxy: directProxy(),
      onChunk
    })

    expect(result).toEqual({ outputText: '第一段第二段', model: 'test-model' })
    expect(onChunk.mock.calls.map((call) => call[0])).toEqual(['第一段', '第二段'])
    const requestInit = (fetchMock.mock.calls as unknown as Array<[string, { body: string }]>)[0][1]
    expect(JSON.parse(requestInit.body)).toMatchObject({
      model: 'test-model',
      stream: true
    })
  })

  it('streams provider token payloads as live chunks', async () => {
    const onChunk = vi.fn()
    const fetchMock = vi.fn(async () =>
      createStreamResponse([
        'data: {"token":"第一段"}\n\n',
        'data: {"token":"第二段"}\n\n',
        'data: [DONE]\n\n'
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAiHttpChatCompletionStream({
      provider: {
        presetId: 'custom',
        baseUrl: 'https://api.example.com/v1',
        customHeaders: []
      },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0,
      timeoutMs: 5000,
      proxy: directProxy(),
      onChunk
    })

    expect(result).toEqual({ outputText: '第一段第二段', model: 'test-model' })
    expect(onChunk.mock.calls.map((call) => call[0])).toEqual(['第一段', '第二段'])
  })

  it('shows progress for reasoning-only chunks without adding reasoning to the final output', async () => {
    const onChunk = vi.fn()
    const fetchMock = vi.fn(async () =>
      createStreamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"内部推理"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"正式结果"}}]}\n\n',
        'data: [DONE]\n\n'
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await runAiHttpChatCompletionStream({
      provider: {
        presetId: 'custom',
        baseUrl: 'https://api.example.com/v1',
        customHeaders: []
      },
      model: 'test-model',
      apiKey: 'sk-test',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0,
      timeoutMs: 5000,
      proxy: directProxy(),
      onChunk
    })

    expect(result).toEqual({ outputText: '正式结果', model: 'test-model' })
    expect(onChunk.mock.calls[0][0]).toContain('模型正在推理')
    expect(onChunk.mock.calls.map((call) => call[0]).join('')).not.toContain('内部推理')
    expect(onChunk.mock.calls.at(-1)?.[0]).toBe('正式结果')
  })

  it('marks explicit streaming incompatibility as fallback-eligible', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      createResponse(422, {
        error: 'stream is not supported by this provider'
      })
    ))

    await expect(
      runAiHttpChatCompletionStream({
        provider: { presetId: 'custom', baseUrl: 'https://api.example.com/v1', customHeaders: [] },
        model: 'test-model',
        apiKey: 'sk-test',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        timeoutMs: 5000,
        proxy: directProxy(),
        onChunk: vi.fn()
      })
    ).rejects.toBeInstanceOf(AiStreamingUnsupportedError)
  })

  it('normalizes streaming timeouts without leaking request details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted')
              error.name = 'AbortError'
              reject(error)
            },
            { once: true }
          )
        })
      )
    )

    await expect(
      runAiHttpChatCompletionStream({
        provider: { presetId: 'custom', baseUrl: 'https://api.example.com/v1', customHeaders: [] },
        model: 'test-model',
        apiKey: 'sk-secret',
        messages: [{ role: 'user', content: 'hi' }],
        temperature: 0,
        timeoutMs: 1,
        proxy: directProxy(),
        onChunk: vi.fn()
      })
    ).rejects.toThrow('HTTP provider 请求超时')
  })

  it('extracts provider hosts for safe logs', () => {
    expect(
      getAiHttpProviderHost({
        presetId: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        customHeaders: []
      })
    ).toBe('api.deepseek.com')
  })
})

function createResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    text: async () => JSON.stringify(body)
  }
}

function createStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  const pending = chunks.map((chunk) => encoder.encode(chunk))
  const cancel = vi.fn(async () => undefined)
  return {
    ok: true,
    status: 200,
    body: {
      getReader: () => ({
        read: async () => {
          const value = pending.shift()
          return value ? { done: false, value } : { done: true }
        },
        cancel
      })
    },
    text: async () => ''
  }
}

function directProxy(): NetworkProxySettings {
  return {
    enabled: false,
    protocol: 'socks5',
    host: '127.0.0.1',
    port: 7890
  }
}
