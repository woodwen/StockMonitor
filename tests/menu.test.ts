import { beforeEach, describe, expect, it, vi } from 'vitest'

const electronMocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn((template: unknown) => ({ template })),
  quit: vi.fn(),
  setApplicationMenu: vi.fn(),
  showMessageBox: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.3',
    quit: electronMocks.quit
  },
  dialog: {
    showMessageBox: electronMocks.showMessageBox
  },
  Menu: {
    buildFromTemplate: electronMocks.buildFromTemplate,
    setApplicationMenu: electronMocks.setApplicationMenu
  }
}))

import { buildApplicationMenuTemplate, createApplicationMenu } from '../src/main/menu'

describe('application menu', () => {
  const windowMock = {
    webContents: {
      send: vi.fn()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds an About item under Help with the current version', () => {
    const template = buildApplicationMenuTemplate(windowMock as never)
    const helpMenu = template.find((item) => item.label === '帮助')
    const helpSubmenu = helpMenu?.submenu as Electron.MenuItemConstructorOptions[]
    const aboutItem = helpSubmenu.find((item) => item.label === '关于 Stock Monitor')

    expect(aboutItem).toBeDefined()

    aboutItem?.click?.({} as never, windowMock as never, {} as never)

    expect(electronMocks.showMessageBox).toHaveBeenCalledWith(
      windowMock,
      expect.objectContaining({
        buttons: ['好'],
        detail: '版本 0.1.3',
        message: 'Stock Monitor',
        title: '关于 Stock Monitor'
      })
    )
  })

  it('installs the generated menu template', () => {
    createApplicationMenu(windowMock as never)

    expect(electronMocks.buildFromTemplate).toHaveBeenCalledWith(expect.any(Array))
    expect(electronMocks.setApplicationMenu).toHaveBeenCalledWith({ template: expect.any(Array) })
  })
})
