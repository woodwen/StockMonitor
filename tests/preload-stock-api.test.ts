import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { StockApi } from '../src/preload/stock-api'
import type {
  AiAnalysisRequest,
  AiAnalysisStreamEvent
} from '../src/renderer/features/stock-workspace/models/ai-models'

const mocks = vi.hoisted(() => {
  const state: { exposedApi?: unknown } = {}
  return {
    state,
    exposeInMainWorld: vi.fn((_key: string, api: unknown) => {
      state.exposedApi = api
    }),
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
})

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mocks.exposeInMainWorld
  },
  ipcRenderer: {
    invoke: mocks.invoke,
    on: mocks.on,
    removeListener: mocks.removeListener
  }
}))

import '../src/preload/index'

describe('preload stock API bridge', () => {
  beforeEach(() => {
    mocks.invoke.mockReset()
    mocks.on.mockReset()
    mocks.removeListener.mockReset()
  })

  it('exposes AI stream start, cancel, and event subscription through typed channels', async () => {
    const api = mocks.state.exposedApi as StockApi
    const request = {
      requestId: 'stream-1',
      analysisRequest: createAiAnalysisRequest()
    }
    const callback = vi.fn()
    const event: AiAnalysisStreamEvent = {
      type: 'chunk',
      requestId: 'stream-1',
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

    await api.startAiAnalysisStream(request)
    await api.cancelAiAnalysis('stream-1')
    const dispose = api.onAiAnalysisStreamEvent(callback)
    const listener = mocks.on.mock.calls[0][1] as (_event: unknown, payload: AiAnalysisStreamEvent) => void
    listener({}, event)
    dispose()

    expect(mocks.invoke).toHaveBeenCalledWith('ai:startAnalysisStream', request)
    expect(mocks.invoke).toHaveBeenCalledWith('ai:cancelAnalysis', 'stream-1')
    expect(mocks.on).toHaveBeenCalledWith('ai:analysisStreamEvent', listener)
    expect(callback).toHaveBeenCalledWith(event)
    expect(mocks.removeListener).toHaveBeenCalledWith('ai:analysisStreamEvent', listener)
  })
})

function createAiAnalysisRequest(): AiAnalysisRequest {
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
