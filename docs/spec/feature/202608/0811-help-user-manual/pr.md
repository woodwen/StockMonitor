# M-26(feat): 新增帮助菜单使用说明书

## 背景

应用内“帮助”菜单此前只有“检查更新”和“关于 Stock Monitor”。用户查看操作说明需要离开桌面应用阅读 README，而 README 同时包含开发、架构和打包信息，不适合作为离线用户手册直接展示。

## 方案概述

- 在 `帮助` 菜单第一项新增 `使用说明书`。
- 点击后复用既有 `menu:command` typed bridge，通知 renderer 打开当前主窗口内的说明书 Modal。
- 说明书内容内置在 renderer 组件中，离线可用，不依赖 README、GitHub 或外部链接。
- 首版只提供中文结构化文字和目录，不加入截图、搜索或快捷键。
- 说明书包含免责声明，避免投资建议、交易建议、荐股服务和收益承诺表述。

## 实现改动

- 修改 `src/main/menu.ts`，新增 `帮助 -> 使用说明书` 菜单项，并发送 `open-user-manual` 命令。
- 修改 `src/preload/stock-api.ts`，扩展 `MenuCommand` 类型，保持 main/preload/renderer 同步。
- 修改 `src/renderer/app/RootViewModel.ts`，新增说明书弹窗开关状态和菜单命令处理。
- 新增 `src/renderer/features/help/views/UserManualModal.tsx`，实现离线说明书 Modal、目录和用户操作章节。
- 修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`，挂载说明书 Modal。
- 修改 `src/renderer/styles.css`，补充说明书 Modal 的滚动、目录、正文和小屏样式。
- 扩展 `tests/menu.test.ts`，覆盖帮助菜单入口和命令发送。
- 新增 `tests/root-view-model.test.ts`，覆盖菜单命令打开和关闭说明书。
- 更新 `README.md` 和 `CHANGELOG.md`，同步用户可见入口和文档记录。
- 新增 `docs/spec/feature/202608/0811-help-user-manual/plan.md`，记录方案、测试计划和验收标准。

## 测试计划(UT)

- `yarn test tests/menu.test.ts`
- `yarn test tests/root-view-model.test.ts`
- `yarn test`
- `yarn typecheck`
- `yarn build`
- `git diff --check`

已执行并通过：

- `yarn test tests/menu.test.ts tests/root-view-model.test.ts`
- `yarn test tests/root-view-model.test.ts`
- `yarn test`
- `yarn typecheck`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

- 帮助菜单第一项新增 `使用说明书`。
- 点击 `帮助 -> 使用说明书` 后应在当前窗口内弹出说明书，不新开窗口，不打开外部浏览器。
- 说明书正文应可滚动，目录按钮可定位到对应章节。
- 说明书应覆盖快速开始、证券代码、分时、K 线、指标、自选股、数据源、网络代理、应用更新和常见问题。
- `帮助 -> 检查更新` 和 `帮助 -> 关于 Stock Monitor` 应保持原有行为。
- 较窄窗口下说明书文字不应溢出或遮挡关闭按钮。

## 风险与后续

- 首版说明书不包含截图。如果后续要加入截图，需要单独评估打包资源、图片体积和小窗口阅读体验。
- 首版不提供搜索。当前章节数量较少，目录定位已经能覆盖主要查找场景。
- 说明书内容内置在组件中，后续新增用户可见功能时需要同步更新该组件和 README。
