# M-31(fix): 修复 Changelog 发布归档

## 背景

仓库已经发布 `v0.1.4`、`v0.1.5`、`v0.1.6`，但根目录 `CHANGELOG.md` 中缺少对应正式版本段落。调查确认，发布时 release notes 允许 fallback 到 `Unreleased / X.Y.Z`，而发版后的 `prepare-next-dev-version` 只把顶部 `Unreleased / 已发布版本` 改成 `Unreleased / 下一版本`，没有归档历史段落，导致多个版本内容累计滚动到当前 `Unreleased / 0.1.7`。

## 方案概述

- 补齐 `CHANGELOG.md` 中 `v0.1.4`、`v0.1.5`、`v0.1.6` 正式版本段落。
- 清理 `Unreleased / 0.1.7`，只保留当前 0.1.7 未发布条目，不再累计 0.1.4、0.1.5、0.1.6 内容。
- 修改 `prepare-next-dev-version`，发版后新增下一版本 `Unreleased`，并将刚发布版本归档为 `vX.Y.Z - YYYY-MM-DD`。
- 更新 Release workflow，调用 bump 脚本时传入 UTC 发布日期。
- 保留 release notes 提取脚本对 `Unreleased / X.Y.Z` 的 fallback 能力，不修改远端历史 GitHub Release notes。

## 实现改动

- 修改 `CHANGELOG.md`：
  - 新增 `v0.1.6 - 2026-08-12`。
  - 新增 `v0.1.5 - 2026-08-11`。
  - 新增 `v0.1.4 - 2026-08-11`。
  - 清理 `Unreleased / 0.1.7` 的历史累计内容。
- 修改 `scripts/prepare-next-dev-version.mjs`：
  - 新增发布日期校验。
  - 新增归档已发布版本的 changelog 更新逻辑。
  - CLI 新增 `--release-date YYYY-MM-DD`。
  - 本地未传日期时默认使用当前 UTC 日期。
- 修改 `.github/workflows/release.yml`：
  - `bump-dev-version` job 传入 `--release-date "$(date -u +%F)"`。
- 修改 `tests/prepare-next-dev-version.test.mjs`：
  - 覆盖新增下一版本 `Unreleased` 和归档刚发布版本。
  - 覆盖无匹配 changelog 标题、非法日期和幂等跳过场景。
- 新增 `docs/spec/feature/202608/0812-changelog-release-archive/plan.md`。

## 测试计划(UT)

已执行并通过：

- `yarn test tests/prepare-next-dev-version.test.mjs tests/changelog-release-notes.test.mjs tests/release-version.test.mjs`
- `yarn test`
- `yarn typecheck`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

### 影响范围

- `CHANGELOG.md` 历史版本展示和当前未发布区块。
- Release workflow 发版后的 `dev` 版本准备 job。
- `scripts/prepare-next-dev-version.mjs` 的 changelog 更新行为。
- `tests/prepare-next-dev-version.test.mjs` 的发版后归档行为断言。

### 建议手动测试范围

- 打开 `CHANGELOG.md`，确认顺序为 `Unreleased / 0.1.7`、`v0.1.6`、`v0.1.5`、`v0.1.4`、`v0.1.3`。
- 确认 `Unreleased / 0.1.7` 只包含当前 0.1.7 未发布内容，不再累计 0.1.4、0.1.5、0.1.6 条目。
- 确认 `v0.1.4` 只包含 dev 自动升版和 Codex 项目工程接入内容。
- 确认 `v0.1.5` 只包含使用说明书和自选股内容。
- 确认 `v0.1.6` 只包含 K 线指标增强、做T测算和 macOS 无签名更新安装降级内容。
- 确认 release notes 提取仍能读取正式版本段落，并在正式段落不存在时 fallback 到 `Unreleased / X.Y.Z`。

## 风险与后续

- 本次只修仓库内 changelog，不修改已发布 GitHub Release notes。
- Workflow 使用 UTC 日期，可能与本地时区日期不同；历史补齐仍使用 tag 对应日期。
- 如果后续 changelog 格式发生变化，需要同步更新 bump 脚本和测试。
