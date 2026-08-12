import type { AppSettings } from '../../../../preload/stock-api'
import type { TradeProfitSettings } from '../models/trade-profit'

export interface TradeProfitSettingsAdapter {
  getSettings(): Promise<AppSettings>
  setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings>
}

export class ElectronTradeProfitSettingsAdapter implements TradeProfitSettingsAdapter {
  getSettings(): Promise<AppSettings> {
    return window.stockApi.getSettings()
  }

  setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings> {
    return window.stockApi.setTradeProfitSettings(settings)
  }
}
