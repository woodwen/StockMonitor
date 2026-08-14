## Why

Stock Monitor 已经在 `docs/spec/feature` 下积累了多份历史功能方案，而 OpenSpec 刚初始化，尚无 baseline specs。项目需要一个统一的规划流程，避免新需求、实现任务、提交打包、changelog 维护和发版校验继续分散在多套文档规则里。

## What Changes

- 将 OpenSpec 作为后续用户可见行为变更、release 行为变更和架构重要改动的主规划流程。
- 将 `docs/spec/feature/YYYYMM/DD-topic` 保留为历史归档材料；默认不迁移、不删除，也不继续把新规格写入旧目录。
- 为当前应用能力新增 OpenSpec baseline specs，不机械复制旧 `plan.md` 和 `pr.md`。
- 更新项目指引，让 agent 优先读取 active OpenSpec change，再把旧 feature specs 当作历史上下文。
- 将后续 OpenSpec proposal、design、tasks 和 specs 的正文描述默认设为简体中文，同时保留 OpenSpec 解析关键字和稳定标识的英文形式。
- 让 `project-commit-pr` 适配 OpenSpec：
  - 当前存在 OpenSpec change 时，优先写入 `openspec/changes/<change>/pr.md`；
  - 打包提交前运行 `openspec validate <change> --strict`；
  - commit 和 PR body 中记录 `OpenSpec Change: <change>`；
  - 继续由 `project-commit-pr` 维护 `CHANGELOG.md`；
  - 除非用户明确要求 archive/finalize，否则不自动归档 OpenSpec change。
- 保持 `CHANGELOG.md` 作为用户可见 release notes 的来源。

## Capabilities

### New Capabilities

- `market-data-sources`：远端 K 线和分时行情源、数据源能力、代理行为、fallback 规则和 Electron 边界约束。
- `stock-workspace`：工作区视图模式、查询状态、刷新行为、持久化、状态展示和用户工作流边界。
- `chart-indicators`：K 线和分时指标配置、计算、渲染边界和持久化规则。
- `watchlist`：本地自选股解析、添加、删除、管理、点击切换、名称回填和持久化。
- `trade-profit-calculator`：做T测算输入、费用规则、ETF 印花税行为、历史记录、持久化和产品安全文案边界。
- `help-and-updates`：帮助菜单入口、应用内文档、版本更新说明、检查更新行为和离线/在线边界。
- `release-process`：changelog、release notes 提取、GitHub Release 打包、发版后版本准备，以及 `project-commit-pr` 提交/PR 打包流程。

### Modified Capabilities

- 无。当前仓库还没有既有 OpenSpec baseline specs。

## Impact

- `openspec/config.yaml`：补充 Stock Monitor 项目上下文和 artifact 规则。
- 后续 OpenSpec changes：默认使用简体中文正文，保留英文 capability id、文件路径、代码标识符和 OpenSpec 必需结构关键字。
- `openspec/specs/**`：本 change archive 后接收 baseline specs。
- `openspec/changes/adopt-openspec-workflow/**`：记录本次迁移 proposal、design、tasks 和 delta specs。
- `AGENTS.md`：将文档规则从旧 `docs/spec/feature` 默认落点调整为 OpenSpec-first。
- `docs/codex/feature-task.md`：更新实现任务提示，要求优先读取 active OpenSpec change。
- `docs/spec/README.md`：说明旧 spec 目录的归档状态。
- `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`：增加通用 OpenSpec-aware 提交/PR 打包规则。
- 业务代码不在本次工作流迁移范围内。
