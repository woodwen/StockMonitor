# M-24(build): 发版后自动准备 dev 下一版本

## 背景:

- 当前 `master` 发版流程以 `package.json.version` 高于最新正式 GitHub Release 为发布条件。
- 发版成功后如果不提升 `dev` 的版本号，后续开发可能继续累积在已发布版本上。
- 版本号不能在 `master` 发版后自动回写，否则会让 `master` 偏离刚发布的版本状态。

## 方案概述:

- 新增 `scripts/prepare-next-dev-version.mjs`，集中处理下一开发版本计算和文件更新。
- Release workflow 在 `publish` 成功后新增 `bump-dev-version` job，只 checkout 并 push
  `dev` 分支。
- `master` 发版完成后保持原发布版本，不自动提交版本号变更。
- 版本进位遵循 `minor` 和 `patch` 最高为 `100` 的规则：
  - `0.1.99 -> 0.1.100`
  - `0.1.100 -> 0.2.0`
  - `0.100.100 -> 1.0.0`

## 实现改动:

### 新增脚本

新增 `scripts/prepare-next-dev-version.mjs`：

- 校验稳定 semver，且 `minor`、`patch` 必须在 `0..100`。
- 计算下一开发版本。
- 比较 `dev` 当前版本和刚发布版本：
  - 相等时更新。
  - `dev` 已更高时跳过。
  - `dev` 更低时失败。
- 只更新 `package.json` 和 `CHANGELOG.md` 顶部 `Unreleased / X.Y.Z` 标题。
- 在 GitHub Actions 中输出 `changed`、`version` 和 `next_version`。

### 更新 release workflow

更新 `.github/workflows/release.yml`：

- 新增 `bump-dev-version` job，依赖 `check-version` 和 `publish`。
- checkout `dev` 分支并调用新增脚本。
- 仅当脚本输出 `changed=true` 时提交：
  `chore(release): prepare v<nextVersion> [skip release] [skip ci]`
- push 目标固定为 `origin HEAD:dev`。
- 不强推、不 rebase、不修改 `master`。

### 测试与文档

- 新增 `tests/prepare-next-dev-version.test.mjs`，覆盖版本进位、跳过、失败和 changelog
  更新。
- 扩展 `tests/package-build-config.test.mjs`，断言 release workflow 包含发版后准备
  `dev` 下一版本的关键结构。
- 新增方案文档：
  `docs/spec/feature/202608/0811-post-release-dev-version-bump/plan.md`。
- 更新 `CHANGELOG.md` 当前未发布区块。

## 测试计划(UT):

已执行并通过：

- `yarn test tests/prepare-next-dev-version.test.mjs tests/release-version.test.mjs tests/changelog-release-notes.test.mjs tests/package-build-config.test.mjs`
- `yarn test`
- `yarn typecheck`
- `node scripts/extract-changelog-release-notes.mjs --check`
- `git diff --check`
- `yarn build`

## 影响范围(建议手动测试范围):

- 影响 GitHub Actions 发版后的后置维护步骤。
- 不改变 Release 创建、artifact 上传、npm publish、自动更新元数据生成流程。
- 不改变 renderer/main/preload 运行时代码。

## 风险与后续:

- 如果 `dev` 分支保护禁止 GitHub Actions bot push，后置 job 会失败；已完成的 release
  不受影响。
- 如果 `dev` 缺少对应 `Unreleased / <releasedVersion>` 标题，脚本会失败并要求人工处理。
- 后续如需要自动 PR 模式，可在 bot push 受限时单独扩展。

## 验收标准:

- 发布成功后只自动准备 `dev` 下一版本。
- `master` 不被版本准备提交修改。
- `patch` 和 `minor` 的 `100` 上限进位规则有测试覆盖。
- `dev` 已提前升版时幂等跳过，`dev` 落后时失败。
