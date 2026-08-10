import type { AppSettings, NetworkProxySettings } from '../../../../preload/stock-api'
import type { StockDataSourceMeta, StockDataset, StockQuery } from '../models/stock-types'

export interface StockDataAdapter {
  getStockDataSources(): Promise<StockDataSourceMeta[]>
  fetchStockDataset(query: StockQuery): Promise<StockDataset>
  getSettings(): Promise<AppSettings>
  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings>
}

export class ElectronStockDataAdapter implements StockDataAdapter {
  getStockDataSources(): Promise<StockDataSourceMeta[]> {
    return window.stockApi.getStockDataSources()
  }

  fetchStockDataset(query: StockQuery): Promise<StockDataset> {
    return window.stockApi.fetchStockDataset(query)
  }

  getSettings(): Promise<AppSettings> {
    return window.stockApi.getSettings()
  }

  setNetworkProxy(proxy: NetworkProxySettings): Promise<AppSettings> {
    return window.stockApi.setNetworkProxy(proxy)
  }
}
