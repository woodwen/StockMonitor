# M-29(feat): 内置做T盈亏测算

## 背景

当前 Stock Monitor 已经覆盖远端分时、K 线、自选股、指标、代理和更新能力，但用户做买入卖出费用测算时仍需要离开应用。`/Users/mac/code/NodeProjects/workwork` 项目中已有一个简单的 A 股做 T 盈利计算器，本次将其核心计算能力按 Stock Monitor 的 Electron 三端和 MobX MVVM 边界内置到当前应用。

## 方案概述

本次新增独立的 `trade-profit-calculator` feature：

- 顶部工具栏新增 `做T` 按钮。
- 点击后在当前窗口右侧打开 Drawer。
- Drawer 内提供买入价、卖出价、股数、手续费、印花税、最低佣金和 ETF 输入。
- 实时展示买入金额、卖出金额、费用合计和本次盈亏。
- 支持新增多笔测算记录、单条删除、清空全部和总盈亏汇总。
- 草稿输入和最近 200 条历史记录通过 `electron-store` 持久化。

本功能只做费用和盈亏测算，不接入真实交易、券商账户、下单接口或交易建议。

## 实现改动

### 做T测算 feature

新增 `src/renderer/features/trade-profit-calculator/`：

- `models/trade-profit.ts`
  - 定义 `TradeProfitInput`、`TradeProfitResult`、`TradeProfitRecord`、`TradeProfitSettings`。
  - 实现默认输入、输入 normalize、费用计算、记录创建、设置 normalize 和总盈亏汇总。
  - 将记录上限固定为最近 200 条。
- `view-models/TradeProfitCalculatorViewModel.ts`
  - 管理 Drawer 开关、草稿、历史记录、总盈亏和保存错误状态。
  - 草稿输入 500ms debounce 保存。
  - 新增、删除、清空记录立即保存。
  - `dispose()` 时 flush 待保存草稿。
- `adapters/ElectronTradeProfitSettingsAdapter.ts`
  - 通过 `window.stockApi` 读取和保存做T测算设置。
- `views/TradeProfitCalculatorDrawer.tsx`
  - 使用 Ant Design Drawer、Form、InputNumber、Switch、Table 和确认弹窗展示测算 UI。
  - 盈利红色、亏损绿色，沿用 A 股展示习惯。
  - 清空全部记录后显式关闭确认框，避免清空成功但弹窗停留。

### 主进程和 preload

- `src/preload/stock-api.ts`
  - `AppSettings` 新增 `tradeProfit`。
  - `StockApi` 新增 `setTradeProfitSettings()`。
- `src/preload/index.ts`
  - 新增 `settings:setTradeProfitSettings` invoke。
- `src/main/store.ts`
  - 默认设置新增 `tradeProfit`。
  - 新增 `setTradeProfitSettings()`。
  - `normalizeSettings()` 中补齐并清洗做T测算设置。
- `src/main/ipc.ts`
  - 注册 `settings:setTradeProfitSettings` handler。

### Renderer 集成

- `src/renderer/app/RootViewModel.ts`
  - 新增 `tradeProfitCalculator` 根状态。
  - 初始化和销毁时同步处理做T测算 ViewModel。
- `src/renderer/features/stock-workspace/views/TopToolbar.tsx`
  - 新增 `做T` 按钮。
- `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`
  - 传入做T ViewModel，并挂载 `TradeProfitCalculatorDrawer`。
- `src/renderer/styles.css`
  - 新增 Drawer 布局、结果摘要、表格和盈亏颜色样式。

### 文档

- 新增 `docs/spec/feature/202608/0812-trade-profit-calculator/plan.md`。
- 新增当前 `pr.md`。
- 更新 `README.md`，补充做T入口、费用规则、持久化设置和测试覆盖。
- 更新应用内 `使用说明书`，新增“做T测算”章节。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.6`。

## 测试计划(UT)

新增：

- `tests/trade-profit-calculator.test.ts`
  - 覆盖普通股票费用计算、ETF 免印花税、最低佣金、费率佣金、总盈亏、输入 normalize 和记录上限。
- `tests/trade-profit-calculator-view-model.test.ts`
  - 覆盖启动恢复、实时结果、debounce 保存、新增记录、删除记录、清空记录、dispose flush 和保存失败兜底。
- `tests/store.test.ts`
  - 覆盖默认 `tradeProfit` 设置和保存做T设置时不覆盖代理、工作区等既有设置。

扩展：

- `tests/ipc-handlers.test.ts`
  - 覆盖 `settings:setTradeProfitSettings` handler 注册。
- 现有 `StockApi` / `AppSettings` fake 同步补齐 `tradeProfit` 和 `setTradeProfitSettings()`。

需要执行：

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

### 影响范围

- 顶部工具栏新增 `做T` 入口。
- 本地设置文件新增 `tradeProfit.draft` 和 `tradeProfit.records`。
- preload typed bridge 新增 `setTradeProfitSettings()`。
- 主进程 IPC 和 store 增加做T设置保存路径。
- README、CHANGELOG 和应用内说明书新增用户可见说明。

### 建议手动测试范围

- 打开应用后点击顶部 `做T`，确认右侧 Drawer 打开且当前行情视图不变。
- 修改买入价、卖出价、股数、手续费、印花税、最低佣金，确认实时费用和盈亏更新。
- 切换 ETF，确认印花税为 0。
- 新增多条记录，确认总盈亏汇总正确。
- 删除单条记录和清空全部记录，确认表格和总盈亏同步更新。
- 修改草稿和新增记录后重启应用，确认草稿和历史记录恢复。
- 切换自选股后新增记录，确认记录快照使用当前证券代码/名称。
- 确认新增和删除做T记录不改变分时/K 线视图、数据源、指标、自选股或代理设置。

## 风险与后续

- 不同券商费用规则可能不同，第一期只做通用手续费、最低佣金和印花税测算。
- 历史记录限制为最近 200 条，避免本地设置文件无限增长。
- 当前金额计算使用 number，满足两位小数展示；后续如做对账导出，可再评估 decimal。
- 后续可单独设计“从当前行情价格填入”动作，但本次不自动带入行情价格，避免误导用户。

## 验收标准

- `做T` 入口可打开测算 Drawer。
- 费用明细和盈亏测算符合 plan 中公式。
- ETF 免印花税。
- 历史记录可新增、删除、清空和汇总。
- 草稿和最近 200 条记录可持久化恢复。
- main、preload、renderer 类型和测试保持同步。
- 文档和 changelog 已同步。
