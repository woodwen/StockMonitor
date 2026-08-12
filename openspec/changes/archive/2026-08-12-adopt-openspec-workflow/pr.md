# M-32(docs): 接入 OpenSpec 工作流

OpenSpec Change: adopt-openspec-workflow

## 背景

- 项目已经积累大量 `docs/spec/feature` 历史方案，但 OpenSpec 刚初始化，缺少统一的后续规划和归档规则。
- 旧 `plan.md/pr.md` 同时承载需求、设计、测试和提交记录，继续作为新需求默认落点会让规格来源分散。
- 本次目标是把 OpenSpec 固化为后续新需求的主流程，并让提交打包流程能读取 OpenSpec change 上下文。

## 方案概述

- 采用 OpenSpec-first：后续用户可见行为变更、release 行为变更和架构重要改动优先创建 OpenSpec change。
- 保留 `docs/spec/feature/YYYYMM/DD-topic` 为历史归档目录，默认不迁移、不删除、不继续新增规格。
- OpenSpec artifacts 默认使用简体中文正文，保留结构关键字、capability id、路径、命令、API 和代码标识符的英文稳定形式。
- 首批 baseline specs 按七个 capability 拆分：`market-data-sources`、`stock-workspace`、`chart-indicators`、`watchlist`、`trade-profit-calculator`、`help-and-updates`、`release-process`。
- `project-commit-pr` 默认识别 active OpenSpec change，生成中文 PR markdown 和 commit body，并保留 `OpenSpec Change: <change>`。

## 实现改动

- 更新 `openspec/config.yaml`，写入 Stock Monitor 项目上下文、OpenSpec 中文正文规则、artifact rules 和验证要求。
- 新增 `openspec/changes/adopt-openspec-workflow` 的 proposal、design、tasks、七个 delta specs 和本 PR markdown。
- 更新 `AGENTS.md`，将文档规则调整为 OpenSpec-first，并说明旧 spec 目录归档状态。
- 更新 `docs/codex/feature-task.md`，要求实现任务优先读取 active OpenSpec artifacts。
- 新增 `docs/spec/README.md`，说明 `docs/spec/feature` 是历史归档目录。
- 更新本机全局 `project-commit-pr` skill，使其支持 OpenSpec-aware 打包；该文件位于用户级 Codex 配置目录，不属于仓库提交内容。
- 未更新 `CHANGELOG.md`，因为本次是内部 workflow/agent instruction 迁移，不影响应用用户可见行为、安装、更新行为或 release 输出。

## 测试计划(UT)

- `openspec validate adopt-openspec-workflow --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `rg -n "[[:blank:]]$" openspec docs/spec/README.md`
- 未运行 `yarn build`，因为本次没有修改应用代码。

## 影响范围(建议手动测试范围)

- 后续新需求的标准流程改为 OpenSpec change 驱动。
- 旧 `docs/spec/feature` 继续可读，但默认只作为历史归档参考。
- Codex 实现任务和项目指令会优先读取 OpenSpec proposal、design、tasks 和 specs。
- 使用 `project-commit-pr` 打包 active OpenSpec change 时，PR markdown 默认写入 `openspec/changes/<change>/pr.md`。

## 风险与后续

- 本次不会 archive `adopt-openspec-workflow`，baseline specs 需要后续显式执行 `openspec archive adopt-openspec-workflow --yes` 才会同步到 `openspec/specs/**`。
- 本机全局 `project-commit-pr` skill 已同步更新，但它不在当前仓库 git 管理范围内，需要在最终汇报中单独说明。

## 验收标准

- OpenSpec change artifacts 使用中文正文并通过严格校验。
- 项目文档明确 OpenSpec-first 和旧 spec 归档规则。
- `project-commit-pr` 规则明确 active OpenSpec change 的 PR 路径、验证和不自动 archive 行为。
- 本地 commit 创建完成后不 push、不 archive。
