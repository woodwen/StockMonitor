# 分时常用指标

## 背景

当前应用已经支持当日分时行情视图，分时图由 Canvas adapter 独立绘制，展示价格线、均价线、昨收参考线、右侧涨跌幅轴、成交量柱、十字线 tooltip 和午间休市空档压缩。

现有 K 线指标体系已经有独立的 `indicatorSettings`、指标弹窗、参数校验、持久化和 adapter 同步逻辑，但分时视图尚未接入指标配置。分时和 K 线的数据模型、图表 adapter、可用字段不同，不能直接复用 K 线指标配置，否则会造成：

- 用户在 K 线开启或调整指标后，切到分时视图被动变化。
- K 线指标依赖 OHLC 数据，部分逻辑无法准确作用在当前分时点上。
- 分时 Canvas 的副图区和 tooltip 空间更紧凑，需要独立的展示限制。

本次目标是在分时视图中新增常用、可准确计算、可配置的指标，并保持 K 线指标配置不受影响。

## 方案概述

新增分时指标配置、计算和绘制链路。分时图继续使用 Canvas adapter，指标计算集中在 model 层，工作区设置新增独立的 `timeshareIndicatorSettings`。

一期指标范围：

- 主图区：分时 MA、分时 EMA、分时 BOLL。
- 信号指标：B/S。
- 成交量区：成交量 MA。
- 副图区：MACD、RSI。
- 基础显示项：均价线、昨收线、成交量柱继续默认开启，并纳入分时指标弹窗管理。

一期暂不做：

- KDJ：当前分时点没有稳定的分钟 OHLC 字段，用逐点价格近似会降低指标可信度。
- 量比：需要历史日或历史同分钟成交量基准，当前分时数据集没有。
- 换手率：需要流通股本或自由流通股本。
- 委比、内外盘、资金流：需要盘口、逐笔或主动买卖方向数据。

## 默认实现决策

- 分时和 K 线指标配置不共用，新增 `timeshareIndicatorSettings`。
- 顶部“指标”按钮在分时和 K 线都显示，打开同一个指标弹窗；弹窗内容按当前视图切换。
- 新增分时指标默认关闭，避免升级后图表突然变复杂。
- 现有基础显示保持默认开启：价格线固定开启，均价线、昨收线、成交量柱默认开启。
- 价格线不可关闭；均价线、昨收线、成交量柱可在分时指标弹窗中关闭。
- 指标颜色沿用现有暗色图表风格，一期使用固定颜色，不提供颜色配置。
- 分时副图最多同时开启 2 个，超过后置灰未开启的副图指标，并提示“分时副图最多开启 2 个”。
- 副图高度按开启数量动态分配：开启 1 个时保留较高副图区，开启 2 个时等分副图区，同时优先保证主价格区可读性。
- 参数修改采用草稿模型，点击“应用”后生效并保存；点击“取消”不影响当前图表。
- 分时自动刷新拿到新数据后，在本地重新计算指标，不重新触发额外行情请求。
- 指标只在分时数据刷新或指标参数应用时重算；鼠标移动只读取已计算结果，不做实时计算。
- tooltip 只展示已开启指标的当前点数值；当内容过多时优先展示主图区数值，副图详情只在鼠标位于副图区时展示。
- B/S 默认关闭，参数默认 `5, 20`，放在“信号指标”分组，不参与分时副图数量限制。
- B/S 使用分时价格序列计算：`EMA(price, 快线)` 上穿 `EMA(price, 慢线)` 生成 `B`，下穿生成 `S`；EMA 从首个分时价格开始，第二个点起判断交叉。
- B/S 不做额外去噪或最小间隔过滤，先保持算法透明；如果后续标记过密，再单独增加信号过滤参数。
- B/S 标记绘制在主价格区，`B` 位于价格点下方，`S` 位于价格点上方，并限制在价格区内。
- tooltip 所在分时点有 B/S 信号时显示 `B/S 买入` 或 `B/S 卖出`，没有信号时不额外展示。
- 分时图按区域展示线条图例说明：主图说明价格、均价、昨收、MA、EMA、BOLL、B/S；成交量区说明成交量和 VOL MA；副图区说明 MACD/RSI 线条。
- 如果数据源缺少 `avgPrice`、`previousClose` 或成交量异常，只隐藏对应线或柱，不让图表报错或白屏。
- 实现完成后再补 `pr.md` 草稿，方案阶段只维护当前 `plan.md`。

## 分时指标默认配置

| 指标 | 区域 | 默认开启 | 默认参数 | 说明 |
| --- | --- | --- | --- | --- |
| 价格线 | 主图 | 是 | 无 | 固定展示，不提供关闭 |
| 均价线 | 主图 | 是 | 无 | 数据源返回的分时均价 |
| 昨收线 | 主图 | 是 | 无 | 基于 `previousClose` 的参考线 |
| MA | 主图 | 否 | `5, 10, 20, 60` | 基于分时价格的简单移动平均 |
| EMA | 主图 | 否 | `12, 26` | 基于分时价格的指数移动平均 |
| BOLL | 主图 | 否 | `20, 2` | 基于分时价格的布林线 |
| B/S | 信号 | 否 | `5, 20` | 基于分时价格快慢 EMA 交叉的买卖信号 |
| 成交量 | 成交量区 | 是 | 无 | 当前已有成交量柱 |
| VOL MA | 成交量区 | 否 | `5, 10, 20` | 基于单分钟成交量的移动平均 |
| MACD | 副图 | 否 | `12, 26, 9` | 基于分时价格的 MACD |
| RSI | 副图 | 否 | `6, 12, 24` | 基于分时价格的 RSI |

## 模块设计

### 分时指标定义

新增 `src/renderer/features/stock-workspace/models/timeshare-indicator-definitions.ts`：

- 定义 `TimeshareIndicatorName`、`TimeshareIndicatorPane`、`TimeshareIndicatorSettings`、`TimeshareIndicatorSettingsMap`。
- 维护分时指标 label、分区、默认开启状态、默认参数和参数 schema。
- 提供 `createDefaultTimeshareIndicatorSettings()`、`normalizeTimeshareIndicatorSettings()`、`validateTimeshareIndicatorParams()`。
- 提供 `countEnabledTimeshareSubIndicators()`、`canEnableTimeshareIndicator()`，集中实现副图最多 2 个限制。

该模块是分时指标配置的主要 seam。UI、ViewModel、主进程 store 和图表 adapter 都只依赖该 interface，不在各处硬编码指标列表。

### 分时指标计算

新增 `src/renderer/features/stock-workspace/models/timeshare-indicator-engine.ts`：

- 输入：`StockTimeshareDataset` 和 `TimeshareIndicatorSettingsMap`。
- 输出：`EnrichedStockTimeshareDataset`，每个点附带当前已计算指标值。
- 复用或抽取现有 `calculateMovingAverage()`、`calculateEma()`、`calculateBoll()` 的纯函数能力。
- 新增 `calculateMacd()` 和 `calculateRsi()`，计算逻辑只依赖价格序列。
- 新增 `calculateTimeshareBsSignals()`，基于分时价格快慢 EMA 交叉输出 B/S 信号。
- 对 warm-up 阶段返回 `undefined`，Canvas adapter 跳过未成形点。

该模块的 interface 应保持小而稳定：调用方只需要传入分时数据和分时指标配置，不需要知道每个指标如何计算。

### 分时 ViewModel

修改 `src/renderer/features/stock-workspace/view-models/TimeshareChartViewModel.ts`：

- `dataset` 改为保存 `EnrichedStockTimeshareDataset | null`。
- 新增 `indicatorSettings`、`indicatorDraft`、`indicatorDialogOpen` 或在工作区 ViewModel 中按当前视图路由到分时指标草稿。
- 新增分时指标草稿开关、参数修改、恢复默认、应用和取消逻辑。
- `setDataset()` 接收原始分时 dataset 时，基于当前 `timeshareIndicatorSettings` enrich 后再递增 `revision`。
- 参数变更应用后，不请求远端行情，只基于当前原始 dataset 重新 enrich。

需要保留原始 `StockTimeshareDataset`，避免连续修改指标参数时基于已 enrich 数据重复叠加。

### 股票工作区 ViewModel

修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：

- 加载设置时恢复 `timeshareIndicatorSettings`。
- 保存工作区设置时同时写入 K 线 `indicatorSettings` 和分时 `timeshareIndicatorSettings`。
- `openIndicatorDialog()` 根据 `viewMode` 打开 K 线或分时指标草稿。
- `applyIndicatorSettingsDraft()` 根据 `viewMode` 应用对应配置。
- 分时刷新成功后，调用分时 ViewModel 的 enrich 链路。

### 分时 Canvas adapter

修改 `src/renderer/features/stock-workspace/adapters/TimeshareChartAdapter.ts`：

- `setDataset()` 接收 `EnrichedStockTimeshareDataset`。
- 价格区 range 纳入已开启主图指标值，避免 MA、EMA、BOLL 超出画布。
- 按配置绘制均价线、昨收线、MA、EMA、BOLL 和 B/S 标记。
- 成交量区按配置绘制成交量柱和 VOL MA。
- 按已开启副图动态划分 MACD、RSI pane。
- crosshair tooltip 根据当前 pane 和开启指标展示对应数值。

Canvas adapter 只负责把已计算好的结果画出来，不在绘制函数里计算指标。

### 指标弹窗

修改 `src/renderer/features/stock-workspace/views/IndicatorSettingsModal.tsx`：

- 弹窗标题继续使用“指标设置”。
- 当 `viewMode === 'kline'` 时展示现有 K 线指标。
- 当 `viewMode === 'timeshare'` 时展示分时指标。
- 分时弹窗分组：基础显示、主图指标、信号指标、成交量指标、副图指标。
- 参数输入继续使用 Ant Design `InputNumber`。
- 副图已满时置灰未开启副图指标。

### 持久化

修改 `src/preload/stock-api.ts`：

- `WorkspaceSettings` 新增 `timeshareIndicatorSettings?: TimeshareIndicatorSettingsMap`。

修改 `src/main/store.ts`：

- 默认工作区设置写入 `timeshareIndicatorSettings`。
- `normalizeWorkspaceSettings()` 补齐缺失分时指标配置。
- 参数非法时回退对应指标默认参数。
- `timeshareIndicatorSettings.bsSignal` 缺失时自动补齐为关闭和 `5,20`。
- 副图历史配置超过 2 个时，按 `MACD > RSI` 优先级保留前 2 个。

## 测试计划(UT)

### 分时指标定义

- 校验默认指标包含均价线、昨收线、MA、EMA、BOLL、B/S、成交量、VOL MA、MACD、RSI。
- 校验新增指标默认关闭，基础显示项默认开启。
- 校验分时副图最多开启 2 个。
- 校验参数范围、整数周期、唯一周期，以及 MACD/B/S 快慢线顺序。
- 校验异常配置 normalize 后回到有效配置。

### 分时指标计算

- 校验 MA warm-up 阶段为 `undefined`，成形后计算正确。
- 校验 EMA 使用首个价格作为初始值。
- 校验 BOLL 使用分时价格计算上下轨。
- 校验 VOL MA 使用单分钟成交量。
- 校验 MACD 输出 dif、dea、macd。
- 校验 RSI 在上涨、下跌和持平序列下结果稳定。
- 校验 B/S 上穿生成买入信号、下穿生成卖出信号。

### 分时 ViewModel

- 校验加载 dataset 后生成 enriched dataset 并递增 revision。
- 校验应用分时指标草稿不请求远端行情，只重新 enrich 当前数据。
- 校验取消草稿不影响当前分时指标配置。
- 校验分时和 K 线指标设置互不影响。
- 校验保存工作区设置时包含 `timeshareIndicatorSettings`。

### 分时 Canvas adapter

- 校验价格 range 会包含开启的主图指标值。
- 校验关闭均价线或昨收线时不会绘制对应线。
- 校验开启主图指标时会生成对应折线绘制数据。
- 校验开启副图指标时 pane 高度划分稳定。
- 校验开启 B/S 时主图生成 B/S 标记且不影响副图数量。
- 校验 tooltip 在开启多个指标时不越界。

### 回归用例

- 分时午间休市压缩逻辑保持不变。
- 分时自动刷新保持 15 秒静默刷新逻辑不变。
- K 线指标设置、K 线图 adapter 和现有 `indicatorSettings` 持久化保持不变。
- 远端 K 线/分时数据源、代理配置、更新检查等现有测试保持通过。

需要执行：

- `yarn test tests/timeshare-chart.test.ts`
- `yarn test tests/timeshare-indicator-definitions.test.ts`
- `yarn test tests/timeshare-indicator-engine.test.ts`
- `yarn test tests/indicator-engine.test.ts`
- `yarn test tests/indicator-definitions.test.ts`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn typecheck`
- `yarn build`

## 影响范围(建议手动测试范围)

### 分时指标弹窗

- 在分时视图点击“指标”，确认展示分时指标配置。
- 在 K 线视图点击“指标”，确认仍展示 K 线指标配置。
- 确认新增分时指标默认关闭，均价线、昨收线、成交量柱默认开启。
- 修改分时指标参数后点击“取消”，确认图表不变化。
- 修改分时指标参数后点击“应用”，确认图表立即变化并保存。

### 分时图展示

- 开启 MA、EMA、BOLL，确认主图线显示正常且不超出价格轴。
- 开启 B/S，确认主图出现 `B` 和 `S` 标记。
- 关闭均价线或昨收线，确认对应线隐藏。
- 开启 VOL MA，确认成交量区出现均线。
- 开启 MACD、RSI，确认最多同时展示 2 个副图。
- 鼠标移动时，确认 tooltip 显示当前点指标值且不遮挡严重。
- 确认各区域图例颜色和线条颜色一致，开启或关闭指标后图例同步变化。
- 鼠标移动到有 B/S 信号的分时点时，确认 tooltip 展示 `B/S 买入` 或 `B/S 卖出`。

### 持久化兼容

- 修改分时指标开关和参数后重启应用，确认配置恢复。
- 修改 K 线指标后切回分时，确认分时指标不被 K 线配置影响。
- 设置文件缺少 `timeshareIndicatorSettings` 时，确认启动后自动补齐默认值。
- 手动构造非法参数或副图超限配置，确认启动后 normalize 到有效配置。

## 风险与后续

- 当前分时数据没有分钟 OHLC，一期不做 KDJ，避免用近似算法制造误导。
- 当前分时数据没有历史同分钟基准，量比需要二期引入历史成交量数据后再做。
- 当前分时数据没有流通股本、盘口和逐笔方向，换手率、委比、内外盘和资金流需要数据源层补字段。
- 分时图 Canvas 当前是单文件 adapter，加入副图和 tooltip 逻辑后文件会变重；实现时应抽出布局、坐标和绘制 helper，避免绘制逻辑继续膨胀。
- 副图区默认最多 2 个是分时视图规则，不影响 K 线副图最多 3 个的现有规则。

## 验收标准

- 分时视图顶部可以打开“指标设置”。
- 分时指标弹窗支持基础显示、主图指标、成交量指标和副图指标配置。
- 分时新增指标默认关闭，均价线、昨收线、成交量柱默认开启。
- MA、EMA、BOLL、VOL MA、MACD、RSI 按默认参数和用户参数正确绘制。
- B/S 可在分时指标弹窗中开关和调整参数，开启后按分时价格快慢 EMA 交叉绘制买卖标记。
- 分时图能展示每条线的名称和颜色说明，说明内容随指标开关同步变化。
- 分时副图最多同时开启 2 个。
- 分时和 K 线指标设置互不影响。
- 分时自动刷新后指标随最新数据更新。
- 重启应用后分时指标开关和参数恢复。
