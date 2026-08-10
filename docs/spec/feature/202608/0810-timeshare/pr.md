# M-10(feat): 接入分时行情并拆分数据源

## 背景:

- 现有行情工作区以 K 线为中心，`StockQuery.sourceId`、`StockDataset`、K 线指标和 klinecharts 渲染链路无法准确表达当日分时。
- 分时行情需要最新价、均价、昨收基准、成交量、交易时段压缩和自动刷新等独立语义，不应伪装成新的 K 线周期。
- K 线源和分时源在同一平台内通常也是不同接口；复用同一个 `sourceId` 会导致用户在 K 线/分时之间切换时互相污染数据源选择。
- 默认分时源为东方财富时，`push2.eastmoney.com` 在当前网络下可能返回空响应，启动进入分时会失败，需要在东方财富同源范围内做 host fallback。

## 方案概述:

- 新增独立分时数据模型、IPC/preload 接口、main process 数据源 adapter、renderer ViewModel 和 Canvas 图表视图。
- 工作区新增 `viewMode` 和 `timeshareSourceId`，默认进入分时视图；K 线数据源继续使用 `query.sourceId`，分时数据源使用 `timeshareSourceId`，证券代码共享。
- 数据源能力新增 `timeshare` 标记，东方财富和腾讯/QQ 财经支持标准分时；新浪财经、网易财经 163 继续只作为 K 线源。
- 分时视图支持价格线、均价线、昨收线、右侧涨跌幅轴、成交量柱、十字线 tooltip 和午休时段压缩。
- 分时视图在窗口可见且处于 A 股交易时间时每 15 秒自动静默刷新；K 线仍保持手动刷新。
- 东方财富分时在主 host 失败时按同一数据源内 `push2` -> `push2delay` 顺序重试，不做跨源静默 fallback。

## 实现改动:

- `src/main/remote-stock-sources.ts`：新增 `fetchRemoteStockTimeshareDataset`、东方财富分时解析、腾讯/QQ 财经分时解析、分时能力校验和东方财富分时 host fallback。
- `src/main/ipc.ts`、`src/preload/index.ts`、`src/preload/stock-api.ts`：新增 `stock:fetchTimeshareDataset` 和 `fetchStockTimeshareDataset` typed bridge。
- `src/main/store.ts`、`src/renderer/features/app-update/view-models/AppUpdateViewModel.ts`：新增默认 `viewMode: 'timeshare'`、`timeshareSourceId: 'eastmoney'`，并兼容旧配置。
- `src/renderer/features/stock-workspace/models/stock-types.ts`：新增 `WorkspaceViewMode`、`StockTimeshareQuery`、`StockTimesharePoint`、`StockTimeshareDataset` 和 `SourceCapabilities.timeshare`。
- `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：拆分 K 线/分时刷新链路、独立数据源切换、分时自动刷新、source test 按当前视图执行、状态栏摘要适配当前视图。
- `src/renderer/features/stock-workspace/view-models/TimeshareChartViewModel.ts`、`src/renderer/features/stock-workspace/adapters/TimeshareChartAdapter.ts`、`src/renderer/features/stock-workspace/views/TimeshareChartView.tsx`：新增分时图状态、Canvas 绘制和 React 容器。
- `src/renderer/features/stock-workspace/views/TopToolbar.tsx`、`DataSourceStatusModal.tsx`、`StatusBar.tsx`、`WorkspacePage.tsx`、`src/renderer/styles.css`：新增“分时 / K线”切换、分时模式控件显隐、数据源能力展示和图表布局样式。
- `tests/remote-stock-sources.test.ts`、`tests/stock-workspace-view-model.test.ts`、`tests/timeshare-chart.test.ts`、`tests/legacy-stock-parser.test.ts`：补充分时解析、数据源拆分、启动默认分时、host fallback、配置兼容和图表 ViewModel 测试。
- `docs/spec/feature/202608/0810-timeshare/plan.md`、`README.md`：同步方案、数据源能力、默认行为、测试范围和已知限制。

## 测试计划(UT):

- 通过：`yarn typecheck`
- 通过：`yarn test`，7 个测试文件、47 个用例通过
- 通过：`yarn build`
- 通过：`git diff --check`

## 影响范围(建议手动测试范围):

- 启动默认进入分时视图，默认标的 `sh000001`，分时源为东方财富，页面不应显示启动失败。
- 在分时视图切换东方财富和腾讯/QQ 财经，确认分时点数、最新价摘要、tooltip、成交量和昨收涨跌幅轴展示正常。
- 在 K 线视图切换东方财富、腾讯/QQ 财经、新浪财经、网易财经 163，确认周期和复权能力按源自动收敛，K 线刷新仍为手动。
- 验证 K 线源和分时源互不覆盖：例如 K 线选新浪财经，分时仍可保持东方财富或腾讯/QQ 财经。
- 打开数据源弹窗，在分时视图确认不支持分时的源不能被作为分时源使用，并展示明确状态。
- 窗口隐藏、切回 K 线、午休或收盘后，确认分时自动刷新停止；交易时间窗口可见时确认 15 秒自动刷新。
- 检查旧配置升级：缺少 `viewMode` 或 `timeshareSourceId` 时默认进入分时且使用东方财富分时源；非法分时源回退东方财富。

## 调查结论:

- 东方财富 K 线和分时不是同一接口，分别走 `push2his.eastmoney.com/api/qt/stock/kline/get` 和 `push2.eastmoney.com/api/qt/stock/trends2/get`。
- 腾讯/QQ 财经 K 线和分时也不是同一接口，分别走 `fqkline/get` 和 `minute/query`。
- 新浪财经当前只接入 K 线；其 1 分钟 K 线接口不等价于标准分时，暂不标记为分时源。
- 网易财经 163 当前只接入日线股票 K 线，未接入稳定分时源。
- 东方财富分时启动失败是同源 host 可用性差异，`push2delay.eastmoney.com` 对当前默认标的可返回有效分时点位。

## 风险与后续:

- 免费网页接口没有稳定 SLA，字段和 host 可能继续变化；后续可以在数据源弹窗中增加更细的失败原因展示。
- 分时自动刷新目前只按工作日时间段判断，未接入 A 股节假日交易日历。
- 本次不做跨源自动 fallback；如果后续需要，应在状态栏明确展示实际 fallback 源，避免数据口径静默变化。
- 新浪 1 分钟 K 线可作为“降级分时”单独评估，但需要在 UI 明确标注口径差异。

## 验收标准:

- 默认启动进入分时视图并能加载东方财富分时，主 host 不可用时可使用东方财富延迟 host 返回数据。
- K 线和分时源独立保存，切换其中一个视图的数据源不会覆盖另一个视图的数据源。
- 分时只允许使用声明支持分时的数据源，未支持源在数据源测试和切换时有明确反馈。
- 单元测试、类型检查、生产构建和 diff 空白检查通过。
