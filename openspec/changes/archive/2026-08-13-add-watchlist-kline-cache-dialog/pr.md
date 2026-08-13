# M-36(feat): 新增自选股 K 线缓存管理

OpenSpec Change: add-watchlist-kline-cache-dialog

## 背景:

- 自选股已支持本地维护，但缺少批量缓存历史 K 线数据的入口。
- 后续策略扫描和回测需要稳定、可复用、可判断完整性的本地历史 K 线数据。

## 方案概述:

- 新增自选股历史 K 线缓存管理弹窗，按单一数据源、多个周期、多个复权组合和日期范围展示缓存完整性。
- 周期使用 `日线`、`周线`、`月线` 复选框组，复权使用 `前复权`、`不复权`、`后复权` 复选框组，默认按数据源能力过滤后全选。
- 缓存状态、刷新任务和清理操作统一以一行一个 `symbol + period + adjust` 组合为粒度。
- 缓存持久化放在 main process 文件目录，renderer 只通过 typed preload bridge 调用缓存能力。

## 实现改动:

- 新增 `src/main/kline-cache.ts`，实现 `kline-cache/v1` 文件缓存、覆盖区间计算、缓存读取、批量刷新 job、取消任务、行级错误和按组合清理。
- 扩展 `StockApi`、preload 和 IPC handlers，新增缓存状态查询、刷新、job 查询、取消、读取和清理 API。
- 扩展 stock workspace ViewModel 和 adapter，管理缓存弹窗状态、组合查询草稿、组合行选择、轮询任务和结构化 clone 安全请求。
- 新增 `KlineCacheManagementModal`，并在自选股面板提供缓存入口；弹窗展示名称、周期、复权、状态、记录数、缓存范围、缺失范围、最近刷新和消息。
- 更新 OpenSpec 主 specs，并归档 `add-watchlist-kline-cache-dialog`。

## 测试计划(UT):

- `openspec validate add-watchlist-kline-cache-dialog --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test tests/kline-cache.test.ts tests/kline-cache-service.test.ts tests/ipc-handlers.test.ts tests/stock-workspace-view-model.test.ts`
- `yarn test tests/remote-stock-sources.test.ts`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- 自选股面板缓存入口和缓存管理弹窗打开/关闭。
- 周期和复权复选框默认值、数据源切换后的能力过滤、空选择提示。
- 刷新全部、刷新选中、清理选中、取消任务和任务进度显示。
- 本地缓存读取不联网补齐、unsupported 组合跳过远端请求、缓存失败不影响当前图表。

## 风险与后续:

- 默认全选会将每只自选股展开为最多 9 个请求，watchlist 较大时耗时会增加；第一版采用顺序刷新并支持取消。
- 完整性按成功覆盖区间判断，不引入交易日历推断；后续策略模块如需交易日级校验，可在缓存服务上继续扩展。
