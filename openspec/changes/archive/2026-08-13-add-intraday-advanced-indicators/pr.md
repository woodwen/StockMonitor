# M-35(feat): 新增分时高级指标

OpenSpec Change: add-intraday-advanced-indicators

## 背景:

- 当前分时图缺少分钟 OHLC、历史成交量基准、流通股本、盘口、内外盘和资金流等高级上下文，无法可靠支持 KDJ、量比、换手率、委比、内外盘、资金流。
- 这些指标不能通过价格涨跌、均价或总股本做隐式推断，需要在数据源能力、dataset 契约、指标计算和 UI 展示中同时表达可用性与缺失原因。

## 方案概述:

- 扩展 `chart-indicators` 和 `market-data-sources` capability，归档 OpenSpec change 后同步主规格。
- 在主进程行情源 adapter 中补充分时高级上下文能力和东方财富第一版解析，基础分时数据保持可用，高级上下文失败时降级为不可用原因。
- 在 model 层新增高级分时指标定义、参数 normalize、可用性检查和计算逻辑，ViewModel 负责 enrich 编排，chart adapter 只消费已计算结果。
- 高级指标默认关闭，不支持或缺少前置数据时在设置弹窗和展示入口中提示原因，不输出投资建议、买卖建议或收益承诺。

## 实现改动:

- 扩展 `SourceCapabilities`、`StockTimeshareDataset`、`StockTimesharePoint` 等 typed contract，增加高级上下文、字段来源、展示形态、口径和指标可用性。
- 在 `src/main/remote-stock-sources.ts` 中为东方财富补充分钟 OHLC、历史成交量基准、流通股本、盘口、内外盘和资金流解析，并加入按 `sourceId + symbol + tradeDate` 复用的静态上下文缓存。
- 在 `timeshare-indicator-definitions` 和 `timeshare-indicator-engine` 中实现 KDJ、量比、换手率、委比、内外盘、资金流的默认参数、缺失前置检查和结果输出。
- 更新 `StockWorkspaceViewModel`、`TimeshareChartViewModel`、`IndicatorSettingsModal`、`TimeshareChartAdapter` 和样式，支持高级指标配置、不可用提示、tooltip/摘要展示和分时副图渲染。
- 补充行情源、工作区 ViewModel、指标定义和指标计算测试，覆盖能力元数据、缓存、公式、参数 normalize、缺失数据降级和部分可用场景。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7`，记录用户可见高级分时指标变更。

## 测试计划(UT):

- `openspec validate add-intraday-advanced-indicators --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `openspec archive add-intraday-advanced-indicators --yes`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- 分时图指标设置弹窗：确认高级指标默认关闭、可用性提示准确、副图数量限制仍生效。
- 东方财富 A 股分时数据：确认基础分时图在高级上下文缺失或请求失败时仍可展示。
- 高级指标展示：检查 KDJ、量比、换手率、委比、内外盘、资金流的 tooltip、最新摘要和不可用原因。
- 自动刷新：确认分时刷新不会改变 K 线查询状态，历史成交量和流通股本缓存复用，盘口与资金流随刷新更新。

## 风险与后续:

- 东方财富接口字段存在变化风险，后续应在发现字段变化时优先补解析测试和不可用原因映射。
- 腾讯等其他数据源暂未提供同等高级上下文覆盖，后续应按 capability 逐项验证后再开放。
