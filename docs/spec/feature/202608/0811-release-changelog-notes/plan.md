# 发版读取 Changelog 与提交流程自动维护

## 背景

当前项目已经新增根目录 `CHANGELOG.md`，但发版和提交流程还没有真正消费这份文档：

- `master` 分支发版 workflow 当前在创建 GitHub Release 时使用固定说明 `Automated release for $RELEASE_TAG.`，没有读取对应版本的 changelog 内容。
- 如果 release notes 不从 `CHANGELOG.md` 提取，维护者仍需要在 GitHub Release 页面或 workflow 中重复维护版本说明。
- `project-commit-pr` 技能当前负责生成本地 PR 文档和 commit，但没有要求每次提交时同步维护项目 changelog。
- 如果 changelog 只依赖人工记忆更新，后续版本发布时容易出现缺失、过期或和 PR 内容不一致的问题。
- 用户希望 `master` 发版时读取最新发版对应版本的 changelog 内容，并且每次使用 `project-commit-pr` 提交 PR 时自动更新对应项目的 `CHANGELOG.md`。

本次目标是设计一套可落地的流程：发布时以 `CHANGELOG.md` 作为 GitHub Release notes 的唯一来源，提交流程中把 changelog 更新作为默认步骤。

## 方案概述

采用“发版强校验 + 提交流程自动维护”的方案。

### 发版流程

- 将用户提到的 `maser` 按 `master` 理解，本次只调整 `.github/workflows/release.yml` 的 `master` 发版流程。
- 发版版本继续由 `package.json.version` 决定，现有 `scripts/check-release-version.mjs` 继续负责判断是否需要发布。
- 新增 changelog release notes 提取脚本：
  - 读取 `package.json.version`。
  - 读取根目录 `CHANGELOG.md`。
  - 提取当前版本对应段落。
  - 输出 `release-notes.md` 供 GitHub CLI 使用。
- `gh release create` 从固定 `--notes` 改为 `--notes-file release-notes.md`。
- 找不到对应 changelog 段落或内容为空时，release workflow 直接失败，避免发布空说明或占位说明。

### Changelog 匹配规则

发版时按以下顺序读取：

1. 优先匹配正式版本标题：`## vX.Y.Z - YYYY-MM-DD`。
2. 如果正式版本标题不存在，fallback 匹配未发布标题：`## Unreleased / X.Y.Z`。
3. 提取该标题下直到下一个 `## ` 标题前的全部内容。
4. 去除首尾空白后作为 release notes。
5. 如果最终内容为空，视为失败。

默认允许 fallback 到 `Unreleased / X.Y.Z`，这样当前 `0.1.2` 在尚未归档为正式日期标题前，也能先通过 changelog 生成 release notes。

### project-commit-pr 自动更新

- 修改全局技能 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`。
- 每次使用 `project-commit-pr` 准备本地 PR 和 commit 时，自动检测当前仓库根目录是否存在 `CHANGELOG.md`。
- 若存在 `CHANGELOG.md`，在生成 PR markdown 后、validation 前更新 changelog。
- 默认写入顶部 `Unreleased / 当前 package.version` 区块。
- 如果没有该区块，则在第一个正式版本区块前创建该区块。
- 如果仓库没有 `CHANGELOG.md`，默认不强制创建，避免影响不使用 changelog 的其他项目。
- staging 时把 `CHANGELOG.md` 作为当前任务相关文件一起提交。

不扩大范围处理：

- 不改变现有版本判断逻辑。
- 不改变 release artifact 构建、上传和 npm publish 流程。
- 不自动修改 GitHub Release 已发布历史内容。
- 不引入第三方 changelog 生成工具。
- 不为所有仓库强制创建 changelog；只在检测到项目已有 `CHANGELOG.md` 时维护。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 分支名 | 按 `master` 理解 |
| 发版说明来源 | 根目录 `CHANGELOG.md` |
| 版本来源 | `package.json.version` |
| 优先匹配 | `## vX.Y.Z - YYYY-MM-DD` |
| fallback 匹配 | `## Unreleased / X.Y.Z` |
| 缺少内容时 | release workflow 失败 |
| release notes 输出 | `release-notes.md` |
| GitHub CLI 参数 | `--notes-file release-notes.md` |
| project-commit-pr 更新位置 | `Unreleased / 当前 package.version` |
| changelog 不存在时 | 不强制创建 |
| 全局技能路径 | `/Users/mac/.codex/skills/project-commit-pr/SKILL.md` |

## 实现改动

### 新增 release notes 提取脚本

新增 `scripts/extract-changelog-release-notes.mjs`：

- 导出可测试函数：
  - `extractChangelogSection(markdown, version)`
  - `readPackageVersion(packageJsonPath)`
  - `writeReleaseNotes({ changelogPath, packageJsonPath, outputPath })`
- 支持正式版本标题和未发布版本标题两种匹配。
- 正确截断到下一个二级标题 `## `。
- 对缺失文件、缺失版本段落、空内容输出明确错误。
- CLI 默认读取：
  - `CHANGELOG.md`
  - `package.json`
  - 输出 `release-notes.md`
- 在 GitHub Actions 中失败时返回非 0。

### 更新 release workflow

修改 `.github/workflows/release.yml`：

- 在 `validate` job 中增加 changelog 校验步骤：
  - `node scripts/extract-changelog-release-notes.mjs --check`
  - 或使用脚本默认输出到临时文件后丢弃。
- 在 `publish` job 中，在 `Create GitHub Release` 前生成 `release-notes.md`。
- 修改 `gh release create`：
  - 移除 `--notes "Automated release for $RELEASE_TAG."`
  - 新增 `--notes-file release-notes.md`
- 保持 tag、title、target 和 artifact 参数不变。

### 新增 UT

新增 `tests/changelog-release-notes.test.mjs`：

- 覆盖优先提取 `## v0.1.2 - 2026-08-11`。
- 覆盖正式版本标题不存在时 fallback 到 `## Unreleased / 0.1.2`。
- 覆盖遇到下一个 `## ` 标题时正确截断。
- 覆盖缺少对应版本标题时报错。
- 覆盖对应版本标题存在但内容为空时报错。
- 覆盖正式版本标题优先级高于同版本未发布标题。

### 更新 project-commit-pr 技能

修改 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md`：

- 在默认规则中增加 changelog 维护要求：
  - 如果当前仓库根目录存在 `CHANGELOG.md`，每次本地 PR/commit 都要更新。
  - 更新目标为 `Unreleased / 当前 package.version`。
  - 缺少未发布区块时创建。
- 在 workflow 中增加步骤：
  - 生成或更新本地 `pr.md` 后，更新 `CHANGELOG.md`。
  - validation 前完成 changelog 更新，让检查覆盖最终 diff。
  - staging 时按相关文件处理 `CHANGELOG.md`。
- 增加 commit type 到 changelog 分类映射：
  - `feat` -> `Added`
  - `fix` -> `Fixed`
  - `build` -> `Build`
  - `docs` -> `Docs`
  - `test`、`refactor`、`chore` -> `Changed`
- 要求 changelog 条目使用本次 PR 的用户可读摘要，不写 commit hash。
- 对仓库外技能文件的修改需要写权限确认；实际实施时按 Codex sandbox 规则申请升级写入。

### 更新本次 plan

新增当前文档 `docs/spec/feature/202608/0811-release-changelog-notes/plan.md`，记录默认确认项、实现边界、测试计划和验收标准。

## 测试计划(UT)

需要执行：

- `yarn test tests/changelog-release-notes.test.mjs`
- `yarn test tests/release-version.test.mjs`
- `yarn test`
- `yarn typecheck`
- `yarn build`
- `git diff --check`

技能更新验证：

- 检查 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md` 的 frontmatter 不变。
- 用一次文档类变更模拟 `project-commit-pr` 流程，确认会把条目写入 `CHANGELOG.md` 的 `Unreleased / 当前 package.version` 区块。
- 确认没有 `CHANGELOG.md` 的项目不会被强制创建 changelog。

如果实际实施阶段因为网络、依赖安装或 sandbox 权限导致验证命令失败，需要在 PR 文档和最终说明中明确记录失败原因与未覆盖风险。

## 影响范围(建议手动测试范围)

### 发版流程

- 合并到 `master` 后，确认 release workflow 的 `check-version` 仍能正确输出 `version`、`tag`、`should_release`。
- 在 `package.json.version = 0.1.2` 时，确认 workflow 能从 `CHANGELOG.md` 提取 `Unreleased / 0.1.2` 内容。
- 将 changelog 归档为 `## v0.1.2 - YYYY-MM-DD` 后，确认 workflow 优先读取正式版本标题。
- 临时移除对应版本 changelog 内容，确认 workflow 在创建 GitHub Release 前失败。
- 确认 GitHub Release 页面展示的 notes 与 `CHANGELOG.md` 对应版本内容一致。

### project-commit-pr 流程

- 使用 `project-commit-pr` 提交 `feat` 类变更，确认 changelog 写入 `Added`。
- 使用 `project-commit-pr` 提交 `fix` 类变更，确认 changelog 写入 `Fixed`。
- 使用 `project-commit-pr` 提交 `build` 类变更，确认 changelog 写入 `Build`。
- 使用 `project-commit-pr` 提交 `docs` 类变更，确认 changelog 写入 `Docs`。
- 使用 `project-commit-pr` 提交 `chore`、`test` 或 `refactor` 类变更，确认 changelog 写入 `Changed`。
- 确认 staging 只包含当前任务相关文件和 `CHANGELOG.md`，不误提交无关脏文件。

### 文档维护

- 打开 `CHANGELOG.md`，确认顶部 `Unreleased / 当前 package.version` 区块保持在正式版本之前。
- 确认自动追加条目不重复创建相同分类标题。
- 确认 release notes 提取不包含下一个版本标题内容。

## 风险与后续

- 修改 `/Users/mac/.codex/skills/project-commit-pr/SKILL.md` 属于仓库外全局技能变更，会影响其他项目；默认通过“仅检测到 `CHANGELOG.md` 时才更新”降低影响。
- 自动 changelog 条目质量依赖 PR 摘要质量，后续仍需要维护者在复杂功能发布前人工润色。
- 当前 release notes 只支持二级标题作为版本边界；如果后续 changelog 格式改变，需要同步调整脚本和测试。
- 允许 fallback 到 `Unreleased / X.Y.Z` 能减少发版阻塞，但正式 release 后仍建议把标题归档为 `vX.Y.Z - YYYY-MM-DD`。
- 本次不做远端 GitHub Release notes 回填；历史 release 如需更新，需要单独操作。

## 验收标准

- 新增 release notes 提取脚本，并能从 `CHANGELOG.md` 提取当前版本内容。
- Release workflow 创建 GitHub Release 时使用 `--notes-file release-notes.md`。
- 缺少对应 changelog 内容时，release workflow 在发布前失败。
- `project-commit-pr` 技能说明包含自动维护 `CHANGELOG.md` 的规则和分类映射。
- 使用 `project-commit-pr` 时，已有 `CHANGELOG.md` 的项目会默认更新 `Unreleased / 当前 package.version`。
- 没有 `CHANGELOG.md` 的项目不会被强制创建 changelog。
- 相关 UT、类型检查、构建和 diff 空白检查通过。
