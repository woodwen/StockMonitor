# M-16(build): 固定 GitHub Releases 自动更新源

## 背景

- 自动更新文档仍写着 `generic` 发布源和 `https://updates.example.com/stock-monitor/` 占位地址。
- 当前桌面应用实际应通过 `electron-updater` 读取 GitHub Releases 上的安装包和更新元数据。
- Release workflow 依赖 package version 与 GitHub Releases 对比决定是否发布新版本，本次同步将版本推进到 `0.1.1`。

## 方案概述

- 将自动更新说明统一到 GitHub Releases：`https://github.com/woodwen/StockMonitor/releases`。
- 增加包配置 UT，锁定 `build.publish` 使用 GitHub provider 和 `woodwen/StockMonitor`。
- 保留现有发布流水线与 `electron-builder` 产物上传机制，不扩大到签名、notarization 或远端 PR 创建。

## 实现改动

- 更新 `README.md`：
  - 将自动更新发布源从 `generic` 占位源改为 GitHub Releases。
  - 说明更新元数据由 `electron-builder` 随安装包生成，并作为 Release assets 上传。
  - 明确 `package.json` 的 `build.publish` 已配置为 `woodwen/StockMonitor`。
- 更新 `tests/package-build-config.test.mjs`：
  - 新增断言，校验桌面自动更新发布源固定为 GitHub provider。
  - 校验 owner、repo 和 releaseType 分别为 `woodwen`、`StockMonitor`、`release`。
- 更新 `package.json`：
  - 将 package version 从 `0.1.0` 提升到 `0.1.1`，用于触发下一次稳定 Release。

## 测试计划(UT)

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

- push/merge 到发布分支后，确认 Release workflow 识别 `v0.1.1` 并创建 GitHub Release。
- 确认 Release assets 中包含三端安装包、blockmap 和更新元数据文件。
- 安装旧版本后手动触发 `帮助 -> 检查更新`，确认能从 GitHub Releases 检测到新版本。
- macOS/Windows 正式发布仍需单独验证签名与安装权限。

## 调查结论

- `package.json` 中 `build.publish` 已经配置为 GitHub provider，但文档没有同步，且缺少测试保护。
- `.github/workflows/release.yml` 会上传 `release/*.yml`、`release/*.yaml`、安装包和 blockmap 到 GitHub Release，符合 `electron-updater` 的 GitHub Releases 更新模型。

## 风险与后续

- 本地验证只能覆盖配置、类型检查、单元测试和构建；真正的自动更新下载链路需要发布后的 GitHub Release assets 手动验收。
- 本次不处理代码签名，未签名构建在部分系统上的安装或自动更新体验仍可能受平台安全策略影响。
