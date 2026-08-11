# 发版后自动准备 dev 下一版本

## 背景

当前 Release workflow 监听 `master` 分支，并以 `package.json.version` 和
GitHub Releases 中最新正式版本比较来决定是否发布。发版完成后，开发分支仍需要
手动提升到下一版本，否则后续开发提交可能继续停留在已发布版本号上。

本次目标是在 `master` 发版成功后，只自动更新 `dev` 分支的下一开发版本号，不修改
`master`，避免已发布分支被发版后的自动提交污染。

## 方案概述

新增一个发版后置步骤：

- `master` 继续作为唯一自动发布入口。
- `publish` job 成功创建 GitHub Release 并发布 GitHub Package 后，新增
  `bump-dev-version` job。
- `bump-dev-version` checkout `dev` 分支。
- 读取刚发布的版本号，即 `needs.check-version.outputs.version`。
- 按本项目版本进位规则计算下一开发版本。
- 只更新 `dev` 上的 `package.json` 和 `CHANGELOG.md`。
- 自动提交并 push 到 `dev`。
- `master` 不产生版本号回写提交。

## 版本进位规则

版本号使用稳定 semver 的 `major.minor.patch` 形式。

- `patch < 100`：递增 patch。
  - `0.1.4 -> 0.1.5`
  - `0.1.99 -> 0.1.100`
- `patch == 100` 且 `minor < 100`：minor 加 1，patch 归零。
  - `0.1.100 -> 0.2.0`
- `minor == 100` 且 `patch == 100`：major 加 1，minor 和 patch 归零。
  - `0.100.100 -> 1.0.0`

默认 major 不设置上限。minor 和 patch 的合法范围为 `0..100`，如果输入版本超过该
范围，脚本失败并要求人工处理。

## dev 分支状态策略

脚本在 `dev` 分支执行时比较 `dev` 当前版本和刚发布版本：

- `devVersion == releasedVersion`：更新到下一开发版本。
- `devVersion > releasedVersion`：跳过，不覆盖、不降级。
- `devVersion < releasedVersion`：失败，提示人工同步分支。

该策略保证重复运行 workflow 时幂等，也避免自动任务把已经提前升级的 `dev` 版本改低。

## Changelog 策略

只维护顶部未发布版本标题：

- 将 `## Unreleased / <releasedVersion>` 替换为
  `## Unreleased / <nextVersion>`。
- 不自动把已发布内容归档为 `## vX.Y.Z - YYYY-MM-DD`。
- 如果缺少 `Unreleased / <releasedVersion>`，脚本失败，不猜测位置创建。

这样自动任务只负责准备下一开发版本，正式发布历史仍由发布 PR 或维护者整理。

## Workflow 改动

在 `.github/workflows/release.yml` 新增 `bump-dev-version` job：

- `needs: [check-version, publish]`
- `if: needs.check-version.outputs.should_release == 'true'`
- checkout `dev`：
  - `ref: dev`
  - `fetch-depth: 0`
- setup Node.js 22
- 调用：
  - `node scripts/prepare-next-dev-version.mjs --released-version "${{ needs.check-version.outputs.version }}"`
- 如果脚本输出 `changed=true`：
  - 配置 `github-actions[bot]` git 身份。
  - `git add package.json CHANGELOG.md`
  - `git commit -m "chore(release): prepare v<nextVersion> [skip release] [skip ci]"`
  - `git push origin HEAD:dev`

默认不强推、不 rebase、不自动开 PR。若 `dev` 被分支保护阻止 push，job 失败，但不影响
已经完成的 GitHub Release 和 GitHub Package。

## 实现改动

新增 `scripts/prepare-next-dev-version.mjs`：

- 导出可测试函数：
  - `parseBoundedVersion(version, label)`
  - `compareBoundedVersions(left, right)`
  - `getNextDevVersion(version)`
  - `prepareNextDevVersion({ packageJsonPath, changelogPath, releasedVersion })`
- CLI 支持：
  - `--released-version X.Y.Z`
  - `--package package.json`
  - `--changelog CHANGELOG.md`
- 在 GitHub Actions 中写入 `GITHUB_OUTPUT`：
  - `changed`
  - `version`
  - `next_version`

新增 `tests/prepare-next-dev-version.test.mjs`：

- 覆盖常规 patch 递增。
- 覆盖 `0.1.99 -> 0.1.100`。
- 覆盖 `0.1.100 -> 0.2.0`。
- 覆盖 `0.100.100 -> 1.0.0`。
- 覆盖 `dev` 已高于刚发布版本时跳过。
- 覆盖 `dev` 低于刚发布版本时报错。
- 覆盖缺少对应 changelog 未发布标题时报错。

更新 `CHANGELOG.md`：

- 在当前 `Unreleased / 0.1.4` 中新增 Build 条目，说明发版后会自动准备 `dev`
  下一开发版本。

## 测试计划(UT)

需要执行：

- `yarn test tests/prepare-next-dev-version.test.mjs`
- `yarn test tests/release-version.test.mjs`
- `yarn test tests/changelog-release-notes.test.mjs`
- `yarn typecheck`
- `yarn build`

如果依赖、网络或环境导致验证失败，需要在最终说明中明确记录未覆盖风险。

## 影响范围

- `.github/workflows/release.yml`：新增发版后的 `dev` 版本准备 job。
- `scripts/prepare-next-dev-version.mjs`：新增版本进位和文件更新逻辑。
- `CHANGELOG.md`：新增用户可见构建流程变更记录。
- `tests/prepare-next-dev-version.test.mjs`：新增版本进位和文件更新回归测试。

## 风险与后续

- 如果 `dev` 分支保护禁止 GitHub Actions bot push，后置 job 会失败；后续可改为自动创建
  PR。
- 如果 `dev` 在发版后已有人工升版，本脚本会跳过，不会再补写 changelog。
- 如果 changelog 格式改变，需要同步调整脚本的标题匹配规则。
- 当前不支持 beta、alpha、rc 等预发布版本。

## 验收标准

- `master` 发版成功后不会自动修改 `master`。
- `dev` 当前版本等于刚发布版本时，会自动提升到下一开发版本。
- `dev` 当前版本高于刚发布版本时，workflow 幂等跳过。
- `dev` 当前版本低于刚发布版本时，workflow 失败并提示人工处理。
- `CHANGELOG.md` 顶部未发布版本标题随 `dev` 版本一起更新。
- release/changelog 相关测试通过。
