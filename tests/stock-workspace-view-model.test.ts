import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import iconv from 'iconv-lite'
import type { StockFileAdapter } from '../src/renderer/features/stock-workspace/adapters/ElectronFileAdapter'
import { StockWorkspaceViewModel } from '../src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel'

class FakeFileAdapter implements StockFileAdapter {
  private readonly text = iconv.decode(
    readFileSync(resolve(process.cwd(), 'fixtures/legacy/000002.txt')),
    'gbk'
  )

  async openLegacyTextFile() {
    return {
      filePath: 'fixtures/legacy/000002.txt',
      fileName: '000002.txt',
      text: this.text,
      encoding: 'gbk'
    }
  }

  async readSampleLegacyTextFile() {
    return this.openLegacyTextFile().then((payload) => payload!)
  }

  async getRecentFiles() {
    return []
  }

  async clearRecentFiles() {
    return undefined
  }
}

describe('StockWorkspaceViewModel', () => {
  it('loads bundled sample data into chart state', async () => {
    const viewModel = new StockWorkspaceViewModel(new FakeFileAdapter())

    await viewModel.initialize()

    expect(viewModel.chart.dataset?.meta.name).toBe('上证指数')
    expect(viewModel.recordCount).toBeGreaterThan(100)
    expect(viewModel.importFile.status).toBe('success')
  })

  it('toggles chart indicators', () => {
    const viewModel = new StockWorkspaceViewModel(new FakeFileAdapter())

    viewModel.toggleIndicator('boll', false)

    expect(viewModel.chart.enabledIndicators.boll).toBe(false)
  })
})
