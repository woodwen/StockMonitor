import { makeAutoObservable } from 'mobx'
import { ElectronStockDataAdapter } from '../features/stock-workspace/adapters/ElectronStockDataAdapter'
import { StockWorkspaceViewModel } from '../features/stock-workspace/view-models/StockWorkspaceViewModel'
import { AppUpdateViewModel } from '../features/app-update/view-models/AppUpdateViewModel'
import { ElectronTradeProfitSettingsAdapter } from '../features/trade-profit-calculator/adapters/ElectronTradeProfitSettingsAdapter'
import { TradeProfitCalculatorViewModel } from '../features/trade-profit-calculator/view-models/TradeProfitCalculatorViewModel'
import type { MenuCommand } from '../../preload/stock-api'

export class RootViewModel {
  readonly appUpdate = new AppUpdateViewModel()
  readonly tradeProfitCalculator = new TradeProfitCalculatorViewModel(
    new ElectronTradeProfitSettingsAdapter()
  )
  readonly stockWorkspace = new StockWorkspaceViewModel(new ElectronStockDataAdapter(), {
    onLocalCacheImported: () => this.tradeProfitCalculator.reloadSettings()
  })
  isUserManualOpen = false
  isVersionUpdatesOpen = false
  private removeMenuListener?: () => void

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.stockWorkspace.initialize(),
      this.appUpdate.initialize(),
      this.tradeProfitCalculator.initialize()
    ])
    this.removeMenuListener = window.stockApi.onMenuCommand(this.handleMenuCommand)
  }

  dispose(): void {
    this.removeMenuListener?.()
    this.stockWorkspace.dispose()
    this.appUpdate.dispose()
    this.tradeProfitCalculator.dispose()
  }

  openUserManual(): void {
    this.isUserManualOpen = true
  }

  closeUserManual(): void {
    this.isUserManualOpen = false
  }

  openVersionUpdates(): void {
    this.isVersionUpdatesOpen = true
  }

  closeVersionUpdates(): void {
    this.isVersionUpdatesOpen = false
  }

  private handleMenuCommand(command: MenuCommand): void {
    if (command === 'refresh-stock') {
      this.stockWorkspace.refreshStock()
    } else if (command === 'check-update') {
      this.appUpdate.checkForUpdates()
    } else if (command === 'open-user-manual') {
      this.openUserManual()
    } else if (command === 'open-version-updates') {
      this.openVersionUpdates()
    }
  }
}
