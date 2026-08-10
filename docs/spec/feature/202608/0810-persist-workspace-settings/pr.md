# M-5(feat): 持久化股票工作区设置

## 背景

- 股票工作区已支持远端行情数据源、代理配置、周期/复权/日期范围切换，以及 BOLL、VOL MA、B/S 指标开关。
- 代理配置已经纳入应用设置持久化，但查询条件和指标开关仍只存在于渲染进程内存中，重启后会回到默认值。
- `AppSettings` 扩展后，需要兼容旧设置结构，并保证设置读取或保存失败时不阻断启动和刷新流程。

## 方案概述

- 在 `AppSettings` 中新增 `workspace` 设置项，保存当前 `StockQuery` 和图表指标开关。
- 主进程通过 `electron-store` 管理默认值、normalize 和持久化，渲染进程通过 preload/IPC 读写工作区设置。
- 股票工作区初始化时恢复持久化查询和指标状态，用户修改离散控件时立即保存，修改文本输入时使用 500ms debounce 合并保存。
- 根 ViewModel 销毁时释放工作区资源并保存待写入状态，避免应用退出时丢失最后一次输入。

## 实现改动

- `src/preload/stock-api.ts` 新增 `WorkspaceSettings` 类型，并在 `AppSettings`、`StockApi` 中补齐 `workspace` 与 `setWorkspaceSettings()`。
- `src/main/ipc.ts` 注册 `settings:setWorkspaceSettings` IPC handler。
- `src/main/store.ts` 新增工作区默认设置、工作区设置保存入口、查询字段白名单校验、日期格式兜底、指标开关补齐，以及设置读写异常日志。
- `src/preload/index.ts` 将工作区设置保存 API 暴露到 `window.stockApi`。
- `ElectronStockDataAdapter` 新增 `setWorkspaceSettings()` 透传能力。
- `StockWorkspaceViewModel` 启动时恢复工作区设置，变更时保存设置，并在 `dispose()` 中 flush debounce 保存。
- `KLineChartViewModel` 新增 `setIndicators()`，支持一次性恢复全部指标开关。
- `RootViewModel` 销毁时调用 `stockWorkspace.dispose()`。
- `AppUpdateViewModel` 默认设置补齐 `workspace` 字段，并在设置读取失败时继续使用默认值。
- `tests/stock-workspace-view-model.test.ts` 扩展 fake adapter，新增恢复工作区设置、控件变更保存、文本输入 debounce 保存等用例。
- 新增 `docs/spec/feature/202608/0810-persist-workspace-settings/plan.md` 记录实现计划、测试计划、手动测试范围和验收标准。

## 测试计划(UT)

- `yarn test tests/stock-workspace-view-model.test.ts`
  - 覆盖默认远端数据加载、数据源 fallback、代理保存、指标切换。
  - 覆盖启动恢复查询条件和指标开关。
  - 覆盖用户修改控件后保存工作区设置。
  - 覆盖股票代码等文本输入 debounce 保存。
- `yarn test`
  - 回归全部 Vitest 用例。
- `yarn typecheck`
  - 校验 `AppSettings` 扩展后 main、preload、renderer 三端类型引用。
- `yarn build`
  - 校验 Electron main/preload/renderer 生产构建。
- `git diff --check`
  - 校验 diff 中没有空白错误。

## 影响范围(建议手动测试范围)

- 启动应用后修改数据源、证券代码、周期、复权、日期范围，退出并重启，确认工具栏和图表按上次状态恢复。
- 关闭或打开 BOLL、VOL MA、B/S 后重启，确认指标开关状态保持一致。
- 快速连续修改股票代码或日期，等待 debounce 保存后重启，确认恢复最终输入值。
- 修改文本输入后立即退出应用，确认最后一次输入被保存。
- 使用旧版本配置文件或缺失 `workspace` 字段的配置启动，确认应用自动补齐默认值。
- 修改代理配置后再修改工作区配置，确认 `networkProxy`、`checkUpdatesOnStartup` 等既有设置不被覆盖。
- 模拟设置读取或保存失败，确认应用仍能启动和刷新行情，并输出 warning。

## 风险与后续

- 当前持久化的是最后一次用户编辑状态，不区分“已刷新成功的查询”和“正在编辑的草稿”。如果后续需要严格恢复最后一次成功加载状态，需要拆分查询草稿和已应用查询。
- 主进程和 `AppUpdateViewModel` 目前各自维护默认 `AppSettings` 构造逻辑，后续可以抽出共享默认值工厂，减少字段扩展时的重复维护。
- 当前 UT 重点覆盖渲染端 ViewModel 行为，后续可为 `src/main/store.ts` 的 normalize 逻辑补充独立单测。

## 验收标准

- 股票工作区查询条件和指标开关可以在应用重启后恢复。
- 股票代码、开始日期、结束日期输入通过 debounce 保存，不会每次按键都写入配置。
- 数据源、周期、复权、指标开关变更后能及时保存。
- 设置读取或保存失败不阻断应用启动、刷新和更新模块初始化。
- 全量 UT、类型检查、构建和 diff 空白检查通过。
