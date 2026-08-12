# K 线指标体验增强：样式、精度与实时预览

## 背景

当前应用已经支持 K 线图展示、远端行情加载、工作区设置持久化，以及指标设置弹窗。K 线指标配置已经覆盖 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI，并支持开关、参数、参数校验、副图最多 3 个、旧 `enabledIndicators` 迁移和工作区保存。

现有指标体验仍有几个缺口：

- 指标颜色、线型和显示精度仍依赖 klinecharts 默认配置，用户无法按自己的看盘习惯调整。
- 指标弹窗采用“应用后生效”，用户修改参数或样式前无法即时判断图表效果。
- B/S overlay 颜色硬编码在 adapter 中，无法与其他指标样式一起管理。
- klinecharts indicator 的 `precision` 和 `styles` 尚未纳入当前 `IndicatorSettings`，持久化结构不能表达视觉配置。
- 后续继续在弹窗或 adapter 内追加样式判断，会让指标定义、UI、持久化和图表同步规则分散。

本次目标是在 K 线指标上新增颜色、线型、显示精度配置，并支持指标弹窗实时预览。分时指标维持现有参数弹窗，不纳入本次增强范围。

## 方案概述

在现有指标定义模块上扩展视觉配置，把指标开关、参数、显示精度和样式作为同一个 `IndicatorSettings` 管理。UI、ViewModel、主进程 store 和 klinecharts adapter 都从指标定义读取默认值和可配置项，避免多处硬编码。

核心方案：

- K 线 `IndicatorSettings` 增加 `precision` 和 `styles`。
- 样式按指标输出项配置，例如 BOLL 的 `UP/MID/DN`，MACD 的 `DIF/DEA/柱`，B/S 的买入/卖出标记。
- K 线弹窗内修改开关、参数、颜色、线型、显示精度后，草稿中的有效配置立即预览到当前图表。
- 点击“应用”后才把草稿提交为当前配置并保存到工作区设置。
- 点击“取消”清空预览，图表恢复打开弹窗前状态。
- 参数或样式非法时禁用“应用”，图表保持最后一次有效预览。
- klinecharts 内置指标优先使用原生 `precision` 和 `styles`；B/S 继续使用自定义 overlay，但颜色从指标配置读取。

本次不做：

- 不扩展分时指标样式。
- 不支持线宽、透明度和自定义标记形状。
- 不新增指标。
- 不改变副图最多 3 个的现有规则。
- 不改变行情请求、数据源 fallback、代理和自动刷新流程。

## 默认确认项

| 确认项 | 默认决策 |
| --- | --- |
| 本次范围 | 只增强 K 线指标 |
| 分时指标 | 暂不改 |
| 配置粒度 | 按指标输出项配置样式 |
| 可配置项 | 颜色、线型、显示精度 |
| 暂不支持 | 线宽、透明度、标记形状 |
| 线型集合 | 实线、虚线、点线 |
| 颜色格式 | 只保存 `#RRGGBB` |
| 显示精度范围 | `0-6` 位小数 |
| 实时预览 | 有效草稿立即预览，应用才保存，取消回滚 |
| 参数非法时预览 | 保持最后一次有效预览 |
| B/S 样式 | 只开放买入、卖出标记颜色 |
| 重置行为 | 参数“恢复默认”和样式“恢复样式”分开 |
| 旧配置兼容 | 缺失 `precision/styles` 时 normalize 补默认值 |

## 指标默认配置

| 指标 | 分组 | 默认开启 | 默认参数 | 默认精度 | 计入副图上限 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| BOLL | 主图 | 是 | `20, 2` | `2` | 否 | 布林线周期、标准差倍数 |
| MA | 主图 | 否 | `5, 10, 20, 60` | `2` | 否 | 收盘价移动平均线周期 |
| EMA | 主图 | 否 | `12, 26` | `2` | 否 | 收盘价指数移动平均线周期 |
| B/S | 主图信号 | 是 | `5, 20` | 不适用 | 否 | 自定义买卖点信号快慢周期 |
| VOL | 副图 | 是 | `5, 10, 20` | `0` | 是 | 成交量及成交量均线 |
| MACD | 副图 | 否 | `12, 26, 9` | `2` | 是 | 快线、慢线、信号线 |
| KDJ | 副图 | 否 | `9, 3, 3` | `2` | 是 | RSV 周期、K 平滑、D 平滑 |
| RSI | 副图 | 否 | `6, 12, 24` | `2` | 是 | 相对强弱指标周期 |

## 指标样式默认配置

默认线条颜色贴近 klinecharts 当前默认视觉，降低升级后的视觉跳变：

- 线条颜色槽位：`#FF9600`、`#935EBD`、`#1677FF`、`#E11D74`、`#01C5C4`。
- 默认线型：全部为实线。
- VOL/MACD 柱体颜色：沿用当前 K 线涨跌色，涨 `#ef5350`、跌 `#26a69a`、平 `#8f9bb3`。
- B/S 标记颜色：买入 `#ff4d4f`，卖出 `#13c2c2`。

样式槽位：

| 指标 | 可配置输出项 | 可配置项 |
| --- | --- | --- |
| BOLL | `UP`、`MID`、`DN` | 颜色、线型、显示精度 |
| MA | 按参数动态生成的 `MA1...MAn` | 颜色、线型、显示精度 |
| EMA | 按参数动态生成的 `EMA1...EMAn` | 颜色、线型、显示精度 |
| VOL | 成交量均线 `MA1...MAn`、成交量柱 | 均线颜色和线型、柱体涨跌平颜色、显示精度 |
| MACD | `DIF`、`DEA`、`MACD` 柱 | 线条颜色和线型、柱体涨跌平颜色、显示精度 |
| KDJ | `K`、`D`、`J` | 颜色、线型、显示精度 |
| RSI | 按参数动态生成的 `RSI1...RSIn` | 颜色、线型、显示精度 |
| B/S | 买入标记、卖出标记 | 标记颜色 |

## 实现改动

### 指标类型与定义

修改 `src/renderer/features/stock-workspace/models/stock-types.ts`：

- 扩展 `IndicatorSettings`，新增 `precision` 和 `styles`。
- 新增指标线型、线条样式、柱体样式和标记样式类型。
- 保持 `IndicatorSettingsMap` 仍是 K 线指标配置的统一类型。

修改 `src/renderer/features/stock-workspace/models/indicator-definitions.ts`：

- 在 `IndicatorDefinition` 中增加默认精度、精度范围、样式槽位和默认样式。
- 新增 `createDefaultIndicatorStyle()` 或等价 helper，集中生成默认样式。
- 新增 `normalizeIndicatorPrecision()`、`normalizeIndicatorStyles()`。
- 新增 `validateIndicatorStyles()` 或将样式校验纳入现有 validate 结果。
- 颜色只接受 `#RRGGBB`；非法颜色回退对应槽位默认值。
- 线型只接受 `solid`、`dashed`、`dotted`；非法线型回退 `solid`。
- 精度只接受 `0-6` 整数；非法精度回退指标默认精度。
- 旧配置缺少 `precision/styles` 时自动补齐，不影响旧 `enabled + params` 配置启动。

### K 线图 ViewModel

修改 `src/renderer/features/stock-workspace/view-models/KLineChartViewModel.ts`：

- 新增 `previewIndicatorSettings`，表示弹窗打开期间的有效预览配置。
- 新增 `effectiveIndicatorSettings`，图表渲染统一读取该值：有预览时用预览，否则用已提交配置。
- 草稿开关、参数、颜色、线型、精度变化后，先校验草稿；有效时更新预览并递增 `revision`。
- 取消弹窗时清空预览、恢复草稿为已提交配置，并递增 `revision`。
- 应用弹窗时把草稿 normalize 后提交到 `indicatorSettings`，清空预览并递增 `revision`。
- 新增样式相关 action：设置精度、设置线条颜色、设置线型、设置柱体颜色、设置 B/S 标记颜色、恢复默认样式。
- 保留副图最多 3 个逻辑，副图限制继续基于草稿计算。

### 股票工作区 ViewModel

修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：

- 加载设置时恢复完整 `indicatorSettings`，包含开关、参数、精度和样式。
- 保存工作区设置时写入完整 K 线指标配置。
- K 线指标预览变更时，不立即保存工作区设置。
- K 线指标应用后，才保存工作区设置。
- 保留最新 K 线原始 dataset，或在重新 enrich 前剥离已有指标字段，确保 B/S 参数预览和取消回滚不会基于旧 enrichment 叠加。
- B/S 参数预览时基于当前 dataset 重新计算买卖点，不重新请求远端行情。

### 图表 adapter

修改 `src/renderer/features/stock-workspace/adapters/KLineChartsAdapter.ts`：

- `setDataset(dataset, indicatorSettings)` 继续作为图表同步入口。
- 创建 klinecharts indicator 时传入 `calcParams`、`precision` 和 `styles`。
- 将通用线型映射到 klinecharts：
  - `solid` -> `style: solid`。
  - `dashed` -> `style: dashed`，`dashedValue: [6, 4]`。
  - `dotted` -> `style: dashed`，`dashedValue: [2, 3]`。
- 将线条样式映射到 `styles.lines`。
- 将 VOL/MACD 柱体涨跌平颜色映射到 `styles.bars[0]`。
- active indicator 签名包含参数、精度和样式。
- 参数变化时移除旧指标并按新参数重新创建，确保 regenerate figures 正确。
- 仅精度或样式变化时优先调用 `overrideIndicator`，减少实时预览时 pane 闪烁。
- B/S overlay 创建时把买入、卖出颜色写入 `extendData` 或 overlay styles，overlay 绘制函数不再硬编码颜色。
- B/S 参数或样式变化时移除并重建 overlay，避免重复叠加或颜色不更新。

### 指标设置弹窗

修改 `src/renderer/features/stock-workspace/views/IndicatorSettingsModal.tsx`：

- K 线指标行保留开关、名称、参数输入和恢复默认。
- 增加显示精度 `InputNumber`，范围 `0-6`。
- 增加样式入口，使用 Popover 展示详细样式配置。
- 颜色使用 Ant Design `ColorPicker`。
- 线型使用 `Segmented` 或 `Select`。
- 多线指标行内只展示颜色 swatch 摘要，详细配置放入 Popover，避免弹窗行高失控。
- B/S 样式面板只展示买入和卖出颜色。
- 参数“恢复默认”和样式“恢复样式”分开。
- K 线弹窗草稿变化后触发实时预览；分时弹窗保持现有应用后生效。

修改 `src/renderer/styles.css`：

- 增加样式 swatch、样式 Popover、精度输入和紧凑布局样式。
- 保持弹窗在窄宽度下可换行，不挤压参数输入。
- 避免大面积嵌套卡片，指标行仍保持可扫描的列表布局。

### IPC 与持久化配置

修改 `src/preload/stock-api.ts`：

- `WorkspaceSettings.indicatorSettings` 使用扩展后的 `IndicatorSettingsMap`。
- 保留历史 `enabledIndicators` 可选字段用于兼容迁移。

修改 `src/main/store.ts`：

- 默认工作区设置写入完整 K 线指标配置。
- `normalizeWorkspaceSettings()` 对 `indicatorSettings` 执行参数、精度和样式 normalize。
- 缺少 `precision/styles` 的历史配置自动补齐默认值。
- 非法颜色、线型、精度回退默认值。
- 副图超限兜底规则保持不变。

### 文档

- 当前 `plan.md` 记录本次 K 线指标体验增强方案。
- 实现完成后新增或更新同目录 `pr.md`。
- 用户可见行为变化需要更新 `CHANGELOG.md` 的 `Unreleased / 当前 package.json version` 区块。

## 测试计划(UT)

### 指标定义与 normalize

- 校验默认指标配置包含 `enabled`、`params`、`precision` 和 `styles`。
- 校验 BOLL、MA、EMA、MACD、KDJ、RSI 默认精度为 `2`。
- 校验 VOL 默认精度为 `0`。
- 校验默认线条颜色槽位符合本文档配置。
- 校验 VOL/MACD 默认柱体颜色符合本文档配置。
- 校验 B/S 默认买入、卖出颜色符合本文档配置。
- 校验旧 `enabledIndicators` 可迁移，并自动补齐默认精度和样式。
- 校验旧 `indicatorSettings` 缺少 `precision/styles` 时自动补齐默认值。
- 校验非法颜色、非法线型、非法精度会回退默认值。
- 校验原有参数校验仍覆盖周期范围、重复周期、MACD 快慢线顺序和 BOLL 倍数范围。

### KLineChartViewModel

- 校验打开弹窗时草稿等于当前已提交配置。
- 校验修改有效参数会更新预览配置并递增 `revision`。
- 校验修改颜色、线型、显示精度会更新预览配置并递增 `revision`。
- 校验参数非法时不会更新预览配置，并禁用应用。
- 校验取消弹窗会清空预览，当前配置保持不变，并递增 `revision`。
- 校验应用弹窗会提交草稿、清空预览，并递增 `revision`。
- 校验恢复默认参数只影响对应指标参数草稿。
- 校验恢复样式只影响对应指标样式草稿。
- 校验副图已开启 3 个时，不能再开启第 4 个副图指标。
- 校验 B/S 参数预览会触发当前 dataset 重新 enrich。

### StockWorkspaceViewModel

- 校验指标预览变更不会调用 `setWorkspaceSettings()`。
- 校验应用指标草稿后才保存完整工作区指标配置。
- 校验取消指标弹窗后不会保存预览配置。
- 校验切换股票、周期、复权、日期范围后，当前已提交指标样式继续用于图表。
- 校验加载历史配置时能恢复样式和精度。

### KLineChartsAdapter

- 校验创建指标时传入 `calcParams`、`precision` 和 `styles`。
- 校验线条样式映射到 klinecharts `styles.lines`。
- 校验 `solid`、`dashed`、`dotted` 映射为正确的 klinecharts line style 和 `dashedValue`。
- 校验 VOL/MACD 柱体颜色映射到 `styles.bars[0]`。
- 校验参数变化时移除旧指标并重新创建。
- 校验仅样式或精度变化时调用 `overrideIndicator`，不重复创建 pane。
- 校验关闭指标时移除对应 indicator 或 overlay。
- 校验相同状态重复同步不会重复创建 indicator 或 overlay。
- 校验 B/S overlay 使用配置中的买入、卖出颜色。
- 校验 B/S 参数或颜色变化时 overlay 会更新且不重复叠加。

### 回归用例

- `indicator-engine` 既有 BOLL、VOL、B/S enrichment 测试保持通过。
- 工作区查询条件、数据源 fallback、代理配置保存、分时指标配置保持不受影响。

需要执行：

```bash
yarn test tests/indicator-definitions.test.ts
yarn test tests/indicator-engine.test.ts
yarn test tests/klinecharts-adapter.test.ts
yarn test tests/stock-workspace-view-model.test.ts
yarn typecheck
yarn build
```

## 影响范围(建议手动测试范围)

### 指标弹窗

- 启动应用，进入 K 线视图，点击顶部“指标”按钮。
- 确认弹窗仍展示 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI。
- 确认默认开启 BOLL、VOL、B/S，其余指标默认关闭。
- 确认每个 K 线指标可见显示精度入口。
- 确认线条类指标可配置颜色和线型。
- 确认 VOL/MACD 可配置柱体涨跌平颜色。
- 确认 B/S 只展示买入、卖出颜色配置。
- 点击“恢复默认”，确认只恢复对应指标参数。
- 点击“恢复样式”，确认只恢复对应指标样式。

### 实时预览与取消回滚

- 修改 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 参数，确认图表实时预览。
- 修改颜色或线型，确认图表线条实时变化。
- 修改显示精度，确认 legend 或 tooltip 数值精度实时变化。
- 修改 B/S 快慢周期，确认买卖点实时重新计算。
- 修改 B/S 买入或卖出颜色，确认 overlay 颜色实时变化。
- 修改后点击“取消”，确认图表恢复打开弹窗前状态。
- 修改后点击“应用”，确认图表保持新效果并保存。

### 副图数量限制

- 依次开启 VOL、MACD、KDJ，确认三者可同时展示。
- 第 3 个副图开启后，确认 RSI 开关置灰并显示最多 3 个提示。
- 关闭任意一个已开启副图指标后，确认 RSI 可重新开启。
- 确认 BOLL、MA、EMA、B/S 开关不受副图 3 个限制影响。

### 参数与样式校验

- 将任意周期改为 0 或负数，确认“应用”不可点击并展示错误。
- 输入重复周期，确认无法应用或被 normalize 为有效参数。
- 将 MACD 快线设置为大于或等于慢线，确认无法应用。
- 将 BOLL 标准差倍数设置为无效值，确认无法应用或回退默认。
- 将显示精度设置为小于 0 或大于 6，确认无法应用或回退默认。
- 尝试写入非法颜色或线型配置，确认启动后回退默认值且不白屏。

### 图表展示

- 开启/关闭 BOLL、MA、EMA，确认主图指标显示和隐藏正常。
- 开启/关闭 VOL、MACD、KDJ、RSI，确认副图 pane 创建和移除正常。
- 修改各指标参数，确认 legend 或图形结果跟随变化。
- 修改各指标颜色、线型和显示精度，确认图表线条、柱体、legend 数值精度跟随变化。
- 修改 B/S 参数，确认买卖点 overlay 重新计算且不重复叠加。
- 切换股票、周期、复权、日期范围后，确认指标配置仍按当前设置渲染。

### 持久化兼容

- 修改指标开关、参数、样式、显示精度后退出应用并重启，确认配置恢复。
- 使用旧版本仅包含 `enabledIndicators` 的设置启动，确认应用正常迁移并补齐默认参数、样式和精度。
- 使用旧版本仅包含 `enabled` 和 `params` 的 `indicatorSettings` 启动，确认自动补齐默认样式和精度。
- 手动构造副图超过 3 个开启的设置，确认启动后自动限制到最多 3 个。
- 设置文件缺字段或含非法参数、非法颜色、非法线型时，确认应用不白屏并回退到有效配置。

### 分时回归

- 切换到分时视图，确认分时指标弹窗仍按现有参数模型工作。
- 修改 K 线指标样式后切换分时，确认分时图不受 K 线样式影响。
- 修改分时指标后切回 K 线，确认 K 线样式不被分时配置覆盖。

## 风险与后续

- klinecharts `9.8.10` 支持 indicator `precision` 和 `styles`；若后续升级图表库导致字段变化，应只调整 `KLineChartsAdapter` 的样式映射层。
- 实时预览必须保留“取消回滚”语义，预览状态不能直接写入持久化配置。
- B/S 预览依赖本地 enrichment 和 overlay 同步，需重点防止 overlay 重复叠加。
- 多线指标加上样式配置后弹窗信息密度会提升，需要用 Popover 和 swatch 控制行高。
- 显示精度会影响 legend、tooltip 和 y 轴展示效果，需确认 klinecharts 内置 indicator 对 `precision` 的实际应用范围。
- 本次不支持线宽、透明度和标记形状；如用户后续需要，应继续扩展指标定义模块，不在 adapter 内临时加字段。

## 验收标准

- K 线指标弹窗可配置 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 的颜色、线型和显示精度。
- K 线指标弹窗可配置 B/S 买入、卖出标记颜色。
- 默认样式和显示精度符合本文档配置。
- K 线弹窗有效草稿实时预览；取消后图表回滚，应用后才保存。
- 参数非法时“应用”不可点击，图表不进入异常状态。
- 指标参数变化后图表使用新参数，不继续沿用旧参数。
- 指标颜色、线型、显示精度变化后图表立即使用新配置。
- B/S 参数或颜色变化后 overlay 正确更新且不重复叠加。
- 应用重启后恢复指标开关、参数、样式和显示精度。
- 旧工作区设置可以兼容迁移。
- 分时指标配置和分时图展示不受本次 K 线样式配置影响。
- `yarn test`、`yarn typecheck`、`yarn build` 通过。
