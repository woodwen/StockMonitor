# Changelog 发布归档修复

## 背景

当前仓库已经存在 `v0.1.4`、`v0.1.5`、`v0.1.6` tag，但根目录 `CHANGELOG.md` 只保留了当前 `Unreleased / 0.1.7` 和 `v0.1.3` 及更早的正式版本段落，缺失 `v0.1.4`、`v0.1.5`、`v0.1.6` 的正式 changelog 段落。

调查结论：

- `v0.1.4` tag 当时的 changelog 顶部是 `## Unreleased / 0.1.4`。
- `v0.1.5` tag 当时的 changelog 顶部是 `## Unreleased / 0.1.5`。
- `v0.1.6` tag 当时的 changelog 顶部是 `## Unreleased / 0.1.6`。
- Release workflow 能成功发版，是因为 `scripts/extract-changelog-release-notes.mjs` 允许 fallback 到 `Unreleased / X.Y.Z`。
- 发版后的 `scripts/prepare-next-dev-version.mjs` 只把顶部标题从 `Unreleased / <releasedVersion>` 替换成 `Unreleased / <nextVersion>`，没有把已发布内容归档为 `## vX.Y.Z - YYYY-MM-DD`。
- 因此 `0.1.4`、`0.1.5`、`0.1.6` 的发布内容被一路滚动到了当前 `Unreleased / 0.1.7`。

本次目标是补齐历史正式版本段落，并修复发版后自动准备 dev 下一版本时的 changelog 归档逻辑，避免后续版本继续缺失。

## 方案概述

采用“补历史 + 修脚本防复发”的方案：

- 补齐 `CHANGELOG.md` 中 `v0.1.4`、`v0.1.5`、`v0.1.6` 正式版本段落。
- 历史内容来源以各 tag 当时的 `Unreleased / X.Y.Z` 内容为基础，但整理为“每个版本只保留本版本新增内容”。
- 清理当前 `Unreleased / 0.1.7`，只保留真正属于 0.1.7 未发布开发内容的条目。
- 修改 `scripts/prepare-next-dev-version.mjs`：
  - 发版后先把顶部 `Unreleased / <releasedVersion>` 归档为 `v<releasedVersion> - <releaseDate>`。
  - 再在顶部新增 `Unreleased / <nextVersion>` 空段。
  - 同步更新 `package.json.version` 到下一开发版本。
- 修改 Release workflow，在调用 `prepare-next-dev-version.mjs` 时传入发布日期。
- 扩展 `tests/prepare-next-dev-version.test.mjs`，覆盖历史归档、新未发布段创建和错误场景。
- 不修改已经发布到 GitHub 的历史 Release notes，只修仓库内 changelog。

## 默认实现决策

| 确认项 | 默认方案 |
| --- | --- |
| 修复范围 | 同时修 `CHANGELOG.md` 历史段落和发版后 bump 脚本 |
| 历史内容来源 | 用各 tag 当时的 `Unreleased / X.Y.Z` 内容作为基础 |
| 是否做累计式 changelog | 不做累计式，每个版本只放本版本新增内容 |
| 版本日期 | `v0.1.4 - 2026-08-11`、`v0.1.5 - 2026-08-11`、`v0.1.6 - 2026-08-12` |
| 当前 `Unreleased / 0.1.7` | 只保留当前 0.1.7 未发布内容，不再累计 0.1.4、0.1.5、0.1.6 条目 |
| 是否修改已发布 GitHub Release notes | 不修改远端历史 Release，只修仓库 changelog |
| 脚本行为 | 归档 `Unreleased / releasedVersion` 为 `vX.Y.Z - YYYY-MM-DD`，再新增 `Unreleased / nextVersion` |
| 日期来源 | workflow 传入发布日期；本地 CLI 可显式传 `--release-date YYYY-MM-DD`，未传时用当前日期 |
| 测试覆盖 | 扩展 `prepare-next-dev-version.test.mjs` |
| 提交方式 | 实现时使用 `$project-commit-pr` 做一个 `fix` 提交 |

## 历史版本归档规则

### v0.1.4 - 2026-08-11

只归档 0.1.4 自身内容：

```md
## v0.1.4 - 2026-08-11

### Build

- 发版成功后自动在 `dev` 分支准备下一开发版本，`master` 保持已发布版本不变。

### Docs

- 新增 Codex 项目工程接入方案文档、中文仓库级 `AGENTS.md` 指令和本地 Codex 任务模板。
```

### v0.1.5 - 2026-08-11

只归档 0.1.5 自身内容：

```md
## v0.1.5 - 2026-08-11

### Added

- 在帮助菜单新增离线 `使用说明书`，覆盖快速开始、分时、K 线、指标、自选股、数据源、网络代理、应用更新和常见问题。
- 新增本地自选股管理，支持单只/批量添加、剪切板粘贴、管理模式删除所选、点击切换和持久化恢复。

### Docs

- 新增帮助菜单使用说明书方案文档和 PR 记录。
```

### v0.1.6 - 2026-08-12

只归档 0.1.6 自身内容：

```md
## v0.1.6 - 2026-08-12

### Added

- 新增 K 线指标颜色、线型、显示精度配置，支持指标弹窗内实时预览，点击应用后再持久化保存。
- 新增 `做T` 盈亏测算面板，支持费用明细、ETF 免印花税、多笔记录、总盈亏和本地持久化。

### Fixed

- macOS 安装包暂未签名时，应用内更新不再尝试自动下载安装，改为打开 GitHub Release 下载页手动安装 DMG。

### Docs

- 新增做T盈亏测算方案文档，并同步 README 与应用内说明书。
```

### Unreleased / 0.1.7

清理后只保留当前未发布内容：

```md
## Unreleased / 0.1.7

### Added

- 在帮助菜单新增离线 `版本更新说明`，用于查看当前安装包内置的 `CHANGELOG.md` 版本记录。

### Fixed

- 修复发布后 changelog 未归档导致 `v0.1.4`、`v0.1.5`、`v0.1.6` 历史版本说明缺失的问题。
```

## 实现改动

### 修复 CHANGELOG.md

修改根目录 `CHANGELOG.md`：

- 在 `Unreleased / 0.1.7` 后插入 `v0.1.6`、`v0.1.5`、`v0.1.4`。
- 版本顺序保持倒序：`Unreleased / 0.1.7`、`v0.1.6`、`v0.1.5`、`v0.1.4`、`v0.1.3`。
- 将当前 `Unreleased / 0.1.7` 中属于历史版本的条目移动到对应正式版本段落。
- 避免同一条目在多个版本重复出现。

### 修复 prepare-next-dev-version 脚本

修改 `scripts/prepare-next-dev-version.mjs`：

- 新增 `archiveReleasedChangelogVersion(markdown, releasedVersion, nextVersion, releaseDate)` 或等价函数。
- 新函数要求 changelog 第一条版本标题必须是 `## Unreleased / <releasedVersion>`。
- 将第一条标题替换为：
  - 顶部新增 `## Unreleased / <nextVersion>`。
  - 原内容归档到紧随其后的 `## v<releasedVersion> - <releaseDate>`。
- 保留原版本内容，不丢失分类和列表项。
- 如果 `releaseDate` 不合法，脚本失败并输出明确错误。
- CLI 新增 `--release-date YYYY-MM-DD`。
- CLI 未传 `--release-date` 时，本地默认使用当前日期，便于人工运行。

示例输出：

```md
## Unreleased / 0.1.8

## v0.1.7 - 2026-08-12

### Added

- ...

## v0.1.6 - 2026-08-12
```

### 更新 Release workflow

修改 `.github/workflows/release.yml`：

- 在 `bump-dev-version` job 中调用脚本时传入发布日期：

```bash
node scripts/prepare-next-dev-version.mjs \
  --released-version "$RELEASED_VERSION" \
  --release-date "$(date -u +%F)"
```

默认使用 UTC 日期，保持 workflow 环境稳定。历史 changelog 手工补齐时使用 tag 对应日期。

### 更新测试

修改 `tests/prepare-next-dev-version.test.mjs`：

- 将原“只更新顶部 Unreleased 标题”的断言改为“归档已发布版本并新增下一 Unreleased”。
- 覆盖 `0.1.4 -> 0.1.5` 时：
  - `package.json.version` 更新为 `0.1.5`。
  - changelog 顶部新增 `## Unreleased / 0.1.5`。
  - 原 `## Unreleased / 0.1.4` 变为 `## v0.1.4 - 2026-08-11`。
  - 原 0.1.4 内容保留。
- 覆盖缺少 `Unreleased / releasedVersion` 时报错。
- 覆盖 `releaseDate` 格式非法时报错。
- 覆盖 dev 版本已高于 released version 时仍跳过且不改 changelog。

### 更新方案和 PR 记录

新增当前方案文档：

- `docs/spec/feature/202608/0812-changelog-release-archive/plan.md`

实现完成后新增同目录：

- `docs/spec/feature/202608/0812-changelog-release-archive/pr.md`

## 测试计划(UT)

需要执行：

- `yarn test tests/prepare-next-dev-version.test.mjs`
- `yarn test tests/changelog-release-notes.test.mjs`
- `yarn test tests/release-version.test.mjs`
- `yarn test`
- `yarn typecheck`
- `yarn build`
- `git diff --check`

重点 UT：

- 发版后准备下一 dev 版本时会同时归档 changelog。
- release notes 提取仍优先读取正式 `vX.Y.Z - YYYY-MM-DD` 段落。
- 当前只有 `Unreleased / X.Y.Z` 时 release notes fallback 行为仍保留。
- changelog 缺少当前 release version 时脚本失败。
- 日期参数非法时脚本失败。

## 影响范围(建议手动测试范围)

影响模块：

- `CHANGELOG.md`：补齐历史正式版本段落并清理当前 Unreleased。
- `scripts/prepare-next-dev-version.mjs`：改变发版后 changelog 更新策略。
- `.github/workflows/release.yml`：传入 release date。
- `tests/prepare-next-dev-version.test.mjs`：更新脚本行为测试。
- `docs/spec/feature/202608/0812-changelog-release-archive/`：新增方案和 PR 记录。

建议手动检查：

1. 打开 `CHANGELOG.md`，确认顺序为 `Unreleased / 0.1.7`、`v0.1.6`、`v0.1.5`、`v0.1.4`、`v0.1.3`。
2. 确认 `Unreleased / 0.1.7` 只包含当前 0.1.7 未发布内容，不再累计 0.1.4、0.1.5、0.1.6 条目。
3. 确认 `v0.1.4` 只包含 dev 自动升版和 Codex 项目工程接入内容。
4. 确认 `v0.1.5` 只包含使用说明书和自选股内容。
5. 确认 `v0.1.6` 只包含 K 线指标增强、做T测算和 macOS 无签名更新安装降级内容。
6. 模拟运行 `prepareNextDevVersion()` 的测试样例，确认会新增下一版本空 Unreleased 并归档刚发布版本。
7. 确认 release notes 提取脚本仍能读取当前正式版本段落。

## 风险与约束

- 本次只修仓库内 changelog，不修改已发布 GitHub Release notes。
- 手工拆分历史内容时需要避免把 0.1.4 内容重复放入 0.1.5 或 0.1.6。
- workflow 使用 UTC 日期，可能与本地 Asia/Shanghai 日期不同；默认接受 workflow 的 UTC 稳定性，历史补齐仍使用 tag 日期。
- 如果未来需要以 Git tag 合并时间作为日期，需要新增 GitHub API 或 git 查询逻辑，不在本次范围内。
- `extract-changelog-release-notes.mjs` 的 fallback 行为保留，以免未来发版前未归档时直接阻断，但发版后的 dev bump 会自动归档。

## 验收标准

- `CHANGELOG.md` 存在 `v0.1.4`、`v0.1.5`、`v0.1.6` 正式版本段落。
- 当前 `Unreleased / 0.1.7` 不再累计历史版本内容。
- `prepare-next-dev-version` 发版后会归档已发布版本并新增下一开发版本 Unreleased。
- Release workflow 会向 bump 脚本传入 release date。
- 相关 UT、全量测试、类型检查、构建和 diff 空白检查通过。
