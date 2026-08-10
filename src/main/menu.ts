import { BrowserWindow, Menu, app } from 'electron'
import type { MenuCommand } from '../preload/stock-api'

export function createApplicationMenu(window: BrowserWindow): void {
  const sendCommand = (command: MenuCommand): void => {
    window.webContents.send('menu:command', command)
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入行情文本',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendCommand('open-file')
        },
        {
          label: '加载示例数据',
          click: () => sendCommand('load-sample')
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
