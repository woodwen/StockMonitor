/// <reference types="vite/client" />

import type { StockApi } from '../preload/stock-api'

declare global {
  interface Window {
    stockApi: StockApi
  }
}
