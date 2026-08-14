#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const RELEASE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const MAX_MINOR_OR_PATCH = 100

export function parseBoundedVersion(version, label = 'version') {
  if (typeof version !== 'string') {
    throw new Error(`${label} must be a stable semver in X.Y.Z format: ${version}`)
  }

  const match = version.match(STABLE_VERSION_PATTERN)
  if (!match) {
    throw new Error(`${label} must be a stable semver in X.Y.Z format: ${version}`)
  }

  const [major, minor, patch] = version.split('.').map((part) => Number(part))
  if (minor > MAX_MINOR_OR_PATCH || patch > MAX_MINOR_OR_PATCH) {
    throw new Error(`${label} minor and patch must be between 0 and 100: ${version}`)
  }

  return { raw: version, major, minor, patch }
}

export function compareBoundedVersions(left, right) {
  const parsedLeft = parseBoundedVersion(left, 'left version')
  const parsedRight = parseBoundedVersion(right, 'right version')

  for (const key of ['major', 'minor', 'patch']) {
    if (parsedLeft[key] > parsedRight[key]) {
      return 1
    }
    if (parsedLeft[key] < parsedRight[key]) {
      return -1
    }
  }

  return 0
}

export function getNextDevVersion(version) {
  const parsed = parseBoundedVersion(version)

  if (parsed.patch < MAX_MINOR_OR_PATCH) {
    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`
  }

  if (parsed.minor < MAX_MINOR_OR_PATCH) {
    return `${parsed.major}.${parsed.minor + 1}.0`
  }

  return `${parsed.major + 1}.0.0`
}

export function archiveReleasedChangelogVersion(markdown, releasedVersion, nextVersion, releaseDate) {
  parseBoundedVersion(releasedVersion, 'released version')
  parseBoundedVersion(nextVersion, 'next version')
  assertReleaseDate(releaseDate)

  if (typeof markdown !== 'string') {
    throw new Error('CHANGELOG content must be a string')
  }

  const firstVersionHeading = markdown.match(/^##\s+(.+)$/m)
  if (!firstVersionHeading || typeof firstVersionHeading.index !== 'number') {
    throw new Error('CHANGELOG.md must contain an Unreleased version heading')
  }

  const expectedHeadingPattern = new RegExp(
    `^##\\s+Unreleased\\s*/\\s*${escapeRegExp(releasedVersion)}\\s*$`
  )
  if (!expectedHeadingPattern.test(firstVersionHeading[0])) {
    throw new Error(`CHANGELOG.md must start with Unreleased / ${releasedVersion}`)
  }

  const contentStart = firstVersionHeading.index
  const contentEnd = contentStart + firstVersionHeading[0].length
  return `${markdown.slice(0, contentStart)}## Unreleased / ${nextVersion}

## v${releasedVersion} - ${releaseDate}${markdown.slice(contentEnd)}`
}

export function prepareNextDevVersion({
  packageJsonPath = resolve(process.cwd(), 'package.json'),
  changelogPath = resolve(process.cwd(), 'CHANGELOG.md'),
  releasedVersion,
  releaseDate = getCurrentDateString()
} = {}) {
  parseBoundedVersion(releasedVersion, 'released version')
  assertReleaseDate(releaseDate)

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  const devVersion = packageJson.version
  parseBoundedVersion(devVersion, 'dev package version')

  const comparison = compareBoundedVersions(devVersion, releasedVersion)
  if (comparison > 0) {
    return {
      changed: false,
      version: devVersion,
      nextVersion: devVersion,
      releasedVersion,
      reason: `dev package version ${devVersion} is already higher than released version ${releasedVersion}`
    }
  }

  if (comparison < 0) {
    throw new Error(
      `dev package version ${devVersion} is lower than released version ${releasedVersion}; sync dev before preparing the next version`
    )
  }

  const nextVersion = getNextDevVersion(releasedVersion)
  const changelog = readFileSync(changelogPath, 'utf8')
  const nextChangelog = archiveReleasedChangelogVersion(
    changelog,
    releasedVersion,
    nextVersion,
    releaseDate
  )
  const nextPackageJson = {
    ...packageJson,
    version: nextVersion
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(nextPackageJson, null, 2)}\n`)
  writeFileSync(changelogPath, nextChangelog)

  return {
    changed: true,
    version: devVersion,
    nextVersion,
    releasedVersion,
    reason: `prepared next dev version ${nextVersion}`
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function assertReleaseDate(value) {
  if (typeof value !== 'string' || !RELEASE_DATE_PATTERN.test(value)) {
    throw new Error(`release date must be in YYYY-MM-DD format: ${value}`)
  }
}

function getCurrentDateString() {
  return new Date().toISOString().slice(0, 10)
}

function parseArgs(argv) {
  const options = {
    packageJsonPath: resolve(process.cwd(), 'package.json'),
    changelogPath: resolve(process.cwd(), 'CHANGELOG.md'),
    releasedVersion: undefined,
    releaseDate: getCurrentDateString()
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--released-version') {
      options.releasedVersion = requiredValue(argv, (index += 1), arg)
    } else if (arg === '--release-date') {
      options.releaseDate = requiredValue(argv, (index += 1), arg)
    } else if (arg === '--package') {
      options.packageJsonPath = resolveRequiredValue(argv, (index += 1), arg)
    } else if (arg === '--changelog') {
      options.changelogPath = resolveRequiredValue(argv, (index += 1), arg)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (!options.releasedVersion) {
    throw new Error('--released-version requires a value')
  }

  return options
}

function resolveRequiredValue(argv, index, label) {
  return resolve(process.cwd(), requiredValue(argv, index, label))
}

function requiredValue(argv, index, label) {
  const value = argv[index]
  if (!value || value.startsWith('--')) {
    throw new Error(`${label} requires a value`)
  }
  return value
}

function writeGithubOutputs(result, outputPath) {
  const lines = [
    `changed=${result.changed ? 'true' : 'false'}`,
    `version=${result.version}`,
    `next_version=${result.nextVersion}`
  ]

  appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

function main() {
  const result = prepareNextDevVersion(parseArgs(process.argv.slice(2)))

  if (process.env.GITHUB_OUTPUT) {
    writeGithubOutputs(result, process.env.GITHUB_OUTPUT)
  } else {
    console.log(JSON.stringify(result, null, 2))
  }

  console.error(result.reason)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
