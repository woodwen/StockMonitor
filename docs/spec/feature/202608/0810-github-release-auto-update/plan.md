# GitHub Releases 自动更新源固定

## 背景

当前项目已经接入 Electron 自动更新能力，并通过 GitHub Actions 发布桌面安装包和更新元数据。但自动更新相关文档和配置保护仍存在不一致：

- `README.md` 中仍记录 `generic` 发布源和 `https://updates.example.com/stock-monitor/` 占位地址。
- 桌面应用实际应通过 `electron-updater` 从 `woodwen/StockMonitor` 的 GitHub Releases 读取安装包和更新元数据。
- `package.json` 中已经存在 `build.publish` 配置，但缺少测试保护，后续可能被误改回占位源。
- Release workflow 依赖 `package.json` 的 `version` 与 GitHub Releases 最新正式版本对比来决定是否发布，本次需要推进到 `0.1.1` 触发下一次稳定发布。

本次目标是把自动更新源明确固定为 GitHub Releases，并用文档和 UT 保护配置一致性。

## 方案概述

采用配置保护和文档同步方案：

- 将 README 自动更新说明从 generic 占位源改为 GitHub Releases。
- 明确发布地址为 `https://github.com/woodwen/StockMonitor/releases`。
- 说明 `electron-builder` 随桌面安装包生成更新元数据，并由 Release workflow 作为 GitHub Release assets 上传。
- 在包配置测试中锁定 `build.publish`：
  - `provider = "github"`
  - `owner = "woodwen"`
  - `repo = "StockMonitor"`
  - `releaseType = "release"`
- 将 `package.json` 版本从 `0.1.0` 推进到 `0.1.1`，配合 release workflow 的版本比较逻辑触发下一次发布。

不扩大范围处理：

- 不修改 release workflow 的触发策略和产物上传策略。
- 不处理 macOS Developer ID、notarization 或 Windows 代码签名。
- 不创建远端 PR 或直接操作 GitHub Release。
- 不实现多发布通道、预发布版本或灰度更新。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 自动更新发布源 | GitHub Releases |
| Releases URL | `https://github.com/woodwen/StockMonitor/releases` |
| electron-builder provider | `github` |
| GitHub owner | `woodwen` |
| GitHub repo | `StockMonitor` |
| releaseType | `release` |
| 版本推进 | `0.1.0` -> `0.1.1` |
| 更新元数据来源 | `electron-builder` 随安装包生成 |
| 更新元数据落点 | GitHub Release assets |
| 签名与 notarization | 本次不处理 |

## 实现改动

### README

- 修改 `README.md` 的自动更新章节：
  - 将发布源从 `generic` 改为 GitHub Releases。
  - 将占位地址替换为 `https://github.com/woodwen/StockMonitor/releases`。
  - 补充更新元数据由 `electron-builder` 生成，并作为 Release assets 上传。
  - 明确 `package.json` 的 `build.publish` 已配置为 `woodwen/StockMonitor`。
  - 保留正式发布仍需准备 macOS/Windows 签名的提示。

### package.json

- 修改根目录 `package.json`：
  - 将 `version` 从 `0.1.0` 提升到 `0.1.1`。
  - 保持既有 `build.publish` GitHub provider 配置不变。

### 包配置测试

- 修改 `tests/package-build-config.test.mjs`：
  - 新增 `uses GitHub Releases as the desktop auto-update source` 用例。
  - 断言 `packageJson.build.publish` 完整等于 GitHub Releases 配置。
  - 防止后续误删 provider、owner、repo 或 releaseType。

## 测试计划(UT)

需要执行：

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

补充检查：

- 可单独运行 `yarn test tests/package-build-config.test.mjs --reporter=verbose` 快速验证包配置测试。
- 如执行本地提交，还需要执行 `git diff --cached --check`。

## 影响范围(建议手动测试范围)

### 自动更新配置

- 确认 `package.json` 中 `build.publish` 指向 GitHub provider。
- 确认 README 中自动更新说明不再出现 generic 占位源。
- 确认更新源 URL 与仓库 Releases 地址一致。

### 发布流程

- push/merge 到发布分支后，确认 Release workflow 识别 `v0.1.1`。
- 确认 workflow 只在当前版本高于最新正式 Release 时创建新 Release。
- 确认 Release assets 中包含桌面安装包、blockmap 和 `latest*.yml` 或同类更新元数据。

### 客户端更新链路

- 安装旧版本后通过 `帮助 -> 检查更新` 手动触发更新检测。
- 确认应用能从 GitHub Releases 检测到新版本。
- 确认下载完成后能进入提示重启安装流程。
- 在 macOS/Windows 上单独确认未签名构建的系统权限提示和安装体验。

## 调查结论

- `package.json` 中 `build.publish` 已经配置为 GitHub provider，但 README 没有同步，容易误导后续发布配置。
- `.github/workflows/release.yml` 会上传 `release/*.yml`、`release/*.yaml`、安装包和 blockmap 到 GitHub Release，符合 `electron-updater` 的 GitHub Releases 更新模型。
- 本地测试只能验证配置一致性，无法验证发布后的真实下载链路。

## 风险与后续

- GitHub Releases 自动更新链路必须等 Release assets 实际生成后才能端到端验收。
- 本次不处理代码签名，未签名构建在 macOS/Windows 上的安装或自动更新体验仍可能受系统安全策略影响。
- 如果后续增加 prerelease、beta 或多通道发布，需要重新定义 `releaseType`、版本比较和 README 说明。
- 如果 GitHub Release assets 命名或上传规则变更，需要同步更新 README 和包配置测试。

## 验收标准

- README 自动更新章节固定为 GitHub Releases 源。
- `package.json` 版本推进到 `0.1.1`。
- `build.publish` 配置保持为 `woodwen/StockMonitor` 的 GitHub release provider。
- `tests/package-build-config.test.mjs` 覆盖 GitHub Releases 自动更新源配置。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
- 发布后能在 GitHub Release assets 中看到安装包、blockmap 和更新元数据。
