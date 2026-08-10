import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const appImageSafePathPattern = /^[\p{L}\p{N}._\- ]+$/u

describe('package build config', () => {
  it('uses a safe Linux executable name for AppImage packaging', () => {
    const executableName = packageJson.build.linux.executableName

    expect(packageJson.name).toBe('@woodwen/stock-monitor-electron')
    expect(executableName).toBe('stock-monitor')
    expect(executableName).toMatch(appImageSafePathPattern)
    expect(executableName).not.toContain('@')
    expect(executableName).not.toContain('/')
  })
})
