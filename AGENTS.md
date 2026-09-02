# Stock Monitor Codex 指南

## 项目概览

Stock Monitor 是一个跨平台股票行情桌面应用，技术栈包括 Electron、React、
TypeScript、MobX、Ant Design、klinecharts、Vitest 和 electron-builder。
包管理器使用 Yarn 1。

## 架构规则

- `src/main/` 负责窗口、菜单、IPC handlers、远端行情源 adapter、持久化设置、
  网络代理、日志和应用更新。
- `src/preload/` 只暴露 typed bridge。Renderer 代码应通过 `window.stockApi`
  使用主进程能力。
- `src/renderer/` 不能直接请求远端行情接口。
- React View 只负责展示状态和触发用户命令。
- MobX ViewModel 负责状态、查询流程、编排、刷新行为和持久化触发。
- Model 负责纯业务逻辑，例如行情类型、指标定义和指标计算。
- Adapter 负责外部依赖，例如 Electron bridge、klinecharts 和 Canvas 绘制。

## 高风险文件

- `src/main/remote-stock-sources.ts`：行情源能力、HTTP 请求、解析逻辑、fallback
  行为和代理感知请求。
- `src/main/ipc.ts`：主进程 IPC 注册。
- `src/preload/stock-api.ts`：暴露给 renderer 的公开 typed API。
- `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：
  工作区状态、数据源切换、刷新流程、持久化和自动刷新。
- `.github/workflows/release.yml`：发布校验、打包、GitHub Release 和
  GitHub Package 发布。
- `scripts/extract-changelog-release-notes.mjs`：release notes 提取。
- `CHANGELOG.md`：用户可见 changelog，也是 GitHub Release notes 的来源。

## 验证命令

- 普通代码改动：运行 `yarn typecheck` 和 `yarn test`。
- 主进程、preload、Electron 配置、打包或发布相关改动：额外运行 `yarn build`。
- 远端行情源改动：运行 `yarn test tests/remote-stock-sources.test.ts`。
- 工作区 ViewModel 改动：运行
  `yarn test tests/stock-workspace-view-model.test.ts`。
- IPC 改动：运行 `yarn test tests/ipc-handlers.test.ts`。
- release 或 changelog 改动：运行
  `yarn test tests/release-version.test.mjs` 和
  `yarn test tests/changelog-release-notes.test.mjs`。

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for `woodwen/StockMonitor`; use `gh` and
follow `docs/agents/issue-tracker.md`.

### Triage labels

Use the default mattpocock/skills triage vocabulary: `needs-triage`,
`needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See
`docs/agents/triage-labels.md`.

### Domain docs

Use single-context domain docs: root `CONTEXT.md` and repo-level ADRs under
`docs/adr/`, created lazily when terms or decisions are resolved. See
`docs/agents/domain.md`.

## 文档规则

- 用户可见功能、行为变更、release 行为变更或架构重要改动，应优先通过
  OpenSpec change 规划和实施。
- OpenSpec proposal、design、tasks 和 specs 的正文默认使用简体中文。
  OpenSpec 结构关键字、capability id、文件路径、命令、API 和代码标识符
  保留英文稳定形式。
- `docs/spec/feature/YYYYMM/DD-topic` 是历史归档目录。除非任务明确延续
  已存在的 legacy plan，否则不再作为新规格默认落点。
- 实施 active OpenSpec change 前，应读取对应 proposal、design、tasks 和
  specs；更新后应运行 `openspec validate <change> --strict`。
- 本地 PR markdown 默认由 `project-commit-pr` 生成。存在 active OpenSpec
  change 时，优先写入 `openspec/changes/<change>/pr.md`。
- 用户可见变更应写入 `CHANGELOG.md` 中
  `Unreleased / <current package.json version>` 区块。
- 纯内部 workflow、agent instructions 或 OpenSpec 迁移变更不要求写入应用
  `CHANGELOG.md`。
- 发布流程以 `CHANGELOG.md` 作为 GitHub Release notes 来源。

## Code Review Rules

- 标记 renderer 中直接请求远端行情数据的改动。
- 标记新增或修改 IPC channel 但没有同步 preload 类型的改动。
- 标记修改 `StockApi` 但没有同步 adapter 和测试的改动。
- 标记行情源能力变化但没有同步 README、spec 或测试覆盖的改动。
- 标记用户可见行为变化但没有同步 OpenSpec specs 或测试覆盖的改动。
- 标记破坏 changelog release notes 校验的 release workflow 改动。
- 标记用户可见文案中的投资建议、买卖建议、收益承诺或类似表述。
- 优先做符合现有模块边界的聚焦改动，避免无必要的大范围重构。
