# 帮助菜单版本更新说明

## 背景

当前应用通过 `CHANGELOG.md` 维护用户可见更新内容，并在发布流程中从该文件提取 GitHub Release notes。应用内“帮助”菜单已有 `使用说明书`、`检查更新` 和 `关于 Stock Monitor`，但用户无法在应用内直接查看当前安装包包含的版本更新说明。

本次目标是在“帮助”菜单中新增 `版本更新说明` 入口，让用户在离线状态下查看随当前安装包打包的版本记录。

## 方案概述

- 在 `帮助` 菜单中新增 `版本更新说明`，位置放在 `使用说明书` 和 `检查更新` 之间。
- 点击后复用现有 `menu:command` 通道通知 renderer。
- renderer 在当前主窗口内打开 Ant Design Modal。
- 内容来源直接使用根目录 `CHANGELOG.md`，通过 Vite raw import 随 renderer bundle 打包。
- 展示当前安装包内置的版本说明，不联网查询远端 GitHub Release。
- 不新增 IPC channel，不新增主进程文件读取，不维护第二份 release notes 文案。

默认决策：

| 确认项 | 默认方案 |
| --- | --- |
| 菜单名称 | `版本更新说明` |
| 菜单位置 | 放在 `使用说明书` 和 `检查更新` 之间 |
| 内容来源 | 直接打包 `CHANGELOG.md`，不联网、不读远端 Release |
| 展示范围 | 展示 `CHANGELOG.md` 内全部版本记录 |
| 当前版本显示 | `Unreleased / 0.1.7` 显示为 `当前版本 0.1.7` |
| 历史版本显示 | `v0.1.3 - 2026-08-11` 显示为 `v0.1.3 / 2026-08-11` |
| 分类展示 | 保留 `Added / Changed / Fixed / Build / Docs` 等分类 |
| 是否加搜索 | 首版不加搜索，左侧版本目录足够 |
| 是否加检查更新按钮 | 首版不在弹窗里加按钮，继续用菜单和工具栏现有入口 |
| 是否打开 GitHub Release | 不打开外链，说明保持离线可用 |
| 是否新增 IPC | 不新增 IPC，复用现有 `menu:command` |
| 是否维护第二份文案 | 不维护，避免 changelog 和帮助内容漂移 |

## 范围边界

本次包含：

- 新增 `帮助 -> 版本更新说明` 菜单入口。
- 新增 `open-version-updates` 菜单命令类型。
- 新增 Root ViewModel 的版本说明弹窗开关状态。
- 新增版本更新说明 Modal。
- 新增 changelog 解析纯函数。
- 展示 `CHANGELOG.md` 中全部版本记录。
- 同步 README、CHANGELOG、方案文档和 PR 记录。
- 补齐菜单、Root ViewModel 和 changelog parser 测试。

本次不包含：

- 不联网读取 GitHub Releases。
- 不打开外部浏览器。
- 不新增“检查更新”按钮，继续使用现有菜单和工具栏入口。
- 不新增搜索功能。
- 不新增 IPC channel。
- 不新增独立帮助窗口。
- 不改变现有自动更新检查、下载或安装逻辑。

## 实现改动

### 菜单入口

修改 `src/main/menu.ts`：

- 在 `帮助` 菜单中新增 `版本更新说明`。
- 点击后发送 `open-version-updates` 菜单命令。
- 菜单顺序为 `使用说明书`、`版本更新说明`、`检查更新`、分隔线、`关于 Stock Monitor`。

### Preload 类型

修改 `src/preload/stock-api.ts`：

- 将 `MenuCommand` 扩展为 `open-version-updates`。
- `src/preload/index.ts` 继续复用现有 `onMenuCommand()`，不新增 IPC channel。

### Root ViewModel

修改 `src/renderer/app/RootViewModel.ts`：

- 新增 `isVersionUpdatesOpen` 状态。
- 新增 `openVersionUpdates()` 和 `closeVersionUpdates()`。
- `handleMenuCommand('open-version-updates')` 时打开版本更新说明。

### Changelog 解析

新增 `src/renderer/features/help/models/changelog.ts`：

- 导出 `parseChangelog()`。
- 输入为 changelog markdown string。
- 输出结构化版本记录、分类和列表项。
- 识别 `## Unreleased / X.Y.Z`、`## vX.Y.Z - YYYY-MM-DD`、`### Added` 等分类和 `- xxx` 列表项。
- 对行内代码由 renderer 层做简单分段渲染，不引入 markdown 解析依赖。
- 解析失败或没有有效版本内容时返回空数组，由 UI 显示空状态提示。

### Renderer 视图

新增 `src/renderer/features/help/views/VersionUpdatesModal.tsx`：

- 通过 `CHANGELOG.md?raw` 打包当前安装包内置 changelog。
- 使用 Ant Design `Modal`、`Typography`、`Empty` 展示。
- 顶部说明内容来自当前安装包内置 `CHANGELOG.md`；如需检查新版本，请使用 `帮助 -> 检查更新` 或顶部工具栏入口。
- 左侧目录展示版本列表，点击后滚动到对应版本。
- 右侧正文展示版本标题、日期、分类和条目。
- 正文区域内部滚动，避免撑开主窗口。

修改 `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：

- 挂载 `VersionUpdatesModal`。

修改 `src/renderer/styles.css`：

- 新增版本说明 Modal 的目录、正文、滚动和小屏样式。
- 使用独立 `version-updates-*` class，避免耦合现有使用说明书样式。

### 文档与记录

修改 `README.md`：

- 在“应用内帮助”章节新增 `帮助 -> 版本更新说明`。

修改 `CHANGELOG.md`：

- 在 `Unreleased / 0.1.7` 的 `Added` 区块新增用户可见记录。

新增本目录 `pr.md`：

- 功能完成后记录背景、方案、实现改动、测试计划和影响范围。

## 测试计划(UT)

更新 `tests/menu.test.ts`：

- 校验 `帮助` 菜单包含 `版本更新说明`。
- 校验菜单顺序为 `使用说明书`、`版本更新说明`、`检查更新`。
- 点击 `版本更新说明` 后发送 `menu:command` / `open-version-updates`。

更新 `tests/root-view-model.test.ts`：

- 校验收到 `open-version-updates` 后打开版本更新说明。
- 校验 `closeVersionUpdates()` 后关闭版本更新说明。

新增 `tests/changelog-parser.test.ts`：

- 解析 `## Unreleased / 0.1.7` 为当前版本。
- 解析 `## v0.1.3 - 2026-08-11` 为历史版本和日期。
- 保留 `Added / Changed / Fixed / Build / Docs` 分类。
- 保留各分类下列表项和行内代码文本。
- 空 changelog 或无版本内容时返回空数组。

本地验证命令：

```bash
yarn typecheck
yarn test
yarn build
git diff --check
```

## 影响范围(建议手动测试范围)

建议手动测试以下范围：

1. 启动应用。
2. 点击 `帮助 -> 版本更新说明`。
3. 确认当前窗口内打开 Modal，不新开窗口，不打开外部浏览器。
4. 确认左侧目录展示当前版本和历史版本。
5. 点击左侧版本目录，确认右侧滚动到对应版本。
6. 确认 `当前版本 0.1.7` 来自 `Unreleased / 0.1.7`。
7. 确认历史版本显示版本号和日期。
8. 确认分类和条目与 `CHANGELOG.md` 一致。
9. 确认关闭 Modal 后主界面可继续操作。
10. 确认 `帮助 -> 使用说明书`、`帮助 -> 检查更新`、`帮助 -> 关于 Stock Monitor` 原行为不变。
11. 确认顶部工具栏“检查更新”原行为不变。

影响模块：

- `src/main/menu.ts`：帮助菜单新增入口和命令发送。
- `src/preload/stock-api.ts`：菜单命令类型扩展。
- `src/renderer/app/RootViewModel.ts`：新增弹窗状态和菜单命令处理。
- `src/renderer/features/help/`：新增 changelog 解析和版本说明 Modal。
- `src/renderer/features/stock-workspace/views/WorkspacePage.tsx`：新增 Modal 挂载。
- `src/renderer/styles.css`：新增版本说明弹窗样式。
- `README.md`、`CHANGELOG.md`、`docs/spec/feature/202608/0812-help-version-updates/pr.md`：同步用户可见文档和实现记录。

## 风险与约束

- 本功能展示的是当前安装包内置说明，不代表远端最新版本说明。
- 如果 changelog 格式未来变更，需要同步更新 parser 和测试。
- 不引入 markdown 解析依赖，首版只支持当前 changelog 使用到的标题、分类、列表和行内代码。
- 需要避免在更新说明中出现投资建议、买卖建议、收益承诺或类似用户可见表述。

## 验收标准

- `帮助` 菜单中 `版本更新说明` 位于 `使用说明书` 和 `检查更新` 之间。
- 点击 `版本更新说明` 后在当前主窗口打开 Modal，不新开窗口，不打开外部浏览器。
- Modal 展示当前安装包内置 `CHANGELOG.md` 的全部版本记录。
- `Unreleased / 当前版本` 展示为 `当前版本 X.Y.Z`。
- 历史版本展示版本号和日期。
- 分类和列表项与 changelog 内容一致。
- 关闭 Modal 后主界面状态正常。
- 现有 `使用说明书`、`检查更新`、`关于 Stock Monitor` 行为不变。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
