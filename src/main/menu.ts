import { BrowserWindow, Menu, app, dialog } from 'electron'
import type { MenuCommand } from '../preload/stock-api'
import { APP_NAME } from './app-metadata'

export function createApplicationMenu(window: BrowserWindow): void {
  Menu.setApplicationMenu(Menu.buildFromTemplate(buildApplicationMenuTemplate(window)))
}

export function buildApplicationMenuTemplate(
  window: BrowserWindow
): Electron.MenuItemConstructorOptions[] {
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
        },
        { type: 'separator' },
        {
          label: `关于 ${APP_NAME}`,
          click: () => {
            void dialog.showMessageBox(window, {
              type: 'info',
              title: `关于 ${APP_NAME}`,
              message: APP_NAME,
              detail: `版本 ${app.getVersion()}`,
              buttons: ['好']
            })
          }
        }
      ]
    }
  ]

  return template
}
