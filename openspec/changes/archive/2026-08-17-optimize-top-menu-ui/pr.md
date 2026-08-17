# M-42(feat): 优化顶部菜单聚合

OpenSpec Change: optimize-top-menu-ui

## 背景:

- 工作区顶部工具栏随着数据源、代理、缓存导入导出、更新检查、指标、策略和做T入口增加，所有按钮都铺在同一行，默认桌面窗口下需要横向扫描，低频配置入口和行情查询主路径缺少层级。
- 本次变更按 OpenSpec `optimize-top-menu-ui` 完成方案实施和归档，目标是在不改变业务流程的前提下优化顶部入口组织。

## 方案概述:

- 保留高频行情查询链路直接可见：证券输入、自选、分时/K 线切换、K 线参数、刷新和当前证券标题。
- 将低频配置与维护操作聚合到顶部 `更多` 菜单：数据源、代理、缓存导入导出、检查更新和启动检查更新。
- 保持 `指标` 与 `做T` 顶部直接可见，`策略` 仅在 K 线模式下直接展示。

## 实现改动:

- 重构 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`，新增 `createTopToolbarMoreMenuItems`，让菜单项构造可测试，并保留既有 ViewModel action、loading、disabled 和 checked 语义。
- 调整 `src/renderer/styles.css` 中顶部栏分组、标题省略和窄窗口响应式样式，降低横向滚动和文本挤压风险。
- 新增 `tests/top-toolbar.test.ts`，覆盖主入口可见性、K 线模式策略入口、`更多` 菜单项和运行状态；同步更新本地缓存导入导出 toolbar 测试。
- 更新 `README.md`、应用内 `使用说明书` 和 `CHANGELOG.md`，同步新的顶部入口位置。
- 归档 OpenSpec change，并将顶部工具栏聚合与稳定布局要求同步到 `openspec/specs/stock-workspace/spec.md`。

## 测试计划(UT):

- `openspec validate optimize-top-menu-ui --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- 分时模式顶部栏：证券输入、自选、视图切换、刷新、指标、做T、当前标题和 `更多` 菜单。
- K 线模式顶部栏：周期、复权、日期范围和 `策略` 入口是否按预期展示。
- `更多` 菜单：数据源、代理、缓存导入导出、检查更新和启动检查更新是否可触发且状态反馈正常。
- 默认桌面宽度和较窄窗口下，顶部控件是否存在重叠、挤压或不可访问问题。
