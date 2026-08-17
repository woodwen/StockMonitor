# M-43(feat): 更新指标默认与说明文档

OpenSpec Change: update-indicator-defaults-and-help

背景:
- K 线和分时指标设置中继续暴露独立 `B/S` 信号会与 K 线策略回测信号形成概念重叠。
- 策略模板默认选择和指标/策略原理说明需要与当前产品行为保持一致，并在应用内使用说明书中解释清楚。

方案概述:
- 删除 K 线和分时当前可见 `B/S` 指标入口、计算和渲染路径，同时保留旧 `bsSignal` settings 读取兼容并在 normalize 时忽略。
- 将 K 线 `策略` 信号指标默认开启，图表只在存在选中成功策略回测结果时展示策略买入/卖出标记。
- 保持策略模板 fresh/default settings 默认全选全部可用模板，并补充缺失、无效或全未知选择的全选回退测试。
- 更新应用内使用说明书、README、CHANGELOG 和 OpenSpec 主规格。

实现改动:
- 更新 K 线和分时指标类型、definitions、normalize、indicator engine、ViewModel、指标设置弹窗和 chart adapter，移除 `B/S` 用户可见与渲染路径。
- 更新策略回测 settings 测试，覆盖默认全选、旧设置保留可识别模板选择、无效或空选择回落全选。
- 使用说明书补充 K 线指标、分时指标和 12 个策略模板的意义、基本原理、前置数据和限制。
- README 和 `CHANGELOG.md` 同步记录指标默认行为、策略模板默认选择和说明文档变化。
- OpenSpec change 已归档到 `openspec/changes/archive/2026-08-17-update-indicator-defaults-and-help`，并同步更新 `chart-indicators`、`help-and-updates`、`kline-strategy-backtesting` 主规格。

测试计划(UT):
- `openspec validate update-indicator-defaults-and-help --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test tests/indicator-definitions.test.ts tests/timeshare-indicator-definitions.test.ts tests/indicator-engine.test.ts tests/timeshare-indicator-engine.test.ts tests/klinecharts-adapter.test.ts tests/kline-strategy-backtesting.test.ts tests/stock-workspace-view-model.test.ts`
- `yarn test tests/release-version.test.mjs tests/changelog-release-notes.test.mjs`
- `yarn test`
- `yarn build`

影响范围(建议手动测试范围):
- K 线指标设置弹窗：确认 `B/S` 不出现，`策略` 默认开启，关闭/开启策略信号后图表标记符合预期。
- 分时指标设置弹窗和分时图：确认 `B/S` 不出现，不绘制 B/S 标记，不显示 B/S 图例或 tooltip 文案。
- K 线策略回测面板：确认策略模板默认全选，可手动取消，运行成功后选中策略标记能在 K 线图展示。
- 帮助菜单使用说明书和 README：确认指标、策略模板说明与风险提示文案可读且不构成投资建议。

风险与后续:
- 旧版持久化 `bsSignal` 会被兼容读取但不再恢复为当前可见指标；用户若依赖旧 B/S 标记，需要改用策略回测信号查看历史策略触发点。
