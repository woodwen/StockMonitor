import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  archiveReleasedChangelogVersion,
  compareBoundedVersions,
  getNextDevVersion,
  parseBoundedVersion,
  prepareNextDevVersion
} from '../scripts/prepare-next-dev-version.mjs'

const tempDirs = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), { recursive: true, force: true })
  }
})

function createTempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'stock-monitor-next-version-'))
  tempDirs.push(dir)
  return dir
}

function changelog(version) {
  return `# Changelog

本文件记录每个版本的主要更新内容。

## Unreleased / ${version}

### Build

- Pending build note.

## v0.1.3 - 2026-08-11

### Fixed

- Previous note.
`
}

function createTempProject({ version = '0.1.4', changelogVersion = version } = {}) {
  const dir = createTempDir()
  const packageJsonPath = join(dir, 'package.json')
  const changelogPath = join(dir, 'CHANGELOG.md')

  writeFileSync(
    packageJsonPath,
    `${JSON.stringify({ name: '@woodwen/stock-monitor-electron', version }, null, 2)}\n`
  )
  writeFileSync(changelogPath, changelog(changelogVersion))

  return { changelogPath, packageJsonPath }
}

function readPackageVersion(packageJsonPath) {
  return JSON.parse(readFileSync(packageJsonPath, 'utf8')).version
}

describe('next dev version preparation', () => {
  it('parses only stable versions with bounded minor and patch components', () => {
    expect(parseBoundedVersion('1.2.3')).toEqual({ raw: '1.2.3', major: 1, minor: 2, patch: 3 })
    expect(() => parseBoundedVersion('1.2.3-beta.1')).toThrow('stable semver')
    expect(() => parseBoundedVersion('1.101.0')).toThrow('between 0 and 100')
    expect(() => parseBoundedVersion('1.0.101')).toThrow('between 0 and 100')
  })

  it('compares bounded stable versions', () => {
    expect(compareBoundedVersions('0.1.100', '0.2.0')).toBe(-1)
    expect(compareBoundedVersions('0.2.0', '0.1.100')).toBe(1)
    expect(compareBoundedVersions('1.0.0', '0.100.100')).toBe(1)
    expect(compareBoundedVersions('0.1.4', '0.1.4')).toBe(0)
  })

  it('increments patch until the patch component reaches 100', () => {
    expect(getNextDevVersion('0.1.4')).toBe('0.1.5')
    expect(getNextDevVersion('0.1.99')).toBe('0.1.100')
  })

  it('rolls patch 100 into the next minor version', () => {
    expect(getNextDevVersion('0.1.100')).toBe('0.2.0')
  })

  it('rolls minor 100 and patch 100 into the next major version', () => {
    expect(getNextDevVersion('0.100.100')).toBe('1.0.0')
  })

  it('updates package version, archives released notes, and creates the next unreleased heading', () => {
    const { changelogPath, packageJsonPath } = createTempProject({ version: '0.1.4' })

    expect(
      prepareNextDevVersion({
        changelogPath,
        packageJsonPath,
        releasedVersion: '0.1.4',
        releaseDate: '2026-08-11'
      })
    ).toEqual({
      changed: true,
      version: '0.1.4',
      nextVersion: '0.1.5',
      releasedVersion: '0.1.4',
      reason: 'prepared next dev version 0.1.5'
    })

    expect(readPackageVersion(packageJsonPath)).toBe('0.1.5')
    expect(readFileSync(changelogPath, 'utf8')).toBe(`# Changelog

本文件记录每个版本的主要更新内容。

## Unreleased / 0.1.5

## v0.1.4 - 2026-08-11

### Build

- Pending build note.

## v0.1.3 - 2026-08-11

### Fixed

- Previous note.
`)
  })

  it('skips when the dev package version is already higher than the released version', () => {
    const { changelogPath, packageJsonPath } = createTempProject({ version: '0.2.0' })

    expect(
      prepareNextDevVersion({
        changelogPath,
        packageJsonPath,
        releasedVersion: '0.1.100'
      })
    ).toMatchObject({
      changed: false,
      version: '0.2.0',
      nextVersion: '0.2.0',
      releasedVersion: '0.1.100'
    })

    expect(readPackageVersion(packageJsonPath)).toBe('0.2.0')
    expect(readFileSync(changelogPath, 'utf8')).toContain('## Unreleased / 0.2.0')
  })

  it('throws when the dev package version is lower than the released version', () => {
    const { changelogPath, packageJsonPath } = createTempProject({ version: '0.1.3' })

    expect(() =>
      prepareNextDevVersion({
        changelogPath,
        packageJsonPath,
        releasedVersion: '0.1.4'
      })
    ).toThrow('dev package version 0.1.3 is lower than released version 0.1.4')

    expect(readPackageVersion(packageJsonPath)).toBe('0.1.3')
  })

  it('throws without modifying files when the matching top changelog heading is missing', () => {
    const { changelogPath, packageJsonPath } = createTempProject({
      version: '0.1.4',
      changelogVersion: '0.1.3'
    })

    expect(() =>
      prepareNextDevVersion({
        changelogPath,
        packageJsonPath,
        releasedVersion: '0.1.4'
      })
    ).toThrow('CHANGELOG.md must start with Unreleased / 0.1.4')

    expect(readPackageVersion(packageJsonPath)).toBe('0.1.4')
    expect(readFileSync(changelogPath, 'utf8')).toContain('## Unreleased / 0.1.3')
  })

  it('throws without modifying files when the release date is invalid', () => {
    const { changelogPath, packageJsonPath } = createTempProject({ version: '0.1.4' })

    expect(() =>
      prepareNextDevVersion({
        changelogPath,
        packageJsonPath,
        releasedVersion: '0.1.4',
        releaseDate: '2026/08/11'
      })
    ).toThrow('release date must be in YYYY-MM-DD format')

    expect(readPackageVersion(packageJsonPath)).toBe('0.1.4')
    expect(readFileSync(changelogPath, 'utf8')).toContain('## Unreleased / 0.1.4')
  })

  it('archives only the first version heading in the changelog', () => {
    const markdown = `# Changelog

## Unreleased / 0.1.4

- Pending note.

## Unreleased / 0.1.4

- Historical malformed note.
`

    expect(archiveReleasedChangelogVersion(markdown, '0.1.4', '0.1.5', '2026-08-11')).toBe(`# Changelog

## Unreleased / 0.1.5

## v0.1.4 - 2026-08-11

- Pending note.

## Unreleased / 0.1.4

- Historical malformed note.
`)
  })
})
