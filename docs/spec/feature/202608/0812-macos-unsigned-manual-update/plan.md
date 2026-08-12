# macOS 无签名自动更新临时降级

## 背景

用户在 macOS 端手动触发应用更新后，ZIP 下载成功，但安装阶段弹窗显示：

```text
Code signature at URL file:///Users/mac/Library/Caches/com.stockmonitor.desktop.ShipIt/update.NE2vYxZ/Stock%20Monitor.app/ did not pass validation:
代码不含资源，但签名指示这些资源必须存在
```

本地排查确认：

- `electron-updater` 已从 GitHub Releases 正确发现 `0.1.5`。
- `Stock-Monitor-0.1.5-arm64.zip` 已下载到 updater pending 缓存。
- 本地 ZIP 的 sha512 与远端 `latest-mac.yml` 完全一致，排除下载损坏或篡改。
- 使用 `codesign --verify --deep --strict` 校验 ZIP 内 `Stock Monitor.app` 可稳定复现同一签名错误。
- 当前安装在 `/Applications/Stock Monitor.app` 的旧版本也存在同类签名问题。

根因是当前 macOS 发布包没有正式 app bundle 签名。`package.json` 中
`build.mac.identity` 为 `null`，release workflow 中设置了
`CSC_IDENTITY_AUTO_DISCOVERY=false`。Squirrel.Mac 在安装更新前会校验下载后的
`.app` 代码签名；在无法提供 Developer ID Application 证书和 notarization 的阶段，
继续走 `electron-updater.downloadUpdate()` 会稳定失败。

## 方案概述

采用临时降级策略：保留 GitHub Releases 版本检查，但 macOS packaged build 在未启用
正式签名自动更新前，不再执行应用内自动下载和自动安装。

用户路径调整为：

1. 用户通过 `帮助 -> 检查更新` 或顶部工具栏触发检查。
2. 应用继续使用 `electron-updater.checkForUpdates()` 读取 GitHub Releases 更新元数据。
3. macOS packaged build 发现新版本时，不进入“下载更新”流程，而是显示手动下载提示。
4. 用户点击“打开下载页”，应用打开对应版本 GitHub Release 页面。
5. 用户手动下载 DMG 并覆盖安装。

本次不尝试用 ad-hoc signing 绕过问题。临时实验表明 ad-hoc 签名可让
`codesign --verify --deep --strict` 通过，但仍无法通过 Gatekeeper `spctl` 评估，
也不能提供正式分发需要的稳定签名身份。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| macOS 无签名更新方式 | 手动下载 GitHub Release DMG |
| 版本检查 | 保留 `electron-updater.checkForUpdates()` |
| 应用内下载 | macOS 无签名 packaged build 禁用 |
| 重启安装 | macOS 无签名 packaged build 不进入该流程 |
| 下载页 | 优先打开 `https://github.com/woodwen/StockMonitor/releases/tag/v${version}` |
| 未知版本下载页 | 回退到 `https://github.com/woodwen/StockMonitor/releases` |
| Windows/Linux | 不扩大改动范围，保留现有行为 |
| 开发环境 | 保留现有模拟状态流和不真实更新策略 |
| 正式根治 | 后续补 Developer ID 签名和 notarization |

## 实现改动

### 主进程更新管理

修改 `src/main/update-manager.ts`：

- 新增 `MACOS_SIGNED_AUTO_UPDATE_ENABLED=false`，作为当前临时策略开关。
- 新增 `shouldUseManualMacUpdateInstall()`：
  - packaged build
  - `process.platform === "darwin"`
  - 未启用签名自动更新
- `update-available` 事件中记录最新可用版本。
- macOS 无签名模式下发送 `{ type: "manual-download" }`，不发送自动下载用的
  `{ type: "available" }`。
- `downloadUpdate()` 增加保护，macOS 无签名模式下不调用
  `autoUpdater.downloadUpdate()`。
- 新增 `getReleaseDownloadUrl()` 生成 GitHub Release URL。
- 新增 `openUpdateDownloadPage()`，通过 `shell.openExternal()` 打开下载页。

### IPC 与 preload API

修改 `src/main/ipc.ts`、`src/preload/index.ts` 和 `src/preload/stock-api.ts`：

- 新增 IPC channel：`update:openDownloadPage`。
- 在 typed `StockApi` 中新增：

```ts
openUpdateDownloadPage(version?: string): Promise<void>
```

### Renderer 更新状态

修改 `src/renderer/features/app-update/models/update-types.ts`：

- `UpdateStatus` 新增 `manual-download`。
- `AppUpdateEvent` 新增：

```ts
{ type: 'manual-download'; version?: string; message: string }
```

修改 `src/renderer/features/app-update/view-models/AppUpdateViewModel.ts`：

- 处理 `manual-download` 事件并进入手动下载状态。
- 新增 `openManualDownloadPage()`，调用 preload API 打开下载页。
- 打开下载页成功后回到 `idle`，失败时展示更新错误弹窗。

修改 `src/renderer/features/app-update/views/UpdateStatusView.tsx`：

- 新增“发现新版本”手动下载弹窗。
- 主按钮文案为“打开下载页”。
- 取消按钮文案为“稍后”。

### 文档与更新日志

- 更新 `README.md` 自动更新说明，记录 macOS 无签名阶段会打开 GitHub Release 下载页。
- 更新离线使用说明书的“应用更新”章节。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.6`。
- 新增本方案文档和 PR 记录。

## 测试计划(UT)

需要执行：

```bash
yarn test tests/update-manager.test.ts tests/app-update-view-model.test.ts tests/ipc-handlers.test.ts tests/root-view-model.test.ts --reporter=verbose
yarn typecheck
yarn test
yarn build
git diff --check
```

重点覆盖：

- `tests/update-manager.test.ts`
  - macOS packaged build 且未启用签名自动更新时，进入手动安装策略。
  - 打开指定版本 GitHub Release 下载页。
  - 原有下载取消能力仍可在强制自动安装测试路径下验证。
- `tests/app-update-view-model.test.ts`
  - `manual-download` 事件会进入手动下载状态。
  - 点击打开下载页会调用 preload API，并在成功后回到 `idle`。
- `tests/ipc-handlers.test.ts`
  - `update:openDownloadPage` handler 可重复注册。
- `tests/root-view-model.test.ts`
  - typed fake `StockApi` 与新增 preload API 保持一致。

## 影响范围(建议手动测试范围)

### macOS 无签名 packaged build

- 安装旧版本后触发 `帮助 -> 检查更新`。
- 确认能发现 GitHub Releases 中的新版本。
- 确认弹窗提示需要手动下载，不再显示“下载更新”按钮。
- 点击“打开下载页”，确认打开对应版本 GitHub Release 页面。
- 确认不会下载 ZIP 到 updater pending 目录。
- 确认不会进入“更新已下载”或“立即重启安装”流程。

### macOS 手动安装

- 从 GitHub Release 页面下载 DMG。
- 手动覆盖安装后启动应用。
- 确认用户配置、工作区设置、自选股和网络代理设置仍保留。
- 再次检查更新时，如没有新版本，应显示“当前已经是最新版本”。

### 非 macOS 平台

- Windows 检查更新、下载更新和安装流程不因 `manual-download` 状态受影响。
- Linux 检查更新不因新增 IPC/API 受影响。

### 开发环境

- `yarn dev` 下触发“检查更新”，确认仍走开发环境模拟状态流。
- 点击下载更新时仍提示开发环境不下载更新包。

## 风险与后续

- 已经安装的旧无签名版本无法通过自动更新修复自己，需要用户手动安装新版 DMG。
- 手动安装不会提供无感更新体验，只是避免继续展示系统签名校验失败。
- 本次没有解决 Gatekeeper、Developer ID、notarization 或 Windows SmartScreen 问题。
- 后续取得 Developer ID 证书后，需要：
  - 移除或打开 `MACOS_SIGNED_AUTO_UPDATE_ENABLED`。
  - 配置 CI 签名证书和 notarization 密钥。
  - 增加 `forceCodeSigning: true`，避免再次静默产出无签名 macOS 包。
  - 用真实旧版本到新版本端到端验证 Squirrel.Mac 自动更新。

## 验收标准

- macOS 无签名 packaged build 发现新版本后只提示手动下载。
- macOS 无签名 packaged build 不再调用自动下载安装路径。
- “打开下载页”能打开对应版本 GitHub Release 页面。
- 新增 IPC、preload API、更新事件类型和 ViewModel 状态均有测试覆盖。
- README、离线使用说明、CHANGELOG 和 feature 文档同步更新。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
