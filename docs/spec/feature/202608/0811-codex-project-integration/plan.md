# Codex 项目工程接入方案

## 背景

当前项目已经形成较清晰的工程流程：

- Electron 三端结构：`main`、`preload`、`renderer`。
- Renderer 采用 React + MobX MVVM，View、ViewModel、Model、Adapter 边界明确。
- 行情请求统一在主进程数据源模块内完成，渲染进程通过 preload typed bridge 调用。
- 已有 `tests/` 覆盖数据源、IPC、ViewModel、指标、自动更新、发版脚本等关键路径。
- 已有 `docs/spec/feature/YYYYMM/DD-topic/plan.md` 与 `pr.md` 的功能记录习惯。
- Release workflow 已经接入 `CHANGELOG.md` release notes 提取、类型检查、单测、构建和三端打包。

因此 Codex 接入不应从产品内 AI 功能开始，也不应优先改 release 主流程。第一期目标是把 Codex 固化为项目工程助手，让它稳定理解项目结构、修改边界、验证命令和审查重点。

## 默认确认项

按默认建议收敛为以下决策：

| 确认项 | 默认决策 |
| --- | --- |
| 第一期范围 | 只做工程侧 Codex 接入 |
| 产品内 AI 功能 | 暂不做 |
| OpenAI API 依赖 | 暂不新增 |
| GitHub Action | 暂不接入主流程，作为第二期 |
| PR 阻塞门禁 | 暂不做，后续即使接入也先只评论 |
| Secret 管理 | 第一期不需要任何 key |
| 项目指令入口 | 新增根目录 `AGENTS.md` |
| `AGENTS.md` 语言 | 中文为主，路径/命令/API 等技术标识保留英文；`Code Review Rules` 标题保留英文 |
| Prompt 模板入口 | 新增 `docs/codex/` |
| 版本号 | 本次落地时从 `0.1.3` 升级到 `0.1.4` |
| 文档流程 | 保持现有 `docs/spec/feature/.../plan.md` 与 `pr.md` |
| 验证策略 | 文档类变更只做 diff/格式检查；后续落地代码时按影响范围跑测试 |

## 官方能力边界

本方案依据 OpenAI Docs 中的当前 Codex 能力边界：

- `AGENTS.md` 用于给 Codex 提供项目级指令和上下文。
- `codex exec` 适合本地脚本、CI、预合并检查、定时任务等非交互自动化。
- `openai/codex-action@v1` 适合在 GitHub Actions 中运行 Codex review 或自动化任务。
- Codex SDK/App Server 属于更深的程序化或产品级集成，不作为第一期切入点。

## 一期方案：项目级 Codex 指令与模板

### 目标

让 Codex 每次进入本仓库时默认知道：

- 这个项目是什么。
- 哪些文件是高风险边界。
- 哪些架构约束不能破坏。
- 常见任务应该看哪些测试。
- 新功能和发版相关变更应该更新哪些文档。

### 新增文件

第一期建议新增：

```text
AGENTS.md
docs/codex/
  feature-task.md
  pr-review.md
  release-check.md
```

### `AGENTS.md` 内容边界

`AGENTS.md` 应控制在项目规则和审查规则，不写长篇背景说明。建议包含：

语言策略：

- 说明性内容使用中文，便于项目维护者后续直接阅读和修改。
- 文件路径、命令、API 名、类型名和包名保留英文，例如 `window.stockApi`、`StockApi`、`yarn typecheck`。
- `## Code Review Rules` 标题保留英文，正文规则使用中文，以贴合官方 Codex review section 命名并保持本项目文档可读性。

#### 项目概览

- Stock Monitor 是跨平台行情桌面应用。
- 技术栈：Electron、React、TypeScript、MobX、Ant Design、klinecharts、Vitest、electron-builder。
- 包管理器：Yarn 1。

#### 架构边界

- `src/main/` 负责窗口、菜单、IPC、远端行情源、配置、代理、日志、更新。
- `src/preload/` 只暴露 typed bridge，主要是 `window.stockApi`。
- `src/renderer/` 不直接访问远端行情接口。
- View 只负责展示和事件触发。
- ViewModel 负责状态、查询条件、流程编排和持久化触发。
- Model 负责纯业务逻辑，例如行情类型、指标定义、指标计算。
- Adapter 负责外部依赖，例如 Electron bridge、klinecharts、Canvas。

#### 高风险模块

- `src/main/remote-stock-sources.ts`：行情源能力、请求、解析、fallback、代理。
- `src/main/ipc.ts`：主进程 IPC handler 注册。
- `src/preload/stock-api.ts`：渲染进程可访问的 typed bridge。
- `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：工作区状态和刷新流程。
- `.github/workflows/release.yml`：发版、构建、GitHub Release、GitHub Package。
- `scripts/extract-changelog-release-notes.mjs`：release notes 提取。
- `CHANGELOG.md`：用户可见变更与 release notes 来源。

#### 常用验证命令

- 普通代码改动：`yarn typecheck`、`yarn test`。
- 主进程、preload、Electron 配置、打包相关改动：额外跑 `yarn build`。
- release/changelog 改动：跑 `yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。
- 数据源改动：跑 `yarn test tests/remote-stock-sources.test.ts`。
- ViewModel 改动：跑 `yarn test tests/stock-workspace-view-model.test.ts`。
- IPC 改动：跑 `yarn test tests/ipc-handlers.test.ts`。

#### 文档规则

- 用户可见功能新增或行为变更，应新增或更新 `docs/spec/feature/YYYYMM/DD-topic/plan.md`。
- 完成实现后应新增或更新同目录 `pr.md`。
- 用户可见变更应更新 `CHANGELOG.md` 的 `Unreleased / 当前 package.version` 区块。
- 发布流程仍以 `CHANGELOG.md` 为 release notes 来源。

#### Code Review Rules

建议在 `AGENTS.md` 增加专门的 `## Code Review Rules`：

- 标记 renderer 直接请求远端行情接口的改动。
- 标记新增 IPC 但没有同步 preload 类型的改动。
- 标记修改 `StockApi` 但没有同步 adapter 或测试的改动。
- 标记数据源能力变化但没有同步 README/spec/test 的改动。
- 标记 release workflow 改动但没有验证 changelog release notes 的改动。
- 标记将投资建议、买卖建议、收益承诺写进应用文案的改动。

### `docs/codex/feature-task.md`

用途：本地手工让 Codex 执行功能开发前的任务模板。

建议内容：

- 要求先阅读 README、对应 plan、相关 source/test。
- 要求按现有 MVVM 和 Electron 三端边界实施。
- 要求列出影响范围和测试计划。
- 要求完成后更新 `pr.md` 与必要 changelog。

### `docs/codex/pr-review.md`

用途：后续 `codex exec` 或 GitHub Action 的 PR review prompt。

审查重点：

- Electron 三端边界。
- preload typed bridge 同步。
- 数据源能力矩阵、fallback、代理、错误文案。
- 分时/K 线 ViewModel 状态流。
- 指标计算纯逻辑回归。
- 自动更新和 release artifact 风险。
- 测试覆盖与文档覆盖。

输出格式：

- Findings by severity。
- Missing tests。
- Release/changelog impact。
- Suggested minimal fix。
- Residual risk。

### `docs/codex/release-check.md`

用途：发版前让 Codex 做只读 release 风险检查。

检查内容：

- `package.json.version` 与 `CHANGELOG.md` 是否匹配。
- 当前版本 changelog 区块是否可被提取。
- `.github/workflows/release.yml` 是否仍有 typecheck/test/build/release notes 步骤。
- electron-builder 发布配置是否仍指向 GitHub Releases。
- macOS ZIP、DMG、Windows exe、Linux AppImage artifact 规则是否仍完整。

## 二期方案：本地 `codex exec` 自动化

二期不改业务代码，先提供本地命令或脚本说明，验证 prompt 质量。

示例命令：

```bash
codex exec --sandbox read-only "$(cat docs/codex/pr-review.md)"
```

建议任务：

- Review 当前 git diff。
- 检查某个 feature plan 是否覆盖实现和测试。
- 发版前检查 changelog/release workflow 风险。
- 分析 CI 日志并输出可能原因和下一步。

二期验收标准：

- 本地 review 输出稳定、可读、项目相关。
- 输出能明确引用高风险文件和缺失测试。
- 不要求 Codex 自动改文件。
- 不需要 OpenAI API key 写入仓库。

## 三期方案：GitHub Action 只读 PR Review

三期才考虑接入 GitHub Action，并且默认只评论、不阻塞。

建议新增：

```text
.github/workflows/codex-pr-review.yml
.github/codex/prompts/pr-review.md
```

默认策略：

- `pull_request` 触发。
- 使用 `openai/codex-action@v1`。
- `sandbox: read-only`。
- `openai-api-key` 只从 GitHub Secret 读取。
- 不设置 job 级 `OPENAI_API_KEY`。
- 不自动 push patch。
- 不作为 required check。

三期验收标准：

- PR 下能生成 review comment。
- review 不泄露 secret。
- review 内容围绕项目架构和测试，而不是泛泛 lint。
- 对误报较多的规则先调整 prompt，不急着做阻塞。

## 暂缓方案：产品内 AI 功能

产品内 AI 不放在当前阶段。原因：

- 当前收益最大的点是提升工程协作质量。
- 产品内 AI 会引入 OpenAI API key 管理、成本控制、网络失败兜底和合规文案。
- 股票行情场景需要严格避免投资建议、买卖建议和收益承诺。

如果后续要做，优先从“解释/诊断”切入，而不是“交易建议”：

- 数据源失败诊断。
- 指标参数解释。
- 当前行情摘要解释。
- release notes 用户化总结。

产品内 AI 的安全边界：

- API key 只能存在主进程或后端服务，不能进入 renderer。
- renderer 只能通过 preload typed bridge 调用。
- 输入只传必要摘要，不传全量大数组。
- 输出必须包含“不构成投资建议”的免责声明。
- 网络失败不能影响行情主流程。

## 实施步骤

第一期实际落地时按以下顺序：

1. 新增中文为主的根目录 `AGENTS.md`，保留路径、命令、API 名等英文技术标识。
2. 新增 `docs/codex/feature-task.md`。
3. 新增 `docs/codex/pr-review.md`。
4. 新增 `docs/codex/release-check.md`。
5. 将 `package.json.version` 从 `0.1.3` 升级到 `0.1.4`。
6. 在 `CHANGELOG.md` 新增 `Unreleased / 0.1.4`，并保留既有 `0.1.3` 变更内容。
7. 检查文档内容是否和 README、现有 spec、测试文件名一致。
8. 执行 `git diff --check` 和版本/changelog 相关校验。

第一期不做：

- 不修改 `src/` 业务代码。
- 不修改 `.github/workflows/release.yml`。
- 不新增依赖。
- 不新增 OpenAI API key 配置。
- 不接入产品内 AI UI。

## 测试计划

第一期是文档和 Codex 指令接入，默认不需要运行完整 UT。

需要执行：

- `git diff --check`
- `node scripts/extract-changelog-release-notes.mjs --check`
- `yarn test tests/changelog-release-notes.test.mjs`
- `yarn test tests/release-version.test.mjs`

建议人工验证：

- 打开 `AGENTS.md`，确认高风险文件路径准确。
- 打开 `docs/codex/pr-review.md`，确认 review 重点覆盖 Electron 三端、数据源、release、changelog。
- 新开一次 Codex 任务，让它总结当前项目规则，确认能读取并复述 `AGENTS.md`。

后续如果实际修改 `src/`、scripts 或 workflow，再按 `AGENTS.md` 中的测试映射运行对应命令。

## 影响范围

第一期影响范围：

- 只影响 Codex 读取项目上下文和本地人工使用 prompt 的方式。
- 不影响应用运行逻辑。
- 不影响打包产物。
- 不影响 GitHub Release。
- 不影响用户界面。
- 不影响行情数据请求。

## 风险与后续

- `AGENTS.md` 写得太长会稀释重点，应保持短而明确。
- prompt 模板如果过于泛化，会产生无价值 review；需要围绕本项目文件和测试持续收敛。
- GitHub Action 接入后会产生 API 成本和 secret 管理风险，所以放到二期验证之后。
- 产品内 AI 有合规和成本风险，必须单独立项，不和工程侧 Codex 接入混在一起。

## 验收标准

第一期完成后应满足：

- 根目录存在 `AGENTS.md`。
- `AGENTS.md` 使用中文为主的说明，保留路径、命令、API 名等英文技术标识。
- `AGENTS.md` 明确项目架构、边界、测试命令、文档规则和 code review rules。
- `docs/codex/` 下存在 feature、review、release 三类 prompt 模板。
- `package.json.version` 升级到 `0.1.4`。
- `CHANGELOG.md` 存在非空的 `Unreleased / 0.1.4` 区块。
- 第一阶段没有改动业务代码、CI 或依赖。
- `git diff --check`、release notes 提取校验和版本/changelog 相关测试通过。
- 后续 Codex 任务能基于项目规则给出更稳定的实现和 review。
