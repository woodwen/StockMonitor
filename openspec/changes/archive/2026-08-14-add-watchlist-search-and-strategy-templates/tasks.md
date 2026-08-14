## 1. 自选股搜索筛选

- [x] 1.1 在 `StockWorkspaceViewModel` 增加 `watchlistSearchText`、搜索 setter/clear 行为和 `filteredWatchlist` 派生列表，支持名称、完整 symbol、裸代码和大小写不敏感匹配。
- [x] 1.2 调整自选股面板关闭、清空搜索、搜索无结果和 watchlist 为空时的状态边界，确保搜索词不持久化、关闭面板时清空，且搜索不触发行情刷新或持久化写入。
- [x] 1.3 将管理模式下 `全选`、`反选` 和列表渲染改为基于当前筛选结果，同时保留隐藏已选条目的删除语义。
- [x] 1.4 更新 `WatchlistPanel` UI 和样式，增加搜索输入、清空入口、无匹配空状态，并保持现有添加、缓存和管理入口可用。
- [x] 1.5 补充 `tests/stock-workspace-view-model.test.ts` 自选股搜索、筛选点击、无匹配、搜索不刷新、管理模式筛选选择范围的测试。

## 2. 策略模板模型和元数据

- [x] 2.1 扩展 `KlineStrategyTemplateId` 和 `KlineStrategyTemplateDefinition`，增加附件 8 个稳定 id 以及 `typeLabel`、`basicLogic`、`recommendationLevel` 元数据。
- [x] 2.2 在 `klineStrategyTemplates` 中新增附件 8 个模板，配置默认参数、参数约束、最小样本数、兼容周期和信号解释，并保留既有 4 个模板 id。
- [x] 2.3 更新策略设置创建、clone、normalize 和未知 id 过滤逻辑，确保 fresh settings 默认选中全部可用模板、旧设置保留已保存选择，且新增模板默认参数可补齐。
- [x] 2.4 调整 `KlineStrategyPanel` 和 ViewModel 派生行数据，展示类型、基本逻辑和固定星级推荐程度，且历史表现排名仍按回测评分展示。

## 3. 新增策略信号计算

- [x] 3.1 在策略 model 中补齐可测试的 Bollinger、KDJ、ATR、成交量均线和多均线辅助计算函数。
- [x] 3.2 实现 `ma-bullish-alignment`、`n-day-high-breakout`、`volume-breakout`、`bollinger-breakout` 的确定性 `buy`/`sell` 信号生成。
- [x] 3.3 实现 `bollinger-mean-reversion`、`kdj-oversold-rebound`、`atr-trend-following`、`low-volume-ma-pullback` 的确定性 `buy`/`sell` 信号生成。
- [x] 3.4 确保新增模板结果继续复用现有回测成交、成本、指标、排名和图表信号传递流程，不新增 renderer 远端请求。
- [x] 3.5 补充 `tests/kline-strategy-backtesting.test.ts`，覆盖新增模板元数据、固定推荐程度、参数校验、fresh settings 默认全选、旧设置兼容和每个新增模板的 deterministic 信号/交易结果。

## 4. 文档和验证

- [x] 4.1 更新用户可见说明和 `CHANGELOG.md` 的 `Unreleased / <current package.json version>` 区块，描述自选股搜索筛选和新增策略模板。
- [x] 4.2 运行 `yarn typecheck`。
- [x] 4.3 运行 `yarn test tests/stock-workspace-view-model.test.ts`。
- [x] 4.4 运行 `yarn test tests/kline-strategy-backtesting.test.ts`。
- [x] 4.5 运行 `yarn test`。
- [x] 4.6 运行 `openspec validate add-watchlist-search-and-strategy-templates --strict`。
