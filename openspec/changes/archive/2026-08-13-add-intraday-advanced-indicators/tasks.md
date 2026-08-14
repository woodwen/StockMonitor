## 1. 数据模型与能力契约

- [x] 1.1 扩展 `SourceCapabilities`，增加高级分时上下文能力字段，并覆盖分钟 OHLC、历史成交量、流通股本、盘口档位、逐笔方向和源端资金流聚合状态。
- [x] 1.2 扩展 `StockTimeshareDataset` 和 `StockTimesharePoint` 类型，加入可选高级上下文、指标可用性、字段来源、展示形态和口径信息，同时保持基础分时字段向后兼容。
- [x] 1.3 同步 `StockApi`、preload bridge、renderer `StockDataAdapter` 和测试 fake API 的 typed contract。
- [x] 1.4 更新工作区设置 normalize，保证新增分时指标默认关闭，且旧设置缺少新键时可自动补齐。
- [x] 1.5 定义高级上下文缓存键 `sourceId + symbol + tradeDate`，区分可缓存的历史成交量/流通股本和随刷新更新的盘口/逐笔方向/资金流。

## 2. 行情源高级上下文

- [x] 2.1 为每个现有数据源补充高级分时能力声明，东方财富作为第一版优先支持源，腾讯和其他未确认字段使用保守不可用或未知状态。
- [x] 2.2 实现东方财富分钟 OHLC 和历史成交量基准解析，默认返回最近 5 个有效交易日日均每分钟成交量，若有同分钟累计历史基准则优先返回该口径。
- [x] 2.3 实现东方财富 A 股股票流通股本、买卖前 5 档盘口、内外盘或逐笔方向、总流入/总流出/净流入解析；缺少字段时返回不可用原因。
- [x] 2.4 确保高级上下文请求失败时保留基础分时数据，并把失败原因映射为指标不可用状态。
- [x] 2.5 补充行情源单元测试，覆盖能力元数据、字段规范化、无效字段丢弃、同源 fallback 和禁止跨源静默拼接。
- [x] 2.6 补充缓存测试，覆盖历史成交量和流通股本按 `sourceId + symbol + tradeDate` 复用，盘口、逐笔方向和资金流随分时刷新更新。

## 3. 分时高级指标模型

- [x] 3.1 在 `timeshare-indicator-definitions` 中加入 `kdj`、`volumeRatio`、`turnoverRate`、`orderRatio`、`inOutVolume` 和 `capitalFlow` 的定义、默认参数、pane 分类和参数校验。
- [x] 3.2 在 `timeshare-indicator-engine` 中实现 KDJ、量比、换手率、委比、内外盘和资金流计算，并输出序列值、最新态值或累计态值。
- [x] 3.3 固定默认公式：KDJ `[9, 3, 3]` 且 RSV 平盘区间按 50，量比使用 5 日基准或源端同分钟累计基准，换手率使用流通股本，委比使用买卖前 5 档，资金流只做总流入、总流出、净流入。
- [x] 3.4 实现高级指标前置数据检查，缺失时返回不可用原因，并避免用价格点、均价、总股本或涨跌方向推断缺失字段。
- [x] 3.5 补充 model 单元测试，覆盖默认公式、参数 normalize、缺失前置数据、部分指标可用和不可用原因。

## 4. 工作区编排与展示

- [x] 4.1 更新 `StockWorkspaceViewModel` 的分时刷新流程，让高级上下文随分时数据进入 enrich 流程，并保持自动刷新不改变 K 线查询状态。
- [x] 4.2 更新分时指标设置弹窗，展示高级指标控件、数据源可用性和不可用原因；高级指标默认关闭，并继续执行分时副图数量限制。
- [x] 4.3 更新分时 chart adapter，渲染序列型高级指标，并在 tooltip 或图例中展示对应数值与口径。
- [x] 4.4 为委比增加最新盘口快照展示；为内外盘和资金流增加序列或累计态展示入口，且不将最新快照或累计聚合值伪装成历史序列。
- [x] 4.5 确认用户可见文案只描述指标名称、数值、口径和不可用原因，不包含投资建议、买卖建议或收益承诺。

## 5. 文档与验证

- [x] 5.1 更新 `CHANGELOG.md` 的 `Unreleased / <current package.json version>` 区块，记录高级分时指标用户可见变更。
- [x] 5.2 运行 `openspec validate add-intraday-advanced-indicators --strict`。
- [x] 5.3 运行 `yarn typecheck` 和 `yarn test`。
- [x] 5.4 运行 `yarn test tests/remote-stock-sources.test.ts`、`yarn test tests/stock-workspace-view-model.test.ts` 和 `yarn test tests/ipc-handlers.test.ts`。
- [x] 5.5 如实施触及主进程、preload、Electron 配置或打包路径，运行 `yarn build`。
