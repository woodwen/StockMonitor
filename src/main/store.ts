import Store from 'electron-store'
import type { AppSettings, NetworkProxySettings } from '../preload/stock-api'

interface AppStoreSchema {
  settings: AppSettings
  windowBounds?: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

export const appStore = new Store<AppStoreSchema>({
  name: 'stock-monitor',
  defaults: {
    settings: {
      checkUpdatesOnStartup: true,
      networkProxy: getDefaultNetworkProxy()
    }
  }
})

export function getSettings(): AppSettings {
  return normalizeSettings(appStore.get('settings'))
}

export function setCheckUpdatesOnStartup(enabled: boolean): AppSettings {
  const settings = {
    ...getSettings(),
    checkUpdatesOnStartup: enabled
  }
  appStore.set('settings', settings)
  return settings
}

export function setNetworkProxy(proxy: NetworkProxySettings): AppSettings {
  const settings = {
    ...getSettings(),
    networkProxy: normalizeNetworkProxy(proxy)
  }
  appStore.set('settings', settings)
  return settings
}

function normalizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  return {
    checkUpdatesOnStartup: settings?.checkUpdatesOnStartup ?? true,
    networkProxy: normalizeNetworkProxy(settings?.networkProxy)
  }
}

function normalizeNetworkProxy(proxy: Partial<NetworkProxySettings> | undefined): NetworkProxySettings {
  const port = Number(proxy?.port)
  return {
    enabled: Boolean(proxy?.enabled),
    protocol: proxy?.protocol === 'http' ? 'http' : 'socks5',
    host: proxy?.host?.trim() || '127.0.0.1',
    port: Number.isInteger(port) && port > 0 && port <= 65535 ? port : 7890
  }
}

function getDefaultNetworkProxy(): NetworkProxySettings {
  return {
    enabled: false,
    protocol: 'socks5',
    host: '127.0.0.1',
    port: 7890
  }
}
