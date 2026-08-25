## Why

当前 `/Users/mac/.codex/skills/openspec-change-workflow/SKILL.md` 已经覆盖
`先出方案`、`调整方案`、`实施方案`、`review` 和 `完成提交` 五类 OpenSpec 工作流，
但它仍以单文件长流程为主，存在几个可优化点：

- `description` 同时承载触发词和过多语义，作为 context pointer 还可以更短、更前置。
- `SKILL.md` 把所有分支细节放在同一层，执行某个分支时容易携带不相关步骤。
- 各阶段 completion criteria 还不够显式，尤其是方案阶段、实施阶段和 review 阶段。
- 对 mattpocock/skills 已接入的 `writing-for-agents`、`grilling`、`domain-modeling`、
  `tdd`、`diagnosing-bugs` 和 `code-review` 规则没有明确复用入口。
- 当前要求用户提供 `change-id` 的规则偏硬，和用户常用的“先出方案”自然语言请求之间
  存在摩擦；需要既保留路径安全，又支持在明显需求中生成默认 `change-id`。

本 change 先规划如何优化该全局 skill，使它更像一个轻量 router：入口短、分支清楚、
完成标准可检查，并把只有特定分支需要的细节下沉到引用文件。

## What Changes

- 优化 `openspec-change-workflow` 的 frontmatter description：保留模型自动触发能力，
  但用更短的触发分支描述覆盖 `先出方案`、`调整方案`、`实施方案`、`review`、
  `完成提交`、`归档` 和 `OpenSpec change`。
- 记录已确认的默认实施边界：只优化全局
  `/Users/mac/.codex/skills/openspec-change-workflow/`，不在本项目复制同名
  `openspec-change-workflow`，避免全局与项目内 skill 分叉。
- 将单文件长流程拆成入口 `SKILL.md` + 分支 workflow reference 文件：
  - `workflows/propose.md`
  - `workflows/update.md`
  - `workflows/implement.md`
  - `workflows/review.md`
  - `workflows/complete.md`
  - `references/artifact-rules.md`
- 在入口中只保留：输入解析、通用边界、分支路由和必须读取哪些引用文件。
- 明确 `change-id` 解析策略：用户显式提供时严格使用；用户未提供但需求足够明确时生成
  concise English kebab-case 默认值并在最终报告中说明；只有名称不明确或路径不安全时才询问。
- 在方案阶段引入 `grilling` 的设计树原则：只把真实用户决策列为待确认项，事实由 agent
  自己通过仓库探测获取；默认建议同步写入所有 artifacts。
- 在实施阶段引入 `tdd` 和 `diagnosing-bugs` 的约束：bug/performance 变更先建立 tight
  feedback loop；新增行为优先按明确 seam 做红绿循环；没有合适 seam 时把风险写入任务和报告。
- 在 review 阶段引入 `code-review` 的两轴模型：Standards 轴检查项目规则和工程 smell，
  Spec 轴检查 OpenSpec artifacts；两个轴的 findings 分开报告，不互相掩盖。
- 引入 `domain-modeling` 的 domain docs 规则：如果仓库有 `docs/agents/domain.md`、
  `CONTEXT.md` 或 ADR，相关阶段应读取；术语和 ADR 只在真实决策产生时懒创建。
- 增加 skill 文档自身的 validation：检查所有引用文件存在、frontmatter 可解析、无重复
  `## Workflow` 分支、无 shell-sensitive placeholder 提前展开、无 trailing whitespace。

## Capabilities

### New Capabilities

- `agent-workflow`: 约束仓库内 agent workflow 和全局 Codex skill 的规划、实施、review、
  validation 与提交边界。

### Modified Capabilities

- 无。本 change 只规划新增 agent workflow capability，不改变 Stock Monitor 应用产品行为。

## Impact

- 计划后续修改 `/Users/mac/.codex/skills/openspec-change-workflow/SKILL.md`。
- 计划后续新增 `/Users/mac/.codex/skills/openspec-change-workflow/workflows/*.md` 和
  `/Users/mac/.codex/skills/openspec-change-workflow/references/artifact-rules.md`。
- 不修改 Stock Monitor 业务代码、renderer/main/preload、README 或 `CHANGELOG.md`。
- 由于是内部 agent workflow 变更，不需要写入应用 `CHANGELOG.md`。
- 除非实施阶段意外触碰应用源码、构建脚本或 release 逻辑，否则不运行应用级
  `yarn typecheck`、`yarn test` 或 `yarn build`。
- 实施阶段需要验证：
  - `openspec validate optimize-openspec-change-workflow-skill --strict`
  - `openspec validate --all --strict`
  - `git diff --check`
  - skill 文件结构/引用完整性检查
  - 必要时手动 smoke：用优化后的 skill 对一个只读场景解释路由，不创建额外 change
