# agent-workflow Specification

## Purpose
定义仓库中 agent workflow 与全局 Codex skill 的 OpenSpec 管理规则，确保 proposal、
implementation、review、archive 和本地提交阶段有明确边界、可验证检查和一致的交付记录。
## Requirements
### Requirement: OpenSpec workflow skill 使用短入口和分支引用
`openspec-change-workflow` SHALL 作为 model-invoked skill 管理 OpenSpec change 的方案、
调整、实施、review、归档和本地提交流程，并将分支细节放入按 workflow 拆分的引用文件。

#### Scenario: 用户触发 OpenSpec workflow
- **WHEN** 用户用“先出方案”、“调整方案”、“实施方案”、“review”、“完成提交”、“归档”
  或 `OpenSpec change` 触发工作流
- **THEN** skill SHALL 通过短 `description` 被识别为适用
- **AND** 入口 `SKILL.md` SHALL 只保留输入解析、通用边界、分支路由和 required reads

#### Scenario: Agent 执行单个 workflow 分支
- **WHEN** agent 确认当前任务属于某个 workflow 分支
- **THEN** agent SHALL 读取该分支对应的 `workflows/*.md`
- **AND** agent SHALL 读取共享的 artifact 规则引用文件
- **AND** agent SHALL NOT 依赖未读取的其他分支步骤完成当前分支

### Requirement: 全局 skill 优化边界保持明确
`optimize-openspec-change-workflow-skill` SHALL 只优化全局
`openspec-change-workflow` skill，并把内部 workflow 变更与 Stock Monitor 应用变更分开。

#### Scenario: 实施全局 skill 优化
- **WHEN** agent 实施本 change
- **THEN** agent SHALL 修改 `/Users/mac/.codex/skills/openspec-change-workflow/`
- **AND** agent SHALL NOT 在本项目创建第二份同名 `openspec-change-workflow` skill

#### Scenario: 内部 workflow 变更无需应用 changelog
- **WHEN** 本 change 只修改 agent workflow 或 skill 文档
- **THEN** workflow SHALL NOT 要求写入应用 `CHANGELOG.md`
- **AND** 最终报告 SHALL 说明这是内部 agent workflow 变更

#### Scenario: 未触碰应用代码或构建发布逻辑
- **WHEN** 实施阶段没有修改 `src/`、构建脚本、release 逻辑或用户可见应用文案
- **THEN** workflow SHALL NOT 运行应用级 `yarn typecheck`、`yarn test` 或 `yarn build`
- **AND** 最终报告 SHALL 说明这些检查未运行的原因

### Requirement: Change id 解析降低无效打断
`openspec-change-workflow` SHALL 在保证路径安全的前提下解析或生成 `change-id`，并只在必要时询问用户。

#### Scenario: 用户显式提供 change id
- **WHEN** 用户提供明确 `change-id`
- **THEN** workflow SHALL 使用该值，除非它对路径不安全或与现有文件冲突

#### Scenario: 用户未提供 change id 但需求明确
- **WHEN** 用户要求创建新 OpenSpec change 且需求足以命名
- **THEN** workflow SHALL 生成 concise English kebab-case `change-id`
- **AND** 最终报告 SHALL 展示生成的 `change-id`

#### Scenario: 用户请求无法安全命名
- **WHEN** 用户需求不足以生成明确 `change-id`，或候选名称不安全、冲突
- **THEN** workflow SHALL 在改文件前询问用户

### Requirement: 方案阶段区分 facts 和 decisions
`先出方案` workflow SHALL 让 agent 自行获取仓库 facts，并只把真实用户 decisions 放入确认项。

#### Scenario: 创建方案前探索仓库
- **WHEN** agent 准备创建 OpenSpec proposal、design、tasks 和 specs
- **THEN** agent SHALL 读取现有 OpenSpec 配置、active changes、相关 specs、项目指引和 git 状态
- **AND** agent SHALL NOT 询问可以从仓库或工具直接获取的 facts

#### Scenario: 方案存在待确认决策
- **WHEN** 方案包含多个可行产品或工程边界
- **THEN** agent SHALL 给出默认建议，并把待确认项集中写入 proposal 或 design 的 open questions

#### Scenario: 用户接受默认决策
- **WHEN** 用户说“都按默认”或等价表达
- **THEN** 后续调整 SHALL 将默认决策同步写入 proposal、design、tasks 和 specs
- **AND** workflow SHALL NOT 反复询问同一批 routine decisions

### Requirement: 实施阶段使用可观察反馈
`实施方案` workflow SHALL 根据变更风险选择合适反馈纪律，确保实现可以被验证。

#### Scenario: 变更是 bug 或 performance 修复
- **WHEN** OpenSpec change 的目标是修复 bug、回归、性能问题或不稳定行为
- **THEN** workflow SHALL 先建立 tight feedback loop
- **AND** 该 loop SHALL 能复现用户描述的症状或度量变化

#### Scenario: 变更新增或修改行为
- **WHEN** OpenSpec change 新增或修改可观察行为
- **THEN** workflow SHOULD 在合适 public seam 做 vertical slice 验证
- **AND** 测试 SHALL 避免绑定私有实现细节

#### Scenario: 没有合适 seam
- **WHEN** 当前架构没有合适 public seam 支撑回归测试
- **THEN** workflow SHALL 在 tasks 或最终报告中记录残余风险和替代验证方式

### Requirement: Review 阶段分离 Standards 和 Spec
`review` workflow SHALL 以两轴方式检查 OpenSpec change，并分别报告发现。

#### Scenario: Review OpenSpec change
- **WHEN** 用户要求 review 一个 OpenSpec change
- **THEN** workflow SHALL 检查 proposal、design、tasks、specs、当前 diff 和项目规则
- **AND** workflow SHALL 分别输出 Standards findings 和 Spec findings

#### Scenario: Standards 和 Spec 结论不同
- **WHEN** 一个问题只违反项目规则或只违反 OpenSpec 需求
- **THEN** workflow SHALL 保持对应轴的分类
- **AND** workflow SHALL NOT 用另一个轴的通过结果掩盖该问题

#### Scenario: Review 后仍有 Critical 或 Major
- **WHEN** review 后仍存在 Critical 或 Major findings
- **THEN** workflow SHALL 报告阻塞原因
- **AND** workflow SHALL NOT 建议进入归档或完成提交

### Requirement: Domain docs 按需读取和懒创建
`openspec-change-workflow` SHALL 在相关阶段读取仓库 domain docs，并避免创建空占位文档。

#### Scenario: 仓库提供 agent domain docs
- **WHEN** 仓库存在 `docs/agents/domain.md`
- **THEN** workflow SHALL 按该文件说明读取 `CONTEXT.md`、`CONTEXT-MAP.md` 或相关 ADR

#### Scenario: 产生新的 domain term 或 ADR 决策
- **WHEN** 方案或实施过程中真实解决了新 domain term 或不可轻易逆转的架构决策
- **THEN** workflow MAY 使用 domain-modeling 规则更新 `CONTEXT.md` 或新增 ADR
- **AND** workflow SHALL 在 tasks 或最终报告中说明该文档变更

#### Scenario: 没有真实 domain 决策
- **WHEN** 本次 change 没有新增术语或 ADR 决策
- **THEN** workflow SHALL NOT 创建空的 `CONTEXT.md` 或 `docs/adr/` 占位

### Requirement: Skill 文档变更需要结构校验
`openspec-change-workflow` 的实施 SHALL 校验 skill 文档自身结构，防止引用失效或触发规则退化。

#### Scenario: 修改 skill 入口
- **WHEN** 实施阶段修改 `SKILL.md`
- **THEN** workflow SHALL 检查 frontmatter 可解析
- **AND** `name` SHALL 保持 `openspec-change-workflow`
- **AND** `description` SHALL 保持短 context pointer，而不是长篇流程正文

#### Scenario: 修改 workflow reference
- **WHEN** 实施阶段新增或修改 `workflows/*.md` 或 `references/*.md`
- **THEN** workflow SHALL 检查入口引用的文件都存在
- **AND** workflow SHALL 检查没有重复或冲突的 workflow 分支定义

#### Scenario: 文档包含 shell 命令模板
- **WHEN** workflow 文档包含 shell-sensitive placeholder
- **THEN** workflow SHALL 使用不会在写入时提前展开的写法
- **AND** validation SHALL 覆盖 placeholder 未被错误替换
