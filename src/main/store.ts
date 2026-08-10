import Store from 'electron-store'
import type { AppSettings, NetworkProxySettings, WorkspaceSettings } from '../preload/stock-api'
import type {
  StockAdjust,
  StockPeriod,
  StockQuery,
  StockSourceId,
  WorkspaceViewMode
} from '../renderer/features/stock-workspace/models/stock-types'
import {
  createDefaultIndicatorSettings,
  normalizeIndicatorSettings
} from '../renderer/features/stock-workspace/models/indicator-definitions'
import { logger } from './logger'

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
      networkProxy: getDefaultNetworkProxy(),
      workspace: getDefaultWorkspaceSettings()
    }
  }
})

export function getSettings(): AppSettings {
  try {
    return normalizeSettings(appStore.get('settings'))
  } catch (error) {
    logger.warn('Failed to load app settings', error)
    return normalizeSettings(undefined)
  }
}

export function setCheckUpdatesOnStartup(enabled: boolean): AppSettings {
  const settings = {
    ...getSettings(),
    checkUpdatesOnStartup: enabled
  }
  persistSettings(settings)
  return settings
}

export function setNetworkProxy(proxy: NetworkProxySettings): AppSettings {
  const settings = {
    ...getSettings(),
    networkProxy: normalizeNetworkProxy(proxy)
  }
  persistSettings(settings)
  return settings
}

export function setWorkspaceSettings(workspace: WorkspaceSettings): AppSettings {
  const settings = {
    ...getSettings(),
    workspace: normalizeWorkspaceSettings(workspace)
  }
  persistSettings(settings)
  return settings
}

function normalizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  return {
    checkUpdatesOnStartup: settings?.checkUpdatesOnStartup ?? true,
    networkProxy: normalizeNetworkProxy(settings?.networkProxy),
    workspace: normalizeWorkspaceSettings(settings?.workspace)
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

function persistSettings(settings: AppSettings): void {
  try {
    appStore.set('settings', settings)
  } catch (error) {
    logger.warn('Failed to save app settings', error)
  }
}

function normalizeWorkspaceSettings(workspace: Partial<WorkspaceSettings> | undefined): WorkspaceSettings {
  const defaults = getDefaultWorkspaceSettings()
  return {
    viewMode: isWorkspaceViewMode(workspace?.viewMode) ? workspace.viewMode : defaults.viewMode,
    timeshareSourceId: normalizeTimeshareSourceId(workspace?.timeshareSourceId),
    query: normalizeStockQuery(workspace?.query, defaults.query),
    indicatorSettings: normalizeIndicatorSettings(workspace?.indicatorSettings, workspace?.enabledIndicators)
  }
}

function normalizeStockQuery(query: Partial<StockQuery> | undefined, defaults: StockQuery): StockQuery {
  return {
    sourceId: isStockSourceId(query?.sourceId) ? query.sourceId : defaults.sourceId,
    symbol: query?.symbol?.trim() || defaults.symbol,
    period: isStockPeriod(query?.period) ? query.period : defaults.period,
    adjust: isStockAdjust(query?.adjust) ? query.adjust : defaults.adjust,
    startDate: normalizeDateKey(query?.startDate, defaults.startDate),
    endDate: normalizeDateKey(query?.endDate, defaults.endDate)
  }
}

function getDefaultWorkspaceSettings(): WorkspaceSettings {
  const endDate = new Date()
  const startDate = new Date(endDate)
  startDate.setFullYear(startDate.getFullYear() - 2)

  return {
    viewMode: 'timeshare',
    timeshareSourceId: 'eastmoney',
    query: {
      sourceId: 'eastmoney',
      symbol: 'sh000001',
      period: 'day',
      adjust: 'qfq',
      startDate: formatDateKey(startDate),
      endDate: formatDateKey(endDate)
    },
    indicatorSettings: createDefaultIndicatorSettings()
  }
}

const stockSourceIds: StockSourceId[] = ['eastmoney', 'sina', 'netease163', 'tencent']
const timeshareSourceIds: StockSourceId[] = ['eastmoney', 'tencent']
const stockPeriods: StockPeriod[] = ['day', 'week', 'month', '5', '15', '30', '60']
const stockAdjusts: StockAdjust[] = ['none', 'qfq', 'hfq']
const workspaceViewModes: WorkspaceViewMode[] = ['kline', 'timeshare']

function isStockSourceId(value: unknown): value is StockSourceId {
  return stockSourceIds.includes(value as StockSourceId)
}

function normalizeTimeshareSourceId(value: unknown): StockSourceId {
  return timeshareSourceIds.includes(value as StockSourceId) ? (value as StockSourceId) : 'eastmoney'
}

function isStockPeriod(value: unknown): value is StockPeriod {
  return stockPeriods.includes(value as StockPeriod)
}

function isStockAdjust(value: unknown): value is StockAdjust {
  return stockAdjusts.includes(value as StockAdjust)
}

function isWorkspaceViewMode(value: unknown): value is WorkspaceViewMode {
  return workspaceViewModes.includes(value as WorkspaceViewMode)
}

function normalizeDateKey(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }
  const dateKey = value.replace(/\D/g, '').slice(0, 8)
  return dateKey.length === 8 ? dateKey : fallback
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}
