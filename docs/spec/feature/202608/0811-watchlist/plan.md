# 自选股管理

## 背景

当前应用已经支持远端 K 线和分时行情、数据源切换、指标设置、网络代理和工作区设置持久化。用户可以通过顶部工具栏输入证券代码并刷新行情，但还不能保存常看的股票：

- 重启应用后只能恢复最后一次查看的代码，不能快速切换多只常看股票。
- 用户需要反复手动输入证券代码，使用成本较高。
- 没有批量维护入口，已有股票池无法一次性录入或清理。

本次目标是新增本地自选股管理能力，覆盖单只添加、批量添加、管理模式删除所选、点击切换和持久化恢复。第一期只保存自选股列表和名称，不做全列表实时行情。

## 方案概述

新增一个统一的“自选”入口，打开左侧自选股栏。自选股栏同时承载列表查看、单只添加、批量添加和管理模式删除所选。

一期能力：

- 顶部工具栏新增 `自选` 按钮，用于打开或收起左侧自选股栏。
- 自选股栏展示本地保存的股票列表。
- 点击自选股后切换当前证券代码，并按当前视图刷新分时或 K 线。
- 同一个添加输入框同时支持单只和批量添加。
- 添加输入区支持读取剪切板文本并生成批量添加预览。
- 管理模式支持多选、全选、反选和删除所选。
- 自选股列表保存到本地设置，应用重启后恢复。
- 当前股票加载成功后，可用行情返回的 `meta.name` 回填自选股名称。

一期暂不做：

- 自选股全列表实时价格、涨跌幅、成交量。
- 股票分组、标签、排序拖拽。
- 导入导出、云同步。
- 远端名称搜索和输入联想。
- 针对自选股列表的批量行情请求。

## 默认实现决策

- 自选股入口：顶部工具栏只放一个 `自选` 按钮。
- 面板形态：点击 `自选` 打开左侧自选股栏；再次点击收起。
- 面板默认状态：应用启动默认收起；用户打开后只在本次运行中保持状态，暂不持久化展开状态。
- 自选股最大数量：最多保存 300 只，超过后新增失败并提示。
- 批量添加上限：单次最多解析 200 行，避免误粘超大内容。
- 新增位置：新增股票放到列表顶部；批量添加时按输入顺序整体插入顶部。
- 重复处理：已存在的不重复添加，也不调整原位置。
- 名称处理：有名称时保存名称；没有名称时先显示证券代码；后续该股票加载成功后使用行情 `meta.name` 回填。
- 删除确认：删除统一在管理模式中完成，删除所选前必须确认并提示删除数量。
- 删除当前股票：只从自选股移除，不切换当前图表。
- 点击自选股行为：切换当前 `symbol` 并刷新当前视图。
- 数据源行为：点击自选股不改变 K 线或分时数据源，继续使用用户当前选择的数据源。
- 批量添加格式：一行一个，支持空格、逗号和 Tab 分隔代码与名称。
- 剪切板粘贴：显式 `粘贴` 按钮读取剪切板文本并追加到添加输入框；读取失败时提示用户使用 Cmd/Ctrl+V。
- 裸 6 位代码前缀：沿用现有市场推断规则，`6/5` 开头为 `sh`，`4/8/9` 开头为 `bj`，其他为 `sz`。
- 管理模式：只用于删除所选；关闭面板或删除完成后退出管理模式。
- 持久化位置：新增 `workspace.watchlist`，复用现有 `setWorkspaceSettings` 保存链路。
- 远端请求：添加自选股时不请求远端行情；只有点击切换或刷新当前股票时才走既有行情请求。

## 添加格式

添加输入框按行解析，每一行可以是代码，也可以是代码加名称：

```text
sh600519
600519 贵州茅台
sz000001 平安银行
000001,平安银行
000300	沪深300
```

解析规则：

- 空行忽略。
- 代码大小写不敏感，保存为小写前缀加 6 位数字，例如 `sh600519`。
- `sh`、`sz`、`bj` 前缀合法；其他前缀视为格式错误。
- 裸 6 位代码按默认市场推断规则补前缀。
- 名称取代码后剩余文本，去掉首尾空白和分隔符。
- 名称为空时保存为空，列表展示时回退显示代码。
- 同一次输入中重复的代码，只保留第一次出现的可添加项。
- 已存在于自选股列表的代码标记为已存在，不写入。

确认添加前展示预览结果：

- 可添加：确认后写入自选股。
- 已存在：确认时跳过。
- 格式错误：确认时跳过，并保留错误原因。

## 删除规则

- 自选股栏提供管理模式。
- 管理模式下每行显示 checkbox。
- 支持全选、反选和删除所选。
- 删除所选前弹出确认框，展示将删除的数量。
- 确认后删除所选股票、保存设置、清空选择并退出管理模式。
- 如果删除的是当前正在查看的股票，图表保持当前数据不变。

## 实现改动

### 自选股规则 model

新增 `src/renderer/features/stock-workspace/models/watchlist.ts`：

- 定义自选股解析、规范化、去重、增删的纯函数。
- 暴露小 interface：
  - `normalizeWatchlist(value): WatchlistItem[]`
  - `parseWatchlistText(text, existingItems): WatchlistParseResult`
  - `addWatchlistItems(items, additions): WatchlistItem[]`
  - `removeWatchlistSymbols(items, symbols): WatchlistItem[]`
  - `createWatchlistItemFromMeta(meta): WatchlistItem`
- 集中处理代码规范化、市场前缀推断、数量上限和重复规则。

这个 model 是自选股规则的主要 seam。UI、ViewModel 和主进程 store 都只依赖该 interface，不在各处重复实现字符串解析和去重逻辑。

### 类型定义

修改 `src/renderer/features/stock-workspace/models/stock-types.ts`：

- 新增 `WatchlistItem`：
  - `symbol: string`
  - `name: string`
  - `createdAt: number`
  - `updatedAt?: number`
- 新增批量添加预览相关类型：
  - `WatchlistAddPreview`
  - `WatchlistParseResult`
  - `WatchlistAddPreviewStatus`

### 持久化

修改 `src/preload/stock-api.ts`：

- `WorkspaceSettings` 新增 `watchlist?: WatchlistItem[]`。

修改 `src/main/store.ts`：

- 默认工作区设置新增 `watchlist: []`。
- `normalizeWorkspaceSettings()` 补齐并规范化 `watchlist`。
- 清理非法代码、非法名称、非法时间戳和重复项。
- 超过 300 只时只保留前 300 只。

自选股不新增 IPC channel，继续复用 `settings:setWorkspaceSettings`。

### 股票工作区 ViewModel

修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：

- 新增状态：
  - `watchlist`
  - `watchlistOpen`
  - `watchlistManageMode`
  - `selectedWatchlistSymbols`
  - `watchlistAddText`
  - `watchlistAddPreview`
- 新增派生状态：
  - `isCurrentSymbolWatched`
  - `selectedWatchlistCount`
  - `canAddWatchlistPreview`
  - `canDeleteSelectedWatchlistItems`
- 新增行为：
  - `toggleWatchlistOpen()`
  - `setWatchlistAddText(text)`
  - `previewWatchlistAdditions()`
  - `confirmWatchlistAdditions()`
  - `addCurrentToWatchlist()`
  - `selectWatchlistItem(symbol)`
  - `toggleWatchlistManageMode()`
  - `toggleWatchlistSelection(symbol, selected)`
  - `selectAllWatchlistItems()`
  - `invertWatchlistSelection()`
  - `removeSelectedWatchlistItems()`

加载设置时恢复 `workspace.watchlist`。保存工作区设置时写入当前自选股列表。行情刷新成功后，如果当前股票已在自选股中且名称为空或仍等于代码，则用 `dataset.meta.name` 回填名称并保存。

### UI

修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`：

- 新增 `自选` 按钮。
- 按钮展示当前自选股数量。
- 当前股票已在自选股中时按钮可显示已收藏状态。

修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：

- 在主内容区左侧挂载自选股栏。
- 自选股栏打开时图表区域自适应剩余宽度。

新增 `src/renderer/features/stock-workspace/views/WatchlistPanel.tsx`：

- 展示自选股列表、空状态、添加输入区和管理模式操作区。
- 添加输入区使用多行文本框，同时覆盖单只和批量添加。
- 添加输入区提供 `粘贴` 按钮，调用浏览器剪切板能力读取文本并写入多行输入框。
- 添加预览按状态展示可添加、已存在和格式错误行。
- 列表行展示名称和代码，当前股票高亮。
- 管理模式行内展示 checkbox。
- 删除所选使用 Ant Design `App.useApp()` 提供的 `modal.confirm` 二次确认，确保确认框挂载在当前 `AntdApp` 上下文中。

修改 `src/renderer/styles.css`：

- 增加自选股栏、列表行、添加预览、管理工具栏和空状态样式。
- 自选股栏采用紧凑信息密度，避免影响图表可视面积。

## 测试计划(UT)

### 自选股 model

- 校验 `sh600519`、`600519 贵州茅台`、`sz000001 平安银行`、`000001,平安银行`、Tab 分隔格式可正确解析。
- 校验裸 6 位代码按默认市场规则补前缀。
- 校验非法前缀、非 6 位代码、空代码行返回格式错误。
- 校验空行被忽略。
- 校验同一次输入重复代码只保留第一次。
- 校验已存在代码标记为已存在。
- 校验批量添加超过 200 行时只解析前 200 行并返回提示。
- 校验自选股总数超过 300 只时新增失败或截断到 300 只。
- 校验批量删除按 symbol 删除，未知 symbol 忽略。
- 校验 normalize 会清理非法项、重复项，并保留有效顺序。

### StockWorkspaceViewModel

- 校验启动时从 `settings.workspace.watchlist` 恢复自选股。
- 校验单只添加当前股票后立即保存工作区设置。
- 校验批量添加只保存可添加项，跳过已存在和格式错误项。
- 校验剪切板文本追加到批量添加草稿后会立即生成预览。
- 校验空剪切板文本会给出提示且不改变添加草稿。
- 校验管理模式删除所选后保存结果。
- 校验删除当前股票不会清空当前图表状态。
- 校验点击自选股会切换 `query.symbol` 并刷新当前视图。
- 校验点击自选股不改变当前 K 线源或分时源。
- 校验行情加载成功后可回填当前自选股名称。
- 校验关闭面板或批量删除完成后退出管理模式并清空选择。

### 回归用例

- 工作区查询条件、K 线指标、分时指标、数据源选择和代理设置持久化保持不变。
- K 线和分时数据源仍保持独立。
- 分时自动刷新逻辑不因自选股栏打开而改变。
- Renderer 仍不直接请求远端行情，只通过 `window.stockApi` 使用主进程能力。

需要执行：

- `yarn test tests/stock-workspace-view-model.test.ts`
- 新增 `yarn test tests/watchlist.test.ts`
- `yarn typecheck`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围)

### 自选股面板

- 启动应用，确认自选股栏默认收起。
- 点击顶部 `自选` 按钮，确认左侧自选股栏打开。
- 再次点击 `自选`，确认自选股栏收起。
- 自选股为空时，确认显示空状态和添加入口。

### 添加与管理删除

- 在添加输入框输入一只股票代码，确认预览为可添加。
- 确认添加后，股票出现在列表顶部。
- 普通列表行不展示删除按钮。
- 进入管理模式，选择一只或多只股票后点击删除所选，确认出现删除数量确认。
- 删除当前正在查看的股票，确认图表仍保持当前数据。

### 批量添加

- 粘贴多行股票代码和名称，确认预览区区分可添加、已存在和格式错误。
- 点击 `粘贴` 按钮，确认剪切板文本进入添加输入框并立即生成预览。
- 剪切板为空或读取失败时，确认界面展示可读提示且仍可手动 Cmd/Ctrl+V。
- 确认添加后，只有可添加项写入列表。
- 重复粘贴同一批内容，确认已有项不会重复。
- 粘贴超过 200 行，确认有上限提示且不会卡顿。

### 批量删除

- 进入管理模式，选择多只股票。
- 测试全选和反选。
- 点击删除所选，确认出现删除数量确认。
- 在确认框点击取消，确认列表、选择状态和管理模式不变。
- 确认后列表更新，选择清空并退出管理模式。

### 点击切换

- 点击某只自选股，确认顶部证券代码切换。
- 当前为分时视图时，确认刷新分时行情。
- 当前为 K 线视图时，确认刷新 K 线行情。
- 切换自选股后，确认当前 K 线源或分时源不被改变。

### 持久化

- 添加多只自选股后退出应用并重启。
- 重启后打开自选股栏，确认列表恢复。
- 删除部分自选股后重启，确认删除结果保持。

## 风险与后续

- 添加时不请求远端行情，因此部分自选股名称可能暂时为空，需等用户点击加载成功后回填。
- 自选股列表没有实时行情，用户可能期待列表中直接看到价格和涨跌幅；这应作为二期单独设计批量 quote 能力。
- 批量添加依赖文本格式解析，第一期只支持常见分隔符，不支持 Excel 文件或 CSV 文件导入。
- 自选股列表随 `workspace` 一起保存，未来如果增加多工作区或多账户，需要再拆分更明确的存储模型。

## 验收标准

- 用户可以通过同一个自选股入口完成单只添加、批量添加和管理模式删除所选。
- 自选股列表可以在应用重启后恢复。
- 批量添加能正确区分可添加、已存在和格式错误。
- 点击自选股可以切换当前代码并刷新当前视图。
- 点击自选股不会改变用户当前选择的数据源。
- 删除当前股票不会影响当前图表展示。
- 自选股解析、去重、增删规则有单元测试覆盖。
- `yarn test tests/watchlist.test.ts` 通过。
- `yarn test tests/stock-workspace-view-model.test.ts` 通过。
- `yarn typecheck` 通过。
