#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function extractChangelogSection(markdown, version) {
  assertStableVersion(version)

  if (typeof markdown !== 'string') {
    throw new Error('CHANGELOG content must be a string')
  }

  const formalHeadingPattern = new RegExp(
    `^##\\s+v${escapeRegExp(version)}\\s+-\\s+\\d{4}-\\d{2}-\\d{2}\\s*$`,
    'm'
  )
  const unreleasedHeadingPattern = new RegExp(
    `^##\\s+Unreleased\\s*/\\s*${escapeRegExp(version)}\\s*$`,
    'm'
  )

  const headingMatch = markdown.match(formalHeadingPattern) ?? markdown.match(unreleasedHeadingPattern)
  if (!headingMatch || typeof headingMatch.index !== 'number') {
    throw new Error(`CHANGELOG.md must contain notes for version ${version}`)
  }

  const contentStart = headingMatch.index + headingMatch[0].length
  const nextHeadingIndex = markdown.slice(contentStart).search(/^##\s+/m)
  const contentEnd = nextHeadingIndex === -1 ? markdown.length : contentStart + nextHeadingIndex
  const notes = markdown.slice(contentStart, contentEnd).trim()

  if (!notes) {
    throw new Error(`CHANGELOG.md notes for version ${version} must not be empty`)
  }

  return notes
}

export function readPackageVersion(packageJsonPath = resolve(process.cwd(), 'package.json')) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  return packageJson.version
}

export function readChangelogReleaseNotes({
  changelogPath = resolve(process.cwd(), 'CHANGELOG.md'),
  packageJsonPath = resolve(process.cwd(), 'package.json'),
  version = readPackageVersion(packageJsonPath)
} = {}) {
  const changelog = readFileSync(changelogPath, 'utf8')
  return {
    version,
    notes: extractChangelogSection(changelog, version)
  }
}

export function writeReleaseNotes({
  changelogPath = resolve(process.cwd(), 'CHANGELOG.md'),
  packageJsonPath = resolve(process.cwd(), 'package.json'),
  outputPath = resolve(process.cwd(), 'release-notes.md'),
  version
} = {}) {
  const result = readChangelogReleaseNotes({ changelogPath, packageJsonPath, version })
  writeFileSync(outputPath, `${result.notes}\n`)
  return result
}

function assertStableVersion(version) {
  if (typeof version !== 'string' || !STABLE_VERSION_PATTERN.test(version)) {
    throw new Error(`version must be a stable semver in X.Y.Z format: ${version}`)
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseArgs(argv) {
  const options = {
    check: false,
    changelogPath: resolve(process.cwd(), 'CHANGELOG.md'),
    packageJsonPath: resolve(process.cwd(), 'package.json'),
    outputPath: resolve(process.cwd(), 'release-notes.md'),
    version: undefined
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--check') {
      options.check = true
    } else if (arg === '--changelog') {
      options.changelogPath = resolveRequiredValue(argv, (index += 1), arg)
    } else if (arg === '--package') {
      options.packageJsonPath = resolveRequiredValue(argv, (index += 1), arg)
    } else if (arg === '--output') {
      options.outputPath = resolveRequiredValue(argv, (index += 1), arg)
    } else if (arg === '--version') {
      options.version = requiredValue(argv, (index += 1), arg)
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
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

function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = options.check
    ? readChangelogReleaseNotes(options)
    : writeReleaseNotes(options)

  console.error(
    `Changelog release notes ${options.check ? 'validated' : 'written'} for v${result.version}`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
