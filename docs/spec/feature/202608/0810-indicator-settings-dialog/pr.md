# M-6(feat): 新增指标管理弹窗与参数配置

## 背景:

- 当前工具栏直接展示 BOLL、VOL MA、B/S 指标 checkbox，随着常用指标增加会继续挤占查询控件空间。
- 现有指标参数分散硬编码在计算层和 klinecharts adapter 中，用户无法调整 BOLL、VOL、B/S 等指标参数。
- 工作区设置只持久化指标开关，不保存指标参数，也无法兼容新增 MA、EMA、MACD、KDJ、RSI 等常用指标。
- 图表 adapter 之前在指标已创建时直接跳过同步，后续如果只增加参数输入，会出现界面参数已变但图表仍沿用旧参数的问题。

## 方案概述:

- 新增顶部工具栏“指标”按钮，用 `IndicatorSettingsModal` 统一管理指标开关和参数。
- 指标分为主图指标和副图指标：
  - 主图指标：BOLL、MA、EMA、B/S。
  - 副图指标：VOL、MACD、KDJ、RSI。
- 默认开启 BOLL、VOL、B/S；新增 MA、EMA、MACD、KDJ、RSI 默认关闭。
- 副图指标 VOL、MACD、KDJ、RSI 最多同时开启 3 个；达到上限后置灰其余未开启副图指标。
- 参数采用弹窗草稿模型：点击“应用”后统一生效并保存，点击“取消”不影响当前图表。
- 新增统一指标定义模块，集中维护默认参数、参数范围、klinecharts 指标名、副图上限和参数校验规则。

## 实现改动:

- 新增 `indicator-definitions.ts`：
  - 定义 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI 的默认开关、默认参数、参数 schema 和图表分组。
  - 提供 `normalizeIndicatorSettings()`、`validateIndicatorParams()`、副图计数和副图上限 helper。
- 扩展 `stock-types.ts`：
  - 新增完整 `IndicatorName`、`IndicatorPane`、`IndicatorSettings`、`IndicatorSettingsMap` 类型。
- 修改 `indicator-engine.ts`：
  - 支持从完整指标配置派生 BOLL、VOL、B/S 本地计算参数。
  - B/S 参数变化后可基于当前 dataset 重新 enrich，不重新拉取远端行情。
- 修改 `KLineChartViewModel` / `StockWorkspaceViewModel`：
  - 用 `indicatorSettings` 替代单纯 boolean 开关作为主状态。
  - 增加指标弹窗打开、取消、应用、恢复默认、参数草稿和校验错误状态。
  - 应用指标草稿后立即保存工作区设置。
- 修改 `KLineChartsAdapter`：
  - 接收完整指标配置。
  - 支持 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 的创建/移除。
  - 记录指标参数签名，参数变化时移除旧指标并按新参数重新创建。
  - B/S 继续使用自定义 overlay，并避免重复叠加。
- 新增 `IndicatorSettingsModal.tsx`：
  - 使用 Ant Design Modal 展示主图和副图指标。
  - 参数使用 `InputNumber`，支持每个指标恢复默认。
  - 参数非法时禁用“应用”。
- 修改工具栏和页面挂载：
  - `TopToolbar` 移除原指标 checkbox 区域，新增“指标”按钮。
  - `WorkspacePage` 挂载指标设置弹窗。
  - `styles.css` 补充指标弹窗布局样式。
- 修改设置持久化：
  - `WorkspaceSettings` 支持保存完整 `indicatorSettings`。
  - `store.ts` 支持旧 `enabledIndicators` 配置迁移，并对异常参数和副图超限做 normalize。
  - `AppUpdateViewModel` 默认设置补齐新 workspace 指标配置。
- 新增和更新 UT：
  - 新增 `indicator-definitions.test.ts`。
  - 更新 klinecharts adapter 和工作区 ViewModel 测试，覆盖参数重建、弹窗草稿应用和副图最多 3 个限制。

## 测试计划(UT):

- 已执行 `yarn typecheck`，TypeScript 类型检查通过。
- 已执行 `yarn test`，全量 Vitest 通过：6 个测试文件，28 个用例。
- 已执行 `yarn build`，Electron main/preload/renderer 生产构建通过。
- 已执行 `git diff --check`，diff 空白检查通过。

## 影响范围(建议手动测试范围):

- 打开应用，确认顶部工具栏显示“指标”按钮，原 BOLL/VOL/B/S checkbox 不再直接占用工具栏。
- 打开“指标设置”弹窗，确认默认开启 BOLL、VOL、B/S，新增指标默认关闭。
- 修改 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 参数并应用，确认图表 legend 或图形结果跟随变化。
- 修改 B/S 参数并应用，确认买卖点 overlay 重新计算且不重复叠加。
- 依次开启 VOL、MACD、KDJ，确认第 4 个副图指标 RSI 被置灰；关闭任一副图后确认 RSI 可重新开启。
- 修改指标参数后退出并重启，确认指标开关和参数恢复。
- 使用旧版仅包含 `enabledIndicators` 的设置启动，确认应用正常迁移并补齐默认参数。

## 风险与后续:

- 当前指标样式仍使用 klinecharts 默认样式；后续如需颜色、线型、显示精度配置，可继续扩展 `indicator-definitions.ts`。
- 当前副图最多 3 个是全局工作区规则，不按股票、周期或数据源单独保存。
- 弹窗采用“应用/取消”草稿模型，不做实时预览；后续如需要实时预览，可在不改变持久化结构的前提下调整交互。
- 当前 MA、EMA、MACD、KDJ、RSI 使用 klinecharts 内置指标名；若后续升级图表库导致兼容变化，需要通过 adapter 或自定义指标注册兜底。

## 验收标准:

- 指标弹窗可管理 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI 的开关和参数。
- 默认开启、默认参数和副图最多 3 个限制符合 plan。
- 点击取消不会改变当前图表；点击应用后参数生效并持久化。
- 参数变化后 adapter 使用新参数重建指标，不继续沿用旧参数。
- 旧 `enabledIndicators` 工作区设置可以兼容迁移。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 均通过。
