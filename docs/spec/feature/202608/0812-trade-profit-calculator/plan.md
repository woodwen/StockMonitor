# 做T盈亏测算

## 背景

当前应用已经支持 A 股分时、K 线、自选股、指标设置、数据源切换、网络代理和本地配置持久化。用户可以在同一个窗口里查看行情，但如果想估算一次买入卖出组合的费用和盈亏，还需要离开应用使用外部表格或独立工具。

本次需求是把 `/Users/mac/code/NodeProjects/workwork` 项目中的“A 股做 T 盈利计算器”能力内置到 Stock Monitor。`workwork` 的核心功能是前端计算器：

- 输入买入价、卖出价、股数、手续费万分比、印花税万分比和 ETF 标记。
- 计算买入金额、卖出金额、买入手续费、卖出手续费、印花税和单笔盈亏。
- 支持追加多笔记录并汇总总盈亏。
- ETF 交易不扣印花税。
- 盈利用红色、亏损用绿色展示。

`workwork` 的 Electron main/preload 基本是脚手架，不包含可复用的主进程能力。因此本次不照搬 `workwork` 工程结构，而是把计算规则和交互行为按 Stock Monitor 现有 Electron 三端和 MobX MVVM 结构重新内置。

本功能只做交易费用和盈亏测算，不提供投资建议、买卖建议、荐股服务、收益承诺或交易策略判断。

## 方案概述

新增独立的 `trade-profit-calculator` feature，作为行情工作区旁路工具内置在当前主窗口中：

- 顶部工具栏新增 `做T` 按钮。
- 点击后打开右侧 Drawer，不切换当前分时或 K 线视图。
- Drawer 左侧为测算输入表单，右侧或下方为测算记录表和总盈亏。
- 计算规则放在纯 model 中，ViewModel 负责草稿、记录、汇总、持久化和 UI 状态。
- 记录和输入草稿通过 `electron-store` 持久化，应用重启后恢复。
- 每条记录可保存当前证券代码和名称快照，但计算不依赖行情数据。
- 不新增远端请求，不改现有行情数据源，不让 renderer 直接访问主进程存储。

本次包含：

- 做T盈亏测算入口、Drawer、表单、结果表和汇总。
- 多笔记录新增、单条删除、清空全部。
- 草稿输入和历史记录持久化。
- 费用规则、ETF 印花税规则、记录总数上限和异常设置清洗。
- README、应用内说明书、CHANGELOG、feature plan 和完成后的 PR 记录。
- model、ViewModel、store/IPC/preload 相关 UT。

本次不包含：

- 不做独立页面或独立窗口。
- 不做真实交易、下单、券商接口或账户资产接入。
- 不做 T+0/T+1 可交易性校验。
- 不做股票价格自动带入为买入价或卖出价。
- 不做全局搜索、导入导出、云同步或多设备同步。
- 不做复杂券商差异费率模型，第一期只支持通用费率、最低佣金和印花税测算。

## 默认实现决策

| 确认项 | 默认方案 |
| --- | --- |
| 功能名称 | `做T盈亏测算` |
| 入口位置 | 顶部工具栏新增 `做T` 按钮 |
| 展示形态 | 当前窗口右侧 Drawer |
| 是否独立页面 | 不做独立页面 |
| 是否持久化记录 | 持久化草稿和历史记录 |
| 是否关联当前股票 | 新增记录时快照当前证券代码/名称，计算不依赖行情 |
| 手续费默认值 | `2` 万分之 |
| 印花税默认值 | `5` 万分之 |
| 最低佣金默认值 | `5` 元 |
| ETF 规则 | ETF 不扣印花税 |
| 股数输入 | 正整数，最小 `1`，不强制 100 股整手 |
| 金额精度 | 展示保留 2 位小数，内部用 number 计算 |
| 记录操作 | 新增、单条删除、清空全部 |
| 最大记录数 | 最多保存最近 200 条 |
| 色彩规则 | A 股习惯：盈利红色，亏损绿色 |
| 文案边界 | 使用“测算”“盈亏”，避免“盈利预测”“收益保证”等表述 |

## 持久化模型

在 `AppSettings` 中新增独立的 `tradeProfit` 设置块，不复用 `workspace`：

```ts
interface TradeProfitSettings {
  draft: TradeProfitInput
  records: TradeProfitRecord[]
}
```

草稿输入：

```ts
interface TradeProfitInput {
  buyPrice: number
  sellPrice: number
  quantity: number
  commissionRate: number
  stampTaxRate: number
  minimumCommission: number
  isEtf: boolean
}
```

测算结果：

```ts
interface TradeProfitResult {
  buyAmount: number
  sellAmount: number
  buyCommission: number
  sellCommission: number
  stampTax: number
  profit: number
}
```

历史记录：

```ts
interface TradeProfitRecord {
  id: string
  createdAt: number
  input: TradeProfitInput
  result: TradeProfitResult
  symbol?: string
  stockName?: string
}
```

默认设置：

- `records: []`
- `draft.buyPrice: 10`
- `draft.sellPrice: 11`
- `draft.quantity: 1000`
- `draft.commissionRate: 2`
- `draft.stampTaxRate: 5`
- `draft.minimumCommission: 5`
- `draft.isEtf: false`

设置清洗规则：

- 价格、股数、费率、最低佣金必须是有限非负数；非法值回退默认值。
- 股数保存为正整数。
- 记录中的非法输入、非法计算结果、非法时间戳会被丢弃。
- 记录超过 200 条时只保留最近 200 条。
- `symbol` 和 `stockName` 只作为快照展示字段，非法或空字符串会被清理为空。
- 旧版本配置缺少 `tradeProfit` 时自动补齐默认值。

## 计算规则

沿用 `workwork` 的核心公式，并把最低佣金参数显式纳入模型：

```text
买入金额 = 买入价 * 股数
卖出金额 = 卖出价 * 股数
买入手续费 = max(买入金额 * 手续费万分比 / 10000, 最低佣金)
卖出手续费 = max(卖出金额 * 手续费万分比 / 10000, 最低佣金)
印花税 = ETF ? 0 : 卖出金额 * 印花税万分比 / 10000
盈亏 = 卖出金额 - 买入金额 - 买入手续费 - 卖出手续费 - 印花税
```

说明：

- 展示层统一保留 2 位小数。
- model 返回 number，不返回格式化字符串。
- 盈亏为正显示红色，为负显示绿色，零值使用中性色。
- 计算结果是基于用户输入的费用测算，不代表真实成交结果。

## 实现改动

### 做T测算 model

新增 `src/renderer/features/trade-profit-calculator/models/trade-profit.ts`：

- 定义 `TradeProfitInput`、`TradeProfitResult`、`TradeProfitRecord`、`TradeProfitSettings`。
- 暴露纯函数：
  - `createDefaultTradeProfitInput(): TradeProfitInput`
  - `normalizeTradeProfitInput(input): TradeProfitInput`
  - `calculateTradeProfit(input): TradeProfitResult`
  - `createTradeProfitRecord(input, context): TradeProfitRecord`
  - `normalizeTradeProfitSettings(settings): TradeProfitSettings`
  - `sumTradeProfit(records): number`
- 集中处理费用计算、ETF 印花税、默认值、异常值清洗和记录上限。

这个 model 是计算规则和持久化清洗的主要 seam。View、ViewModel、main store 和测试都通过这组纯函数验证行为，避免把费用公式散落到 React 组件或主进程。

### Preload 类型

修改 `src/preload/stock-api.ts`：

- `AppSettings` 新增 `tradeProfit: TradeProfitSettings`。
- `StockApi` 新增：

```ts
setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings>
```

修改 `src/preload/index.ts`：

- 将 `setTradeProfitSettings()` 映射到 `settings:setTradeProfitSettings` IPC。

### 主进程持久化

修改 `src/main/store.ts`：

- 默认设置新增 `tradeProfit`。
- 新增 `setTradeProfitSettings(settings)`。
- `normalizeSettings()` 补齐并规范化 `tradeProfit`。
- 复用 model 的 normalize 逻辑清理异常历史配置。
- 设置保存失败时记录 warning，不阻断渲染进程主流程。

修改 `src/main/ipc.ts`：

- 注册 `settings:setTradeProfitSettings` IPC handler。
- handler 只把 renderer 传入的设置交给 `setTradeProfitSettings()`，不在 IPC 层写业务规则。

### Renderer adapter

新增 `src/renderer/features/trade-profit-calculator/adapters/ElectronTradeProfitSettingsAdapter.ts`：

- 定义 `TradeProfitSettingsAdapter` interface：

```ts
interface TradeProfitSettingsAdapter {
  getSettings(): Promise<AppSettings>
  setTradeProfitSettings(settings: TradeProfitSettings): Promise<AppSettings>
}
```

- Electron adapter 通过 `window.stockApi.getSettings()` 和 `window.stockApi.setTradeProfitSettings()` 访问持久化。
- UT 使用 fake adapter，不直接 stub Electron IPC。

### 做T测算 ViewModel

新增 `src/renderer/features/trade-profit-calculator/view-models/TradeProfitCalculatorViewModel.ts`：

- 状态：
  - `open`
  - `draft`
  - `records`
  - `initialized`
  - `saveError`
- 派生状态：
  - `currentResult`
  - `totalProfit`
  - `canAddRecord`
  - `recordCount`
- 行为：
  - `initialize()`
  - `dispose()`
  - `openCalculator()`
  - `closeCalculator()`
  - `setDraftField(field, value)`
  - `setEtf(isEtf)`
  - `addRecord(context)`
  - `removeRecord(id)`
  - `clearRecords()`
  - `saveSettingsNow()`

保存策略：

- 初始化时从 `settings.tradeProfit` 恢复草稿和记录。
- 草稿输入使用 500ms debounce 保存，避免每次按键都写配置。
- 新增记录、删除记录、清空记录立即保存。
- `dispose()` 时 flush 未触发的草稿保存。
- 保存失败只写入 `saveError` 和 console warning，不影响继续测算。

### Root ViewModel

修改 `src/renderer/app/RootViewModel.ts`：

- 新增 `tradeProfitCalculator = new TradeProfitCalculatorViewModel(new ElectronTradeProfitSettingsAdapter())`。
- `initialize()` 中初始化做T测算 ViewModel。
- `dispose()` 中释放做T测算 ViewModel，确保 flush 持久化草稿。

### 顶部工具栏

修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`：

- 新增 `做T` 按钮，建议使用 `CalculatorOutlined` 图标。
- 点击后调用 `tradeProfitCalculator.openCalculator()`。
- 按钮不触发行情刷新，不改变分时/K 线视图。

修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：

- 将 `root.tradeProfitCalculator` 传给 `TopToolbar`。
- 挂载 `TradeProfitCalculatorDrawer`。
- Drawer 新增记录时传入当前 `stock.normalizedCurrentSymbol` 和 `stock.currentStockName` 作为快照。

### Drawer UI

新增 `src/renderer/features/trade-profit-calculator/views/TradeProfitCalculatorDrawer.tsx`：

- 使用 Ant Design `Drawer`、`Form`、`InputNumber`、`Switch`、`Button`、`Table`、`Statistic` 或 `Typography`。
- 表单字段：
  - 买入价
  - 卖出价
  - 股数
  - 手续费（万分之）
  - 印花税（万分之）
  - 最低佣金
  - ETF
- 实时展示当前草稿测算结果。
- 记录表展示：
  - 时间
  - 证券代码/名称
  - 买入价
  - 卖出价
  - 股数
  - 买入金额
  - 卖出金额
  - 买入手续费
  - 卖出手续费
  - 印花税
  - 盈亏
  - 操作
- 总盈亏展示在记录表上方。
- 清空全部使用二次确认。
- 表格在窄屏下横向滚动，避免文本挤压或重叠。

### 样式

修改 `src/renderer/styles.css`：

- 增加做T Drawer、表单网格、结果摘要、记录表金额颜色和窄屏适配样式。
- 保持当前深色主题和 Ant Design 视觉风格。
- 不迁移 `workwork` 的全局背景图、居中布局和脚手架 CSS。

### 文档

- 新增当前方案文档 `docs/spec/feature/202608/0812-trade-profit-calculator/plan.md`。
- 功能完成后新增同目录 `pr.md`。
- 更新 `README.md`：
  - 功能范围新增 `做T盈亏测算`。
  - 本地设置说明新增 `tradeProfit`。
  - 使用说明补充入口和费用规则。
- 更新 `src/renderer/features/help/views/UserManualModal.tsx`：
  - 目录新增 `做T测算`。
  - 正文说明入口、输入项、ETF 规则、持久化记录和非投资建议边界。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.6`：
  - `Added` 下记录新增做T盈亏测算。
  - 如有说明书/README 更新，可在 `Docs` 下记录。

## 测试计划(UT)

### 做T测算 model

新增 `tests/trade-profit-calculator.test.ts`：

- 校验普通股票按买入价、卖出价、股数、手续费、最低佣金、印花税计算盈亏。
- 校验 ETF 交易印花税为 `0`。
- 校验买入手续费和卖出手续费低于最低佣金时按最低佣金计算。
- 校验买入手续费和卖出手续费高于最低佣金时按费率计算。
- 校验亏损、盈利、零盈亏都能得到稳定的 number 结果。
- 校验 `sumTradeProfit()` 可汇总多笔记录。
- 校验非法价格、股数、费率和最低佣金会被 normalize 到默认值或安全值。
- 校验非法历史记录会被丢弃。
- 校验超过 200 条历史记录时只保留最近 200 条。

### 做T测算 ViewModel

新增 `tests/trade-profit-calculator-view-model.test.ts`：

- 校验启动时从 `settings.tradeProfit` 恢复草稿和历史记录。
- 校验修改草稿字段会更新实时测算结果。
- 校验草稿输入通过 debounce 保存。
- 校验新增记录后立即保存，并带上当前证券代码/名称快照。
- 校验新增记录不改变当前行情 ViewModel 的代码、视图和数据源。
- 校验删除单条记录后立即保存。
- 校验清空全部记录后立即保存。
- 校验 `dispose()` 会 flush 待保存草稿。
- 校验保存失败不阻断继续新增和计算。

### 主进程 store / IPC / preload

新增或扩展测试：

- `tests/ipc-handlers.test.ts`
  - 覆盖 `settings:setTradeProfitSettings` handler 可注册。
  - 保持重复注册 IPC 不抛错。

- 视当前测试结构新增 `tests/store.test.ts` 或补充现有设置相关测试：
  - 历史设置缺少 `tradeProfit` 时补齐默认值。
  - 异常 `tradeProfit` 设置会被 normalize。
  - 保存 `tradeProfit` 不覆盖 `workspace`、`networkProxy`、`checkUpdatesOnStartup`。

- 需要同步更新现有 fake `AppSettings`：
  - `tests/root-view-model.test.ts`
  - `tests/stock-workspace-view-model.test.ts`
  - `tests/app-update-view-model.test.ts`

### 回归用例

- 现有分时和 K 线数据源加载、切换、自动刷新行为保持不变。
- 自选股点击切换和持久化保持不变。
- 指标设置持久化保持不变。
- 网络代理和启动检查更新设置保持不变。
- Renderer 仍不直接访问远端行情接口或 `electron-store`。

需要执行：

```bash
yarn typecheck
yarn test
yarn build
git diff --check
```

由于本次会修改 `main`、`preload`、IPC 和 Electron 设置模型，`yarn build` 是必跑项。

## 影响范围(建议手动测试范围)

### 影响范围

- 顶部工具栏：新增 `做T` 按钮。
- Renderer：新增做T测算 Drawer、ViewModel、model 和 settings adapter。
- Preload：`StockApi` 新增 `setTradeProfitSettings()`。
- 主进程：IPC 和 `electron-store` 设置模型新增 `tradeProfit`。
- 本地配置：应用设置文件会新增 `tradeProfit.draft` 和 `tradeProfit.records`。
- 文档：README、应用内说明书、CHANGELOG、feature plan 和 PR 记录需要同步。

### 建议手动测试范围

#### 打开与关闭

- 启动应用，确认默认仍进入分时视图。
- 点击顶部 `做T` 按钮，确认右侧 Drawer 打开。
- 关闭 Drawer 后确认当前分时/K 线图表状态不变。
- 再次打开 Drawer，确认草稿输入仍在。

#### 测算表单

- 输入买入价、卖出价、股数、手续费、印花税和最低佣金，确认实时结果更新。
- 切换 ETF，确认印花税从普通股票金额变为 `0`。
- 输入小额交易，确认买入和卖出手续费按最低佣金计算。
- 输入较大金额交易，确认手续费按费率计算。
- 输入非法或空值，确认表单不崩溃，新增按钮按规则禁用或回退。

#### 历史记录

- 点击新增记录，确认记录表追加一条记录。
- 确认记录中包含当前证券代码/名称快照。
- 连续新增多条记录，确认总盈亏同步变化。
- 删除单条记录，确认总盈亏同步变化。
- 清空全部记录，确认出现二次确认并清空后总盈亏为 `0`。

#### 持久化

- 修改草稿输入后等待短时间，退出应用并重启，确认草稿恢复。
- 新增多条测算记录后退出应用并重启，确认历史记录恢复。
- 删除部分记录后重启，确认删除结果保持。
- 清空全部记录后重启，确认记录仍为空。

#### 与行情工作区联动

- 当前为分时视图时打开做T Drawer，确认分时自动刷新不受影响。
- 当前为 K 线视图时打开做T Drawer，确认 K 线图表仍可缩放、拖拽和刷新。
- 切换自选股后新增测算记录，确认记录快照为新的证券代码/名称。
- 新增或删除做T记录后，确认当前行情代码、数据源、周期、指标设置不被改变。

#### 设置兼容

- 使用旧版本配置启动，确认没有 `tradeProfit` 字段时应用可正常启动。
- 手动构造异常 `tradeProfit` 配置，确认应用自动回退默认草稿或清理非法记录。
- 确认网络代理、启动检查更新、自选股和工作区设置未被做T保存覆盖。

## 风险与后续

- 不同券商和不同市场的费用规则可能存在差异；第一期只提供通用费率、最低佣金和印花税测算，不保证覆盖所有真实交易场景。
- 记录持久化会增长本地设置文件，因此第一期限制最多 200 条记录。
- 使用 number 进行金额计算足够覆盖当前展示精度，但如果未来支持更复杂的税费明细或导出对账，需要评估 decimal 方案。
- 当前记录只保存证券代码/名称快照，不绑定行情数据版本；后续如果要从当前价格一键带入，需要单独设计“从行情填入”动作，避免误导用户。
- 做T测算可能被误解为交易建议，因此 UI、README 和说明书必须持续避免投资建议、买卖建议和收益承诺文案。

## 验收标准

- 顶部工具栏存在 `做T` 入口。
- 点击 `做T` 后在当前窗口打开右侧 Drawer。
- 用户可以输入费用参数并得到买入金额、卖出金额、费用明细和盈亏结果。
- ETF 交易不扣印花税。
- 用户可以新增、删除和清空测算记录。
- 总盈亏按历史记录实时汇总。
- 草稿和历史记录可在应用重启后恢复。
- 做T测算不会改变当前行情视图、证券代码、数据源、指标或自选股。
- `AppSettings`、preload 类型、IPC handler 和 renderer adapter 保持同步。
- README、应用内说明书、CHANGELOG 和同目录 `pr.md` 在实现完成后同步更新。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
