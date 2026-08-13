## Why

当前应用可以查询单只证券的 K 线数据，也可以本地维护自选股，但缺少面向自选股批量缓存历史 K 线的管理入口。后续策略回测或扫描需要稳定、可复用且可判断完整性的历史 K 线数据，因此需要先建立缓存管理弹窗和缓存状态契约。

## What Changes

- 新增自选股历史 K 线缓存管理弹窗，展示自选股在指定单一数据源、多个周期、多个复权组合和日期范围下的缓存完整情况。
- 周期从单选改为复选框组，支持 `日线`、`周线`、`月线` 默认全选；复权从单选改为复选框组，支持 `前复权`、`不复权`、`后复权` 默认全选。
- 缓存状态以一行一个 `symbol + period + adjust` 组合展示，包含周期、复权、进度、成功、失败、缺口和最近更新时间。
- 支持用户对全部组合或表格选中的组合发起缓存刷新，并按 `自选股 × 已选周期 × 已选复权` 展开任务。
- 新增 main process 侧历史 K 线缓存管理能力，renderer 通过 typed preload bridge 查询缓存状态和触发缓存任务。
- 提供按相同查询维度读取已缓存 K 线数据的能力，供后续策略模块复用；读取缓存时不静默请求远端补齐。
- 缓存完整性以单个 `StockQuery` 的 source、symbol、period、adjust、startDate 和 endDate 为维度计算；请求层支持 `periods` 和 `adjusts`，底层缓存 key 仍按单个组合隔离，避免不同数据源或复权口径混用。
- 缓存管理默认使用当前 K 线 query 的单一数据源和日期范围，但周期/复权默认使用第一版明确支持的 `day/week/month` 与 `qfq/none/hfq`；不默认包含分钟线。
- 缓存存储默认使用 `userData/kline-cache/v1` 文件型 JSON；第一版支持按表格选中的组合清理缓存，不做全局容量策略。
- 缓存失败 SHALL 保留已有可用缓存和清晰错误原因，不影响当前工作区图表刷新。
- 用户可见变更需要更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块。

## Capabilities

### New Capabilities
- `kline-cache-management`: 管理自选股历史 K 线缓存、完整性状态、批量刷新任务和缓存数据边界。

### Modified Capabilities
- `watchlist`: 自选股面板需要提供进入历史 K 线缓存管理弹窗的入口，并以当前 watchlist 作为缓存对象来源。
- `stock-workspace`: 工作区需要编排缓存弹窗状态、缓存范围默认值和后台任务状态，同时保持当前图表刷新行为不被缓存任务破坏。
- `market-data-sources`: K 线缓存的远端请求必须继续遵守 main process 与 typed preload bridge 边界，并复用数据源能力校验、代理设置和 fallback 规则。

## Impact

- 影响 `src/main/`：新增或扩展 K 线缓存服务、持久化存储、IPC handlers、远端 K 线请求复用、组合展开和日志。
- 影响 `src/preload/`：新增缓存状态查询和缓存刷新任务的 typed API，缓存请求类型使用 `periods` 和 `adjusts`。
- 影响 `src/renderer/features/stock-workspace/`：新增缓存管理弹窗 View/ViewModel 状态，扩展自选股面板入口、adapter、周期/复权复选框组和组合表格选择。
- 影响测试：新增缓存 model/service 单元测试，扩展 IPC、store、ViewModel、组合展开和远端行情源边界测试。
- 影响文档：更新 OpenSpec specs，实施时同步 `CHANGELOG.md`。
