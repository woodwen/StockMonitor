## Why

当前工作区会持久化 K 线 query 的 `startDate` 和 `endDate`。用户保存过设置后，应用重启会原样恢复上次日期范围；如果几天后再次打开应用，K 线默认查询、策略回测区间和缓存弹窗默认日期仍停留在旧结束日期，用户需要手动把日期调到当天。

默认 K 线查询本身以“启动日”为基准生成最近两年日期范围。保存设置后的重启行为也应延续这个滚动基准，让每次打开应用时日期范围自动对齐当天，同时尽量保留用户选择的日期窗口长度。

## What Changes

- 应用每次重启并加载工作区设置时，系统把已保存 K 线 query 的 `endDate` 调整为当前启动日的 `YYYYMMDD`。
- 调整 `endDate` 时，系统按保存的 `startDate` 与 `endDate` 之间的日期跨度同步平移 `startDate`，保持用户原先选择的日期窗口长度。
- 该自动调整只发生在重启加载工作区设置阶段；用户在本次会话中手动输入历史日期范围时，系统不应立即强制改回当天。
- 自动调整只影响 K 线 query 的日期范围，不改变保存的证券代码、数据源、周期、复权、视图模式、分时数据源、指标设置、策略回测偏好或自选股。
- 启动后的 K 线刷新、策略回测日期来源和历史 K 线缓存弹窗默认日期应使用调整后的 query。
- 当重启加载阶段实际调整日期基准时，系统应通过现有工作区设置保存路径写回调整后的 query；保存失败不应阻止启动刷新。
- README、应用内使用说明书和 `CHANGELOG.md` 需要同步这个用户可见启动行为。
- 不改变远端行情源协议、K 线缓存存储格式、策略算法、回测评分、自动刷新时机或分时日期行为。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `stock-workspace`: 工作区重启加载保存设置时刷新 K 线 query 的日期基准到当天，并保持日期窗口长度。

## Impact

- 影响 `StockWorkspaceViewModel` 的工作区设置加载流程和日期 query normalize 边界。
- 影响依赖当前 K 线 query 的启动 K 线刷新、策略回测 query、历史 K 线缓存弹窗默认日期。
- 需要补充 ViewModel 单测，覆盖重启时日期范围平移、当天重复重启不额外改变，以及手动输入历史日期不在同会话中被强制覆盖。
- 需要更新 README、应用内 `使用说明书` 和 `CHANGELOG.md` 的用户可见行为说明。
- 实施阶段按项目规则运行 `openspec validate <change> --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`，并运行工作区 ViewModel 与 changelog 相关定向测试。
