# M-18(build): 接入 Changelog 发版说明

## 背景

- 项目已经新增根目录 `CHANGELOG.md`，但 `master` 发版 workflow 创建 GitHub Release 时仍使用固定说明 `Automated release for $RELEASE_TAG.`。
- 固定 release notes 会让发版说明和项目 changelog 脱节，维护者需要重复维护 GitHub Release 内容。
- `package.json` 当前版本为 `0.1.2`，该版本的未发布内容已经记录在 `CHANGELOG.md` 的 `Unreleased / 0.1.2` 区块中。
- 用户希望 `master` 发版时从 changelog 读取当前版本内容，并且后续使用 `project-commit-pr` 提交 PR 时自动维护 changelog。

## 方案概述

- 新增 changelog release notes 提取脚本，以 `package.json.version` 为版本来源读取 `CHANGELOG.md`。
- 提取规则优先匹配正式版本标题 `## vX.Y.Z - YYYY-MM-DD`，缺失时 fallback 到 `## Unreleased / X.Y.Z`。
- 在 release workflow 的 validate 阶段校验当前版本 changelog 内容，在 publish 阶段生成 `release-notes.md`。
- GitHub Release 创建改为使用 `--notes-file release-notes.md`，不再写固定占位说明。
- 更新全局 `project-commit-pr` 技能规则：当仓库已有 `CHANGELOG.md` 时，后续提交 PR 会自动维护 `Unreleased / 当前版本`。

## 实现改动

- 新增 `CHANGELOG.md`：
  - 记录 `Unreleased / 0.1.2`、`v0.1.1`、`v0.1.0` 的版本更新内容。
  - 补充本次 release notes 提取和 `project-commit-pr` 自动维护 changelog 的更新条目。
- 新增 `scripts/extract-changelog-release-notes.mjs`：
  - 导出 `extractChangelogSection()`、`readPackageVersion()`、`readChangelogReleaseNotes()`、`writeReleaseNotes()`。
  - 支持正式版本标题和 `Unreleased / X.Y.Z` fallback。
  - 支持 `--check` 校验模式和 `--output` 输出路径。
  - 对缺少版本内容、空内容和非法版本输出错误并返回非 0。
- 新增 `tests/changelog-release-notes.test.mjs`：
  - 覆盖正式版本优先、未发布版本 fallback、版本边界截断、缺失版本、空内容、非法版本和写出文件。
- 更新 `.github/workflows/release.yml`：
  - `validate` job 增加 `Validate changelog release notes`。
  - `publish` job 增加 `Generate release notes`。
  - `gh release create` 改用 `--notes-file release-notes.md`。
- 新增 plan 文档：
  - `docs/spec/feature/202608/0811-changelog/plan.md`
  - `docs/spec/feature/202608/0811-release-changelog-notes/plan.md`
- 更新仓库外全局技能 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`：
  - 增加 changelog 维护规则、分类映射和 workflow 步骤。
  - 该文件不属于当前 Git 仓库，不能纳入本地 commit。

## 测试计划(UT)

- 已执行 `yarn test tests/changelog-release-notes.test.mjs tests/release-version.test.mjs`，通过：2 个测试文件，15 个用例。
- 已执行 `yarn test`，通过：10 个测试文件，65 个用例。
- 已执行 `yarn typecheck`，TypeScript 类型检查通过。
- 已执行 `yarn build`，Electron main/preload/renderer 生产构建通过。
- 已执行 `git diff --check`，diff 空白检查通过。
- 已执行 `node scripts/extract-changelog-release-notes.mjs --check`，当前 `0.1.2` changelog release notes 校验通过。
- 尝试执行 `skill-creator` 的 `quick_validate.py` 校验全局技能，但当前 Python 环境和 bundled Python 均缺少 `yaml` 模块，未能运行；已人工确认技能 frontmatter 未改。

## 影响范围(建议手动测试范围)

- 合并到 `master` 后，确认 release workflow 在 `validate` 阶段能通过 changelog release notes 校验。
- 当 `package.json.version = 0.1.2` 且只有 `Unreleased / 0.1.2` 时，确认 workflow 能生成 release notes。
- 将 changelog 归档为 `## v0.1.2 - YYYY-MM-DD` 后，确认脚本优先读取正式版本标题。
- 临时移除当前版本 changelog 内容，确认 workflow 在创建 GitHub Release 前失败。
- 在 GitHub Release 页面确认 release notes 与 `CHANGELOG.md` 对应版本内容一致。
- 后续使用 `project-commit-pr` 提交有 `CHANGELOG.md` 的项目时，确认会更新 `Unreleased / 当前版本` 区块。

## 风险与后续

- release notes 提取依赖 `CHANGELOG.md` 的二级标题格式；如果后续 changelog 格式改变，需要同步更新脚本和测试。
- 允许 fallback 到 `Unreleased / X.Y.Z` 能减少发版阻塞，但正式 release 后仍建议把标题归档为 `vX.Y.Z - YYYY-MM-DD`。
- 全局 `project-commit-pr` 技能更新不在当前仓库 commit 内，后续如迁移机器或重装技能，需要重新同步该技能规则。
- `quick_validate.py` 受本地 Python 依赖限制未执行，后续可在具备 PyYAML 的环境中补跑技能校验。

## 验收标准

- `CHANGELOG.md` 存在并包含当前 `0.1.2` 的未发布版本内容。
- `scripts/extract-changelog-release-notes.mjs --check` 能校验当前版本 changelog 内容。
- Release workflow 使用 `--notes-file release-notes.md` 创建 GitHub Release。
- 缺少当前版本 changelog 内容时，release workflow 会在发布前失败。
- 新增 changelog release notes 单测覆盖核心匹配和失败场景。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
