import { BrowserWindow, Menu, app } from 'electron'
import type { MenuCommand } from '../preload/stock-api'

export function createApplicationMenu(window: BrowserWindow): void {
  const sendCommand = (command: MenuCommand): void => {
    window.webContents.send('menu:command', command)
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '行情',
      submenu: [
        {
          label: '刷新行情',
          accelerator: 'CmdOrCtrl+R',
          click: () => sendCommand('refresh-stock')
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '检查更新',
          click: () => sendCommand('check-update')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
