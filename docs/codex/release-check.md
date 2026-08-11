# Stock Monitor Release Check

Perform a read-only release readiness review for this repository.

## Required Checks

Inspect:

- `package.json`
- `CHANGELOG.md`
- `.github/workflows/release.yml`
- `scripts/check-release-version.mjs`
- `scripts/extract-changelog-release-notes.mjs`
- `tests/release-version.test.mjs`
- `tests/changelog-release-notes.test.mjs`

## Review Criteria

Confirm:

- `package.json.version` has a matching `CHANGELOG.md` section.
- The matching changelog section is non-empty.
- Release notes extraction still supports the current changelog format.
- The release workflow still runs typecheck, tests, changelog validation, and
  build before publishing.
- GitHub Release creation still uses extracted release notes.
- GitHub Release artifacts still include macOS DMG/ZIP, Windows EXE, Linux
  AppImage, and update metadata where applicable.
- electron-builder publish config still targets GitHub Releases for
  `woodwen/StockMonitor`.
- GitHub Package publishing remains after release artifact creation.

## Output Format

Return:

1. Blocking release issues.
2. Non-blocking risks.
3. Changelog/version status.
4. Suggested commands to verify locally.
5. Final go/no-go recommendation.
