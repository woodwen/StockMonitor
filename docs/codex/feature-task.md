# Stock Monitor Feature Task

Use this prompt when asking Codex to implement a feature or behavior change in
this repository.

## Required Context

Before editing, read:

- `AGENTS.md`
- `README.md`
- The relevant `docs/spec/feature/YYYYMM/DD-topic/plan.md`, if one exists
- The source files most directly related to the request
- The closest tests under `tests/`

## Implementation Rules

- Keep the Electron main/preload/renderer boundary intact.
- Do not fetch remote stock data directly from renderer code.
- Route renderer access through the preload `window.stockApi` typed bridge.
- Keep React views focused on rendering and user events.
- Keep orchestration and persistence in MobX view models.
- Keep indicator and parsing logic testable as model or main-process code.
- Avoid broad refactors unless the task requires them.

## Documentation Rules

- For user-facing features or behavior changes, update or create a feature plan
  under `docs/spec/feature/YYYYMM/DD-topic/plan.md`.
- After implementation, update or create the matching `pr.md`.
- Update `CHANGELOG.md` under `Unreleased / <current package.json version>` when
  the change is user-facing or affects release behavior.

## Verification

Choose the smallest validation set that covers the risk:

- Normal code changes: `yarn typecheck` and `yarn test`
- Remote source changes: `yarn test tests/remote-stock-sources.test.ts`
- Workspace state changes: `yarn test tests/stock-workspace-view-model.test.ts`
- IPC changes: `yarn test tests/ipc-handlers.test.ts`
- Release or changelog changes:
  - `yarn test tests/release-version.test.mjs`
  - `yarn test tests/changelog-release-notes.test.mjs`
- Electron packaging or release changes: also run `yarn build`

## Final Response

Report:

- Changed files
- Important behavior changes
- Verification commands and results
- Any tests not run and why
