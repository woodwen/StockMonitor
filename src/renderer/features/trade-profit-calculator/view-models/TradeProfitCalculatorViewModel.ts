import { makeAutoObservable, runInAction } from 'mobx'
import type { TradeProfitSettingsAdapter } from '../adapters/ElectronTradeProfitSettingsAdapter'
import {
  calculateTradeProfit,
  createDefaultTradeProfitInput,
  createTradeProfitRecord,
  isTradeProfitInputReady,
  normalizeTradeProfitInput,
  normalizeTradeProfitSettings,
  sumTradeProfit,
  TRADE_PROFIT_MAX_RECORDS,
  type TradeProfitInput,
  type TradeProfitRecord,
  type TradeProfitRecordContext,
  type TradeProfitResult,
  type TradeProfitSettings
} from '../models/trade-profit'

type TradeProfitNumericField = Exclude<keyof TradeProfitInput, 'isEtf'>

const TRADE_PROFIT_SAVE_DEBOUNCE_MS = 500

export class TradeProfitCalculatorViewModel {
  open = false
  draft: TradeProfitInput = createDefaultTradeProfitInput()
  records: TradeProfitRecord[] = []
  initialized = false
  saveError = ''
  private saveTimer?: ReturnType<typeof setTimeout>

  constructor(private readonly settingsAdapter: TradeProfitSettingsAdapter) {
    makeAutoObservable<this, 'settingsAdapter' | 'saveTimer'>(
      this,
      {
        settingsAdapter: false,
        saveTimer: false
      },
      { autoBind: true }
    )
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }
    this.initialized = true
    await this.reloadSettings()
  }

  async reloadSettings(): Promise<void> {
    this.cancelPendingSettingsSave()
    try {
      const settings = await this.settingsAdapter.getSettings()
      const tradeProfit = normalizeTradeProfitSettings(settings.tradeProfit)
      runInAction(() => {
        this.draft = tradeProfit.draft
        this.records = tradeProfit.records
        this.saveError = ''
      })
    } catch (error) {
      console.warn('Failed to load trade profit settings', error)
    }
  }

  dispose(): void {
    const hadPendingSave = Boolean(this.saveTimer)
    this.cancelPendingSettingsSave()
    if (!hadPendingSave) {
      return
    }
    this.persistSettings()
  }

  openCalculator(): void {
    this.open = true
  }

  closeCalculator(): void {
    this.open = false
  }

  setDraftField(field: TradeProfitNumericField, value: number | null): void {
    this.draft = normalizeTradeProfitInput({
      ...this.draft,
      [field]: value ?? 0
    })
    this.queueSettingsSave()
  }

  setEtf(isEtf: boolean): void {
    this.draft = {
      ...this.draft,
      isEtf
    }
    this.queueSettingsSave()
  }

  addRecord(context: TradeProfitRecordContext = {}): void {
    if (!this.canAddRecord) {
      return
    }

    const record = createTradeProfitRecord(this.draft, context)
    this.records = [record, ...this.records].slice(0, TRADE_PROFIT_MAX_RECORDS)
    this.saveSettingsNow()
  }

  removeRecord(id: string): void {
    const next = this.records.filter((record) => record.id !== id)
    if (next.length === this.records.length) {
      return
    }
    this.records = next
    this.saveSettingsNow()
  }

  clearRecords(): void {
    if (this.records.length === 0) {
      return
    }
    this.records = []
    this.saveSettingsNow()
  }

  get currentResult(): TradeProfitResult {
    return calculateTradeProfit(this.draft)
  }

  get totalProfit(): number {
    return sumTradeProfit(this.records)
  }

  get canAddRecord(): boolean {
    return isTradeProfitInputReady(this.draft)
  }

  get recordCount(): number {
    return this.records.length
  }

  private queueSettingsSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer)
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = undefined
      this.persistSettings()
    }, TRADE_PROFIT_SAVE_DEBOUNCE_MS)
  }

  private saveSettingsNow(): void {
    this.cancelPendingSettingsSave()
    this.persistSettings()
  }

  private cancelPendingSettingsSave(): void {
    if (!this.saveTimer) {
      return
    }
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
  }

  private persistSettings(): void {
    void this.settingsAdapter.setTradeProfitSettings(this.getSettings()).then(
      () => {
        runInAction(() => {
          this.saveError = ''
        })
      },
      (error) => {
        console.warn('Failed to save trade profit settings', error)
        runInAction(() => {
          this.saveError = '做T测算记录保存失败'
        })
      }
    )
  }

  private getSettings(): TradeProfitSettings {
    return normalizeTradeProfitSettings({
      draft: this.draft,
      records: this.records
    })
  }
}
