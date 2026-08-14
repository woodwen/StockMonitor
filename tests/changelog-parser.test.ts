import { describe, expect, it } from 'vitest'
import { parseChangelog } from '../src/renderer/features/help/models/changelog'

describe('changelog parser', () => {
  it('parses the unreleased heading as the current version', () => {
    const entries = parseChangelog(`## Unreleased / 0.1.7

### Added

- Add help version updates.
`)

    expect(entries).toEqual([
      {
        id: 'current-0-1-7',
        title: '当前版本 0.1.7',
        version: '0.1.7',
        current: true,
        groups: [
          {
            title: 'Added',
            items: [{ text: 'Add help version updates.' }]
          }
        ]
      }
    ])
  })

  it('parses released headings with dates', () => {
    const entries = parseChangelog(`## v0.1.3 - 2026-08-11

### Fixed

- Fix update downloads.
`)

    expect(entries[0]).toEqual({
      id: 'v-0-1-3',
      title: 'v0.1.3',
      version: '0.1.3',
      date: '2026-08-11',
      current: false,
      groups: [
        {
          title: 'Fixed',
          items: [{ text: 'Fix update downloads.' }]
        }
      ]
    })
  })

  it('preserves groups and item text', () => {
    const entries = parseChangelog(`# Changelog

## Unreleased / 0.1.7

### Added

- Add \`版本更新说明\`.

### Changed

- Update menu order.

### Fixed

- Fix parser fallback.

### Build

- Keep bundle stable.

### Docs

- Update README.
`)

    expect(entries[0].groups).toEqual([
      {
        title: 'Added',
        items: [{ text: 'Add `版本更新说明`.' }]
      },
      {
        title: 'Changed',
        items: [{ text: 'Update menu order.' }]
      },
      {
        title: 'Fixed',
        items: [{ text: 'Fix parser fallback.' }]
      },
      {
        title: 'Build',
        items: [{ text: 'Keep bundle stable.' }]
      },
      {
        title: 'Docs',
        items: [{ text: 'Update README.' }]
      }
    ])
  })

  it('returns an empty list when no version entries exist', () => {
    expect(parseChangelog('')).toEqual([])
    expect(parseChangelog('# Changelog\n\n### Added\n\n- Nothing versioned.')).toEqual([])
  })
})
