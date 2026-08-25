## Context

`openspec-change-workflow` 是全局 Codex skill，当前安装在
`/Users/mac/.codex/skills/openspec-change-workflow/`。它管理一个 OpenSpec change 的
五个阶段：方案、调整、实施、review 和完成提交。

本项目已经把 mattpocock/skills 复制到 `.codex/skills/`，并补充了
`docs/agents/issue-tracker.md`、`docs/agents/domain.md` 和
`docs/agents/triage-labels.md`。这些 skills 的可复用原则包括：

- `writing-for-agents`：用精准 context pointer 触发文档，按信息层级拆分内容，给每个步骤
  明确 completion criterion，减少重复和 stale cache。
- `grilling`：把设计问题组织成 design tree，只询问用户决策，事实由 agent 自己查。
- `domain-modeling`：读取 domain docs，术语和 ADR 只在真实概念或决策出现时懒创建。
- `tdd`：按 seam 做红绿循环，避免实现耦合测试和一次性横向铺测试。
- `diagnosing-bugs`：bug/performance 先构造 tight feedback loop，再假设和修复。
- `code-review`：Standards 与 Spec 两轴分开 review，避免一个维度掩盖另一个维度。

当前 `openspec-change-workflow` 的问题不是缺少阶段，而是文档结构对 agent 的执行负载过高：
一个分支执行时会同时携带其他分支细节；某些规则重复出现在多个阶段；部分完成标准依赖
“看起来完成”，不够可检查。

## Goals / Non-Goals

**Goals:**

- 保留 `openspec-change-workflow` 作为 model-invoked skill，让用户说“先出方案”、
  “实施方案”、“review”、“完成提交”等自然触发词时仍能自动触发。
- 用更短、更前置的 description 作为 context pointer，覆盖核心触发分支。
- 将阶段细节拆到 workflow reference 文件，入口 `SKILL.md` 只做路由和通用边界。
- 为每个阶段定义可检查 completion criteria 和 final report 字段。
- 将 mattpocock/skills 的关键规则落入对应阶段，而不是要求 agent 额外记忆。
- 降低无意义提问：事实由 agent 查；只有真实用户决策进入确认项。
- 保持 OpenSpec 中文正文与英文结构关键字规则不变。

**Non-Goals:**

- 不替换 OpenSpec CLI 或项目现有 `openspec-*` skills。
- 不修改 Stock Monitor 应用功能、构建脚本、发布流程或用户可见文案。
- 不要求每个 OpenSpec change 都强制使用 TDD；只有实现阶段涉及新增行为、bug 或
  performance 风险时按合适 seam 或 tight loop 执行。
- 不在本 change 中创建 GitHub issue、远端 PR、commit、push 或 archive。
- 不把 `CONTEXT.md`、`docs/adr/` 作为空占位文件提前创建。

## Decisions

### Decision 0: 已接受默认实施边界

用户已确认“全按默认”。本 change SHALL 按以下默认项实施：

- 只优化全局 `/Users/mac/.codex/skills/openspec-change-workflow/`，不在本项目复制第二份
  同名 skill。
- 保持 `openspec-change-workflow` 为 model-invoked skill，并采用入口 router +
  workflow/reference 拆分。
- `change-id` 缺失但需求明确时自动生成 concise English kebab-case 默认值。
- mattpocock/skills 规则按 workflow 风险选择性使用，不强制每个阶段都加载全部 skill。
- 读取已有 domain docs，并仅在真实术语或 ADR 决策出现时懒创建 `CONTEXT.md` 或
  `docs/adr/`。
- 这是内部 agent workflow 变更，不写应用 `CHANGELOG.md`。
- 除非实施阶段实际触碰应用源码、构建脚本或 release 逻辑，否则不运行应用级
  `yarn typecheck`、`yarn test` 或 `yarn build`。

### Decision 1: 保持 model-invoked，但缩短入口

`openspec-change-workflow` 仍需要被模型自动触发，因为用户经常只说“先出方案”或
“完成提交”。因此保留 frontmatter `description`，但 description 只写触发分支：
OpenSpec change 的方案、调整、实施、review、归档和本地提交。

备选方案：改成 user-invoked skill。它会降低 context load，但会破坏用户的自然语言触发习惯。

### Decision 2: 按 workflow 分支做 progressive disclosure

入口 `SKILL.md` SHALL 包含：

- 输入解析和 `change-id` 规则；
- 只读探索边界；
- 分支路由表；
- 通用 artifact 一致性、提交/归档/推送边界；
- 每个分支需要读取的 reference 文件。

每个分支的步骤和完成标准下沉到 `workflows/*.md`。跨分支共享规则下沉到
`references/artifact-rules.md`。

备选方案：继续维护单文件。它改动最小，但不能解决不同分支互相干扰和文档 sprawl。

### Decision 3: `change-id` 支持默认生成

用户明确给出 `change-id` 时严格使用；用户未给出但需求足够明确时，skill SHALL 生成一个
concise English kebab-case `change-id`，并在最终报告中展示。只有在需求不足以命名、
候选名称冲突、或名称不满足路径安全时才询问。

这个决策对齐用户常用“先出方案”表达，同时保留 OpenSpec 路径安全。

### Decision 4: 用户确认只用于真实决策

方案阶段 SHALL 区分 facts 与 decisions。仓库结构、OpenSpec config、现有 specs、git 状态、
测试命令等 facts 由 agent 读取；issue tracker、能力边界、是否写 changelog、是否触及全局
skill 等 decisions 才进入确认项。

当用户说“都按默认”或等价表达时，后续调整 SHALL 把默认决策同步写入 proposal、design、
tasks 和 specs，不再重复询问同一批 routine decisions。

### Decision 5: 实施阶段按风险选择 feedback discipline

`实施方案` 阶段 SHALL 先读取 change artifacts。若 change 是 bug 或 performance 修复，
先建立 `diagnosing-bugs` 风格的 tight feedback loop；若 change 新增或修改行为，优先在
合适 public seam 做 `tdd` 风格 vertical slice。若没有合适 seam，任务和最终报告 SHALL
明确残余风险。

这不是把所有改动都强制测试先行，而是让高风险路径有可观察反馈。

### Decision 6: Review 阶段使用两轴报告

`review` 阶段 SHALL 分开检查：

- Standards：项目规则、AGENTS/CLAUDE、`docs/agents/*`、skill 写作规则和工程 smell。
- Spec：proposal、design、tasks、delta specs 与实现 diff 是否一致。

最终报告 SHALL 保持两轴分离，并明确 Critical/Major 是否已清零。

### Decision 7: Domain docs 懒创建

当仓库提供 `docs/agents/domain.md`、`CONTEXT.md` 或 ADR 时，workflow SHALL 在相关阶段读取。
但 `CONTEXT.md` 和 `docs/adr/` 只在 domain term 或 ADR 决策真实产生时创建，不为了接入而写空文件。

## Risks / Trade-offs

- [Risk] 拆分文件后 agent 忘记读取分支 reference。→ Mitigation：入口路由表把每个分支的
  required reads 写成 completion gate，未读取不得执行该分支。
- [Risk] 默认生成 `change-id` 可能与用户期望不同。→ Mitigation：最终报告显式展示生成的
  `change-id`；路径冲突或语义不清时才询问。
- [Risk] 引入 TDD/diagnosing 规则让简单文档改动变慢。→ Mitigation：只在对应风险分支触发；
  workflow-only 文档变更以 OpenSpec validation 和 `git diff --check` 为主。
- [Risk] 全局 skill 变化影响其他仓库。→ Mitigation：保留现有五阶段语义，先优化结构和完成标准，
  不改 OpenSpec CLI 命令含义。
- [Risk] 方案过度抽象。→ Mitigation：实施任务以具体文件和可验收检查为单位，不添加未使用的框架。

## Migration Plan

1. 审阅当前 `/Users/mac/.codex/skills/openspec-change-workflow/SKILL.md` 和
   `agents/openai.yaml`。
2. 新增 `workflows/` 和 `references/` 目录，迁移现有五阶段步骤。
3. 重写入口 `SKILL.md` 为短 router：frontmatter、输入解析、通用边界、路由表、final report
   总原则。
4. 编写 `references/artifact-rules.md`，集中维护 OpenSpec artifact 语言、结构关键字、
   consistency 和 validation 规则。
5. 编写五个 workflow reference 文件，各自包含步骤、completion criteria、final report 字段。
6. 将 mattpocock/skills 规则落到对应 workflow：
   - `propose.md`：grilling 的 design tree 和默认决策同步；
   - `implement.md`：tdd / diagnosing-bugs 的 feedback discipline；
   - `review.md`：code-review 的 Standards / Spec 两轴；
   - 所有 workflow：writing-for-agents 的明确完成标准和低重复；
   - 相关 workflow：domain-modeling 的 domain docs 读取和懒创建。
7. 校验引用完整性、frontmatter、路径安全、shell placeholder 和 whitespace。
8. 运行 OpenSpec validation 和 `git diff --check`。

## Open Questions

- 无。默认决策已确认；后续进入实施阶段时按 `Decision 0` 执行。
