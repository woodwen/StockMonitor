import type { NetworkProxySettings } from '../preload/stock-api'

export function getElectronProxyRules(proxy: NetworkProxySettings): string {
  if (!proxy.enabled) {
    return 'direct://'
  }

  if (proxy.protocol === 'socks5') {
    return `socks5://${proxy.host}:${proxy.port}`
  }

  return `http=${proxy.host}:${proxy.port};https=${proxy.host}:${proxy.port}`
}

export function getHttpProxyUrl(proxy: NetworkProxySettings): string | null {
  if (!proxy.enabled || proxy.protocol !== 'http') {
    return null
  }
  return `http://${proxy.host}:${proxy.port}`
}
