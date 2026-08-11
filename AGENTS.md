# Stock Monitor Codex 指南

## 项目概览

Stock Monitor 是一个跨平台股票行情桌面应用，技术栈包括 Electron、React、
TypeScript、MobX、Ant Design、klinecharts、Vitest 和 electron-builder。
包管理器使用 Yarn 1。

## 架构规则

- `src/main/` 负责窗口、菜单、IPC handlers、远端行情源 adapter、持久化设置、
  网络代理、日志和应用更新。
- `src/preload/` 只暴露 typed bridge。Renderer 代码应通过 `window.stockApi`
  使用主进程能力。
- `src/renderer/` 不能直接请求远端行情接口。
- React View 只负责展示状态和触发用户命令。
- MobX ViewModel 负责状态、查询流程、编排、刷新行为和持久化触发。
- Model 负责纯业务逻辑，例如行情类型、指标定义和指标计算。
- Adapter 负责外部依赖，例如 Electron bridge、klinecharts 和 Canvas 绘制。

## 高风险文件

- `src/main/remote-stock-sources.ts`：行情源能力、HTTP 请求、解析逻辑、fallback
  行为和代理感知请求。
- `src/main/ipc.ts`：主进程 IPC 注册。
- `src/preload/stock-api.ts`：暴露给 renderer 的公开 typed API。
- `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts`：
  工作区状态、数据源切换、刷新流程、持久化和自动刷新。
- `.github/workflows/release.yml`：发布校验、打包、GitHub Release 和
  GitHub Package 发布。
- `scripts/extract-changelog-release-notes.mjs`：release notes 提取。
- `CHANGELOG.md`：用户可见 changelog，也是 GitHub Release notes 的来源。

## 验证命令

- 普通代码改动：运行 `yarn typecheck` 和 `yarn test`。
- 主进程、preload、Electron 配置、打包或发布相关改动：额外运行 `yarn build`。
- 远端行情源改动：运行 `yarn test tests/remote-stock-sources.test.ts`。
- 工作区 ViewModel 改动：运行
  `yarn test tests/stock-workspace-view-model.test.ts`。
- IPC 改动：运行 `yarn test tests/ipc-handlers.test.ts`。
- release 或 changelog 改动：运行
  `yarn test tests/release-version.test.mjs` 和
  `yarn test tests/changelog-release-notes.test.mjs`。

## 文档规则

- 用户可见功能或行为变更，应新增或更新
  `docs/spec/feature/YYYYMM/DD-topic/plan.md`。
- 功能完成后，应新增或更新同目录的 `pr.md`。
- 用户可见变更应写入 `CHANGELOG.md` 中
  `Unreleased / <current package.json version>` 区块。
- 发布流程以 `CHANGELOG.md` 作为 GitHub Release notes 来源。

## Code Review Rules

- 标记 renderer 中直接请求远端行情数据的改动。
- 标记新增或修改 IPC channel 但没有同步 preload 类型的改动。
- 标记修改 `StockApi` 但没有同步 adapter 和测试的改动。
- 标记行情源能力变化但没有同步 README、spec 或测试覆盖的改动。
- 标记破坏 changelog release notes 校验的 release workflow 改动。
- 标记用户可见文案中的投资建议、买卖建议、收益承诺或类似表述。
- 优先做符合现有模块边界的聚焦改动，避免无必要的大范围重构。
