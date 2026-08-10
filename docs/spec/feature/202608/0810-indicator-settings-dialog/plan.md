# 指标管理弹窗与指标参数配置

## 背景

当前应用已经支持 K 线图展示、远端行情加载、工作区设置持久化，以及 BOLL、VOL MA、B/S 三类指标开关。

现有指标管理能力仍比较基础：

- 顶部工具栏直接展示指标 checkbox，随着常用指标增加会继续挤占工具栏空间。
- 当前仅支持 BOLL、VOL MA、B/S，缺少 MA、EMA、MACD、KDJ、RSI 等常用指标。
- 指标参数在代码中硬编码，例如 BOLL 固定为 `20,2`，VOL 固定为 `5,10,20`。
- 指标开关已能持久化，但指标参数尚未纳入工作区设置。
- 图表 adapter 已创建过的指标不会因参数变化重新创建，后续直接加入参数 UI 会出现界面显示新参数但图表仍使用旧参数的风险。

本次目标是新增统一的“指标”弹窗，用于管理指标开关和参数；同时限制副图指标最多同时开启 3 个，避免图表副图区过多导致可读性下降。

## 方案概述

新增顶部工具栏“指标”按钮，打开指标管理弹窗。弹窗统一管理主图指标、副图指标和信号指标。

本期指标范围：

- 主图指标：BOLL、MA、EMA、B/S。
- 副图指标：VOL、MACD、KDJ、RSI。

默认开启：

- 开启：BOLL、VOL、B/S。
- 关闭：MA、EMA、MACD、KDJ、RSI。

副图限制：

- VOL、MACD、KDJ、RSI 计入副图指标数量。
- 副图指标最多同时开启 3 个。
- BOLL、MA、EMA、B/S 不计入副图上限。
- 副图已开启 3 个时，其他未开启副图指标的开关置灰，并提示“副图指标最多开启 3 个”。

参数交互：

- 弹窗内修改参数先进入草稿。
- 点击“应用”后生效并保存到工作区设置。
- 点击“取消”不影响当前图表和已保存配置。
- 每个指标支持“恢复默认”。
- 参数输入做基本校验，避免 0、负数、重复周期、MACD 快线大于或等于慢线等无效配置。

实现上新增统一的指标定义模块，把指标名称、分组、默认参数、参数 schema、是否计入副图上限、klinecharts 指标名等信息集中维护。UI、ViewModel、持久化 normalize、图表 adapter 均从该模块读取定义，避免后续新增指标时在多处硬编码规则。

## 默认实现决策

- 弹窗形式：使用 Ant Design `Modal`，宽度约 `720px`，标题为“指标设置”。
- 入口位置：顶部工具栏新增“指标”按钮，替换现有指标 checkbox 区域。
- 副图超限处理：不自动关闭已选指标，只置灰未开启的副图指标开关，并提示“副图指标最多开启 3 个”。
- 参数范围：
  - 周期类参数为 `1-250` 的整数。
  - BOLL 标准差倍数为 `0.1-10`，允许 1 位小数。
  - MACD 必须满足快线小于慢线。
  - 同一指标内的周期类参数不允许重复。
- 参数生效方式：点击“应用”后统一生效并保存，不做实时预览。
- 旧配置迁移优先级：如果旧配置或异常配置导致副图超过 3 个，按 `VOL > MACD > KDJ > RSI` 优先保留前 3 个。
- klinecharts 指标兼容：先使用内置指标名；如果实现时发现某个指标不支持，再注册自定义指标，UI 和配置结构不变。

## 指标默认配置

| 指标 | 分组 | 默认开启 | 默认参数 | 计入副图上限 | 说明 |
| --- | --- | --- | --- | --- | --- |
| BOLL | 主图 | 是 | `20, 2` | 否 | 布林线周期、标准差倍数 |
| MA | 主图 | 否 | `5, 10, 20, 60` | 否 | 收盘价移动平均线周期 |
| EMA | 主图 | 否 | `12, 26` | 否 | 收盘价指数移动平均线周期 |
| B/S | 主图信号 | 是 | `5, 20` | 否 | 自定义买卖点信号快慢周期 |
| VOL | 副图 | 是 | `5, 10, 20` | 是 | 成交量及成交量均线 |
| MACD | 副图 | 否 | `12, 26, 9` | 是 | 快线、慢线、信号线 |
| KDJ | 副图 | 否 | `9, 3, 3` | 是 | RSV 周期、K 平滑、D 平滑 |
| RSI | 副图 | 否 | `6, 12, 24` | 是 | 相对强弱指标周期 |

## 实现改动

### 指标类型与定义

- 修改 `src/renderer/features/stock-workspace/models/stock-types.ts`：
  - 扩展 `IndicatorName`，新增 `ma`、`ema`、`macd`、`kdj`、`rsi`。
  - 新增 `IndicatorPane`，区分 `main`、`sub`、`overlay`。
  - 新增 `IndicatorSettings`，表示单个指标的 `enabled` 和 `params`。
  - 新增 `IndicatorSettingsMap`，表示全部指标配置。
- 新增 `src/renderer/features/stock-workspace/models/indicator-definitions.ts`：
  - 统一维护全部指标定义。
  - 提供默认配置 `defaultIndicatorSettings`。
  - 提供副图指标列表和副图开启数量计算 helper。
  - 提供参数 normalize/validate helper，供 ViewModel 和主进程 store 复用或对齐实现。

### 指标计算

- 修改 `src/renderer/features/stock-workspace/models/indicator-engine.ts`：
  - `IndicatorConfig` 改为从 `IndicatorSettingsMap` 派生。
  - B/S 信号使用 `bsSignal` 的参数 `5,20`，不再依赖独立硬编码字段。
  - 保留 BOLL、VOL 相关 enrichment，确保现有图表和 UT 行为稳定。
  - 如后续需要自定义实现 klinecharts 不支持的指标，新增计算逻辑应收敛在该模块或独立指标模块内，不写入页面。

### K 线图 ViewModel

- 修改 `src/renderer/features/stock-workspace/view-models/KLineChartViewModel.ts`：
  - 用 `indicatorSettings` 替代 `enabledIndicators` 作为主状态。
  - 增加指标弹窗状态：是否打开、草稿配置、草稿校验错误。
  - 新增 `openIndicatorDialog()`、`closeIndicatorDialog()`、`applyIndicatorDraft()`。
  - 新增 `setIndicatorDraftEnabled()`、`setIndicatorDraftParams()`、`resetIndicatorDraftParams()`。
  - 新增 `enabledSubIndicatorCount`、`canEnableIndicator()`，统一实现副图最多 3 个的限制。
  - 应用草稿时触发 `revision`，使图表重新同步指标和 overlay。

### 股票工作区 ViewModel

- 修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：
  - 加载设置时恢复完整 `indicatorSettings`。
  - 保存工作区设置时写入完整指标开关和参数。
  - 指标弹窗点击“应用”后立即保存工作区设置。
  - B/S 参数变化后，基于当前 dataset 重新 enrich，刷新买卖点 overlay，不重新请求远端行情。
  - 保留现有查询条件、代理、数据源测试等流程不变。

### 图表 adapter

- 修改 `src/renderer/features/stock-workspace/adapters/KLineChartsAdapter.ts`：
  - `setDataset(dataset, enabledIndicators)` 改为 `setDataset(dataset, indicatorSettings)`。
  - 主图指标按配置创建 BOLL、MA、EMA。
  - 副图指标按配置创建 VOL、MACD、KDJ、RSI。
  - B/S 继续使用自定义 overlay。
  - 每个已创建指标记录参数签名；当参数变化时，移除旧指标并按新参数重新创建。
  - 关闭指标时移除对应 pane 或 overlay，避免重复累积。
  - 实现前通过本地 smoke test 确认 klinecharts 内置指标名称可用；如某个指标在当前版本不可用，在指标模块中注册自定义指标，保持 UI 和配置接口不变。

### 指标管理弹窗

- 新增 `src/renderer/features/stock-workspace/views/IndicatorSettingsModal.tsx`：
  - 使用 Ant Design Modal 展示指标设置。
  - 分组展示主图指标和副图指标。
  - 每行包含开关、指标名称、参数输入、恢复默认操作。
  - 参数使用 `InputNumber` 或紧凑数字输入组，不使用自由文本。
  - 当副图开启数量达到 3 个时，未开启副图指标开关置灰。
  - 参数非法时禁用“应用”，并在对应行展示错误提示。
- 修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`：
  - 移除原指标 checkbox 区域。
  - 新增“指标”按钮，用于打开指标管理弹窗。
- 修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：
  - 挂载 `IndicatorSettingsModal`。
- 修改 `src/renderer/styles.css`：
  - 增加指标弹窗布局样式。
  - 保持工具栏单行可横向滚动，避免新增按钮挤压行情查询控件。

### IPC 与持久化配置

- 修改 `src/preload/stock-api.ts`：
  - `WorkspaceSettings` 从 `enabledIndicators` 升级为完整 `indicatorSettings`。
  - 为历史配置兼容保留旧字段类型识别空间。
- 修改 `src/main/store.ts`：
  - 默认工作区设置写入完整指标配置。
  - `normalizeWorkspaceSettings()` 支持旧 `enabledIndicators` 迁移为新 `indicatorSettings`。
  - 对指标开关、参数长度、参数范围做 normalize。
  - 对副图指标超出 3 个的历史或异常配置做兜底，只保留默认优先级下前 3 个开启状态。
- 修改 `src/renderer/features/app-update/view-models/AppUpdateViewModel.ts`：
  - 补齐默认 `AppSettings.workspace.indicatorSettings`，保持类型完整。

## 测试计划(UT)

### 指标定义与参数 normalize

- 校验默认指标列表包含 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI。
- 校验默认开启状态为 BOLL、VOL、B/S。
- 校验副图指标只包含 VOL、MACD、KDJ、RSI。
- 校验副图开启数量最多为 3。
- 校验非法参数会回退默认值或返回校验错误。
- 校验 MACD 快线大于或等于慢线时不可应用。

### 设置持久化

- 校验旧配置 `enabledIndicators` 可迁移为新 `indicatorSettings`。
- 校验历史配置缺少新指标时自动补齐默认配置。
- 校验异常指标名被忽略。
- 校验副图历史配置超过 3 个开启时会 normalize 到最多 3 个。
- 校验保存后的 workspace 包含每个指标的 `enabled` 和 `params`。

### KLineChartViewModel

- 校验打开弹窗时草稿等于当前指标配置。
- 校验取消弹窗不会修改当前指标配置。
- 校验应用弹窗会更新当前指标配置并增加 `revision`。
- 校验恢复默认只影响对应指标草稿。
- 校验副图已开启 3 个时，不能再开启第 4 个副图指标。
- 校验修改 B/S 参数后触发 dataset 重新 enrich。

### KLineChartsAdapter

- 校验开启指标时创建对应 klinecharts indicator。
- 校验关闭指标时移除对应 indicator 或 overlay。
- 校验相同状态重复同步不会重复创建指标。
- 校验参数变化时会移除旧指标并按新参数重新创建。
- 校验 B/S overlay 在 dataset 未变化且参数未变化时不会重复创建。

### 回归用例

- 远端行情加载、数据源 fallback、代理配置保存、工作区查询条件持久化保持通过。
- `indicator-engine` 既有 BOLL、EMA、移动平均、B/S enrichment 相关 UT 保持通过。

需要执行：

- `yarn test tests/indicator-engine.test.ts`
- `yarn test tests/klinecharts-adapter.test.ts`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn typecheck`
- `yarn build`

## 影响范围(建议手动测试范围)

### 指标弹窗

- 启动应用，确认顶部工具栏出现“指标”按钮。
- 点击“指标”，确认弹窗展示主图指标和副图指标两组。
- 确认默认开启 BOLL、VOL、B/S，其余指标默认关闭。
- 修改参数后点击“取消”，确认图表不变化。
- 修改参数后点击“应用”，确认图表指标参数变化并保存。
- 点击单个指标“恢复默认”，确认只恢复该指标参数。

### 副图数量限制

- 依次开启 VOL、MACD、KDJ，确认三者可同时展示。
- 第 3 个副图开启后，确认 RSI 开关置灰并显示最多 3 个提示。
- 关闭任意一个已开启副图指标后，确认 RSI 可重新开启。
- 确认 BOLL、MA、EMA、B/S 开关不受副图 3 个限制影响。

### 参数校验

- 将任意周期改为 0 或负数，确认“应用”不可点击并展示错误。
- 输入重复周期，确认无法应用或被规范化为有效参数。
- 将 MACD 快线设置为大于或等于慢线，确认无法应用。
- 将 BOLL 标准差倍数设置为无效值，确认无法应用或回退默认。

### 图表展示

- 开启/关闭 BOLL、MA、EMA，确认主图指标显示和隐藏正常。
- 开启/关闭 VOL、MACD、KDJ、RSI，确认副图 pane 创建和移除正常。
- 修改 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 参数，确认 legend 或图形结果跟随变化。
- 修改 B/S 参数，确认买卖点 overlay 重新计算且不重复叠加。
- 切换股票、周期、复权、日期范围后，确认指标配置仍按当前设置渲染。

### 持久化兼容

- 修改指标开关和参数后退出应用并重启，确认配置恢复。
- 使用旧版本仅包含 `enabledIndicators` 的设置启动，确认应用正常并迁移默认参数。
- 手动构造副图超过 3 个开启的设置，确认启动后自动限制到最多 3 个。
- 设置文件缺字段或含非法参数时，确认应用不白屏并回退到有效配置。

## 风险与后续

- klinecharts 当前版本是否内置 MA、EMA、MACD、KDJ、RSI 需要实现时做本地 smoke test；若个别指标不可用，需要注册自定义指标。
- 指标参数 schema 初期只覆盖常用周期和基础范围，后续如果要支持颜色、线型、显示精度，需要扩展指标定义模块。
- 当前副图最多 3 个是全局工作区规则，不按股票、周期或数据源单独保存。
- 当前弹窗采用“应用/取消”的草稿模型；如果后续需要实时预览，可在不改变持久化结构的前提下调整交互。
- 新增指标较多后，工具栏压力降低，但图表 legend 信息会增加，需要关注窄窗口下的图表可读性。

## 验收标准

- 顶部工具栏存在“指标”按钮，原指标 checkbox 不再直接占用工具栏。
- 指标弹窗可管理 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI 的开关和参数。
- 默认开启 BOLL、VOL、B/S，默认参数符合本文档配置。
- VOL、MACD、KDJ、RSI 最多同时开启 3 个。
- 弹窗取消不会修改当前图表，应用后才生效并保存。
- 指标参数变更后图表使用新参数，不继续沿用旧参数。
- 应用重启后恢复指标开关和参数。
- 旧工作区设置可以兼容迁移。
- `yarn test`、`yarn typecheck`、`yarn build` 通过。
