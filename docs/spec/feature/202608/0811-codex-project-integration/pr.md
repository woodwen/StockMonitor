# M-23(docs): 接入 Codex 项目工程指引

## 背景

当前项目已经具备较完整的 Electron 三端架构、功能规格文档、Vitest 覆盖、changelog 和 release workflow。为了让 Codex 后续参与功能开发、review 和发版检查时更稳定，需要先把项目工程规则沉淀到仓库内，而不是直接接入产品内 AI 或 CI 阻塞流程。

## 方案概述

本次按第一期方案落地工程侧 Codex 接入：

- 新增中文为主的根目录 `AGENTS.md`，提供项目架构、边界、验证命令、文档规则和 review 规则。
- 新增 `docs/codex/` 本地任务模板，供后续 `codex exec` 或人工 Codex 任务复用。
- 将版本号从 `0.1.3` 升级到 `0.1.4`。
- 新增 `CHANGELOG.md` 的 `Unreleased / 0.1.4` 区块，并把既有 `0.1.3` 内容归档为正式版本段落。

本次不接入 GitHub Action，不新增 OpenAI API 依赖，不修改产品 UI，不改业务代码。

## 实现改动

### Codex 项目指令

新增 `AGENTS.md`：

- 说明项目技术栈和 Yarn 1 包管理器。
- 固化 Electron `main`、`preload`、`renderer` 边界。
- 明确 View、ViewModel、Model、Adapter 分工。
- 说明性内容使用中文，路径、命令、API 名、类型名和包名保留英文。
- `## Code Review Rules` 标题保留英文，规则正文使用中文。
- 标记高风险文件：
  - `src/main/remote-stock-sources.ts`
  - `src/main/ipc.ts`
  - `src/preload/stock-api.ts`
  - `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`
  - `.github/workflows/release.yml`
  - `scripts/extract-changelog-release-notes.mjs`
  - `CHANGELOG.md`
- 增加按影响范围选择验证命令的规则。
- 增加项目级 code review rules。

### Codex 任务模板

新增 `docs/codex/feature-task.md`：

- 用于功能开发任务。
- 要求先阅读 `AGENTS.md`、README、相关 plan 和测试。
- 约束实现必须遵守 Electron 三端和 MVVM 边界。
- 明确文档和验证要求。

新增 `docs/codex/pr-review.md`：

- 用于 PR 或当前 diff review。
- 审查 Electron 边界、preload API、数据源能力、工作区状态、指标逻辑、release 流程和产品安全文案。
- 固定输出为 findings、missing tests、release impact、minimal fixes、residual risk。

新增 `docs/codex/release-check.md`：

- 用于发版前只读检查。
- 检查 `package.json`、`CHANGELOG.md`、release workflow、release 脚本和对应测试。
- 输出 blocking issues、non-blocking risks、version/changelog status、local verification commands 和 go/no-go。

### 版本与 changelog

- `package.json.version` 从 `0.1.3` 升级到 `0.1.4`。
- `CHANGELOG.md` 顶部新增 `Unreleased / 0.1.4`。
- 记录本次 Codex 工程接入文档和模板。
- 将既有 `Unreleased / 0.1.3` 归档为 `v0.1.3 - 2026-08-11`，避免 release notes 匹配混乱。

## 测试计划(UT)

本次主要是文档和版本元数据变更，没有修改运行时代码。

已执行并通过：

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`
- `node scripts/extract-changelog-release-notes.mjs --check`

虽然本次没有修改运行时代码，仍按本地提交流程运行完整 Node 项目检查。

## 影响范围

- 影响 Codex 读取项目上下文和后续任务执行质量。
- 影响下一次发版版本号和 changelog 顶部匹配版本。
- 不影响应用运行逻辑。
- 不影响行情数据请求。
- 不影响自动更新代码。
- 不影响 GitHub Actions release workflow。
- 不引入任何新依赖或 secret。

## 风险与后续

- `AGENTS.md` 和 prompt 模板需要在后续实际 Codex 任务中迭代，初版不应被视为最终规则。
- 后续如果接入 GitHub Action，应先只读 review 和只评论 PR，不作为 required check。
- 产品内 AI 功能仍需单独立项，重点处理 API key、成本、网络失败和投资建议合规边界。

## 验收标准

- 根目录存在 `AGENTS.md`。
- `docs/codex/feature-task.md`、`docs/codex/pr-review.md`、`docs/codex/release-check.md` 均存在。
- `package.json.version` 为 `0.1.4`。
- `CHANGELOG.md` 存在 `Unreleased / 0.1.4` 且内容非空。
- 既有 `0.1.3` changelog 内容没有丢失。
- 文档空白检查和版本/changelog 相关测试通过。
