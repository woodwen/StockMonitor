# M-22(fix): 修复启动与更新交互问题

## 背景

- macOS 打包应用启动时可能因为 `stock:getDataSources` IPC handler 被重复注册而弹出主进程 JavaScript 错误。
- 应用标题栏和帮助菜单缺少当前版本信息，不便于用户确认安装版本。
- 手动检查更新时会把 `net::ERR_CONNECTION_CLOSED` 等底层网络错误直接暴露给用户。
- 下载更新弹窗在无进度或下载阻塞时只能停留在“正在下载更新”，无法取消，也无法转入后台。

## 方案概述

- 将 IPC handler 改为主进程级注册，并在注册前移除同名 handler，避免窗口重建或重复初始化触发 Electron 二次注册异常。
- 抽出应用元数据 helper，让窗口标题显示 `Stock Monitor v{version}`，并在帮助菜单新增“关于 Stock Monitor”。
- 抽出统一代理规则 helper，让行情请求和 `electron-updater` 共用应用内保存的代理设置。
- 更新检查和下载更新前同步代理到 `autoUpdater.netSession`，并将常见网络错误转换为中文可操作提示。
- 为下载更新接入 `CancellationToken`，新增 `update:cancelDownload` IPC。
- 下载弹窗新增“取消下载”和“后台下载”，关闭弹窗时按后台下载处理，取消时真实中止 updater 下载。

## 实现改动

- 修改 `src/main/index.ts`，调整 IPC 注册时机，新增版本化窗口标题并阻止 renderer title 覆盖。
- 修改 `src/main/ipc.ts`，新增重复注册防护和 `update:cancelDownload` handler。
- 新增 `src/main/app-metadata.ts`，统一应用名和版本化标题格式。
- 修改 `src/main/menu.ts`，拆出可测试菜单模板并新增“关于 Stock Monitor”弹窗。
- 新增 `src/main/network-proxy.ts`，统一 Electron session 和 HTTP 代理规则生成。
- 修改 `src/main/remote-stock-sources.ts`，复用统一代理 helper。
- 修改 `src/main/update-manager.ts`，同步 updater 代理、归一化网络错误文案、增加下载取消 token 和取消事件。
- 修改 `src/preload/index.ts`、`src/preload/stock-api.ts`，暴露取消下载 API。
- 修改 `src/renderer/features/app-update/*`，支持下载弹窗后台隐藏、取消下载和取消事件状态清理。
- 修改 `src/renderer/features/stock-workspace/views/NetworkProxyModal.tsx`，说明代理同时影响行情和更新检查。
- 修改 `package.json`，显式声明 `builder-util-runtime@9.7.0`。
- 新增 `docs/spec/feature/202608/0811-update-stability-ux/plan.md`，记录方案、测试计划和手动验收范围。

## 测试计划(UT)

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

新增测试覆盖：

- `tests/ipc-handlers.test.ts`：IPC handler 可重复注册不崩溃。
- `tests/app-metadata.test.ts`：窗口标题版本格式化。
- `tests/menu.test.ts`：帮助菜单“关于”入口和版本弹窗。
- `tests/update-manager.test.ts`：updater 代理同步、网络错误文案、下载取消 token。
- `tests/app-update-view-model.test.ts`：下载弹窗后台隐藏和取消下载状态。

## 影响范围(建议手动测试范围)

- macOS 打包应用启动和关闭窗口后重新激活，确认不再出现 IPC 二次注册错误。
- 标题栏显示 `Stock Monitor v{当前版本}`，帮助菜单可打开“关于 Stock Monitor”并看到版本号。
- 启用和禁用“网络代理”后分别执行“检查更新”，确认代理生效且网络错误为中文提示。
- 有新版本时点击下载更新，确认“后台下载”隐藏弹窗但下载继续，“取消下载”会退出下载中状态。
- 回归行情数据源加载、K 线请求、分时请求和网络代理设置保存。

## 调查结论

- Electron 的 `ipcMain.handle` 是进程级注册，不能跟随 `createWindow()` 重复调用。
- `electron-updater` 使用独立的 `electron-updater` session，不会自动继承行情请求使用的默认 session 代理。
- `electron-updater.downloadUpdate()` 支持传入 `CancellationToken`，可以实现真实取消下载。

## 风险与后续

- 下载取消和后台下载仍需要用真实 GitHub Release 包在 macOS 上端到端手动验证。
- 未签名或未 notarize 的 macOS 构建仍可能受系统安全策略影响，本次不处理签名链路。
- 后续如果需要从后台重新打开下载进度，需要额外增加工具栏或菜单入口。

## 验收标准

- 应用启动和窗口重建不再触发 IPC handler 二次注册错误。
- 标题栏和帮助菜单均能展示当前版本。
- 更新检查使用应用内网络代理设置。
- 网络错误不再原样裸露为 `net::ERR_CONNECTION_CLOSED`。
- 下载更新弹窗支持取消和后台下载，取消时真实中止 updater 下载。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
