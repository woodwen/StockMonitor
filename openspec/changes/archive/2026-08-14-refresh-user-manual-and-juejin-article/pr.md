# M-38(docs): 更新说明书与推广文章截图

OpenSpec Change: refresh-user-manual-and-juejin-article

## 背景:

- `使用说明书`、README 和掘金推广文章此前未完整覆盖自选股历史 K 线缓存、K 线历史回测、做T盈亏测算截图以及 macOS 未签名更新边界。
- 用户提供了自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测截图，需要纳入仓库文档资产并避免引用本机 Downloads 路径。
- 本次需要完成并归档 OpenSpec change，保证主 spec、归档 artifacts、文档和 changelog 同步。

## 方案概述:

- 按 OpenSpec change `refresh-user-manual-and-juejin-article` 的 tasks 执行文档同步。
- 将用户提供截图复制到 `docs/assets/screenshots/`，使用稳定 ASCII 文件名，并在 README 和推广文章中引用仓库内相对路径。
- 更新应用内使用说明书、README、掘金推广文章和 `CHANGELOG.md`，统一功能覆盖、发布边界和产品安全文案。
- 使用 `openspec archive refresh-user-manual-and-juejin-article --yes` 归档 change，并同步 `help-and-updates` 主 spec。

## 实现改动:

- 更新 `src/renderer/features/help/views/UserManualModal.tsx`：
  - 新增 `K 线缓存` 和 `策略回测` 目录及正文章节。
  - 补充历史回测、B/S 信号和做T测算的限制说明。
- 更新 `README.md`：
  - 补齐自选股管理、历史 K 线缓存、K 线历史回测、做T盈亏测算和帮助入口说明。
  - 新增 4 张用户界面截图引用。
  - 更新本地设置、测试覆盖和设计取舍描述。
- 更新 `docs/promotion/juejin-stock-monitor-article.md`：
  - 同步 OpenSpec change 协作流程、当前功能范围、发布边界、测试覆盖和新增截图。
  - 保留并强化不构成投资建议、买卖建议或收益承诺的文案边界。
- 新增截图资产：
  - `docs/assets/screenshots/watchlist-management.png`
  - `docs/assets/screenshots/kline-cache-management.png`
  - `docs/assets/screenshots/trade-profit-calculator.png`
  - `docs/assets/screenshots/kline-strategy-backtesting.png`
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7`：
  - 记录使用说明书、README、推广文章和截图同步。
- 归档 OpenSpec change：
  - `openspec/changes/archive/2026-08-14-refresh-user-manual-and-juejin-article/`
  - 同步 `openspec/specs/help-and-updates/spec.md`，新增 6 条用户文档相关 requirements。

## 测试计划(UT):

- `openspec validate refresh-user-manual-and-juejin-article --strict`：通过，归档前执行。
- `openspec validate --all --strict`：归档前通过；归档后通过。
- `git diff --check`：归档前通过；归档后修复主 spec 末尾空行后通过。
- `yarn typecheck`：通过。
- `yarn test`：通过，27 个测试文件、216 个测试用例通过。
- 未运行 `yarn build`：本次未修改 main/preload/Electron 配置、打包或发布 workflow，按项目规则不需要额外构建验证。

## 影响范围(建议手动测试范围):

- 应用内 `帮助 -> 使用说明书`：
  - 确认目录新增 `K 线缓存` 和 `策略回测`。
  - 确认说明书中策略回测、B/S 信号和做T测算不含投资建议或收益承诺。
- README 和掘金推广文章：
  - 确认新增截图路径可在仓库内访问。
  - 确认文案覆盖自选股、K 线缓存、策略回测、做T测算和 macOS 更新边界。
- OpenSpec：
  - 确认 active changes 中不再包含 `refresh-user-manual-and-juejin-article`。
  - 确认 `help-and-updates` 主 spec 已同步新增文档覆盖与安全文案要求。

## 风险与后续:

- 本次截图来自用户提供的当前界面状态，后续 UI 若发生较大变化，需要重新采集并更新 README 与推广文章。
- 本次只创建本地 commit，不 push，不创建远端 PR。
