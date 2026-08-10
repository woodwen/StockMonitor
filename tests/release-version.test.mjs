import { describe, expect, it } from 'vitest'
import {
  compareStableVersions,
  findLatestStableReleaseVersion,
  getReleaseDecision,
  getStableReleaseVersion,
  parseStableVersion
} from '../scripts/check-release-version.mjs'

function release(tagName, overrides = {}) {
  return {
    tag_name: tagName,
    draft: false,
    prerelease: false,
    ...overrides
  }
}

describe('release version decision', () => {
  it('parses stable semver only', () => {
    expect(parseStableVersion('1.2.3')).toEqual({ raw: '1.2.3', major: 1, minor: 2, patch: 3 })
    expect(parseStableVersion('1.2.3-beta.1')).toBeNull()
    expect(parseStableVersion('01.2.3')).toBeNull()
    expect(parseStableVersion('v1.2.3')).toBeNull()
  })

  it('compares stable semver values', () => {
    expect(compareStableVersions('0.1.1', '0.1.0')).toBe(1)
    expect(compareStableVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareStableVersions('0.0.9', '0.1.0')).toBe(-1)
    expect(compareStableVersions('1.0.0', '0.9.9')).toBe(1)
  })

  it('extracts stable release versions from v-prefixed tags', () => {
    expect(getStableReleaseVersion(release('v0.1.0'))).toBe('0.1.0')
    expect(getStableReleaseVersion(release('0.1.0'))).toBeNull()
    expect(getStableReleaseVersion(release('v0.1.0-beta.1'))).toBeNull()
    expect(getStableReleaseVersion(release('v0.1.0', { draft: true }))).toBeNull()
    expect(getStableReleaseVersion(release('v0.1.0', { prerelease: true }))).toBeNull()
  })

  it('finds the latest stable release while ignoring draft and prerelease entries', () => {
    expect(
      findLatestStableReleaseVersion([
        release('v0.1.0'),
        release('v0.3.0', { prerelease: true }),
        release('v0.2.0', { draft: true }),
        release('v0.1.2'),
        release('not-a-version')
      ])
    ).toBe('0.1.2')
  })

  it('uses 0.0.0 when no stable release exists', () => {
    expect(findLatestStableReleaseVersion([release('v1.0.0-beta.1')])).toBe('0.0.0')
  })

  it('releases only when the package version is higher than the latest stable release', () => {
    expect(
      getReleaseDecision({
        currentVersion: '0.1.1',
        releases: [release('v0.1.0')]
      })
    ).toMatchObject({
      shouldRelease: true,
      version: '0.1.1',
      tag: 'v0.1.1',
      latestVersion: '0.1.0'
    })

    expect(
      getReleaseDecision({
        currentVersion: '0.1.0',
        releases: [release('v0.1.0')]
      }).shouldRelease
    ).toBe(false)

    expect(
      getReleaseDecision({
        currentVersion: '0.0.9',
        releases: [release('v0.1.0')]
      }).shouldRelease
    ).toBe(false)
  })

  it('releases the first stable package version when no stable release exists', () => {
    expect(
      getReleaseDecision({
        currentVersion: '0.1.0',
        releases: []
      })
    ).toMatchObject({
      shouldRelease: true,
      latestVersion: '0.0.0'
    })
  })

  it('rejects non-stable package versions', () => {
    expect(() =>
      getReleaseDecision({
        currentVersion: '1.0.0-beta.1',
        releases: []
      })
    ).toThrow('package version must be a stable semver')

    expect(() =>
      getReleaseDecision({
        currentVersion: 'not-a-version',
        releases: []
      })
    ).toThrow('package version must be a stable semver')
  })
})
