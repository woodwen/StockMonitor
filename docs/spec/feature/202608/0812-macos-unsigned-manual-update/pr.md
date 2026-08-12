# M-28(fix): 降级 macOS 无签名更新安装

## 背景

- macOS 客户端从 GitHub Releases 成功下载 ZIP 后，Squirrel.Mac 在安装前校验
  `Stock Monitor.app` 签名失败，错误为“代码不含资源，但签名指示这些资源必须存在”。
- 当前发布配置显式跳过 macOS 签名：`package.json` 的 `build.mac.identity` 为
  `null`，release workflow 设置了 `CSC_IDENTITY_AUTO_DISCOVERY=false`。
- 暂时无法提供 Developer ID Application 证书和 notarization 时，继续调用
  `electron-updater.downloadUpdate()` 会稳定失败。

## 调查结论

- `electron-updater` 能正确发现 GitHub Releases 中的新版本。
- 本地 pending ZIP 的 sha512 与远端 `latest-mac.yml` 一致，排除下载损坏。
- 使用 `codesign --verify --deep --strict` 校验 ZIP 内 `.app` 可稳定复现签名错误。
- 当前已安装旧版本也存在同类签名问题，旧无签名版本无法靠自动更新自救。

## 方案概述

- 保留 GitHub Releases 更新检查能力。
- macOS packaged build 在未启用正式签名自动更新前，不再执行应用内自动下载和重启安装。
- 发现新版本时显示手动下载提示，用户点击后打开对应版本 GitHub Release 页面。
- 用户手动下载 DMG 并覆盖安装。
- Windows、Linux 和开发环境更新状态流不扩大改动范围。

## 实现改动

- 修改 `src/main/update-manager.ts`：
  - 增加 macOS 无签名手动安装判断。
  - `update-available` 在 macOS 无签名模式下发送 `manual-download` 事件。
  - `downloadUpdate()` 在 macOS 无签名模式下不再调用 `autoUpdater.downloadUpdate()`。
  - 新增 GitHub Release 下载 URL 生成和 `shell.openExternal()` 打开下载页能力。
- 修改 `src/main/ipc.ts`、`src/preload/index.ts` 和 `src/preload/stock-api.ts`：
  - 新增 `update:openDownloadPage` IPC。
  - typed preload API 新增 `openUpdateDownloadPage(version?: string)`。
- 修改 `src/renderer/features/app-update/*`：
  - 新增 `manual-download` 更新状态和事件类型。
  - ViewModel 支持打开手动下载页。
  - 更新弹窗在 macOS 无签名路径下显示“打开下载页”。
- 更新 `README.md`、离线使用说明、`CHANGELOG.md`、plan 和 PR 文档。

## 测试计划(UT)

- `yarn test tests/update-manager.test.ts tests/app-update-view-model.test.ts tests/ipc-handlers.test.ts tests/root-view-model.test.ts --reporter=verbose`
- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

- macOS 无签名 packaged build：
  - 安装旧版本后触发 `帮助 -> 检查更新`。
  - 确认发现新版本后显示手动下载提示。
  - 点击“打开下载页”，确认打开对应版本 GitHub Release 页面。
  - 确认不会下载 ZIP 或进入“立即重启安装”流程。
- macOS 手动安装：
  - 下载 DMG 后覆盖安装。
  - 确认工作区设置、自选股和网络代理配置仍保留。
- 非 macOS 平台：
  - Windows/Linux 更新检查和既有状态流不受新增 `manual-download` 状态影响。
- 开发环境：
  - `yarn dev` 下检查更新仍走开发环境模拟状态流。

## 风险与后续

- 已经安装的旧无签名版本仍需要用户手动安装新版 DMG。
- 手动安装只是临时止血，不能提供无感自动更新体验。
- 本次没有解决 Gatekeeper、Developer ID、notarization 或 Windows SmartScreen 问题。
- 取得 Developer ID 证书并完成 notarization 后，需要重新启用 macOS 应用内自动安装，并用真实 Release 包端到端验证。

## 验收标准

- macOS 无签名 packaged build 发现新版本后只提示手动下载。
- macOS 无签名 packaged build 不再调用自动下载安装路径。
- “打开下载页”能打开对应版本 GitHub Release 页面。
- 新增 IPC、preload API、更新事件类型和 ViewModel 状态均有测试覆盖。
