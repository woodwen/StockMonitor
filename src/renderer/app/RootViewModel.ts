import { makeAutoObservable } from 'mobx'
import { ElectronFileAdapter } from '../features/stock-workspace/adapters/ElectronFileAdapter'
import { StockWorkspaceViewModel } from '../features/stock-workspace/view-models/StockWorkspaceViewModel'
import { AppUpdateViewModel } from '../features/app-update/view-models/AppUpdateViewModel'
import type { MenuCommand } from '../../preload/stock-api'

export class RootViewModel {
  readonly stockWorkspace = new StockWorkspaceViewModel(new ElectronFileAdapter())
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
    this.appUpdate.dispose()
  }

  private handleMenuCommand(command: MenuCommand): void {
    if (command === 'open-file') {
      this.stockWorkspace.openFile()
    } else if (command === 'load-sample') {
      this.stockWorkspace.loadSample()
    } else if (command === 'check-update') {
      this.appUpdate.checkForUpdates()
    }
  }
}
