import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  extractChangelogSection,
  readPackageVersion,
  writeReleaseNotes
} from '../scripts/extract-changelog-release-notes.mjs'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function changelog(body) {
  return `# Changelog

${body}`
}

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'stock-monitor-changelog-'))
  tempDirs.push(dir)
  return dir
}

describe('changelog release notes extraction', () => {
  it('extracts formal version notes before unreleased notes for the same version', () => {
    const markdown = changelog(`## Unreleased / 0.1.2

### Changed

- Draft note.

## v0.1.2 - 2026-08-11

### Fixed

- Release note.

## v0.1.1 - 2026-08-10

### Changed

- Previous note.
`)

    expect(extractChangelogSection(markdown, '0.1.2')).toBe(`### Fixed

- Release note.`)
  })

  it('falls back to unreleased notes when formal version notes do not exist', () => {
    const markdown = changelog(`## Unreleased / 0.1.2

### Changed

- Pending note.

## v0.1.1 - 2026-08-10

### Changed

- Previous note.
`)

    expect(extractChangelogSection(markdown, '0.1.2')).toBe(`### Changed

- Pending note.`)
  })

  it('stops extraction at the next version heading', () => {
    const markdown = changelog(`## v0.1.2 - 2026-08-11

### Added

- First note.

## v0.1.1 - 2026-08-10

### Fixed

- Previous note.
`)

    expect(extractChangelogSection(markdown, '0.1.2')).not.toContain('Previous note')
  })

  it('throws when the matching version heading is missing', () => {
    const markdown = changelog(`## v0.1.1 - 2026-08-10

### Changed

- Previous note.
`)

    expect(() => extractChangelogSection(markdown, '0.1.2')).toThrow(
      'CHANGELOG.md must contain notes for version 0.1.2'
    )
  })

  it('throws when the matching version notes are empty', () => {
    const markdown = changelog(`## v0.1.2 - 2026-08-11

## v0.1.1 - 2026-08-10

### Changed

- Previous note.
`)

    expect(() => extractChangelogSection(markdown, '0.1.2')).toThrow(
      'CHANGELOG.md notes for version 0.1.2 must not be empty'
    )
  })

  it('rejects non-stable version input', () => {
    expect(() => extractChangelogSection('# Changelog', '0.1.2-beta.1')).toThrow(
      'version must be a stable semver'
    )
  })

  it('reads the package version and writes release notes to disk', () => {
    const dir = createTempDir()
    const packageJsonPath = join(dir, 'package.json')
    const changelogPath = join(dir, 'CHANGELOG.md')
    const outputPath = join(dir, 'release-notes.md')

    writeFileSync(packageJsonPath, JSON.stringify({ version: '0.1.2' }))
    writeFileSync(
      changelogPath,
      changelog(`## Unreleased / 0.1.2

### Build

- Use changelog release notes.
`)
    )

    expect(readPackageVersion(packageJsonPath)).toBe('0.1.2')
    expect(writeReleaseNotes({ changelogPath, packageJsonPath, outputPath })).toEqual({
      version: '0.1.2',
      notes: `### Build

- Use changelog release notes.`
    })
    expect(readFileSync(outputPath, 'utf8')).toBe(`### Build

- Use changelog release notes.
`)
  })
})
