import { makeAutoObservable } from 'mobx'
import { ElectronStockDataAdapter } from '../features/stock-workspace/adapters/ElectronStockDataAdapter'
import { StockWorkspaceViewModel } from '../features/stock-workspace/view-models/StockWorkspaceViewModel'
import { AppUpdateViewModel } from '../features/app-update/view-models/AppUpdateViewModel'
import type { MenuCommand } from '../../preload/stock-api'

export class RootViewModel {
  readonly stockWorkspace = new StockWorkspaceViewModel(new ElectronStockDataAdapter())
  readonly appUpdate = new AppUpdateViewModel()
  private removeMenuListener?: () => void

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async initialize(): Promise<void> {
    await Promise.all([this.stockWorkspace.initialize(), this.appUpdate.initialize()])
    this.removeMenuListener = window.stockApi.onMenuCommand(this.handleMenuCommand)
  }

  dispose(): void {
    this.removeMenuListener?.()
    this.stockWorkspace.dispose()
    this.appUpdate.dispose()
  }

  private handleMenuCommand(command: MenuCommand): void {
    if (command === 'refresh-stock') {
      this.stockWorkspace.refreshStock()
    } else if (command === 'check-update') {
      this.appUpdate.checkForUpdates()
    }
  }
}
