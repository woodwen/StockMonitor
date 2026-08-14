# M-30(feat): 新增帮助菜单版本更新说明

## 背景

应用内“帮助”菜单已有 `使用说明书`、`检查更新` 和 `关于 Stock Monitor`，但用户无法在应用内查看当前安装包包含的版本更新记录。项目已经以 `CHANGELOG.md` 作为用户可见 changelog 和 GitHub Release notes 的单一来源，本次在帮助菜单中复用该文件，提供离线可用的版本更新说明。

## 方案概述

- 在 `帮助` 菜单中新增 `版本更新说明`，位置位于 `使用说明书` 和 `检查更新` 之间。
- 点击后复用既有 `menu:command` typed bridge，通知 renderer 打开当前主窗口内的 Modal。
- renderer 通过 Vite raw import 将根目录 `CHANGELOG.md` 打进 bundle，展示当前安装包内置版本记录。
- 新增轻量 changelog parser，仅支持当前 changelog 使用到的版本标题、分类标题、列表项和行内代码。
- 不联网读取 GitHub Releases，不打开外部浏览器，不新增 IPC channel，不维护第二份 release notes 文案。

## 实现改动

- 修改 `src/main/menu.ts`，新增 `帮助 -> 版本更新说明` 菜单项，并发送 `open-version-updates` 命令。
- 修改 `src/preload/stock-api.ts`，扩展 `MenuCommand` 类型。
- 修改 `src/renderer/app/RootViewModel.ts`，新增版本更新说明弹窗开关状态和菜单命令处理。
- 新增 `src/renderer/features/help/models/changelog.ts`，解析内置 `CHANGELOG.md` 为结构化版本记录。
- 新增 `src/renderer/features/help/views/VersionUpdatesModal.tsx`，展示离线版本更新说明、版本目录、分类和条目。
- 修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`，挂载版本更新说明 Modal。
- 修改 `src/renderer/styles.css`，补充版本更新说明 Modal 的目录、正文、滚动和小屏样式。
- 扩展 `tests/menu.test.ts`，覆盖帮助菜单入口顺序和命令发送。
- 扩展 `tests/root-view-model.test.ts`，覆盖菜单命令打开和关闭版本更新说明。
- 新增 `tests/changelog-parser.test.ts`，覆盖 changelog 解析规则和空内容兜底。
- 更新 `README.md` 和 `CHANGELOG.md`，同步用户可见入口和更新记录。
- 新增 `docs/spec/feature/202608/0812-help-version-updates/plan.md`，记录方案、测试计划和影响范围。

## 测试计划(UT)

新增：

- `tests/changelog-parser.test.ts`
  - 覆盖 `Unreleased / 0.1.7` 解析为当前版本。
  - 覆盖 `v0.1.3 - 2026-08-11` 解析为历史版本和日期。
  - 覆盖 `Added / Changed / Fixed / Build / Docs` 分类和列表项保留。
  - 覆盖空 changelog 或无版本内容时返回空数组。

扩展：

- `tests/menu.test.ts`
  - 覆盖 `帮助 -> 版本更新说明` 菜单项。
  - 覆盖 `使用说明书`、`版本更新说明`、`检查更新` 顺序。
  - 覆盖点击后发送 `open-version-updates`。
- `tests/root-view-model.test.ts`
  - 覆盖收到 `open-version-updates` 后打开 Modal。
  - 覆盖 `closeVersionUpdates()` 后关闭 Modal。

已执行并通过：

- `yarn test tests/changelog-parser.test.ts tests/menu.test.ts tests/root-view-model.test.ts`
- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

## 影响范围(建议手动测试范围)

### 影响范围

- 帮助菜单新增 `版本更新说明`。
- preload `MenuCommand` 类型新增 `open-version-updates`。
- Root ViewModel 新增版本更新说明弹窗状态。
- renderer 新增内置 changelog 解析和展示 Modal。
- README 和 CHANGELOG 新增用户可见说明。

### 建议手动测试范围

- 点击 `帮助 -> 版本更新说明`，确认在当前窗口打开 Modal，不新开窗口，不打开外部浏览器。
- 确认左侧目录展示当前版本和历史版本。
- 点击左侧版本目录，确认右侧滚动到对应版本。
- 确认 `Unreleased / 0.1.7` 显示为 `当前版本 0.1.7`。
- 确认历史版本显示版本号和日期。
- 确认分类和条目与 `CHANGELOG.md` 一致。
- 确认关闭 Modal 后主界面可继续操作。
- 确认 `帮助 -> 使用说明书`、`帮助 -> 检查更新`、`帮助 -> 关于 Stock Monitor` 原行为不变。
- 确认顶部工具栏“检查更新”原行为不变。

## 风险与后续

- 本功能展示当前安装包内置 `CHANGELOG.md`，不代表远端最新版本说明。
- 如果 changelog 格式未来变化，需要同步更新 parser 和测试。
- 首版不引入完整 markdown parser；如果后续 changelog 使用表格、嵌套列表或链接，需要单独扩展渲染能力。
