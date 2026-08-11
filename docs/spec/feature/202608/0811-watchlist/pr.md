# M-25(feat): 新增本地自选股管理

## 背景

股票工作区此前只能恢复最后一次查看的证券代码，用户无法保存多只常看股票，也不能批量录入或清理已有股票池。本次在现有工作区持久化链路上新增本地自选股管理。

## 方案概述

- 顶部工具栏新增统一的 `自选` 入口，打开或收起左侧自选股栏。
- 自选股栏支持单只添加、批量添加、剪切板粘贴、管理模式删除所选确认和点击切换股票。
- 批量添加使用同一个多行输入框，支持代码、代码加名称、空格、逗号和 Tab 分隔格式。
- 自选股列表保存到 `workspace.watchlist`，复用现有 `setWorkspaceSettings` 持久化链路。
- 添加自选股时不请求远端行情；点击切换或刷新当前股票时继续走既有行情请求。

## 实现改动

- 扩展 `src/renderer/features/stock-workspace/models/stock-types.ts`，新增自选股条目和批量添加预览类型。
- 新增 `src/renderer/features/stock-workspace/models/watchlist.ts`，集中处理证券代码规范化、市场前缀推断、批量解析、去重、上限和批量删除。
- 修改 `src/preload/stock-api.ts` 和 `src/main/store.ts`，在 `WorkspaceSettings` 中新增 `watchlist` 并补齐主进程 normalize。
- 修改 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`，增加自选股面板状态、添加预览、单/批量增删、点击切换、名称回填和持久化保存。
- 修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx` 和 `WorkspacePage.tsx`，接入顶部 `自选` 入口和左侧面板布局。
- 新增 `src/renderer/features/stock-workspace/views/WatchlistPanel.tsx`，实现自选股列表、添加输入、剪切板粘贴、预览、管理模式和删除所选确认；删除确认使用 `App.useApp()` 的 `modal.confirm`，确保确认框挂载在当前 Ant Design 应用上下文中。
- 修改 `src/renderer/styles.css`，补齐自选股栏、列表、添加预览和管理模式样式。
- 新增 `tests/watchlist.test.ts`，并扩展 `tests/stock-workspace-view-model.test.ts` 的自选股行为覆盖。
- 更新 `README.md` 和 `CHANGELOG.md`，同步用户可见功能与本地设置字段。

## 测试计划(UT)

- `yarn test tests/watchlist.test.ts`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

- 顶部工具栏新增 `自选` 入口和自选股数量显示。
- 工作区主内容区新增可收起的左侧自选股栏，图表区域会自适应剩余宽度。
- `workspace` 本地设置新增 `watchlist` 字段，旧配置缺失该字段时应自动补齐为空列表。
- 点击自选股会修改当前证券代码并刷新当前分时或 K 线视图，但不改变当前数据源。
- 删除当前正在查看的股票只影响自选股列表，不清空当前图表。
- 管理模式下点击删除所选应出现数量确认框；取消不删除，确认后删除并退出管理模式。

## 风险与后续

- 自选股列表第一期不展示实时价格和涨跌幅，后续如需列表行情，应单独设计批量 quote 能力。
- 添加时不请求远端行情，名称为空的股票需要等用户点击加载成功后回填。
- 第一批只支持文本批量添加，不支持文件导入、分组、云同步或排序拖拽。
