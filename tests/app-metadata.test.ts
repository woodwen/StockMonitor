import { describe, expect, it } from 'vitest'
import { formatVersionedAppTitle } from '../src/main/app-metadata'

describe('app metadata', () => {
  it('formats the window title with the app version', () => {
    expect(formatVersionedAppTitle('0.1.3')).toBe('Stock Monitor v0.1.3')
  })

  it('falls back to the app name when the version is unavailable', () => {
    expect(formatVersionedAppTitle('')).toBe('Stock Monitor')
    expect(formatVersionedAppTitle('   ')).toBe('Stock Monitor')
  })
})
