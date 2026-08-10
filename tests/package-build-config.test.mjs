import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const appImageSafePathPattern = /^[\p{L}\p{N}._\- ]+$/u

describe('package build config', () => {
  it('uses a safe Linux executable name for AppImage packaging', () => {
    const executableName = packageJson.build.linux.executableName

    expect(packageJson.name).toBe('@woodwen/stock-monitor-electron')
    expect(packageJson.homepage).toBe('https://github.com/woodwen/StockMonitor#readme')
    expect(packageJson.repository.url).toBe('git+https://github.com/woodwen/StockMonitor.git')
    expect(executableName).toBe('stock-monitor')
    expect(executableName).toMatch(appImageSafePathPattern)
    expect(executableName).not.toContain('@')
    expect(executableName).not.toContain('/')
  })

  it('configures custom app icons for all desktop targets', () => {
    expect(packageJson.build.extraResources).toContainEqual({
      from: 'build/icon.png',
      to: 'icon.png'
    })
    expect(packageJson.build.mac.icon).toBe('build/icon.icns')
    expect(packageJson.build.win.icon).toBe('build/icon.ico')
    expect(packageJson.build.linux.icon).toBe('build/icon.png')

    for (const iconPath of ['build/icon.png', 'build/icon.icns', 'build/icon.ico']) {
      expect(existsSync(new URL(`../${iconPath}`, import.meta.url))).toBe(true)
    }
  })
})
