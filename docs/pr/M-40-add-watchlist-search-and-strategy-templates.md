# M-40(feat): 新增自选搜索与策略模板

OpenSpec Change: add-watchlist-search-and-strategy-templates

背景:
- 自选股列表增长后缺少搜索筛选入口，切换和管理效率下降。
- K 线历史回测模板不足以覆盖新增的趋势、突破、量价、波动和反转类候选策略。

方案概述:
- 在自选股面板增加本地搜索筛选，搜索词作为临时状态，不持久化，关闭面板时清空。
- 扩展策略模板 registry，保留既有 4 个模板 id，新增附件 8 个候选模板及类型、基本逻辑、推荐程度元数据。
- 将 OpenSpec delta 同步到主 specs 并归档 change。

实现改动:
- `StockWorkspaceViewModel` 增加 `watchlistSearchText`、`filteredWatchlist` 和筛选范围内的全选/反选逻辑；`WatchlistPanel` 增加搜索框和无匹配空态。
- `KlineStrategyTemplateDefinition` 增加 `typeLabel`、`basicLogic`、`recommendationLevel`；策略面板展示这些元数据。
- `kline-strategy-backtesting` 新增 8 个模板、参数校验、Bollinger/KDJ/ATR/成交量均线等辅助计算，以及确定性信号生成。
- 更新 README、应用内使用说明书、CHANGELOG，并归档 OpenSpec change 到 `openspec/changes/archive/2026-08-14-add-watchlist-search-and-strategy-templates/`。
- 更新 `openspec/specs/watchlist/spec.md` 和 `openspec/specs/kline-strategy-backtesting/spec.md` 主规格。

测试计划(UT):
- `yarn typecheck`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn test tests/kline-strategy-backtesting.test.ts`
- `yarn test`
- `yarn build`
- `openspec validate add-watchlist-search-and-strategy-templates --strict`
- `openspec validate --all --strict`
- `git diff --check`

影响范围(建议手动测试范围):
- 打开自选股栏，按名称、完整代码和裸代码筛选，确认点击筛选结果不改变数据源。
- 在搜索筛选下进入管理模式，确认全选/反选只作用于当前筛选结果，关闭面板后搜索词清空。
- 打开 K 线策略面板，确认 12 个策略模板可选，新增模板展示类型、基本逻辑、推荐程度。
- 针对新增策略运行历史回测，确认结果仍使用历史表现排名和策略信号文案，不出现投资建议或收益承诺。

风险与后续:
- 新增 8 个模板后 fresh settings 默认全选，长区间回测可能比以前更重；如用户反馈明显变慢，可后续调整默认选择策略。
- 新策略公式为内置确定性模板，不覆盖真实交易制度细节，也不代表未来表现。
