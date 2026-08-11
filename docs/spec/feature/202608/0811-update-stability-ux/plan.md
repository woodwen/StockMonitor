# 桌面启动与更新体验修复

## 背景

用户在 macOS 打包应用中连续遇到几类桌面体验问题：

- 应用启动时报错：

```text
Attempted to register a second handler for 'stock:getDataSources'
```

- 窗口标题只显示 `Stock Monitor`，无法从标题栏快速确认当前版本。
- 帮助菜单中缺少“关于”入口，用户无法在应用内查看版本信息。
- 手动“检查更新”时出现原始网络错误：

```text
net::ERR_CONNECTION_CLOSED
```

- 点击下载更新后，如果没有实际下载进度，弹窗会一直卡在“正在下载更新 0%”，且无法取消或切到后台。

本次目标是修复 Electron 主进程启动稳定性，补齐应用版本可见性，并改善自动更新链路在网络失败、代理环境、下载中断和后台下载场景下的用户体验。

## 方案概述

采用主进程稳定性修复和更新流程状态增强方案：

- 将 IPC handler 注册从窗口创建流程中移出，改为应用 ready 后的进程级初始化。
- 注册 IPC handler 前先移除同名 handler，避免窗口重建或主进程重复初始化时触发 Electron 二次注册异常。
- 抽出应用名称和版本标题格式化逻辑，窗口标题统一显示 `Stock Monitor v{version}`。
- 在“帮助”菜单新增“关于 Stock Monitor”，显示当前应用版本。
- 将网络代理规则抽成主进程共享 helper，让行情请求和 `electron-updater` 共用应用内保存的代理设置。
- 更新检查和下载更新前，将代理同步到 `electron-updater` 独立 session。
- 将 `net::ERR_*`、`ECONNRESET`、`ENOTFOUND` 等网络错误转换成中文可操作提示。
- 下载更新时创建并保存 `CancellationToken`，提供真实取消能力。
- “正在下载更新”弹窗支持：
  - 取消下载。
  - 后台下载。
  - 点关闭按钮隐藏弹窗但不取消下载。
- 下载状态由主进程事件驱动，取消、完成、失败时回到对应 UI 状态。

不扩大范围处理：

- 不改 GitHub Release 发布策略。
- 不修改 macOS 代码签名、notarization 或安装权限策略。
- 不处理历史 Release 中已发布的错误更新元数据。
- 不新增多更新通道、灰度更新或断点续传能力。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| IPC 注册时机 | `app.whenReady()` 后进程级注册 |
| IPC 重复注册防护 | 注册前调用 `ipcMain.removeHandler(channel)` |
| 窗口标题 | `Stock Monitor v{app.getVersion()}` |
| 关于入口 | `帮助 -> 关于 Stock Monitor` |
| 关于内容 | 应用名 + `版本 {app.getVersion()}` |
| 更新代理来源 | 应用内“网络代理”设置 |
| updater 代理目标 | `autoUpdater.netSession` |
| 下载取消机制 | `builder-util-runtime` 的 `CancellationToken` |
| 关闭下载弹窗 | 默认后台下载，不取消任务 |
| 用户取消下载 | 调用主进程 `update:cancelDownload` |

## 实现改动

### Electron 主进程启动

- 修改 `src/main/index.ts`：
  - 将 `registerIpcHandlers()` 从 `createWindow()` 移到 `app.whenReady()`。
  - 新增 `windowTitle`，使用 `formatVersionedAppTitle(app.getVersion())`。
  - 监听 `page-title-updated`，阻止 renderer 的 HTML title 覆盖窗口标题。

- 修改 `src/main/ipc.ts`：
  - 移除窗口参数，IPC 注册不再依赖具体窗口实例。
  - 新增 `registerIpcHandler(channel, handler)`，注册前先 `ipcMain.removeHandler(channel)`。
  - 新增 `update:cancelDownload` IPC。

### 应用元数据与关于菜单

- 新增 `src/main/app-metadata.ts`：
  - 定义 `APP_NAME = 'Stock Monitor'`。
  - 提供 `formatVersionedAppTitle(version)`。

- 修改 `src/main/menu.ts`：
  - 拆出 `buildApplicationMenuTemplate(window)` 便于 UT 覆盖。
  - 在“帮助”菜单中新增“关于 Stock Monitor”。
  - 点击后通过 `dialog.showMessageBox()` 显示应用名和当前版本。

### 网络代理与更新检查

- 新增 `src/main/network-proxy.ts`：
  - 提供 `getElectronProxyRules(proxy)`。
  - 提供 `getHttpProxyUrl(proxy)`。

- 修改 `src/main/remote-stock-sources.ts`：
  - 删除本文件内重复的代理规则函数。
  - 改为复用 `network-proxy.ts`。

- 修改 `src/main/update-manager.ts`：
  - 更新检查和下载更新前调用 `applyUpdaterProxySettings()`。
  - 将应用内保存的代理配置同步到 `autoUpdater.netSession.setProxy()`。
  - 网络类 updater 错误改为中文可操作提示。
  - 保留原始错误信息，作为括号中的辅助信息展示。

- 修改 `src/renderer/features/stock-workspace/views/NetworkProxyModal.tsx`：
  - 调整说明文案，明确代理设置同时影响行情请求和更新检查。

### 更新下载控制

- 修改 `src/main/update-manager.ts`：
  - 引入 `CancellationToken`。
  - 下载开始时保存当前 token。
  - `cancelUpdateDownload()` 调用 token 的 `cancel()`。
  - 监听 `update-cancelled` 和取消错误，向 renderer 发送 `{ type: 'cancelled' }`。
  - 避免重复触发下载时创建多个并发下载任务。

- 修改 `src/preload/stock-api.ts` 和 `src/preload/index.ts`：
  - 在 preload API 中新增 `cancelUpdateDownload()`。

- 修改 `src/renderer/features/app-update/models/update-types.ts`：
  - 在 `AppUpdateEvent` 中新增 `cancelled` 事件。

- 修改 `src/renderer/features/app-update/view-models/AppUpdateViewModel.ts`：
  - 新增 `isDownloadDialogVisible`。
  - `downloadUpdate()` 立即进入下载中状态并显示 0% 进度。
  - 新增 `downloadInBackground()`，只隐藏弹窗，不取消下载。
  - 新增 `cancelDownload()`，调用主进程取消接口并退出下载中状态。
  - 收到 `cancelled`、`downloaded`、`error` 时恢复弹窗可见状态或清理状态。

- 修改 `src/renderer/features/app-update/views/UpdateStatusView.tsx`：
  - “正在下载更新”弹窗新增“取消下载”和“后台下载”按钮。
  - 取消按钮触发真实下载取消。
  - 后台下载和关闭按钮只隐藏弹窗。

### 依赖

- 修改 `package.json`：
  - 显式增加 `builder-util-runtime@9.7.0`，用于主进程直接创建 `CancellationToken`。

## 测试计划(UT)

新增或扩展以下 UT：

- `tests/ipc-handlers.test.ts`
  - 覆盖 `registerIpcHandlers()` 可重复调用，不再触发同名 IPC handler 二次注册异常。

- `tests/app-metadata.test.ts`
  - 覆盖窗口标题格式化为 `Stock Monitor v{version}`。
  - 覆盖版本号为空时回退应用名。

- `tests/menu.test.ts`
  - 覆盖“帮助”菜单包含“关于 Stock Monitor”。
  - 覆盖关于弹窗显示当前版本。

- `tests/update-manager.test.ts`
  - 覆盖更新检查前会把保存的代理设置同步到 updater session。
  - 覆盖 `net::ERR_CONNECTION_CLOSED` 转换为中文网络错误提示。
  - 覆盖下载中的更新可以通过 `cancelUpdateDownload()` 取消。

- `tests/app-update-view-model.test.ts`
  - 覆盖下载弹窗可以切到后台且下载状态保持。
  - 覆盖取消下载会调用 preload API 并退出下载中状态。

需要执行：

```bash
yarn test
yarn typecheck
yarn build
```

已执行并通过：

```bash
yarn test
yarn typecheck
yarn build
```

补充检查：

```bash
git diff --check
```

## 影响范围(建议手动测试范围)

### 启动与窗口

- 启动打包后的 macOS 应用，确认不再弹出 `Attempted to register a second handler` 主进程错误。
- 关闭所有窗口后重新激活应用，确认窗口可重新创建且不触发 IPC 二次注册错误。
- 确认标题栏显示 `Stock Monitor v{当前版本}`。
- 确认 renderer 页面标题不会把窗口标题覆盖回 `Stock Monitor`。

### 帮助菜单

- 打开 `帮助 -> 关于 Stock Monitor`。
- 确认弹窗显示应用名和当前版本。
- 确认 `帮助 -> 检查更新` 仍可触发更新检查。

### 网络代理与更新检查

- 未启用代理时执行“检查更新”，确认失败时显示中文可读错误，不再只显示 `net::ERR_CONNECTION_CLOSED`。
- 启用 SOCKS5 代理，例如 `127.0.0.1:7890`，确认“检查更新”会走代理。
- 启用 HTTP 代理，确认行情请求和更新检查都可使用同一代理设置。
- 代理不可用时，确认错误提示不会导致应用崩溃。

### 更新下载

- 有新版本时点击“下载更新”，确认立即显示下载中弹窗和进度。
- 点击“后台下载”，确认弹窗隐藏，下载任务继续。
- 后台下载完成后，确认显示“更新已下载”并可进入“立即重启安装”流程。
- 点击“取消下载”，确认弹窗关闭，下载状态退出，不再卡在 0%。
- 网络断开或下载失败时，确认进入“更新检查失败”或错误状态，并可关闭提示。

### 回归范围

- 行情数据源列表加载。
- K 线数据请求。
- 分时数据请求。
- 网络代理设置保存和恢复。
- macOS、Windows、Linux 打包构建。

## 风险与后续

- 现有 `/Applications/Stock Monitor.app` 如果仍是旧包，需要重新打包安装后才能看到这些修复。
- 下载取消依赖 `electron-updater` 对 `CancellationToken` 的支持；不同平台仍需用真实 Release 包手动验证。
- 未签名或未 notarize 的 macOS 构建仍可能受到 Gatekeeper 或系统安全策略影响，本次不处理签名链路。
- GitHub Releases 网络访问仍依赖用户本地网络和代理可用性，本次只保证应用会使用保存的代理并给出更清晰错误。
- 如果后续要支持后台下载状态入口，需要在工具栏或菜单中增加“查看下载进度”入口；本次只实现隐藏弹窗和完成/失败回弹。

## 验收标准

- 应用启动和窗口重建不再触发 IPC handler 二次注册错误。
- 标题栏显示当前版本号。
- 帮助菜单包含“关于 Stock Monitor”，并展示当前版本。
- 更新检查会使用应用内网络代理设置。
- 网络错误不再原样裸露为 `net::ERR_CONNECTION_CLOSED`。
- 下载更新弹窗支持取消和后台下载。
- 取消下载会触发真实 updater cancellation，不只是关闭 UI。
- `yarn test`、`yarn typecheck`、`yarn build` 通过。
