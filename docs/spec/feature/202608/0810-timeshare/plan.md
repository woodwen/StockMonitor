# 接入当日分时行情

## 背景

当前应用已经支持远端 K 线查询、多数据源切换、网络代理配置、工作区设置持久化，以及 K 线指标管理。

现有行情模型以 K 线为中心：

- `StockQuery.period` 表示日线、周线、月线、5/15/30/60 分钟等 K 线周期。
- `StockDataset.candles` 使用 OHLCV 结构。
- `StockWorkspaceViewModel` 加载数据后会进入 K 线指标 enrichment 流程。
- `KLineChartsAdapter` 负责蜡烛图、K 线指标和 B/S overlay 渲染。

分时行情与 K 线语义不同：

- 分时点位没有 open/high/low/close 语义，核心是最新价、均价、成交量、成交额和昨收基准。
- 分时不需要复权，不适用现有 K 线指标设置。
- 当日分时需要交易时段、午休压缩和自动刷新等独立行为。

因此本次接入不把分时伪装成 `StockPeriod` 的新值，也不复用 `StockDataset`。目标是在现有 main/preload/renderer 三端架构中新增独立的分时 Interface，保持 K 线链路稳定，同时为后续扩展多数据源分时留下清晰落点。

在新增分时后，K 线与分时还需要拆分数据源状态。当前 K 线查询的 `query.sourceId` 如果被分时复用，会带来两个问题：

- 用户在 K 线模式切到腾讯/新浪后，再进入分时模式会沿用同一个 `sourceId`，导致分时请求落到不支持分时的数据源。
- 用户在分时模式切回东方财富后，也会反向改变 K 线数据源，破坏用户对 K 线源的选择。

因此本期默认将 K 线数据源和分时数据源拆开保存，但证券代码仍共享。用户切换 K 线/分时时，默认查看同一只证券；只有数据源按视图模式独立。

## 方案概述

第一版接入当日分时行情，默认使用东方财富作为分时数据源；本次按默认建议新增腾讯/QQ 财经作为手动备用分时源，新浪 1 分钟 K 线保留为后续降级备选。

- 分时范围：当日分时。
- 数据源：默认东方财富；新增腾讯/QQ 财经分时作为手动备用源；后续再评估新浪 1 分钟 K 线降级源。
- 标的范围：延续现有沪深京股票、ETF、指数。
- 图表内容：价格线、均价线、成交量柱、昨收线、右轴涨跌幅、十字线 tooltip。
- 刷新策略：分时模式下交易时间每 15 秒自动刷新；午休、收盘、窗口后台暂停自动刷新。
- 交易时段：按 A 股 `09:30-11:30`、`13:00-15:00`；X 轴压缩午休，不展示大段空白。
- UI 入口：顶部工具栏新增 `K线 / 分时` 分段切换。
- 数据源策略：K 线数据源和分时数据源分开；证券代码共享；新增分时源默认手动切换，不做静默自动 fallback。
- 持久化：记住上次视图模式、K 线数据源、分时数据源；切回 K 线时保留原 K 线周期、复权、日期和指标配置。

第一版不做以下内容：

- 历史多日分时。
- 盘口、逐笔成交、资金流。
- 分时指标。
- 分时复权。
- 自动切换到新浪、腾讯分时 fallback。
- 网易财经 163 分时。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 分时类型 | 新增独立 `StockTimeshareDataset`，不复用 `StockDataset` |
| 查询参数 | 使用 `StockTimeshareQuery`，仅包含数据源、证券代码和可选交易日 |
| 默认数据源 | 东方财富 |
| K 线数据源 | 继续使用 `query.sourceId` |
| 分时数据源 | 新增 `timeshareSourceId`，默认东方财富 |
| 证券代码 | K 线与分时共享 `query.symbol` |
| 数据源切换 | “数据源”弹窗按当前模式切换对应数据源 |
| 不支持分时的数据源 | 在能力校验阶段返回明确错误 |
| 分时图实现 | 新增独立 `TimeshareChartView` 和 `TimeshareChartAdapter` |
| K 线指标 | 分时模式隐藏指标入口，不对分时数据运行 K 线指标计算 |
| 自动刷新 | 仅分时模式启用，交易时间 15 秒一次 |
| 后台行为 | 页面不可见或窗口后台时暂停自动刷新 |
| 午休展示 | 压缩午休时间轴 |
| 加载失败 | 分时区域展示错误和重试，不清空已有 K 线数据 |
| 新增分时源优先级 | 本次新增腾讯/QQ 财经；新浪仅作为 1 分钟 K 线降级备选 |
| 新增源切换策略 | 默认只支持用户手动切换，不做自动 fallback |

### 默认确认项

- 证券代码共享：K 线和分时都使用 `query.symbol`。
- 分时默认源：始终默认东方财富；K 线源切到腾讯/新浪时不影响分时源。
- 不支持分时的数据源：分时模式下禁用“使用”，并显示“不支持分时”。
- 旧配置兼容：缺少 `timeshareSourceId` 时补 `eastmoney`；非法或不支持分时时也回退 `eastmoney`。
- 数据源弹窗行为：按当前模式操作，K 线模式只改 `query.sourceId`，分时模式只改 `timeshareSourceId`。
- 状态栏显示：只显示当前模式的数据源；数据源弹窗同时展示 K 线源和分时源。
- 自动刷新：继续使用分时源，不受 K 线源变化影响。
- 新增分时源：本次接入腾讯/QQ 财经；新浪只作为 1 分钟 K 线降级源，不能和标准分时混淆。
- 自动 fallback：暂不默认启用，避免不同源字段口径静默混用。

### 分时数据源扩展方案

后续扩展分时数据源时，不新增新的工作区状态字段，继续复用 `timeshareSourceId` 和 `fetchTimeshare()` seam。每个源只在 main 进程 adapter 内处理自己的字段差异，输出统一的 `StockTimeshareDataset`。

### 平台 K 线/分时数据源拆分检查

K 线和分时在同一平台内也通常不是同一个接口。即使平台名称相同，也不能把它们视为一个全局数据源状态；工作区必须继续使用 `query.sourceId` 保存 K 线源，使用 `timeshareSourceId` 保存分时源。

| 平台 | K 线接口 | 分时接口 | 是否同源同口径 | 当前处理 |
| --- | --- | --- | --- | --- |
| 东方财富 | `push2his.eastmoney.com/api/qt/stock/kline/get` | `push2.eastmoney.com/api/qt/stock/trends2/get` | 否。K 线返回 OHLCV；分时返回趋势点和昨收基准 | K 线和分时各自 adapter 解析，默认分时源 |
| 腾讯/QQ 财经 | `web.ifzq.gtimg.cn/appstock/app/fqkline/get` | `web.ifzq.gtimg.cn/appstock/app/minute/query` | 否。K 线返回 OHLCV 数组；分时返回 `HHmm price cumulativeVolume cumulativeTurnover` | K 线和分时各自 adapter 解析，手动备用分时源 |
| 新浪财经 | `quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData` | 暂未确认稳定标准分时接口；可用 1 分钟 K 线降级 | 否。分钟 K 线不是标准分时，均价和昨收口径缺失 | 当前只作为 K 线源；后续降级源需显式标注 |
| 网易财经 163 | `quotes.money.163.com/service/chddata.html` | 暂未确认稳定标准分时接口 | 否。当前仅日线 CSV 能力稳定 | 当前只作为 K 线源 |

拆分原则：

- 平台名称相同不代表 K 线和分时是同一个数据源。用户选择“腾讯 K 线”不应自动等价于“腾讯分时”。
- K 线源切换只影响 `StockQuery.sourceId`、周期、复权和日期能力校验。
- 分时源切换只影响 `timeshareSourceId` 和 `StockTimeshareQuery.sourceId`。
- 数据源弹窗按当前 `viewMode` 决定“使用”按钮含义；弹窗摘要同时展示 K 线源和分时源。
- 状态栏和 toolbar tooltip 只展示当前模式 active source，避免把两个源合并成一个全局选择。
- 自动刷新只使用当前分时源；K 线手动刷新只使用当前 K 线源。
- 不做静默自动 fallback。若将来需要 fallback，必须在状态栏明确展示实际使用的 fallback 源。

| 优先级 | 数据源 | 定位 | 接入方式 | 字段口径 | 默认建议 |
| --- | --- | --- | --- | --- | --- |
| P1 | 腾讯/QQ 财经 | 东方财富不可用时的主备用分时源 | `web.ifzq.gtimg.cn/appstock/app/minute/query?code=sh600519` 形态 | 实盘响应为 `HHmm price cumulativeVolume cumulativeTurnover`；昨收、名称从返回汇总区读取，缺失时明确报错或降级 | 本次接入，可在分时模式手动选择 |
| P2 | 新浪财经 | 降级备用源，不作为严格分时源 | `CN_MarketDataService.getKLineData?symbol=sh600519&scale=1&ma=5&datalen=240` 形态 | 1 分钟 OHLCV K 线；用 `close` 映射 `price`，`amount` 映射 `turnover`，`avgPrice` 无法保证时回退为 `close` | 后续再接入，并在 UI 标注“分钟K线降级” |
| P3 | 东方财富历史分时 | 扩展多日/历史分时，不是新增源 | `push2his.eastmoney.com/api/qt/stock/trends2/get` 形态 | 与当前东财分时字段接近，但历史返回字段可能有价格为 0 的特殊情况 | 等当日分时稳定后再做 |
| 暂缓 | 雪球、AKShare、Tushare、网易 163 | 暂不推荐 | 可能需要 cookie、token、Python 依赖，或分时能力不稳定 | 运行和分发成本高，免费公开可用性弱 | 不进入本期计划 |

东方财富分时 host 处理：

- 默认先请求 `push2.eastmoney.com/api/qt/stock/trends2/get`。
- 如果主 host 网络失败、返回非 JSON 或没有有效分时点位，则在东方财富 adapter 内继续尝试 `push2delay.eastmoney.com/api/qt/stock/trends2/get`。
- 这是同一个东方财富数据源内部的 host fallback，不改变 `timeshareSourceId`，也不等价于跨源自动切腾讯。
- 分时 URL 追加 `_ = Date.now()` 防缓存参数，避免启动时命中异常缓存或被上游空响应影响。

启动失败排查记录：

- 现象：默认进入分时模式且分时源为东方财富时，首页直接显示加载失败。
- 复现：默认标的 `sh000001` 请求 `push2.eastmoney.com/api/qt/stock/trends2/get` 在当前网络下会出现空响应或请求失败。
- 对照：同参数改用 `push2delay.eastmoney.com/api/qt/stock/trends2/get` 可返回 `sh000001`、`sh600519`、`sz000001` 等标的的当日分时点位。
- 结论：问题属于东方财富分时同源 host 可用性差异，不是 `timeshareSourceId` 拆分错误，也不是需要跨源自动切腾讯。
- 修复：在东方财富 adapter 内做 `push2` 到 `push2delay` 的同源 host fallback；失败时错误信息聚合两个 host 的失败原因。

腾讯源接入时的默认处理：

- `TENCENT_META.capabilities.timeshare` 改为 `true`，并新增 `fetchTencentTimeshareDataset()`。
- 证券代码沿用现有 `normalizeSecurityCode()`，直接使用 `sh/sz/bj + code` 形态请求腾讯。
- 分钟点位解析后必须按交易时间升序输出，并过滤非 `09:30-11:30`、`13:00-15:00` 的异常点。
- 腾讯返回成交量和成交额为累计口径，adapter 内转换成分钟增量；该口径通过实盘响应和 UT 样本固定。
- `avgPrice` 字段缺失时先按 `cumulativeTurnover / cumulativeVolume / 100` 计算；计算结果明显偏离当前价时回退为当前价。
- `turnover` 字段缺失时按累计成交额 `0` 处理，图表和 tooltip 不把缺失成交额当成错误。
- `previousClose` 缺失时不返回空成功数据，应返回明确错误，因为昨收线和涨跌幅轴依赖它。

新浪源接入时的默认处理：

- 不把新浪标成完整分时源，除非确认存在稳定的当日分时点位接口。
- 如果只使用 1 分钟 K 线接口，则在 adapter 内转换为 `StockTimeshareDataset`，并在 UI 或 source label 标注“分钟K线降级”。
- 只取当前交易日点位；跨日返回必须按 `tradeDate` 或最新交易日过滤，避免把多日分钟 K 线混进当日分时图。
- `price` 使用 `close`；`volume`、`turnover` 使用接口字段；`avgPrice` 默认使用 `close` 或按成交额/成交量可用时计算。
- 缺少昨收时，优先复用现有新浪 K 线/行情字段补齐；补不齐则失败，不绘制没有涨跌幅基准的分时图。

不做自动 fallback 的原因：

- 不同分时源在成交量、均价、成交额上的口径不完全一致，自动混用会让用户难以判断数据差异来自行情变化还是数据源差异。
- 现有 UI 已经有数据源弹窗，先做手动切换能复用当前交互，不增加后台轮询、错误归因和状态展示复杂度。
- 如果后续确实需要自动 fallback，应新增明确策略，例如“当前源连续失败 2 次后切备用源，并在状态栏显示 fallback 来源”，不能静默切换。

接口资料参考：

- 腾讯分时接口公开样本：<https://www.cnblogs.com/soarowl/p/20516538>
- 腾讯分时接口历史公开样本：<https://blog.csdn.net/geofferysun/article/details/114752182>
- 新浪分钟 K 线接口公开样本：<https://www.cnblogs.com/jetz/p/19355133>
- 东方财富分时字段公开整理：<https://github.com/WangYang-Rex/eastmoney-data-sdk/blob/main/docs/API_FIELDS.md>

## Interface 设计

### 分时视图模式

```ts
export type WorkspaceViewMode = 'kline' | 'timeshare'
```

`WorkspaceViewMode` 是渲染层工作区视图模式，不进入 K 线数据源周期模型。

### 工作区数据源状态

```ts
export interface WorkspaceSettings {
  query: StockQuery
  timeshareSourceId?: StockSourceId
  viewMode?: WorkspaceViewMode
  indicatorSettings?: IndicatorSettingsMap
  enabledIndicators?: Partial<Record<IndicatorName, boolean>>
}
```

约束：

- `query.sourceId` 只表示 K 线数据源。
- `timeshareSourceId` 只表示分时数据源。
- `query.symbol` 继续作为工作区共享证券代码，K 线和分时都使用它。
- 旧配置缺少 `timeshareSourceId` 时，默认补为 `eastmoney`。
- 如果 `timeshareSourceId` 非法，或对应数据源不支持分时，回退为 `eastmoney`。

### 分时查询

```ts
export interface StockTimeshareQuery {
  sourceId: StockSourceId
  symbol: string
  tradeDate?: string
}
```

约束：

- `sourceId` 来自工作区的 `timeshareSourceId`，不再复用 K 线的 `query.sourceId`。
- `symbol` 复用现有证券代码规范，支持 `sh/sz/bj` 前缀。
- `tradeDate` 为可选 `YYYYMMDD`。第一版默认查询当日，历史分时不作为产品能力承诺。

### 分时点位

```ts
export interface StockTimesharePoint {
  timeKey: string
  timestamp: number
  price: number
  avgPrice: number
  volume: number
  turnover: number
}
```

约束：

- `timeKey` 使用 `YYYYMMDDHHmm`。
- `timestamp` 使用本地时区时间戳，和现有 K 线图时间处理保持一致。
- `volume` 和 `turnover` 使用供应商返回值归一化后的数值；如果供应商字段缺失，按 `0` 兜底。

### 分时数据集

```ts
export interface StockTimeshareDataset {
  meta: StockMeta
  previousClose: number
  points: StockTimesharePoint[]
  sourceId?: StockSourceId
  sourceName?: string
  sourceUrl?: string
}
```

约束：

- `previousClose` 用于昨收基准线和涨跌幅右轴。
- `points` 按时间升序输出。
- 当没有有效点位时返回明确错误，不返回空成功数据。

### 数据源能力

```ts
export interface SourceCapabilities {
  periods: StockPeriod[]
  adjusts: StockAdjust[]
  markets: StockMarketScope[]
  timeshare: boolean
}
```

默认能力：

| 数据源 | 当前分时能力 | 扩展建议 |
| --- | --- | --- |
| 东方财富 | 支持 | 默认主源 |
| 腾讯/QQ 财经 | 支持 | 手动备用源 |
| 新浪财经 | 暂不支持 | 后续以 1 分钟 K 线降级方式评估 |
| 网易财经 163 | 不支持 | 暂不接入 |

## 实现改动

### 类型模型

- 修改 `src/renderer/features/stock-workspace/models/stock-types.ts`：
  - 新增 `WorkspaceViewMode`。
  - 新增 `StockTimeshareQuery`。
  - 新增 `StockTimesharePoint`。
  - 新增 `StockTimeshareDataset`。
  - `SourceCapabilities` 新增 `timeshare` 字段。
- 保持 `StockPeriod` 不变，不新增 `'timeshare'` 或 `'1'` 周期。

### 主进程数据源

- 修改 `src/main/remote-stock-sources.ts`：
  - `StockDataSource` 增加可选 `fetchTimeshare(query, context)`。
  - 新增 `fetchRemoteStockTimeshareDataset(query, context)`。
  - 新增分时能力校验：未知数据源、不支持分时、不支持市场类型时提前报错。
  - 东方财富 adapter 新增分时请求、解析和归一化。
  - 东方财富 adapter 内新增 `push2` 到 `push2delay` 的同源 host fallback。
  - 腾讯 adapter 新增分时请求、解析和归一化。
  - 腾讯分时成交量和成交额从累计口径转换为分钟增量。
  - 腾讯分时过滤 `15:00` 之后的盘后重复点位。
  - 复用现有 `normalizeSecurityCode()`、`inferMarketScope()`、`requestJson()`、代理和错误格式化逻辑。
  - 分时返回按 timestamp 升序排序，并过滤无效时间点。

### IPC 与 preload

- 修改 `src/preload/stock-api.ts`：
  - `StockApi` 新增 `fetchStockTimeshareDataset(query): Promise<StockTimeshareDataset>`。
- 修改 `src/preload/index.ts`：
  - 暴露 `fetchStockTimeshareDataset()` 到 `window.stockApi`。
- 修改 `src/main/ipc.ts`：
  - 注册 `stock:fetchTimeshareDataset` handler。
  - handler 内使用当前 `networkProxy` 配置。

### Renderer adapter

- 修改 `src/renderer/features/stock-workspace/adapters/ElectronStockDataAdapter.ts`：
  - `StockDataAdapter` 新增 `fetchStockTimeshareDataset()`。
  - Electron adapter 透传到 preload API。

### 工作区 ViewModel

- 修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：
  - 新增 `viewMode: WorkspaceViewMode`，默认 `timeshare`。
  - 新增 `timeshareSourceId: StockSourceId`，默认 `eastmoney`。
  - 新增 `timeshare = new TimeshareChartViewModel()`。
  - `refreshStock()` 按 `viewMode` 分发到 K 线加载或分时加载。
  - K 线加载继续使用现有 `StockQuery`、`enrichStockDataset()` 和 `KLineChartViewModel`。
  - 分时加载使用 `StockTimeshareQuery` 和 `TimeshareChartViewModel`，其中 `StockTimeshareQuery.sourceId` 来自 `timeshareSourceId`，不运行 K 线指标 enrichment。
  - 新增 `setViewMode(mode)`，切换模式后保存工作区设置。
  - `setSourceId(sourceId)` 按当前 `viewMode` 分流：
    - K 线模式：更新 `query.sourceId`，并按 K 线数据源能力 normalize 周期和复权。
    - 分时模式：更新 `timeshareSourceId`；不支持分时的数据源不能被选中。
  - 新增派生状态：
    - `selectedKlineSource`：由 `query.sourceId` 决定。
    - `selectedTimeshareSource`：由 `timeshareSourceId` 决定。
    - `activeSource` / `activeSourceName`：由当前 `viewMode` 决定。
  - 分时模式下刷新失败只更新分时错误状态，不清空 K 线 dataset。
  - `recordCount`、`latestSummary`、标题和 source label 按当前 `viewMode` 输出。

### 分时 ViewModel

- 新增 `src/renderer/features/stock-workspace/view-models/TimeshareChartViewModel.ts`：
  - 保存 `dataset`、`revision`、分时加载错误和自动刷新状态。
  - 提供最新价、涨跌额、涨跌幅、点位数量等派生状态。
  - 提供 `setDataset()`、`clearError()` 等方法。

### 分时图表

- 新增 `src/renderer/features/stock-workspace/views/TimeshareChartView.tsx`：
  - 挂载分时图 adapter。
  - 展示空状态、加载状态和分时错误重试。
- 新增 `src/renderer/features/stock-workspace/adapters/TimeshareChartAdapter.ts`：
  - 绘制价格线、均价线、昨收线、成交量柱。
  - 绘制左侧价格轴和右侧涨跌幅轴。
  - 绘制压缩午休后的 X 轴。
  - 支持十字线和 tooltip。
  - resize 时重新计算画布尺寸和坐标映射。

### 顶部工具栏

- 修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`：
  - 新增 `K线 / 分时` 分段切换。
  - 分时模式隐藏周期、复权、开始日期、结束日期和指标按钮。
  - 分时模式保留证券代码、刷新、数据源、代理、检查更新。
  - “数据源”按钮 tooltip 展示当前模式的数据源名称。
  - 刷新按钮仍调用 `stock.refreshStock()`。
  - 标题按当前模式显示，例如 `上证指数(sh000001) 分时`。

### 工作区页面

- 修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：
  - `viewMode === 'kline'` 时渲染 `KLineChartView`。
  - `viewMode === 'timeshare'` 时渲染 `TimeshareChartView`。
  - `IndicatorSettingsModal` 仅在 K 线模式有入口，但可继续挂载以保持状态稳定。

### 状态栏

- 修改 `src/renderer/features/stock-workspace/views/StatusBar.tsx`：
  - K 线模式保持当前展示逻辑。
  - 分时模式展示分时数据源、证券代码、点位数、最新价、涨跌幅和 source label。
  - 状态栏第一列按当前 `viewMode` 展示 active source，不把 K 线源和分时源混在一个字段里。

### 数据源状态弹窗

- 修改 `src/renderer/features/stock-workspace/views/DataSourceStatusModal.tsx`：
  - 数据源能力展示增加“分时”列。
  - 弹窗摘要同时展示：
    - `K线数据源：xxx`
    - `分时数据源：yyy`
  - K 线模式测试逻辑以 K 线查询为主，点击“使用”只更新 `query.sourceId`。
  - 分时模式测试逻辑以分时查询为主，点击“使用”只更新 `timeshareSourceId`。
  - 分时模式下，不支持分时的数据源显示“不支持分时”，且“使用”按钮禁用。

### 持久化设置

- 修改 `src/preload/stock-api.ts`：
  - `WorkspaceSettings` 新增可选 `viewMode`。
  - `WorkspaceSettings` 新增可选 `timeshareSourceId`。
- 修改 `src/main/store.ts`：
  - 默认 `viewMode` 为 `timeshare`。
  - 默认 `timeshareSourceId` 为 `eastmoney`。
  - `normalizeWorkspaceSettings()` 兼容历史配置缺少 `viewMode` 的情况。
  - `normalizeWorkspaceSettings()` 兼容历史配置缺少 `timeshareSourceId` 的情况。
  - 非法 `viewMode` 回退为 `timeshare`。
  - 非法 `timeshareSourceId` 或不支持分时的数据源回退为 `eastmoney`。
  - 合法 `timeshareSourceId: 'tencent'` 允许恢复，不回退。
- 修改 `StockWorkspaceViewModel.getWorkspaceSettings()`：
  - 保存当前 `viewMode`。
  - 保存当前 `timeshareSourceId`。
  - K 线查询和指标配置继续按现有逻辑保存。

### 自动刷新

- 在 `StockWorkspaceViewModel` 或独立分时刷新 helper 中实现自动刷新：
  - 仅 `viewMode === 'timeshare'` 时启用。
  - 仅 A 股交易时间内启用。
  - 每 15 秒触发一次分时刷新。
  - `document.visibilityState !== 'visible'` 时暂停。
  - 请求使用递增序号或 token，避免慢请求覆盖新请求结果。
  - 切回 K 线、窗口销毁或 ViewModel dispose 时清理 timer。

## 测试计划(UT)

### 远端数据源模块

- 校验数据源元信息包含 `timeshare` 能力字段。
- 校验东方财富 `timeshare` 为 `true`。
- 校验腾讯/QQ 财经 `timeshare` 为 `true`。
- 校验新浪财经、网易财经 163 `timeshare` 为 `false`。
- 使用 mock fetch 校验东方财富分时响应可归一化为 `StockTimeshareDataset`。
- 校验东方财富分时主 host 失败时会尝试 `push2delay`，且 `sourceName/sourceId` 仍保持东方财富。
- 校验腾讯分时响应可归一化为 `StockTimeshareDataset`。
- 校验腾讯成交量和成交额累计口径按固定样本转换为分钟增量。
- 校验腾讯 `avgPrice` 缺失时按累计成交额/累计成交量计算，无法可靠计算时回退为当前价。
- 校验腾讯缺少 `previousClose` 时返回明确错误。
- 后续新增新浪降级源后，校验只保留当前交易日 1 分钟数据，不混入跨日点位。
- 后续新增新浪降级源后，校验 `close`、`volume`、`amount` 正确映射到分时点位。
- 校验分时点位按 timestamp 升序排序。
- 校验无效点位会被过滤。
- 校验无有效分时点位时返回明确错误。
- 校验不支持分时的数据源在请求前报错，不发起网络请求。
- 校验不支持市场类型时沿用现有能力校验错误。
- 校验请求层仍使用现有代理配置，不读取环境代理变量。

### StockWorkspaceViewModel

- 校验默认 `viewMode` 为 `timeshare`。
- 校验默认 `timeshareSourceId` 为 `eastmoney`。
- 校验从 settings 恢复 `viewMode: 'timeshare'`。
- 校验从 settings 恢复 `timeshareSourceId`。
- 校验非法或缺失 `viewMode` 回退为 `timeshare`。
- 校验非法或不支持分时的 `timeshareSourceId` 回退为 `eastmoney`。
- 校验 `timeshareSourceId: 'tencent'` 可恢复并用于分时刷新。
- 校验切换到分时模式会保存 workspace settings。
- 校验 K 线模式刷新调用 `fetchStockDataset()`，不调用分时查询。
- 校验分时模式刷新调用 `fetchStockTimeshareDataset()`，不调用 K 线查询。
- 校验 K 线模式刷新使用 `query.sourceId`。
- 校验分时模式刷新使用 `timeshareSourceId`。
- 校验 K 线源为腾讯、分时源为东方财富时，分时刷新只请求东方财富。
- 校验 K 线源为新浪、分时源为腾讯时，K 线刷新只请求新浪。
- 校验分时源切到腾讯后，`query.sourceId` 不变，`timeshareSourceId` 变为 `tencent`。
- 校验 K 线源切到新浪或网易后，`timeshareSourceId` 不变。
- 校验 K 线模式调用 `setSourceId()` 只更新 `query.sourceId`。
- 校验分时模式调用 `setSourceId()` 只更新 `timeshareSourceId`。
- 校验分时模式不能选择不支持分时的数据源。
- 校验分时模式可以选择腾讯，且不会影响 K 线 `query.sourceId`。
- 校验默认 `timeshareSourceId` 仍为 `eastmoney`，不会因新增能力自动改变旧用户选择。
- 校验分时加载成功后更新 `timeshare.dataset`、状态、记录数和最新摘要。
- 校验分时加载失败不会清空已有 `chart.dataset`。
- 校验切回 K 线后原 K 线周期、复权、日期和指标设置保持不变。
- 校验 `dispose()` 会清理自动刷新 timer 和待保存设置。

### TimeshareChartViewModel

- 校验 `setDataset()` 后 revision 递增。
- 校验最新价、涨跌额、涨跌幅基于最后一个点位和 `previousClose` 计算。
- 校验空数据集时返回“暂无分时”摘要。
- 校验 `previousClose` 为 0 或非法时涨跌幅展示兜底。

### TimeshareChartAdapter

- 校验传入 dataset 后可生成价格线、均价线、昨收线和成交量绘制数据。
- 校验午休时间轴被压缩，下午点位不会产生过大空白。
- 校验 resize 后坐标映射更新。
- 校验相同 dataset 重复同步不会累积重复监听器。
- 校验 dispose 后释放 canvas 事件监听。

### 设置持久化

- 校验默认 workspace settings 包含 `viewMode: 'timeshare'`。
- 校验默认 workspace settings 包含 `timeshareSourceId: 'eastmoney'`。
- 校验旧配置缺少 `viewMode` 时自动补齐默认值。
- 校验旧配置缺少 `timeshareSourceId` 时自动补齐默认值。
- 校验保存后的 workspace 包含当前 `viewMode` 和 `timeshareSourceId`。
- 校验已有 `query`、`indicatorSettings` normalize 行为不受 `viewMode` 影响。
- 校验 `timeshareSourceId` normalize 不影响 `query.sourceId`。
- 校验保存 `query.sourceId: 'sina'` 与 `timeshareSourceId: 'tencent'` 后能分别恢复。
- 校验旧配置只有 `query.sourceId: 'tencent'` 时，默认分时源仍补为 `eastmoney`，不把 K 线腾讯源隐式复用为分时源。
- 校验非法或不支持分时的 `timeshareSourceId: 'sina'` 回退为 `eastmoney`，但 `query.sourceId` 保持原值。

### 回归用例

- 远端 K 线加载、数据源 fallback、代理配置保存、指标设置、K 线图 adapter 既有 UT 保持通过。
- 分时新增类型不应改变 `StockPeriod` 白名单和 K 线周期 normalize 行为。
- 数据源弹窗在 K 线模式下的“当前”标签只看 `query.sourceId`。
- 数据源弹窗在分时模式下的“当前”标签只看 `timeshareSourceId`。
- 状态栏、toolbar tooltip、标题使用 active source，不展示错误模式的数据源。

需要执行：

- `yarn test tests/remote-stock-sources.test.ts`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn test tests/klinecharts-adapter.test.ts`
- 新增后执行分时相关测试文件，例如 `yarn test tests/timeshare-chart-adapter.test.ts`
- `yarn typecheck`
- `yarn build`

## 影响范围(建议手动测试范围)

### 分时基础加载

- 启动应用，确认默认进入分时模式。
- 点击 `分时`，确认进入分时模式并加载当前证券的当日分时。
- 使用默认 `sh000001` 加载分时，确认价格线、均价线、成交量、昨收线展示正常。
- 默认分时源为东方财富时，确认 `push2` 主 host 失败后仍可通过 `push2delay` 加载分时，状态栏数据源仍显示东方财富。
- 输入沪市股票、深市股票、北交所股票、ETF、指数后刷新，确认分时加载或错误提示符合数据源能力。
- 分时加载失败时，确认错误显示在分时区域，K 线模式历史数据不被清空。

### K 线 / 分时切换

- 在 K 线模式修改周期、复权、日期和指标设置。
- 在 K 线模式将 K 线数据源切换到腾讯或新浪。
- 切到分时模式，确认周期、复权、日期和指标入口隐藏。
- 确认分时数据源仍为东方财富，不沿用 K 线数据源。
- 切回 K 线模式，确认原周期、复权、日期和指标设置保持不变。
- 确认 K 线数据源仍为之前选择的腾讯或新浪，不被分时数据源反向覆盖。
- 多次切换 K 线/分时，确认图表不白屏、不重复叠加 loading。
- 组合测试 `K线源=新浪，分时源=腾讯`：K 线刷新使用新浪 K 线，分时刷新使用腾讯分时。
- 组合测试 `K线源=腾讯，分时源=东方财富`：K 线刷新使用腾讯 K 线，分时刷新使用东方财富分时。
- 组合测试 `K线源=网易，分时源=腾讯`：K 线仅展示网易支持的日线能力，分时仍可使用腾讯。
- 修改 K 线周期、复权或日期后，确认分时源不变化。
- 切换分时源后，确认 K 线周期、复权或日期不变化。

### 顶部工具栏

- 分时模式下确认仅保留证券代码、刷新、数据源、代理、检查更新等必要入口。
- K 线模式下确认原周期、复权、日期和指标入口仍可用。
- 缩小窗口宽度，确认 `K线 / 分时` 切换和刷新按钮不发生文字溢出或控件重叠。

### 分时图表交互

- 鼠标移动到分时图上，确认十字线和 tooltip 展示时间、价格、均价、涨跌幅、成交量。
- 检查上午和下午交易时段的 X 轴，确认午休被压缩。
- 改变窗口大小，确认图表自适应且坐标轴、tooltip 位置正确。
- 交易日非交易时间打开分时，确认能展示最新可用数据但不自动高频刷新。

### 自动刷新

- 交易时间内停留在分时模式，确认每 15 秒刷新一次。
- 切回 K 线模式，确认分时自动刷新停止。
- 切到后台或浏览器不可见状态，确认自动刷新暂停。
- 回到前台后，确认自动刷新恢复。
- 快速连续点击刷新，确认慢请求不会覆盖新结果。

### 数据源状态与代理

- 打开数据源弹窗，确认增加“分时”能力展示。
- 确认弹窗摘要同时展示 K 线数据源和分时数据源。
- K 线模式下点击“使用”，确认只切换 K 线数据源。
- 分时模式下测试数据源，确认东方财富和腾讯可发起分时测试，新浪和网易展示“不支持分时”。
- 分时模式下点击“使用”，确认只切换分时数据源，K 线数据源不变。
- 分时模式下不支持分时的数据源“使用”按钮禁用。
- 确认分时模式下腾讯显示支持分时，点击“使用”后只切换分时数据源。
- 分别用东方财富和腾讯刷新同一证券，确认图表、状态栏 source label、点位数和 tooltip 正常。
- 后续新增新浪降级源后，确认 UI 能识别其为“分钟K线降级”来源，不和标准分时混淆。
- 在 K 线模式打开弹窗时，确认“当前”标签跟随 K 线源；切到分时模式后，“当前”标签跟随分时源。
- 在弹窗摘要中确认 `K线数据源` 与 `分时数据源` 可同时显示不同平台。
- 对不支持分时的新浪/网易，确认分时模式“使用”按钮不可点击，但 K 线模式仍可选择。
- 开启 SOCKS5 或 HTTP 代理后刷新分时，确认请求使用代理配置。
- 关闭代理后刷新分时，确认恢复直连。

### 持久化兼容

- 切换到分时模式后退出并重启，确认恢复到分时模式。
- 切换回 K 线模式后退出并重启，确认恢复到 K 线模式。
- 分别修改 K 线数据源和分时数据源后退出并重启，确认两者分别恢复。
- 保存 `K线源=新浪，分时源=腾讯` 后退出并重启，确认两个源不被合并。
- 使用旧配置文件启动，确认默认进入分时模式且应用不白屏。
- 使用旧配置文件启动，确认分时数据源默认补为东方财富。

## 风险与后续

- 东方财富分时接口属于公开免费接口，字段和可用性不受应用控制。
- 东方财富 `push2` 分时 host 可能在部分网络下空响应，已增加 `push2delay` 同源 host fallback，但仍依赖用户网络能访问东财域名。
- 当前接入东方财富和腾讯分时，但不会在东方财富失败时自动 fallback 到腾讯。
- 腾讯分时接口字段少于东方财富，均价、成交额、成交量口径可能需要降级或转换，必须用固定样本锁住解析行为。
- 新浪方案不是严格分时，而是 1 分钟 K 线转分时，只能作为降级源，不能默认替代标准分时。
- 新增分时源后仍不做静默自动 fallback；如果要做自动 fallback，需要额外设计错误归因和状态栏提示。
- 分时图如果直接用 Canvas 实现，需要确保 resize、DPR、tooltip 和事件解绑都覆盖到位。
- 自动刷新需要避免和用户手动刷新产生竞态，必须使用请求序号或 token 防止旧请求覆盖新数据。
- A 股交易时段逻辑当前只覆盖普通交易日时段，不处理节假日、临时休市、半日市等特殊日历。
- 后续可扩展腾讯手动备用源、 新浪 1 分钟降级源、历史多日分时、盘口、逐笔成交和交易日历模块。

## 验收标准

- 顶部工具栏存在 `K线 / 分时` 分段切换。
- 默认启动进入分时模式，且切回 K 线后不影响既有 K 线加载。
- 分时模式可使用东方财富加载当日分时。
- K 线数据源和分时数据源独立保存、独立切换。
- K 线刷新使用 `query.sourceId`，分时刷新使用 `timeshareSourceId`。
- 默认分时源仍为东方财富，用户可手动切到腾讯且不影响 K 线源。
- 新增新浪降级源前后，标准分时源和 1 分钟 K 线降级源在 UI 或 source label 上可区分。
- 证券代码在 K 线和分时之间共享。
- 分时图展示价格线、均价线、成交量柱、昨收线、右轴涨跌幅和 tooltip。
- 分时模式隐藏周期、复权、日期和指标入口。
- 切回 K 线后原 K 线查询条件和指标设置保持不变。
- 分时模式交易时间内可 15 秒自动刷新，后台和非交易时段暂停。
- 不支持分时的数据源给出明确提示。
- 旧 workspace settings 缺少 `viewMode` 时兼容启动。
- UT、类型检查、构建均通过。
