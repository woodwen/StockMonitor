# M-19(feat): 新增分时指标与截图文档

## 背景

分时图此前只展示价格线、均价线、昨收线、成交量和十字线 tooltip，未接入指标管理能力。K 线已有独立的指标配置、参数校验和持久化，但分时数据模型与 Canvas 绘制链路不同，需要单独建设分时指标配置、计算和绘制能力。

## 方案概述

- 新增分时指标定义和计算模块，支持 `MA`、`EMA`、`BOLL`、`B/S`、`VOL MA`、`MACD`、`RSI`。
- 新增 `timeshareIndicatorSettings`，分时指标和 K 线指标独立保存。
- 分时视图也显示顶部“指标”按钮，同一个指标弹窗按当前视图展示 K 线或分时指标配置。
- 分时新增指标默认关闭；均价线、昨收线、成交量柱默认开启，价格线固定展示。
- 分时副图最多同时开启 2 个，当前支持 `MACD` 和 `RSI`。
- 分时 Canvas adapter 支持主图指标线、B/S 买卖标记、成交量均线、副图 pane、按区域显示的 tooltip，以及各区域线条图例说明。
- README 同步当前功能、分时/K 线截图、免责声明和免费数据源致谢。

## 实现改动

- 新增 `src/renderer/features/stock-workspace/models/timeshare-indicator-definitions.ts`。
- 新增 `src/renderer/features/stock-workspace/models/timeshare-indicator-engine.ts`。
- 扩展 `src/renderer/features/stock-workspace/models/stock-types.ts`，加入分时指标设置和 enriched 分时数据类型。
- 修改 `src/renderer/features/stock-workspace/view-models/TimeshareChartViewModel.ts`，增加分时指标草稿、参数应用和本地重算能力。
- 修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`，按当前视图路由指标弹窗，并保存分时指标配置。
- 修改 `src/renderer/features/stock-workspace/adapters/TimeshareChartAdapter.ts`，绘制分时指标、B/S 标记、动态副图和线条图例。
- 修改 `src/renderer/features/stock-workspace/views/IndicatorSettingsModal.tsx` 和 `TopToolbar.tsx`，支持分时指标入口和分组配置。
- 修改 `src/preload/stock-api.ts`、`src/main/store.ts`、`AppUpdateViewModel.ts`，补齐分时指标默认设置与持久化 normalize。
- 新增 `tests/timeshare-indicator-definitions.test.ts` 和 `tests/timeshare-indicator-engine.test.ts`，并扩展工作区 ViewModel 测试。
- 新增 `docs/assets/screenshots/`，存放分时首页、分时数据源、分时指标设置、网络代理、K 线首页、K 线数据源和 K 线指标截图。
- 更新 `README.md`，补充分时指标说明、截图展示、免责声明和公开免费数据源致谢。

## 测试计划(UT)

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围

- 分时图指标展示、tooltip、成交量区和副图布局。
- 工作区设置持久化结构新增 `timeshareIndicatorSettings`。
- 顶部工具栏分时视图新增“指标”按钮。
- K 线指标设置继续使用原有 `indicatorSettings`，不与分时配置共用。
- README 文档新增截图资源引用、免责声明和数据源致谢。

## 风险与后续

- 当前未做 KDJ、量比、换手率、委比、内外盘和资金流；这些指标需要分钟 OHLC、历史成交量、流通股本、盘口或逐笔方向等额外数据。
- 分时 Canvas adapter 逻辑明显增加；后续如果继续增加指标，建议再拆出独立布局和绘制 helper 文件。
