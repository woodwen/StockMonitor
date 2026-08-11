import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const updateListeners = new Map<string, (...args: never[]) => void>()
  const autoUpdaterMock = {
    autoDownload: true,
    checkForUpdates: vi.fn(async () => undefined),
    downloadUpdate: vi.fn(async (_cancellationToken?: { cancelled: boolean }) => [] as string[]),
    logger: null as unknown,
    netSession: {
      setProxy: vi.fn(async () => undefined)
    },
    on: vi.fn((eventName: string, listener: (...args: never[]) => void) => {
      updateListeners.set(eventName, listener)
    }),
    quitAndInstall: vi.fn()
  }
  const settings = {
    checkUpdatesOnStartup: true,
    networkProxy: {
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    },
    workspace: {}
  }

  return { autoUpdaterMock, settings, updateListeners }
})

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.3',
    isPackaged: true
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
    autoUpdater: mocks.autoUpdaterMock
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

vi.mock('../src/main/store', () => ({
  getSettings: () => mocks.settings
}))

import {
  cancelUpdateDownload,
  checkForUpdates,
  configureUpdateManager,
  downloadUpdate
} from '../src/main/update-manager'

describe('update manager', () => {
  const windowMock = {
    webContents: {
      send: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateListeners.clear()
    mocks.settings.networkProxy = {
      enabled: true,
      protocol: 'socks5',
      host: '127.0.0.1',
      port: 7890
    }
  })

  it('applies the saved proxy settings before checking for updates', async () => {
    await checkForUpdates()

    expect(mocks.autoUpdaterMock.netSession.setProxy).toHaveBeenCalledWith({
      proxyRules: 'socks5://127.0.0.1:7890'
    })
    expect(mocks.autoUpdaterMock.netSession.setProxy.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.autoUpdaterMock.checkForUpdates.mock.invocationCallOrder[0]
    )
  })

  it('turns connection-closed updater errors into an actionable user message', () => {
    configureUpdateManager(windowMock as never)
    mocks.updateListeners.get('error')?.(new Error('net::ERR_CONNECTION_CLOSED') as never)

    expect(windowMock.webContents.send).toHaveBeenCalledWith(
      'update:event',
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('网络')
      })
    )
    expect(windowMock.webContents.send).not.toHaveBeenCalledWith(
      'update:event',
      expect.objectContaining({
        message: 'net::ERR_CONNECTION_CLOSED'
      })
    )
  })

  it('cancels an active update download', async () => {
    configureUpdateManager(windowMock as never)
    let finishDownload: (value: string[]) => void = () => undefined
    mocks.autoUpdaterMock.downloadUpdate.mockImplementationOnce(
      async () =>
        new Promise<string[]>((resolve) => {
          finishDownload = resolve
        })
    )

    const downloadPromise = downloadUpdate()
    await Promise.resolve()
    await Promise.resolve()
    const downloadCall = mocks.autoUpdaterMock.downloadUpdate.mock.calls[0]
    const cancellationToken = downloadCall?.[0]

    expect(cancellationToken?.cancelled).toBe(false)

    cancelUpdateDownload()

    expect(cancellationToken?.cancelled).toBe(true)
    expect(windowMock.webContents.send).toHaveBeenCalledWith('update:event', { type: 'cancelled' })

    finishDownload([])
    await downloadPromise
  })
})
