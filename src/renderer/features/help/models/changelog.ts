export interface ChangelogItem {
  text: string
}

export interface ChangelogGroup {
  title: string
  items: ChangelogItem[]
}

export interface ChangelogVersionEntry {
  id: string
  title: string
  version: string
  date?: string
  current: boolean
  groups: ChangelogGroup[]
}

const currentVersionHeadingPattern = /^##\s+Unreleased\s*\/\s*([0-9]+\.[0-9]+\.[0-9]+)\s*$/
const releasedVersionHeadingPattern = /^##\s+v([0-9]+\.[0-9]+\.[0-9]+)\s+-\s+(\d{4}-\d{2}-\d{2})\s*$/
const groupHeadingPattern = /^###\s+(.+?)\s*$/
const listItemPattern = /^-\s+(.+?)\s*$/

export function parseChangelog(markdown: string): ChangelogVersionEntry[] {
  const entries: ChangelogVersionEntry[] = []
  let currentEntry: ChangelogVersionEntry | null = null
  let currentGroup: ChangelogGroup | null = null

  markdown.split(/\r?\n/).forEach((line) => {
    const trimmedLine = line.trim()

    const versionEntry = parseVersionHeading(trimmedLine)
    if (versionEntry) {
      currentEntry = versionEntry
      currentGroup = null
      entries.push(currentEntry)
      return
    }

    if (!currentEntry) {
      return
    }

    const groupHeading = groupHeadingPattern.exec(trimmedLine)
    if (groupHeading) {
      currentGroup = {
        title: groupHeading[1],
        items: []
      }
      currentEntry.groups.push(currentGroup)
      return
    }

    const listItem = listItemPattern.exec(trimmedLine)
    if (listItem && currentGroup) {
      currentGroup.items.push({ text: listItem[1] })
    }
  })

  return entries.filter((entry) => entry.groups.some((group) => group.items.length > 0))
}

function parseVersionHeading(line: string): ChangelogVersionEntry | null {
  const currentMatch = currentVersionHeadingPattern.exec(line)
  if (currentMatch) {
    const version = currentMatch[1]
    return {
      id: createEntryId('current', version),
      title: `当前版本 ${version}`,
      version,
      current: true,
      groups: []
    }
  }

  const releasedMatch = releasedVersionHeadingPattern.exec(line)
  if (releasedMatch) {
    const version = releasedMatch[1]
    return {
      id: createEntryId('v', version),
      title: `v${version}`,
      version,
      date: releasedMatch[2],
      current: false,
      groups: []
    }
  }

  return null
}

function createEntryId(prefix: string, version: string): string {
  return `${prefix}-${version.replaceAll('.', '-')}`
}
