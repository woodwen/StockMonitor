# 股票工作区设置持久化

## 背景

当前应用已经支持远端行情数据源、代理配置、周期/复权/日期范围切换，以及 BOLL、VOL MA、B/S 等图表指标开关。

但股票工作区的查询条件和指标开关仍只保存在渲染进程内存中：

- 用户重启应用后，数据源、证券代码、周期、复权方式、日期范围会回到默认值。
- 图表指标开关会回到默认开启状态。
- 代理配置已经可以持久化，但工作区配置没有纳入统一设置模型，导致设置体验不一致。
- 如果设置读取失败或历史设置缺少新字段，启动流程缺少明确的容错兜底。

本次目标是将股票工作区常用状态纳入应用设置持久化，保证用户下次启动时恢复上次使用的查询条件和指标开关，同时避免频繁输入股票代码或日期时过度写入本地配置。

## 方案概述

在现有 `AppSettings` 基础上新增 `workspace` 设置项，由主进程统一持久化，渲染进程通过 preload 暴露的设置 API 读取和保存。

- 设置模型新增 `WorkspaceSettings`，包含当前 `StockQuery` 和 `enabledIndicators`。
- 主进程 `electron-store` 默认值中补齐 `workspace`，并对历史配置和异常配置做 normalize。
- 新增 `settings:setWorkspaceSettings` IPC，用于保存工作区设置。
- 股票工作区初始化时读取 `settings.workspace`，恢复查询参数和指标开关。
- 股票代码、开始日期、结束日期这类文本输入采用 500ms debounce 保存。
- 数据源、周期、复权、指标开关这类离散操作立即保存。
- `RootViewModel.dispose()` 时释放工作区资源，并 flush 待保存的工作区设置。
- 设置读取或保存失败时记录 warning，不阻断应用启动、刷新和用户操作。

## 实现改动

### 设置模型与持久化

- 修改 `src/preload/stock-api.ts`：
  - `AppSettings` 新增 `workspace` 字段。
  - 新增 `WorkspaceSettings` 类型，包含 `query` 和 `enabledIndicators`。
  - `StockApi` 新增 `setWorkspaceSettings(workspace)` 方法。
- 修改 `src/main/store.ts`：
  - 默认设置中新增 `workspace` 默认值。
  - 新增 `setWorkspaceSettings()` 保存入口。
  - 新增 `normalizeWorkspaceSettings()`、`normalizeStockQuery()` 和指标开关 normalize。
  - 对 `sourceId`、`period`、`adjust`、日期字符串做白名单和格式兜底。
  - `getSettings()` 和设置保存增加异常捕获，失败时写入日志并回退默认设置。

### IPC 与 preload

- 修改 `src/main/ipc.ts`：
  - 注册 `settings:setWorkspaceSettings` IPC handler。
  - 将渲染进程传入的工作区设置交给 `setWorkspaceSettings()` 统一 normalize 和持久化。
- 修改 `src/preload/index.ts`：
  - 暴露 `setWorkspaceSettings()` 到 `window.stockApi`。

### 股票工作区 ViewModel

- 修改 `src/renderer/features/stock-workspace/adapters/ElectronStockDataAdapter.ts`：
  - `StockDataAdapter` 新增 `setWorkspaceSettings()`。
  - Electron adapter 透传到 preload API。
- 修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：
  - 初始化加载设置时恢复代理配置、查询条件和指标开关。
  - 文本输入变更进入 debounce 保存队列。
  - 数据源、周期、复权、指标开关变更立即保存。
  - 新增 `dispose()`，清理保存定时器并保存最后一次工作区状态。
  - 保存失败仅记录 warning，不影响页面状态。
- 修改 `src/renderer/features/stock-workspace/view-models/KLineChartViewModel.ts`：
  - 新增 `setIndicators()`，支持一次性恢复全部指标开关并触发 revision 更新。
- 修改 `src/renderer/app/RootViewModel.ts`：
  - 根 ViewModel 销毁时调用 `stockWorkspace.dispose()`。

### 更新模块默认设置

- 修改 `src/renderer/features/app-update/view-models/AppUpdateViewModel.ts`：
  - 默认 `settings` 补齐 `workspace` 字段，避免 `AppSettings` 类型变更后默认值不完整。
  - 初始化读取设置失败时记录 warning，并继续使用默认设置。

### UT

- 修改 `tests/stock-workspace-view-model.test.ts`：
  - `FakeDataAdapter` 支持完整 `AppSettings` 和 `setWorkspaceSettings()`。
  - 新增启动恢复工作区查询和指标开关的用例。
  - 新增用户修改控件后保存工作区设置的用例。
  - 新增文本输入 debounce 保存的用例。
  - 保留既有远端数据加载、fallback、代理保存和指标切换回归用例。

## 测试计划(UT)

### StockWorkspaceViewModel

- 校验启动时可从 `settings.workspace.query` 恢复数据源、证券代码、日期范围。
- 校验恢复查询参数时仍会按数据源能力 normalize，例如不支持的周期/复权回退到该源可用值。
- 校验启动时可从 `settings.workspace.enabledIndicators` 恢复 BOLL、VOL MA、B/S 开关。
- 校验切换周期、复权、数据源和指标开关时立即调用 adapter 保存。
- 校验连续修改证券代码、开始日期、结束日期时通过 500ms debounce 合并保存。
- 校验 `dispose()` 会清理未触发的保存定时器，并保存最后一次工作区状态。
- 校验设置读取失败时页面仍可继续初始化并使用默认配置。

### 设置持久化

- 校验历史设置缺少 `workspace` 时自动补齐默认查询和指标开关。
- 校验非法 `sourceId`、`period`、`adjust` 会回退默认值。
- 校验非法日期字符串会回退默认日期。
- 校验指标开关缺字段时按默认值补齐。
- 校验保存失败时不会抛出到渲染端主流程。

### 回归用例

- 远端行情加载、数据源 fallback、代理配置保存、指标切换等既有用例保持通过。
- 类型检查覆盖 `AppSettings` 结构变更后的 main、preload、renderer 三端引用。

需要执行：

- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn typecheck`
- `yarn build`

## 影响范围(建议手动测试范围)

### 启动恢复

- 启动应用，修改数据源、证券代码、周期、复权、日期范围后退出并重启。
- 重启后确认顶部工具栏恢复上次查询条件。
- 重启后确认图表按恢复后的查询条件加载。
- 使用不同数据源保存后重启，确认仍能恢复到对应数据源。

### 指标开关

- 关闭 BOLL、VOL MA 或 B/S 后退出并重启。
- 重启后确认指标开关状态保持一致。
- 重新打开指标后刷新行情，确认图表显示与开关状态一致。

### 输入保存

- 连续快速修改股票代码，等待短时间后退出并重启，确认只恢复最终输入值。
- 连续修改开始日期和结束日期，确认重启后日期范围恢复正确。
- 修改文本输入后立即退出应用，确认 `dispose()` 能保存最后一次状态。

### 设置兼容

- 使用旧版本配置文件启动，确认应用不会因为缺少 `workspace` 字段报错。
- 手动构造异常设置值后启动，确认应用回退到默认查询条件而不是白屏或初始化失败。
- 设置文件不可写或写入失败时，确认应用仍可加载行情，控制台或日志中有 warning。

### 与既有设置联动

- 修改代理配置并保存，确认代理设置不受工作区设置保存影响。
- 修改工作区查询条件后，确认代理配置仍保持原值。
- 检查更新设置 `checkUpdatesOnStartup` 保持原行为。

## 风险与后续

- 当前工作区保存为最后一次用户操作状态，不区分“已成功加载的数据”和“正在编辑但尚未刷新的数据”。这符合当前工具栏输入模型，但如果后续要区分草稿和已应用查询，需要拆分状态。
- 文本输入使用 500ms debounce，可减少写入频率；如果未来增加更多高频设置项，需要统一保存队列或批量设置接口。
- 主进程和 `AppUpdateViewModel` 各自维护默认 `AppSettings` 构造逻辑，后续可以抽出共享默认值工厂，降低字段扩展时的重复维护成本。
- 当前 UT 主要覆盖 ViewModel 行为；主进程 store normalize 可在后续补充独立单测，提高异常配置兼容性验证力度。

## 验收标准

- 股票工作区查询条件可以在应用重启后恢复。
- BOLL、VOL MA、B/S 指标开关可以在应用重启后恢复。
- 股票代码和日期输入不会每次按键都立即写入配置。
- 数据源、周期、复权、指标开关变更后能及时保存。
- 设置读取或保存失败不阻断应用启动和行情刷新。
- `yarn test tests/stock-workspace-view-model.test.ts` 通过。
- `yarn typecheck` 通过。
- `yarn build` 通过。
