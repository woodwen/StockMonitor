## 1. 方案与现状确认

- [x] 1.1 读取当前 `/Users/mac/.codex/skills/openspec-change-workflow/SKILL.md`、
  `agents/openai.yaml`、本 change 的 proposal/design/spec/tasks，以及项目 `AGENTS.md`。
- [x] 1.2 复核 mattpocock/skills 相关输入：`writing-for-agents`、`grilling`、
  `domain-modeling`、`tdd`、`diagnosing-bugs` 和 `code-review`，只提取本 workflow 需要的规则。
- [x] 1.3 按已确认默认项实施：目标为全局 skill 优化，不创建项目内同名
  `openspec-change-workflow`，并记录未触碰 Stock Monitor 应用代码。
- [x] 1.4 复核并保留已确认默认项：model-invoked、router/reference 拆分、清晰需求自动生成
  `change-id`、按阶段选择 mattpocock 规则、domain docs 懒创建。

## 2. Skill 结构优化

- [x] 2.1 新增 `/Users/mac/.codex/skills/openspec-change-workflow/workflows/` 和
  `/Users/mac/.codex/skills/openspec-change-workflow/references/`。
- [x] 2.2 将入口 `SKILL.md` 改为短 router：frontmatter、输入解析、通用边界、分支路由表和
  required reads。
- [x] 2.3 编写 `references/artifact-rules.md`，集中维护中文正文、英文 OpenSpec 结构关键字、
  artifact 一致性、路径安全、提交/归档/推送边界和验证规则。
- [x] 2.4 编写 `workflows/propose.md`、`workflows/update.md`、`workflows/implement.md`、
  `workflows/review.md` 和 `workflows/complete.md`，每个文件包含步骤、completion criteria
  和 final report 字段。

## 3. mattpocock/skills 规则融合

- [x] 3.1 在 `SKILL.md` description 中使用短 context pointer，并覆盖 `先出方案`、`调整方案`、
  `实施方案`、`review`、`完成提交`、`归档` 和 `OpenSpec change` 触发分支。
- [x] 3.2 在 `propose.md` 中加入 design tree 规则：事实由 agent 查，真实用户决策才询问，
  默认建议在用户接受后同步到所有 artifacts。
- [x] 3.3 在 `implement.md` 中加入 feedback discipline：bug/performance 先建 tight loop，
  行为变更优先按 public seam 做 vertical slice；无合适 seam 时记录风险。
- [x] 3.4 在 `review.md` 中加入 Standards / Spec 两轴 review，分别检查项目规则与 OpenSpec
  一致性，并独立报告 findings。
- [x] 3.5 在相关 workflow 中加入 domain docs 读取规则：读取 `docs/agents/domain.md`、
  `CONTEXT.md` 和相关 ADR；仅在真实术语或 ADR 决策出现时懒创建。

## 4. 验证

- [x] 4.1 检查所有 `SKILL.md` 引用的 workflow/reference 文件存在，且路径与实际文件一致。
- [x] 4.2 检查 frontmatter 可解析，`name` 保持 `openspec-change-workflow`，description 没有
  变成长篇正文。
- [x] 4.3 检查 workflow reference 中没有重复或冲突的 `## Workflow` 分支，没有提前展开
  shell-sensitive placeholder。
- [x] 4.4 运行 `openspec validate optimize-openspec-change-workflow-skill --strict`。
- [x] 4.5 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 4.6 本 change 不触碰应用源码；除非实施阶段意外修改 `src/`、构建脚本或 release 逻辑，
  不运行 `yarn typecheck`、`yarn test` 或 `yarn build`。

## 5. 完成边界

- [x] 5.1 更新 tasks 勾选状态，确保只勾选已完成且验证过的任务。
- [x] 5.2 最终报告列出修改的 skill 文件、OpenSpec validation 结果、未运行检查及原因。
- [x] 5.3 不提交、不 push、不 archive；只有用户明确要求“完成提交”或“归档”时再进入下一阶段。
