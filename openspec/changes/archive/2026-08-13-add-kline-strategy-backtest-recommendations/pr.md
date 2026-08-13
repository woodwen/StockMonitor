# M-37(feat): 新增 K 线策略回测排名

OpenSpec Change: add-kline-strategy-backtest-recommendations

## 背景:

- 当前应用已经支持 K 线展示、指标配置和历史 K 线缓存，但缺少基于历史 K 线数据比较候选策略收益、回撤和交易信号的工作流。
- 用户需要在日线/周线/月线级别选择历史区间，基于本地缓存数据运行多种策略模板，并在图表中清晰查看 B/S 历史触发点。

## 方案概述:

- 新增 `kline-strategy-backtesting` capability，提供策略模板、参数校验、信号生成、交易撮合、收益/回撤指标和历史表现排名。
- 工作区策略回测以本地 K 线缓存为输入；缓存缺失、不完整或实际 candles 范围不足时，先触发缓存刷新，刷新后仍不足则阻止回测并展示缺失范围。
- 在 K 线工作区新增策略回测面板入口、策略模板选择、回测区间、资金/费用/滑点假设、历史表现排名、交易明细和信号列表。
- 图表 adapter 只渲染 ViewModel 传入的策略信号，不重新计算策略逻辑；策略 B/S 标记使用可区分配色和描边。

## 实现改动:

- 新增 `src/renderer/features/stock-workspace/models/kline-strategy-backtesting.ts`，实现均线交叉、突破回撤、RSI 超买超卖、MACD 趋势确认四类模板，以及多头、全仓、单笔持仓回测引擎。
- 扩展 `stock-types`、`store`、`preload` 和 `StockWorkspaceViewModel`，持久化策略设置，编排缓存读取/刷新、请求失效中止、错误隔离、结果选择和图表信号同步。
- 新增 `KlineStrategyPanel`，并接入 `TopToolbar`、`WorkspacePage`、`KLineChartView` 和 `styles.css`，展示策略模板、回测设置、排名、摘要、交易明细、信号列表和假设说明。
- 扩展 `KLineChartsAdapter`，增加独立的 `strategy-signal` overlay group，并将买入/卖出 B/S 标记渲染为不同颜色。
- 归档 OpenSpec change，并同步主规格：新增 `openspec/specs/kline-strategy-backtesting/spec.md`，更新 `openspec/specs/stock-workspace/spec.md`。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7`，记录 K 线策略回测和历史表现排名这项用户可见能力。

## 测试计划(UT):

- `openspec validate add-kline-strategy-backtest-recommendations --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- K 线工作区：策略面板打开/关闭、日线/周线/月线回测、分钟周期阻止回测、策略参数错误展示。
- 历史 K 线缓存：无缓存、不完整缓存、刷新失败、刷新后实际数据范围不足时的错误提示和旧结果保留。
- 图表渲染：策略 B/S 标记位置、买入/卖出颜色区分、切换策略后信号刷新、切换股票/周期后旧信号清理。
- 本地设置：策略模板选择、参数、回测区间、初始资金、费用率和滑点率的持久化与旧默认值迁移。

## 调查结论:

- “日期选择和实际运行日期不一致”的根因是策略执行层曾只信任缓存 `status = complete`，没有校验返回 candles 的实际起止范围；现已增加二次覆盖校验。
- “B/S 标记看不清”的根因是策略信号默认配色和圆点样式对比不足；现已将策略买入标记设为红色、卖出标记设为蓝色，并增加浅色描边。

## 风险与后续:

- 第一版仍是历史回测展示，不模拟 T+1、涨跌停无法成交、最小交易单位、卖出印花税拆分等真实交易制度细节。
- 历史回测不代表未来表现；用户可见文案保留为历史回测、候选策略、信号和表现排名，不提供投资建议、买卖建议或收益承诺。
