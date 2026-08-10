# M-15(build): 配置应用图标与仓库主页

## 背景

- 应用当前没有显式配置跨平台打包图标，Electron Builder 会回退到默认图标。
- 用户提供了新的行情主题图标，并希望 GitHub About/主页路径也补充到项目元数据中。

## 方案概述

- 基于用户提供的图片生成 `png`、`icns`、`ico` 三类图标资源，分别覆盖 Linux/运行时、macOS 和 Windows 打包场景。
- 在 Electron 主进程中为开发环境和打包环境解析运行时图标路径，保证窗口图标与 Dock 图标使用同一张图片。
- 在 `package.json` 中补充仓库主页路径，并用打包配置测试锁定图标和仓库元数据。

## 实现改动

- 新增 `build/icon.png`、`build/icon.icns`、`build/icon.ico` 作为应用图标资源。
- 更新 `package.json`，配置 `homepage`、`extraResources`、`mac.icon`、`win.icon`、`linux.icon`。
- 更新 `src/main/index.ts`，在非 macOS 窗口设置 `BrowserWindow.icon`，在 macOS 开发运行时设置 Dock 图标。
- 更新 `tests/package-build-config.test.mjs`，校验 homepage、repository URL、图标配置和图标文件存在。

## 测试计划(UT)

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

- 建议在 macOS 开发模式启动应用，确认 Dock 图标显示为新图标。
- 建议后续分别打包 macOS、Windows、Linux 产物，确认安装包和应用窗口图标显示正常。
- 建议在 GitHub 仓库 About 中同步 Website 为 `https://github.com/woodwen/StockMonitor#readme`。

## 风险与后续

- 完整 `electron-builder --mac dir` 验证曾在本地生成阶段长时间无输出，已终止；当前提交通过文件识别、类型检查、测试和生产构建验证。
- GitHub 远端 About 需要已登录会话、`gh` 或 API token 才能写入；本次只提交项目元数据路径。
