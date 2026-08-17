## 1. K 线指标 B/S 删除与策略默认

- [x] 1.1 从 K 线用户可见指标定义、默认 settings、参数校验和指标设置 UI 中删除 `B/S`，保留 legacy `bsSignal` 输入兼容并在 normalize 时忽略。
- [x] 1.2 将 K 线 `策略` 信号指标调整为 fresh/default settings 默认开启，并删除 `B/S` 与 `策略` 的互斥逻辑。
- [x] 1.3 更新 K 线 ViewModel 和 `KLineChartsAdapter`，移除 K 线 B/S overlay 渲染路径，并保持策略信号仅由选中成功策略结果驱动。
- [x] 1.4 更新 K 线指标相关测试，覆盖默认设置、旧 `bsSignal` 兼容、指标弹窗不展示 B/S、策略默认开启和 K 线图表不渲染 B/S。

## 2. 分时指标 B/S 删除

- [x] 2.1 从分时用户可见指标定义、默认 settings、参数校验和指标设置 UI 中删除 `B/S`，保留 legacy `bsSignal` 输入兼容并在 normalize 时忽略。
- [x] 2.2 更新分时 indicator engine，不再计算分时 B/S 信号。
- [x] 2.3 更新 `TimeshareChartAdapter`，移除分时 B/S 标记绘制、图例项和 tooltip 命中文案。
- [x] 2.4 更新分时指标相关测试，覆盖默认设置、旧 `bsSignal` 兼容、指标弹窗不展示 B/S、分时图不展示 B/S 图例和 tooltip。

## 3. 策略模板默认选择

- [x] 3.1 核对 `createDefaultKlineStrategySettings()`，确保 fresh/default settings 的 `selectedTemplateIds` 包含全部可用策略模板。
- [x] 3.2 核对策略 settings normalize：已有可识别非空选择保持兼容；缺失、无效、全部未知或过滤后为空时回落为全部可用模板。
- [x] 3.3 更新策略回测相关测试，覆盖 fresh/default settings 全选、旧设置保留可识别选择、无效或空选择回落全选。

## 4. 使用说明书、README 和 changelog

- [x] 4.1 更新应用内 `使用说明书` 的指标设置章节，解释当前 K 线指标 `BOLL`、`MA`、`EMA`、`策略`、`VOL`、`MACD`、`KDJ`、`RSI` 的意义、基本原理、前置数据和限制，并说明 K 线 `B/S` 已不再作为当前可配置指标。
- [x] 4.2 更新应用内 `使用说明书` 的分时指标说明，解释 `均价线`、`昨收线`、`MA`、`EMA`、`BOLL`、`成交量`、`VOL MA`、`量比`、`换手率`、`MACD`、`KDJ`、`RSI`、`委比`、`内外盘`、`资金流` 的意义、基本原理、前置数据和限制，并说明分时 `B/S` 已不再作为当前可配置指标。
- [x] 4.3 更新应用内 `使用说明书` 的策略回测章节，逐一解释 12 个策略模板的名称、类型、基本逻辑、信号原理、关键参数和限制，并说明默认选择全部策略模板且可手动取消。
- [x] 4.4 更新 README 中与 K 线/分时 B/S、K 线策略信号默认状态和策略模板默认选择相关的摘要说明，避免与使用说明书冲突。
- [x] 4.5 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.9` 区块，记录指标默认行为、策略默认选择和说明书更新。
- [x] 4.6 检查用户可见文案，确保不包含投资建议、买卖建议、荐股服务、收益承诺或未来表现保证。

## 5. 验证

- [x] 5.1 运行 `openspec validate update-indicator-defaults-and-help --strict`。
- [x] 5.2 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 5.3 运行 K 线指标、分时指标、策略回测、ViewModel、adapter 和文档相关定向测试。
- [x] 5.4 运行 `yarn typecheck` 和 `yarn test`。
- [x] 5.5 因为实施阶段会更新 `CHANGELOG.md`，运行 `yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。
