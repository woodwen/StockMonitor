## Context

现有 K 线指标定义包含 `BOLL`、`MA`、`EMA`、`B/S`、`策略`、`VOL`、`MACD`、`KDJ` 和 `RSI`。其中 `B/S` 默认开启，`策略` 默认关闭，并通过互斥规则避免两套买入/卖出标记同时出现。分时指标定义也包含 `B/S`，默认关闭，但分时 adapter 仍支持 B/S 标记、图例和 tooltip。

策略回测已经维护 12 个策略模板，包括既有 4 个模板和后续新增的 8 个候选模板。当前代码和主规格已经倾向于 fresh settings 默认全选全部模板，但本次需求要求把该行为作为明确验收项，并在使用说明书中解释每个策略模板的意义和原理。

本 change 只规划用户可见行为和后续实施路径，不改实现代码、不提交、不 archive。

## Goals / Non-Goals

**Goals:**

- 从 K 线指标设置中删除 `B/S` 指标项，用户不再看到或配置 K 线 `B/S` 信号。
- 从分时指标设置中删除 `B/S` 指标项，用户不再看到或配置分时 `B/S` 信号。
- K 线 `策略` 信号指标默认开启，并继续由选中成功策略结果提供图表信号数据。
- 策略模板 fresh/default settings 默认选择全部可用模板；已有可识别用户选择保持兼容。
- 使用说明书解释 K 线指标、分时指标、策略信号指标和全部策略模板的意义、基本原理、数据前置条件和限制。
- 更新 README、CHANGELOG 和相关测试，保持用户说明与行为一致。

**Non-Goals:**

- 不新增、删除或重命名策略模板 id。
- 不改变任一策略模板的买入/卖出信号算法、参数约束、推荐程度、评分公式或回测成交模型。
- 不改变 K 线缓存、数据源能力、策略回测日期范围、费用率、滑点率或最大回撤算法。
- 不把说明书写成投资教学、交易建议、荐股服务或收益承诺。
- 不要求 README 承载完整指标/策略原理；README 只同步摘要和入口说明，完整解释放在应用内 `使用说明书`。

## Decisions

1. K 线 `B/S` 从用户可见指标 registry 中移除。

   `indicatorDefinitions` 不再暴露 `bsSignal` 给 K 线指标设置 UI。实施时应同步调整类型、默认 settings、clone/normalize、参数校验、草稿更新、ViewModel 触发路径和 `KLineChartsAdapter` 的 B/S overlay 渲染。旧持久化数据中出现 `bsSignal` 时应兼容读取并忽略，不应导致启动失败或指标设置弹窗异常。

2. K 线 `策略` 信号成为默认选择的 overlay 信号指标。

   删除 `B/S` 后不再需要 `B/S` 与 `策略` 的互斥规则。fresh K 线指标设置 SHALL 默认开启 `策略`。旧版设置中如果不存在可识别的 `strategySignal` 状态，应补齐为开启；如果存在显式可识别的 `strategySignal` 状态，可保留用户状态。图表只有在 `strategySignal.enabled === true` 且存在选中成功策略结果时渲染策略信号；否则保持无策略标记。

3. 分时 `B/S` 从用户可见指标 registry 和图表展示中移除。

   `timeshareIndicatorDefinitions` 不再暴露 `bsSignal`。分时指标 normalize 应忽略旧设置中的 `bsSignal`；分时指标 engine 不再计算分时 B/S；`TimeshareChartAdapter` 不再渲染 B/S 标记、图例项或 tooltip 命中文案。分时基础价格线、均价线、昨收线、成交量、主图指标、成交量指标、副图指标和高级指标保持不变。

4. 策略模板默认全选由 strategy settings normalize 兜底。

   `createDefaultKlineStrategySettings()` 应以 `klineStrategyTemplates.map(template => template.id)` 作为默认 `selectedTemplateIds`。normalize 时保留已有设置中的可识别非空模板选择；当输入缺失、无效、全部未知或过滤后为空时，回落为全部可用模板。该默认选择只影响候选模板集合，不代表投资推荐，也不替代历史回测评分。

5. 使用说明书用 registry 内容作为说明范围。

   说明书应覆盖当前 K 线指标：`BOLL`、`MA`、`EMA`、`策略`、`VOL`、`MACD`、`KDJ`、`RSI`；当前分时指标：`均价线`、`昨收线`、`MA`、`EMA`、`BOLL`、`成交量`、`VOL MA`、`量比`、`换手率`、`MACD`、`KDJ`、`RSI`、`委比`、`内外盘`、`资金流`。说明书 SHALL NOT 继续把 `B/S` 作为当前可配置指标介绍。

6. 使用说明书逐一解释 12 个策略模板。

   说明范围包括 `ma-cross`、`breakout-pullback`、`rsi-reversion`、`macd-trend-confirmation`、`ma-bullish-alignment`、`n-day-high-breakout`、`volume-breakout`、`bollinger-breakout`、`bollinger-mean-reversion`、`kdj-oversold-rebound`、`atr-trend-following` 和 `low-volume-ma-pullback`。每个模板至少说明名称、类型、基本逻辑、信号原理、关键参数和限制，文案必须明确它们只是程序化历史信号模板。

7. 文档安全边界保持一致。

   指标和策略说明可以解释“如何计算”和“用于观察什么历史现象”，但不得写成“应该买入/卖出”“推荐股票”“保证收益”“提升胜率”等表述。策略推荐程度只能描述为模板元数据或候选策略参考，历史表现排名仍由回测评分决定。

## Risks / Trade-offs

- [Risk] 已习惯 K 线或分时 `B/S` 标记的用户会发现入口消失。→ Mitigation：在使用说明书和 changelog 中明确 `B/S` 已从当前指标设置中移除，并说明 K 线策略信号的入口和限制。
- [Risk] 旧持久化 settings 中仍存在 `bsSignal`，删除类型后可能导致 normalize 或渲染路径报错。→ Mitigation：实施时把旧 `bsSignal` 当作 legacy input 兼容读取并忽略，补充旧设置迁移测试。
- [Risk] K 线 `策略` 默认开启但尚未运行策略时图表没有标记，用户可能误以为开关无效。→ Mitigation：说明书和策略面板文案说明策略标记来自选中成功回测结果，未运行或失败时不会显示。
- [Risk] fresh settings 默认全选全部策略模板会增加一次回测的计算量。→ Mitigation：保留用户取消选择模板的能力，并在说明书中解释可按需取消模板。
- [Risk] 使用说明书内容变长影响阅读效率。→ Mitigation：按 K 线指标、分时指标、策略模板分组，使用短句解释意义、原理和限制，避免长篇投资教学。

## Migration Plan

- 更新 K 线指标 model：移除用户可见 `bsSignal` 定义、默认值、参数校验和互斥逻辑；保留旧输入兼容并忽略 legacy `bsSignal`。
- 更新 K 线 ViewModel 和 adapter：移除 B/S overlay 同步和渲染路径；让 `strategySignal` 默认开启，并仅在选中成功策略结果存在时传入策略信号。
- 更新分时指标 model、engine、ViewModel 和 adapter：移除用户可见 `bsSignal`、计算逻辑、标记绘制、图例和 tooltip 文案；保留旧输入兼容并忽略 legacy `bsSignal`。
- 核对并补充 K 线策略 settings normalize：fresh/default settings 全选全部模板；设置缺失、无效或过滤后为空时回落全选；可识别非空旧选择保持兼容。
- 更新应用内 `使用说明书`，按 registry 覆盖全部当前指标和 12 个策略模板的意义、原理、数据要求和限制。
- 同步更新 README 摘要说明和 `CHANGELOG.md` 的 `Unreleased / 0.1.9` 区块。
- 更新相关测试：K 线指标 definitions/normalize、分时指标 definitions/normalize/engine/adapter、ViewModel 策略信号默认行为、策略模板默认全选、说明书文案和 changelog 校验。
- 运行 `openspec validate update-indicator-defaults-and-help --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`、`yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。

## Open Questions

无。默认决策已确认：

- change-id 使用 `update-indicator-defaults-and-help`。
- 删除 K 线指标 `B/S` 和分时指标 `B/S`。
- K 线 `策略` 信号指标默认开启。
- 策略模板 fresh/default settings 默认选择全部可用模板。
- 指标和策略模板的意义与原理说明放在应用内 `使用说明书`，README 只同步摘要。
- 所有用户可见文案遵守产品安全边界，不写投资建议、买卖建议、收益承诺或未来表现保证。
