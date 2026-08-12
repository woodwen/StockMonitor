# M-27(feat): 增强 K 线指标样式、精度与实时预览

## 背景:

- K 线指标设置已经支持开关、参数、副图数量限制和持久化，但颜色、线型、显示精度仍沿用 klinecharts 默认值。
- 指标弹窗此前只有点击“应用”后才生效，用户调整参数或样式时无法即时确认图表效果。
- B/S 信号 overlay 的买入、卖出颜色硬编码在 adapter 中，无法与其他指标样式一起配置和保存。

## 方案概述:

- 扩展 K 线 `IndicatorSettings`，把 `enabled`、`params`、`precision` 和 `styles` 作为统一配置。
- 指标定义集中维护默认精度、线条样式槽位、柱体样式和 B/S 标记样式。
- K 线指标弹窗使用草稿 + 预览模型：有效草稿实时预览，点击“应用”后才提交并保存，点击“取消”恢复已提交配置。
- klinecharts adapter 同步 `calcParams`、`precision`、`styles`，仅样式或精度变化时优先覆盖已有指标，参数变化时重建指标。
- 分时指标继续保持原有参数弹窗和应用后生效逻辑，本次不扩展样式。

## 实现改动:

- 扩展 `stock-types.ts`：
  - 新增 `IndicatorLineStyle`、线条样式、柱体样式、标记样式和 `IndicatorVisualSettings` 类型。
  - `IndicatorSettings` 新增 `precision` 和 `styles` 字段。
- 扩展 `indicator-definitions.ts`：
  - 新增默认精度、默认线条颜色、默认柱体颜色、默认 B/S 标记颜色。
  - 新增样式创建、clone、normalize、validate helper。
  - 旧配置缺少 `precision/styles` 时自动补齐默认值，非法颜色、线型、精度回退默认值。
- 修改 `KLineChartViewModel`：
  - 新增 `previewIndicatorSettings` 和 `effectiveIndicatorSettings`。
  - 新增精度、线条颜色、线型、柱体颜色、B/S 标记颜色和恢复样式 draft action。
  - 参数或样式草稿有效时同步预览；非法草稿保持最后一次有效预览。
- 修改 `StockWorkspaceViewModel`：
  - K 线图表渲染使用 `effectiveIndicatorSettings`。
  - K 线预览变更不保存；应用后保存完整工作区配置。
  - B/S 预览和取消回滚基于当前 dataset 重新 enrich，不重新请求远端行情。
- 修改 `KLineChartsAdapter`：
  - 创建指标时传入 `calcParams`、`precision`、`styles`。
  - 将 `solid/dashed/dotted` 映射为 klinecharts line style 和 `dashedValue`。
  - 将 VOL/MACD 柱体涨跌平颜色映射到 `styles.bars[0]`。
  - B/S overlay 从配置读取买入、卖出颜色，样式变化时重建 overlay。
- 修改 `IndicatorSettingsModal.tsx` 和 `styles.css`：
  - K 线指标行新增显示精度输入和样式 Popover。
  - Popover 内支持线条颜色、线型、柱体涨跌平颜色、B/S 买卖颜色和“恢复样式”。
  - 保持分时指标行不变。
- 更新 `CHANGELOG.md`：
  - 在 `Unreleased / 0.1.6` 记录 K 线指标样式、精度和实时预览能力。

## 测试计划(UT):

- 已执行 `yarn typecheck`，TypeScript 类型检查通过。
- 已执行 `yarn test`，全量 Vitest 通过：20 个测试文件，124 个用例。
- 已执行 `yarn test tests/release-version.test.mjs tests/changelog-release-notes.test.mjs`，changelog/release notes 校验通过。
- 已执行 `yarn build`，Electron main/preload/renderer 生产构建通过。
- 已执行 `git diff --check`，diff 空白检查通过。

## 影响范围(建议手动测试范围):

- 打开 K 线“指标设置”，确认 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 显示精度输入可用，B/S 不展示精度。
- 修改 BOLL 或 MA 线条颜色、线型，确认图表在弹窗未应用时实时预览，取消后恢复原样。
- 修改 VOL 或 MACD 柱体涨跌平颜色，确认柱体颜色实时变化，应用后重启仍能恢复。
- 修改 B/S 买入、卖出颜色，确认 overlay 颜色更新且不会重复叠加。
- 输入非法参数或非法精度时，确认“应用”禁用，图表保持最后一次有效预览。
- 开启 3 个副图指标后，确认第 4 个副图指标仍被限制。
- 切换到分时视图，确认分时指标弹窗仍保持原有参数配置能力。
- 使用旧版缺少 `precision/styles` 的工作区设置启动，确认可以自动补齐默认样式并正常保存。

## 风险与后续:

- 本次只开放颜色、线型和显示精度，不包含线宽、透明度或自定义标记形状。
- 样式覆盖依赖 klinecharts 当前 `precision/styles/overrideIndicator` 行为，后续升级图表库时需要回归 adapter。
- B/S overlay 仍由本项目自定义绘制，后续若开放标记形状需要扩展 overlay 数据结构。

## 验收标准:

- K 线指标弹窗能配置颜色、线型和显示精度。
- 弹窗内有效草稿可以实时预览；应用才保存，取消会回滚。
- 旧指标配置能兼容迁移并补齐默认样式和精度。
- `yarn typecheck`、`yarn test`、`yarn build` 和 `git diff --check` 均通过。

---

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
