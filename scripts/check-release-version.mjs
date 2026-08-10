#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const STABLE_RELEASE_TAG_PATTERN = /^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/
const DEFAULT_LATEST_VERSION = '0.0.0'

export function parseStableVersion(version) {
  if (typeof version !== 'string') {
    return null
  }

  const match = version.match(STABLE_VERSION_PATTERN)
  if (!match) {
    return null
  }

  const [major, minor, patch] = version.split('.').map((part) => Number(part))
  return { raw: version, major, minor, patch }
}

export function compareStableVersions(left, right) {
  const parsedLeft = assertStableVersion(left, 'left version')
  const parsedRight = assertStableVersion(right, 'right version')

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

export function getStableReleaseVersion(release) {
  if (!release || release.draft || release.prerelease) {
    return null
  }

  const tagName = typeof release.tag_name === 'string' ? release.tag_name : ''
  const match = tagName.match(STABLE_RELEASE_TAG_PATTERN)
  return match ? match[1] : null
}

export function findLatestStableReleaseVersion(releases) {
  let latestVersion = DEFAULT_LATEST_VERSION

  for (const release of releases) {
    const releaseVersion = getStableReleaseVersion(release)
    if (releaseVersion && compareStableVersions(releaseVersion, latestVersion) > 0) {
      latestVersion = releaseVersion
    }
  }

  return latestVersion
}

export function getReleaseDecision({ currentVersion, releases }) {
  assertStableVersion(currentVersion, 'package version')

  const latestVersion = findLatestStableReleaseVersion(releases)
  const shouldRelease = compareStableVersions(currentVersion, latestVersion) > 0

  return {
    shouldRelease,
    version: currentVersion,
    tag: `v${currentVersion}`,
    latestVersion
  }
}

export function readPackageVersion(packageJsonPath = resolve(process.cwd(), 'package.json')) {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
  return packageJson.version
}

export async function fetchGithubReleases(repository, token) {
  if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must be in owner/repo format')
  }

  const releases = []
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'stock-monitor-release-check',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  for (let page = 1; page <= 10; page += 1) {
    const response = await fetch(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      { headers }
    )

    if (response.status === 404) {
      return []
    }

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Failed to fetch GitHub releases: ${response.status} ${body}`)
    }

    const pageReleases = await response.json()
    if (!Array.isArray(pageReleases)) {
      throw new Error('GitHub releases response must be an array')
    }

    releases.push(...pageReleases)
    if (pageReleases.length < 100) {
      break
    }
  }

  return releases
}

function assertStableVersion(version, label) {
  const parsed = parseStableVersion(version)
  if (!parsed) {
    throw new Error(`${label} must be a stable semver in X.Y.Z format: ${version}`)
  }
  return parsed
}

function writeGithubOutputs(decision, outputPath) {
  const lines = [
    `should_release=${decision.shouldRelease ? 'true' : 'false'}`,
    `version=${decision.version}`,
    `tag=${decision.tag}`,
    `latest_version=${decision.latestVersion}`
  ]

  appendFileSync(outputPath, `${lines.join('\n')}\n`)
}

async function main() {
  const version = readPackageVersion()
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  const releases = await fetchGithubReleases(repository, token)
  const decision = getReleaseDecision({ currentVersion: version, releases })

  if (process.env.GITHUB_OUTPUT) {
    writeGithubOutputs(decision, process.env.GITHUB_OUTPUT)
  } else {
    console.log(JSON.stringify(decision, null, 2))
  }

  console.error(
    `Release decision: current=${decision.version}, latest=${decision.latestVersion}, should_release=${decision.shouldRelease}`
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
