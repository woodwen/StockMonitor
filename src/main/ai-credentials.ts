import { appStore, type StoredAiCredential } from './store'
import type { AiCredentialStatus } from '../renderer/features/stock-workspace/models/ai-models'

interface ElectronSafeStorage {
  isEncryptionAvailable(): boolean
  encryptString(value: string): Buffer
  decryptString(encrypted: Buffer): string
}

const sessionApiKeys = new Map<string, string>()

export async function getAiCredentialStatus(
  connectorId: string,
  required: boolean
): Promise<AiCredentialStatus> {
  if (!required) {
    return 'not-required'
  }
  if (sessionApiKeys.has(connectorId)) {
    return 'temporary'
  }
  const credentials = getStoredCredentials()
  const credential = credentials[connectorId]
  if (!credential) {
    return 'missing'
  }
  const safeStorage = await getAvailableSafeStorage()
  return safeStorage ? 'saved' : 'unsupported'
}

export async function saveAiApiKey(connectorId: string, apiKey: string): Promise<AiCredentialStatus> {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    await clearAiApiKey(connectorId)
    return 'missing'
  }

  const safeStorage = await getAvailableSafeStorage()
  if (!safeStorage) {
    sessionApiKeys.set(connectorId, trimmed)
    removeStoredCredential(connectorId)
    return 'temporary'
  }

  const encryptedApiKey = safeStorage.encryptString(trimmed).toString('base64')
  const credentials = getStoredCredentials()
  credentials[connectorId] = {
    encryptedApiKey,
    updatedAt: new Date().toISOString()
  }
  appStore.set('aiCredentials', credentials)
  sessionApiKeys.delete(connectorId)
  return 'saved'
}

export async function getAiApiKey(connectorId: string): Promise<string | undefined> {
  const sessionKey = sessionApiKeys.get(connectorId)
  if (sessionKey) {
    return sessionKey
  }

  const credential = getStoredCredentials()[connectorId]
  if (!credential) {
    return undefined
  }
  const safeStorage = await getAvailableSafeStorage()
  if (!safeStorage) {
    return undefined
  }

  try {
    return safeStorage.decryptString(Buffer.from(credential.encryptedApiKey, 'base64'))
  } catch {
    return undefined
  }
}

export async function clearAiApiKey(connectorId: string): Promise<AiCredentialStatus> {
  sessionApiKeys.delete(connectorId)
  removeStoredCredential(connectorId)
  return 'missing'
}

export function getStoredAiCredentialsForTest(): Record<string, StoredAiCredential> {
  return getStoredCredentials()
}

function getStoredCredentials(): Record<string, StoredAiCredential> {
  const value = appStore.get('aiCredentials')
  if (!value || typeof value !== 'object') {
    return {}
  }
  return { ...(value as Record<string, StoredAiCredential>) }
}

function removeStoredCredential(connectorId: string): void {
  const credentials = getStoredCredentials()
  if (!(connectorId in credentials)) {
    return
  }
  delete credentials[connectorId]
  appStore.set('aiCredentials', credentials)
}

async function getAvailableSafeStorage(): Promise<ElectronSafeStorage | null> {
  try {
    const electron = (await import('electron')) as unknown as {
      safeStorage?: ElectronSafeStorage
    }
    const safeStorage = electron.safeStorage
    return safeStorage?.isEncryptionAvailable() ? safeStorage : null
  } catch {
    return null
  }
}
