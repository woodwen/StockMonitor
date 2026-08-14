# M-34(docs): 归档 OpenSpec 工作流变更

OpenSpec Change: adopt-openspec-workflow

## 背景

- `adopt-openspec-workflow` 已完成实施和本地提交，归档前仍处于 active change 状态。
- 需要将该 change 归档，并把七个 delta specs 同步成 OpenSpec baseline specs，作为后续新需求的规格基础。

## 方案概述

- 执行 `openspec archive adopt-openspec-workflow --yes`。
- 将 active change 移动到 `openspec/changes/archive/2026-08-12-adopt-openspec-workflow`。
- 生成 `openspec/specs/**/spec.md` baseline specs。
- 保留归档后的 change artifacts，方便追溯 proposal、design、tasks、PR 和 delta specs。
- 不更新 `CHANGELOG.md`，因为本次是内部 OpenSpec 归档，不影响应用用户可见行为、安装、更新行为或 release 输出。

## 实现改动

- 删除 active change 目录 `openspec/changes/adopt-openspec-workflow`。
- 新增归档目录 `openspec/changes/archive/2026-08-12-adopt-openspec-workflow`。
- 新增七个 baseline specs：
  - `openspec/specs/market-data-sources/spec.md`
  - `openspec/specs/stock-workspace/spec.md`
  - `openspec/specs/chart-indicators/spec.md`
  - `openspec/specs/watchlist/spec.md`
  - `openspec/specs/trade-profit-calculator/spec.md`
  - `openspec/specs/help-and-updates/spec.md`
  - `openspec/specs/release-process/spec.md`
- 新增本地 PR markdown：`docs/pr/M-34-archive-openspec-workflow.md`。

## 测试计划(UT)

- `openspec validate --all --strict`
- `git diff --check`
- `git diff --cached --check`
- `rg -n "[[:blank:]]$" openspec/specs openspec/changes/archive/2026-08-12-adopt-openspec-workflow docs/pr/M-34-archive-openspec-workflow.md`
- 未运行 `yarn build`，因为本次没有修改应用代码。

## 影响范围(建议手动测试范围)

- OpenSpec active changes 为空。
- 后续 OpenSpec 查询会从 `openspec/specs/**` 读取七个 baseline capability。
- 已归档 change 仍可在 archive 目录中追溯。

## 风险与后续

- 归档命令提示本次 change delta 较多，这是非阻塞 warning；后续较大的规格迁移可以拆成多个 change。
- 本次只提交归档产物，不 push。

## 验收标准

- `openspec list --json` 返回空 active changes。
- `openspec list --specs --json` 返回七个 baseline specs。
- `openspec validate --all --strict` 通过。
