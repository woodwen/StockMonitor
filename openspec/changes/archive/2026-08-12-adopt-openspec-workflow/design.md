## Context

Stock Monitor 当前同时存在两类规划信号：

- `docs/spec/feature/YYYYMM/DD-topic` 下的历史 feature plan 和 PR note；
- 刚初始化的 OpenSpec root，当前还没有 baseline specs。

旧文档是有价值的实现历史，但它们混合了产品行为、技术设计、测试计划、PR 说明和调查记录。OpenSpec 更适合作为后续主流程：先提出 change，再定义 requirements，补充 design，拆 tasks，验证后 archive 到 baseline specs。

迁移过程中必须保留现有 Electron 架构规则：main process 负责远端请求，preload 暴露 typed bridge，renderer 负责 UI 状态和展示，MobX ViewModel 编排流程，model 保存纯业务逻辑，adapter 隔离外部依赖。

## Goals / Non-Goals

**Goals:**

- 让 OpenSpec 成为后续需求和行为变更的默认 source of truth。
- 保留旧 `docs/spec/feature` 作为历史归档材料。
- 为当前应用能力补齐第一批 baseline specs。
- 更新项目指引，让后续 Codex 任务优先读取并验证 OpenSpec changes。
- 让后续 OpenSpec artifacts 默认使用简体中文正文。
- 让 `project-commit-pr` 适配 OpenSpec，同时保留现有 M-x 提交约定和 changelog 维护职责。

**Non-Goals:**

- 不重写或删除旧 feature plan 目录。
- 不在本次工作流迁移中修改业务代码或应用行为。
- 不让 `project-commit-pr` 自动 archive OpenSpec changes。
- 不替换 `CHANGELOG.md` 作为 release notes 来源。
- 不在本 change 中 push commit 或创建远端 PR。

## Decisions

### Decision 1: 旧 feature specs 保留为归档

`docs/spec/feature/YYYYMM/DD-topic` 保持为可读历史。除非任务明确是在完成一个已存在的 legacy plan，否则新功能规划 SHALL 使用 OpenSpec。

备选方案：把所有旧 `plan.md` 和 `pr.md` 迁移成 OpenSpec changes。这个方案会制造不真实的 active history，重复已经完成的工作，并让 archive 语义变得不清晰。

### Decision 2: 按能力补 baseline specs

第一批 baseline specs 拆成七个能力：

- `market-data-sources`
- `stock-workspace`
- `chart-indicators`
- `watchlist`
- `trade-profit-calculator`
- `help-and-updates`
- `release-process`

这些 specs 只记录稳定的用户可见行为和架构边界，避免纳入低层实现记录。实现历史继续留在旧文档或未来 change 的 design 中。

备选方案：创建一个很大的 `stock-monitor` spec。它创建成本更低，但后续难以验证和演进。

### Decision 3: `release-process` 包含提交打包流程

`project-commit-pr` 维护 changelog 条目、本地 PR markdown、验证结果和项目提交格式，因此归入 `release-process`。这样可以避免为了仓库工作流额外增加第八个 baseline capability。

备选方案：新增 `development-workflow` 能力。这个拆分概念上更干净，但当前确认的 baseline 范围是七个能力，且相关行为和 release/changelog 强相关。

### Decision 4: `project-commit-pr` 负责打包，OpenSpec 负责归档

`project-commit-pr` SHALL 生成 commit/PR 文本、维护 `CHANGELOG.md`、运行验证、精确 staging，并在用户要求时创建本地 commit。除非用户明确要求 archive/finalize，否则它 SHALL NOT 运行 `openspec archive`。

备选方案：提交后自动 archive。这个方案会把实现打包和规格晋升绑定在一起；如果后续验证或 review 发现问题，回滚成本更高。

### Decision 5: Changelog 继续作为用户可见 release notes 来源

`CHANGELOG.md` 继续作为 GitHub Release notes 的单一来源。OpenSpec 记录需求和行为契约，不替代 release notes。

纯内部工作流或文档迁移不需要写入 app changelog，除非它影响用户可见应用行为、安装、更新体验或 release 输出。

### Decision 6: 后续 OpenSpec artifacts 使用中文正文

后续 OpenSpec proposal、design、tasks 和 specs 的人类可读正文 SHALL 默认使用简体中文。OpenSpec parser keywords、capability ids、文件路径、代码标识符、包名、命令名和 API 名 SHALL 在其稳定形式为英文时保留英文。

spec 中以下结构文本保持英文，以稳定通过 OpenSpec 校验和 archive：

- `## ADDED Requirements`
- `## MODIFIED Requirements`
- `## REMOVED Requirements`
- `### Requirement:`
- `#### Scenario:`
- `- **WHEN**`
- `- **THEN**`

这些结构标记后面的描述可以使用中文。

备选方案：把所有 OpenSpec 标题和场景标记都翻译成中文。这个方案可读性略高，但会增加 OpenSpec 解析和归档失败风险。

## Risks / Trade-offs

- 旧文档和新 specs 在过渡期可能分叉 -> 通过标记 `docs/spec/feature` 为归档，并更新 agent 指引缓解。
- baseline specs 可能写得过细 -> 通过只记录行为、约束和验收场景缓解。
- `project-commit-pr` 是全局 skill -> 在全局 skill 中只加入通用 OpenSpec 行为，Stock Monitor 专属规则留在仓库文档。
- OpenSpec validation 不能覆盖所有项目校验 -> 保留现有 `yarn typecheck`、`yarn test`、专项测试、`yarn build` 和 `git diff --check` 规则。
- 中文 OpenSpec 正文可能诱导翻译解析敏感标记 -> 在 `openspec/config.yaml`、`AGENTS.md` 和 workflow 文档中明确固定英文结构标记。
- 用户可能以为提交打包会自动归档 change -> 明确把 archive 记录为独立显式步骤。

## Migration Plan

1. 创建 `adopt-openspec-workflow` OpenSpec change。
2. 补齐 proposal、design、七个 delta specs 和 tasks。
3. 实施时更新 `openspec/config.yaml`、`AGENTS.md`、`docs/codex/feature-task.md` 和 `docs/spec/README.md`，其中包含后续 OpenSpec 默认中文正文规则。
4. 更新 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`，加入通用 OpenSpec-aware 行为。
5. 运行 `openspec validate adopt-openspec-workflow --strict`、`openspec validate --all --strict` 和 `git diff --check`。
6. 将工作流迁移作为文档/工具类改动提交。
7. 只有在用户明确要求 finalize/archive 后，才 archive 这个 change。

## Open Questions

- 无。当前默认建议已经作为本 change 的迁移决策。
