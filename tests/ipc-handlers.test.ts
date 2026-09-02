import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const registeredHandlers = new Map<string, (...args: unknown[]) => unknown>()
  const klineCacheMock = {
    getKlineCacheStatus: vi.fn(async (request: unknown) => [{ request }]),
    startKlineCacheRefresh: vi.fn((request: unknown) => ({
      id: 'job-1',
      status: 'completed',
      total: 1,
      completed: 1,
      rows: [],
      startedAt: 1,
      finishedAt: 2,
      request
    })),
    getKlineCacheJob: vi.fn((jobId: string) => ({ id: jobId })),
    cancelKlineCacheJob: vi.fn((jobId: string) => ({ id: jobId, status: 'cancelled' })),
    getCachedKlineDataset: vi.fn(async (query: unknown) => ({
      status: 'empty',
      query,
      missingRanges: []
    })),
    clearKlineCache: vi.fn(async (request: unknown) => [{ request }])
  }
  const localCacheMock = {
    exportLocalCacheBackup: vi.fn(async () => ({ status: 'success', filePath: '/tmp/backup.json' })),
    inspectLocalCacheBackup: vi.fn(async () => ({ status: 'ready', importToken: 'token-1' })),
    importLocalCacheBackup: vi.fn(async (request: unknown) => ({
      status: 'success',
      request
    }))
  }
  const aiConnectorMock = {
    getAiConnectorSettingsSnapshot: vi.fn(async () => ({ settings: { connectorId: 'ai-1' } })),
    saveAiConnectorSettingsSnapshot: vi.fn(async (settings: unknown) => ({ settings })),
    saveAiConnectorApiKey: vi.fn(async (connectorId: string) => ({ connectorId })),
    clearAiConnectorApiKey: vi.fn(async (connectorId: string) => ({ connectorId })),
    testAiConnector: vi.fn(async () => ({ status: 'available' })),
    runAiAnalysis: vi.fn(async (request: unknown) => ({ status: 'success', request })),
    startAiAnalysisStream: vi.fn((request: unknown, emit: (payload: unknown) => void) => {
      emit({ type: 'started', requestId: 'stream-1' })
      return { requestId: 'stream-1', request }
    }),
    cancelAiAnalysis: vi.fn((requestId: string) => ({ requestId, status: 'cancelled' }))
  }
  const ipcMainMock = {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      if (registeredHandlers.has(channel)) {
        throw new Error(`Attempted to register a second handler for '${channel}'`)
      }
      registeredHandlers.set(channel, handler)
    }),
    removeHandler: vi.fn((channel: string) => {
      registeredHandlers.delete(channel)
    })
  }

  return { aiConnectorMock, ipcMainMock, klineCacheMock, localCacheMock, registeredHandlers }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    isPackaged: false
  },
  ipcMain: mocks.ipcMainMock,
  shell: {
    openExternal: vi.fn()
  }
}))

vi.mock('electron-log/main', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    initialize: vi.fn(),
    transports: {
      console: { level: 'debug' },
      file: { level: 'info' }
    },
    warn: vi.fn()
  }
}))

vi.mock('electron-store', () => ({
  default: class TestStore {
    private readonly values = new Map<string, unknown>()

    constructor(options?: { defaults?: Record<string, unknown> }) {
      Object.entries(options?.defaults ?? {}).forEach(([key, value]) => {
        this.values.set(key, value)
      })
    }

    get(key: string): unknown {
      return this.values.get(key)
    }

    set(key: string, value: unknown): void {
      this.values.set(key, value)
    }
  }
}))

vi.mock('electron-updater', () => ({
  CancellationToken: class TestCancellationToken {
    cancelled = false

    cancel(): void {
      this.cancelled = true
    }
  },
  default: {
    autoUpdater: {
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      on: vi.fn(),
      quitAndInstall: vi.fn()
    }
  }
}))

vi.mock('../src/main/kline-cache', () => ({
  cancelKlineCacheJob: mocks.klineCacheMock.cancelKlineCacheJob,
  clearKlineCache: mocks.klineCacheMock.clearKlineCache,
  getCachedKlineDataset: mocks.klineCacheMock.getCachedKlineDataset,
  getKlineCacheJob: mocks.klineCacheMock.getKlineCacheJob,
  getKlineCacheStatus: mocks.klineCacheMock.getKlineCacheStatus,
  startKlineCacheRefresh: mocks.klineCacheMock.startKlineCacheRefresh
}))

vi.mock('../src/main/local-cache-portability', () => ({
  exportLocalCacheBackup: mocks.localCacheMock.exportLocalCacheBackup,
  importLocalCacheBackup: mocks.localCacheMock.importLocalCacheBackup,
  inspectLocalCacheBackup: mocks.localCacheMock.inspectLocalCacheBackup
}))

vi.mock('../src/main/ai-connector', () => ({
  clearAiConnectorApiKey: mocks.aiConnectorMock.clearAiConnectorApiKey,
  cancelAiAnalysis: mocks.aiConnectorMock.cancelAiAnalysis,
  getAiConnectorSettingsSnapshot: mocks.aiConnectorMock.getAiConnectorSettingsSnapshot,
  runAiAnalysis: mocks.aiConnectorMock.runAiAnalysis,
  saveAiConnectorApiKey: mocks.aiConnectorMock.saveAiConnectorApiKey,
  saveAiConnectorSettingsSnapshot: mocks.aiConnectorMock.saveAiConnectorSettingsSnapshot,
  startAiAnalysisStream: mocks.aiConnectorMock.startAiAnalysisStream,
  testAiConnector: mocks.aiConnectorMock.testAiConnector
}))

import { registerIpcHandlers } from '../src/main/ipc'

describe('IPC handlers', () => {
  beforeEach(() => {
    mocks.registeredHandlers.clear()
    mocks.ipcMainMock.handle.mockClear()
    mocks.ipcMainMock.removeHandler.mockClear()
    Object.values(mocks.klineCacheMock).forEach((mock) => mock.mockClear())
    Object.values(mocks.localCacheMock).forEach((mock) => mock.mockClear())
    Object.values(mocks.aiConnectorMock).forEach((mock) => mock.mockClear())
  })

  it('can be registered more than once without duplicate-handler startup errors', () => {
    expect(() => registerIpcHandlers()).not.toThrow()
    expect(() => registerIpcHandlers()).not.toThrow()

    expect(mocks.registeredHandlers.has('stock:getDataSources')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:getKlineCacheStatus')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:startKlineCacheRefresh')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:getKlineCacheJob')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:cancelKlineCacheJob')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:getCachedKlineDataset')).toBe(true)
    expect(mocks.registeredHandlers.has('stock:clearKlineCache')).toBe(true)
    expect(mocks.registeredHandlers.has('localCache:exportBackup')).toBe(true)
    expect(mocks.registeredHandlers.has('localCache:inspectBackup')).toBe(true)
    expect(mocks.registeredHandlers.has('localCache:importBackup')).toBe(true)
    expect(mocks.registeredHandlers.has('settings:setTradeProfitSettings')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:getConnectorSettings')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:setConnectorSettings')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:saveConnectorApiKey')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:clearConnectorApiKey')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:testConnector')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:runAnalysis')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:startAnalysisStream')).toBe(true)
    expect(mocks.registeredHandlers.has('ai:cancelAnalysis')).toBe(true)
    expect(mocks.registeredHandlers.has('update:openDownloadPage')).toBe(true)
  })

  it('delegates kline cache IPC handlers to the cache service', async () => {
    registerIpcHandlers()

    const statusRequest = createKlineCacheRequest()
    const query = {
      sourceId: statusRequest.query.sourceId,
      symbol: 'sh600519',
      period: 'day',
      adjust: 'qfq',
      startDate: statusRequest.query.startDate,
      endDate: statusRequest.query.endDate
    }

    await getHandler('stock:getKlineCacheStatus')({}, statusRequest)
    expect(mocks.klineCacheMock.getKlineCacheStatus).toHaveBeenCalledWith(statusRequest)

    getHandler('stock:startKlineCacheRefresh')({}, statusRequest)
    expect(mocks.klineCacheMock.startKlineCacheRefresh).toHaveBeenCalledWith(statusRequest)

    getHandler('stock:getKlineCacheJob')({}, 'job-1')
    expect(mocks.klineCacheMock.getKlineCacheJob).toHaveBeenCalledWith('job-1')

    getHandler('stock:cancelKlineCacheJob')({}, 'job-1')
    expect(mocks.klineCacheMock.cancelKlineCacheJob).toHaveBeenCalledWith('job-1')

    await getHandler('stock:getCachedKlineDataset')({}, query)
    expect(mocks.klineCacheMock.getCachedKlineDataset).toHaveBeenCalledWith(query)

    await getHandler('stock:clearKlineCache')({}, statusRequest)
    expect(mocks.klineCacheMock.clearKlineCache).toHaveBeenCalledWith(statusRequest)
  })

  it('delegates local cache portability IPC handlers to the backup service', async () => {
    registerIpcHandlers()

    await getHandler('localCache:exportBackup')({})
    expect(mocks.localCacheMock.exportLocalCacheBackup).toHaveBeenCalledTimes(1)

    await getHandler('localCache:inspectBackup')({})
    expect(mocks.localCacheMock.inspectLocalCacheBackup).toHaveBeenCalledTimes(1)

    const request = {
      importToken: 'token-1',
      strategy: 'merge'
    }
    await getHandler('localCache:importBackup')({}, request)
    expect(mocks.localCacheMock.importLocalCacheBackup).toHaveBeenCalledWith(request)
  })

  it('delegates AI connector IPC handlers to the coordinator', async () => {
    registerIpcHandlers()

    const settings = { connectorId: 'ai-1' }
    const request = { useCaseId: 'daily-review' }
    const streamRequest = {
      requestId: 'stream-1',
      analysisRequest: request
    }
    const send = vi.fn()

    await getHandler('ai:getConnectorSettings')({})
    await getHandler('ai:setConnectorSettings')({}, settings)
    await getHandler('ai:saveConnectorApiKey')({}, 'ai-1', 'secret-key')
    await getHandler('ai:clearConnectorApiKey')({}, 'ai-1')
    await getHandler('ai:testConnector')({})
    await getHandler('ai:runAnalysis')({}, request)
    await getHandler('ai:startAnalysisStream')({ sender: { send } }, streamRequest)
    await getHandler('ai:cancelAnalysis')({}, 'stream-1')

    expect(mocks.aiConnectorMock.getAiConnectorSettingsSnapshot).toHaveBeenCalledTimes(1)
    expect(mocks.aiConnectorMock.saveAiConnectorSettingsSnapshot).toHaveBeenCalledWith(settings)
    expect(mocks.aiConnectorMock.saveAiConnectorApiKey).toHaveBeenCalledWith('ai-1', 'secret-key')
    expect(mocks.aiConnectorMock.clearAiConnectorApiKey).toHaveBeenCalledWith('ai-1')
    expect(mocks.aiConnectorMock.testAiConnector).toHaveBeenCalledTimes(1)
    expect(mocks.aiConnectorMock.runAiAnalysis).toHaveBeenCalledWith(request)
    expect(mocks.aiConnectorMock.startAiAnalysisStream).toHaveBeenCalledWith(
      streamRequest,
      expect.any(Function)
    )
    expect(send).toHaveBeenCalledWith('ai:analysisStreamEvent', {
      type: 'started',
      requestId: 'stream-1'
    })
    expect(mocks.aiConnectorMock.cancelAiAnalysis).toHaveBeenCalledWith('stream-1')
  })
})

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handler = mocks.registeredHandlers.get(channel)
  expect(handler).toBeTypeOf('function')
  return handler as (...args: unknown[]) => unknown
}

function createKlineCacheRequest() {
  return {
    query: {
      sourceId: 'eastmoney',
      periods: ['day'],
      adjusts: ['qfq'],
      startDate: '20260801',
      endDate: '20260810'
    },
    items: [
      {
        symbol: 'sh600519',
        name: '贵州茅台',
        createdAt: 1
      }
    ]
  }
}
