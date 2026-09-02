import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const stores: Array<Map<string, unknown>> = []
  const safeStorageState = {
    encryptionAvailable: true
  }

  class TestStore {
    private readonly values = new Map<string, unknown>()

    constructor(options?: { defaults?: Record<string, unknown> }) {
      Object.entries(options?.defaults ?? {}).forEach(([key, value]) => {
        this.values.set(key, value)
      })
      stores.push(this.values)
    }

    get(key: string): unknown {
      return this.values.get(key)
    }

    set(key: string, value: unknown): void {
      this.values.set(key, value)
    }
  }

  return { safeStorageState, stores, TestStore }
})

vi.mock('electron-store', () => ({
  default: mocks.TestStore
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

vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => mocks.safeStorageState.encryptionAvailable,
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value: Buffer) =>
      value.toString('utf8').replace(/^encrypted:/, '')
  }
}))

import {
  clearAiApiKey,
  getAiApiKey,
  getAiCredentialStatus,
  getStoredAiCredentialsForTest,
  saveAiApiKey
} from '../src/main/ai-credentials'

describe('AI credential store', () => {
  beforeEach(async () => {
    mocks.safeStorageState.encryptionAvailable = true
    mocks.stores.forEach((store) => store.delete('aiCredentials'))
    await clearAiApiKey('default-ai-connector')
  })

  it('stores API keys encrypted when Electron safeStorage is available', async () => {
    await expect(saveAiApiKey('default-ai-connector', 'sk-test')).resolves.toBe('saved')

    const stored = getStoredAiCredentialsForTest()['default-ai-connector']
    expect(stored.encryptedApiKey).not.toContain('sk-test')
    await expect(getAiApiKey('default-ai-connector')).resolves.toBe('sk-test')
    await expect(getAiCredentialStatus('default-ai-connector', true)).resolves.toBe('saved')
  })

  it('uses session-only credentials when safeStorage is unavailable', async () => {
    mocks.safeStorageState.encryptionAvailable = false

    await expect(saveAiApiKey('default-ai-connector', 'sk-temp')).resolves.toBe('temporary')

    expect(getStoredAiCredentialsForTest()).toEqual({})
    await expect(getAiApiKey('default-ai-connector')).resolves.toBe('sk-temp')
    await expect(getAiCredentialStatus('default-ai-connector', true)).resolves.toBe('temporary')
  })

  it('reports persisted credentials as unsupported when they cannot be decrypted', async () => {
    await saveAiApiKey('default-ai-connector', 'sk-test')
    mocks.safeStorageState.encryptionAvailable = false

    await expect(getAiCredentialStatus('default-ai-connector', true)).resolves.toBe('unsupported')
    await expect(getAiApiKey('default-ai-connector')).resolves.toBeUndefined()
  })
})
