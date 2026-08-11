# Stock Monitor PR Review

Review the current changes in this repository. Prioritize correctness,
regressions, missing tests, release risks, and architecture boundary violations.

## Project-Specific Review Focus

Check these areas first:

- Electron boundary:
  - `src/main/` owns remote requests, IPC, settings, proxy, logging, and updates.
  - `src/preload/` exposes the typed bridge.
  - `src/renderer/` must not call remote stock APIs directly.
- Preload API consistency:
  - Changes to `StockApi` should be reflected in preload usage, adapters, and
    tests.
  - New IPC channels should have matching typed bridge methods when exposed to
    renderer code.
- Remote stock sources:
  - Source capabilities should match implementation, README, specs, and tests.
  - Fallback behavior should preserve clear error messages.
  - Proxy behavior should remain explicit and should not silently read system
    proxy environment variables.
- Workspace behavior:
  - K-line and timeshare source selection should remain independent.
  - Timeshare auto-refresh should not leak timers or overwrite stale requests.
  - ViewModel changes should preserve persistence behavior.
- Indicators and charting:
  - Indicator calculations should stay in pure model code.
  - Chart adapters should not own business rules.
- Release flow:
  - `CHANGELOG.md` should contain an entry for user-facing changes.
  - `package.json.version` should match the top unreleased changelog section when
    preparing a release.
  - Release workflow changes should preserve typecheck, tests, build, artifact
    upload, and changelog release notes extraction.
- Product safety:
  - Flag investment advice, buy/sell recommendations, profit promises, or
    similar claims in user-facing text.

## Output Format

Return the review in this order:

1. Findings, ordered by severity, with file and line references when available.
2. Missing or weak tests.
3. Release or changelog impact.
4. Suggested minimal fixes.
5. Residual risk.

If there are no findings, say so clearly and still mention any remaining test
gaps or unverified areas.
