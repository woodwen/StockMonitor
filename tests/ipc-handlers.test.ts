import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const registeredHandlers = new Set<string>()
  const ipcMainMock = {
    handle: vi.fn((channel: string) => {
      if (registeredHandlers.has(channel)) {
        throw new Error(`Attempted to register a second handler for '${channel}'`)
      }
      registeredHandlers.add(channel)
    }),
    removeHandler: vi.fn((channel: string) => {
      registeredHandlers.delete(channel)
    })
  }

  return { ipcMainMock, registeredHandlers }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.0.0',
    isPackaged: false
  },
  ipcMain: mocks.ipcMainMock
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

import { registerIpcHandlers } from '../src/main/ipc'

describe('IPC handlers', () => {
  beforeEach(() => {
    mocks.registeredHandlers.clear()
    mocks.ipcMainMock.handle.mockClear()
    mocks.ipcMainMock.removeHandler.mockClear()
  })

  it('can be registered more than once without duplicate-handler startup errors', () => {
    expect(() => registerIpcHandlers()).not.toThrow()
    expect(() => registerIpcHandlers()).not.toThrow()

    expect(mocks.registeredHandlers).toContain('stock:getDataSources')
  })
})
