## 1. OpenSpec Project Guidance

- [x] 1.1 更新 `openspec/config.yaml`，写入 Stock Monitor 技术栈、Electron 边界规则、OpenSpec artifact 规则、简体中文正文默认规则、验证要求和用户可见投资安全文案约束。
- [x] 1.2 更新 `AGENTS.md`，让新行为变更默认使用 active OpenSpec changes，并把 legacy `docs/spec/feature` plans 视为历史上下文。
- [x] 1.3 更新 `docs/codex/feature-task.md`，让实现任务在编辑前读取相关 OpenSpec proposal、design、tasks 和 specs。
- [x] 1.4 新增 `docs/spec/README.md`，说明 `docs/spec/feature/YYYYMM/DD-topic` 是归档目录，新需求应使用 OpenSpec。
- [x] 1.5 记录后续 OpenSpec proposal、design、tasks 和 specs 默认使用简体中文正文，同时保留英文 capability ids、文件路径、代码标识符、命令和 OpenSpec 必需结构关键字。

## 2. Baseline Specs

- [x] 2.1 对照 `README.md` 和历史 feature plans，复核七个 delta specs 是否符合当前行为。
- [x] 2.2 保持 baseline specs 聚焦用户可见行为、架构边界和验收场景，避免搬入实现历史。
- [x] 2.3 确认第一批 baseline capabilities 仍为 `market-data-sources`、`stock-workspace`、`chart-indicators`、`watchlist`、`trade-profit-calculator`、`help-and-updates` 和 `release-process`。
- [x] 2.4 确保后续 baseline 和 delta specs 保留 OpenSpec 解析敏感标记英文，包括 `Requirement`、`Scenario`、`WHEN` 和 `THEN`，并在这些标记后使用中文描述。

## 3. project-commit-pr Integration

- [x] 3.1 更新 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`，当仓库包含 `openspec/config.yaml` 时启用通用 OpenSpec 检测。
- [x] 3.2 让 `project-commit-pr` 优先读取 active OpenSpec change artifacts，并把 PR markdown 写入 `openspec/changes/<change>/pr.md`。
- [x] 3.3 让 `project-commit-pr` 在为 active OpenSpec change 打包提交前运行 `openspec validate <change> --strict`。
- [x] 3.4 让 `project-commit-pr` 在适用时把 `OpenSpec Change: <change>` 写入 commit 和 PR body。
- [x] 3.5 仅当任务已经绑定 legacy plan 时保留 `docs/spec/feature/.../pr.md`；否则 fallback 到 `docs/pr/M-x-summary.md`。
- [x] 3.6 确保 `project-commit-pr` 不运行 `openspec archive`，除非用户明确要求 archive、finalize 或 completion。
- [x] 3.7 继续由 `project-commit-pr` 维护 `CHANGELOG.md`，但内部 workflow-only 变更不写 app changelog bullet。
- [x] 3.8 让 `project-commit-pr` 默认生成中文 OpenSpec-aware PR markdown 和 commit body，同时保留英文 OpenSpec change id。

## 4. Validation

- [x] 4.1 运行 `openspec validate adopt-openspec-workflow --strict`。
- [x] 4.2 运行 `openspec validate --all --strict`。
- [x] 4.3 运行 `git diff --check`。
- [x] 4.4 本次 workflow-only 文档/工具迁移默认不运行 `yarn build`，除非实施过程中意外触碰应用代码。

## 5. Completion

- [x] 5.1 使用 `project-commit-pr` 将已实施迁移打包为本地文档/工具类 commit。
- [x] 5.2 提交后保持 OpenSpec change active，除非用户明确要求 archive。
- [ ] 5.3 用户要求 finalize 时，运行 `openspec archive adopt-openspec-workflow --yes`，并验证 archive 后的 baseline specs。
