# Stock Monitor Feature Task

Use this prompt when asking Codex to implement a feature or behavior change in
this repository. New requirements should use OpenSpec first.

## Required Context

Before editing, read:

- `AGENTS.md`
- `README.md`
- The relevant active OpenSpec change artifacts:
  - `openspec/changes/<change>/proposal.md`
  - `openspec/changes/<change>/design.md`
  - `openspec/changes/<change>/tasks.md`
  - `openspec/changes/<change>/specs/**/spec.md`
- The relevant `docs/spec/feature/YYYYMM/DD-topic/plan.md`, only when the task
  explicitly continues a legacy archived plan
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

- For user-facing features, behavior changes, release behavior changes, or
  architecture-significant work, update the active OpenSpec change first.
- OpenSpec proposal, design, tasks, and specs should use Simplified Chinese
  prose by default.
- Preserve OpenSpec structural keywords in English, including
  `ADDED Requirements`, `MODIFIED Requirements`, `REMOVED Requirements`,
  `Requirement`, `Scenario`, `WHEN`, and `THEN`.
- Keep capability ids, file paths, commands, APIs, package names, and code
  identifiers in their stable English form.
- Treat `docs/spec/feature/YYYYMM/DD-topic` as historical archive material.
  Only update it when explicitly continuing a legacy archived plan.
- After implementation, use `project-commit-pr` to generate local PR markdown.
  If an active OpenSpec change exists, the PR markdown should live under
  `openspec/changes/<change>/pr.md`.
- Update `CHANGELOG.md` under `Unreleased / <current package.json version>` when
  the change is user-facing or affects release behavior. Internal workflow-only
  OpenSpec or agent instruction changes do not require an app changelog entry.

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
- OpenSpec changes: `openspec validate <change> --strict`
- All OpenSpec validation when relevant: `openspec validate --all --strict`

## Final Response

Report:

- Changed files
- Important behavior changes
- Verification commands and results
- Any tests not run and why
