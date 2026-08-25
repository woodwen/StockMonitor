# M-45(chore): 优化 OpenSpec 工作流 Skill

OpenSpec Change: optimize-openspec-change-workflow-skill

背景:
- 全局 `/Users/mac/.codex/skills/openspec-change-workflow/` 原先以单个 `SKILL.md` 承载五类流程，分支细节集中在同一层，容易增加 agent 执行负载。
- 当前项目已接入 mattpocock/skills，需要把 `writing-for-agents`、`grilling`、`domain-modeling`、`tdd`、`diagnosing-bugs` 和 `code-review` 中适合 OpenSpec workflow 的规则落到可执行流程中。

方案概述:
- 将全局 `openspec-change-workflow` 调整为短 router，按用户请求路由到 `propose`、`update`、`implement`、`review` 和 `complete` 分支引用文件。
- 把跨分支共用的 artifact 规则、边界和验证要求集中到 `references/artifact-rules.md`。
- 归档 OpenSpec change，并新增 `agent-workflow` capability 作为后续 agent workflow 管理规则。

实现改动:
- 更新全局 `/Users/mac/.codex/skills/openspec-change-workflow/SKILL.md`，保留短 description、`change-id` 解析、通用边界和 required reads 路由。
- 新增全局 workflow/reference 文件：`workflows/propose.md`、`workflows/update.md`、`workflows/implement.md`、`workflows/review.md`、`workflows/complete.md` 和 `references/artifact-rules.md`。
- 在仓库内归档 `openspec/changes/archive/2026-08-25-optimize-openspec-change-workflow-skill/`，并生成 `openspec/specs/agent-workflow/spec.md`。
- 补全归档后主 spec 的 `Purpose`，避免保留 OpenSpec 自动生成的 `TBD` 占位。

测试计划(UT):
- `skill structure validation passed`
- `frontmatter yaml validation passed`
- `openspec validate optimize-openspec-change-workflow-skill --strict`
- `openspec archive optimize-openspec-change-workflow-skill --yes`
- `openspec validate --all --strict`
- `git diff --check`
- 未运行 `yarn typecheck`、`yarn test`、`yarn build`：本次未修改 Stock Monitor 应用源码、构建脚本、release 逻辑或用户可见应用行为。

影响范围(建议手动测试范围):
- 影响全局 Codex skill `/Users/mac/.codex/skills/openspec-change-workflow/` 的触发路由和流程文档。
- 影响仓库 OpenSpec `agent-workflow` capability 与归档记录。
- 不影响 Stock Monitor renderer/main/preload、行情源、打包发布或用户可见应用功能。

风险与后续:
- 全局 skill 文件位于当前 Git 仓库外，本提交只能记录仓库内 OpenSpec 归档、主 spec 和 PR 文档；全局 skill 实际文件需通过本机 `$CODEX_HOME` 保留。
- 当前工作区还有其他未提交变更，提交时只 stage 本 change 相关仓库文件。
