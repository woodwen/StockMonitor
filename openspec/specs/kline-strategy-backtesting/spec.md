# kline-strategy-backtesting Specification

## Purpose
TBD - created by archiving change add-kline-strategy-backtest-recommendations. Update Purpose after archive.
## Requirements
### Requirement: K 线策略模板可发现且可参数化
系统 SHALL 提供 K 线策略模板 registry，用于展示可用模板、默认参数、参数约束、最小样本数、兼容周期和信号解释。第一版 SHALL 至少包含均线交叉、突破回撤、RSI 超买超卖和 MACD 趋势确认四类模板，且策略周期范围 SHALL 限定为 `day`、`week`、`month`。

#### Scenario: 用户查看策略模板
- **WHEN** 用户打开 K 线策略面板
- **THEN** 系统 SHALL 展示可用策略模板的名称、说明、参数、默认值、最小样本数和兼容 K 线周期

#### Scenario: 用户修改策略参数
- **WHEN** 用户编辑策略模板参数
- **THEN** 系统 SHALL 对参数执行 normalize 和校验，并在参数超出模板约束时展示清晰错误

#### Scenario: 模板不兼容当前周期
- **WHEN** 当前 K 线周期不被某个策略模板支持
- **THEN** 系统 SHALL 将该模板标记为不可运行，并 SHALL 展示不兼容原因

#### Scenario: 分钟 K 线周期
- **WHEN** 当前 K 线周期为 `5`、`15`、`30` 或 `60`
- **THEN** 系统 SHALL 将策略回测标记为暂不支持当前周期，并 SHALL NOT 运行策略模板

### Requirement: 回测数据输入可复现
系统 SHALL 基于当前 K 线 query 的数据身份和策略面板选择的历史区间执行策略回测，并 SHALL 保持 `sourceId`、`symbol`、`period`、`adjust`、`startDate` 和 `endDate` 与回测结果绑定。第一版 SHALL 只对 `day`、`week`、`month` 周期执行回测。

#### Scenario: 用户选择回测区间
- **WHEN** 用户在策略面板修改回测 `startDate` 或 `endDate` 并运行回测
- **THEN** 系统 SHALL 使用当前 K 线 query 的 `sourceId`、`symbol`、`period` 和 `adjust`，以及策略面板选择的 `startDate` 和 `endDate` 组成回测 query
- **AND** 系统 SHALL NOT 因修改策略回测区间而自动改变当前 K 线图表 query

#### Scenario: 本地缓存覆盖回测范围
- **WHEN** 本地 K 线缓存完整覆盖回测 query
- **THEN** 系统 SHALL 通过 typed adapter 读取缓存 dataset，并用缓存返回的 candles 执行回测

#### Scenario: 缓存状态完整但实际数据范围不足
- **WHEN** typed adapter 返回 `status = complete` 但 dataset 的实际 candles 起止范围无法覆盖回测 query 的 `startDate` 到 `endDate`
- **THEN** 系统 SHALL 将该缓存结果视为不完整
- **AND** 系统 SHALL 先触发对应 query 的 K 线缓存下载或刷新
- **AND** 若刷新后实际 candles 起止范围仍无法覆盖回测 query，系统 SHALL 阻止本次回测并展示缺失范围

#### Scenario: 当前图表数据覆盖回测范围
- **WHEN** 当前 K 线图表 dataset 与回测 query 的 `sourceId`、`symbol`、`period` 和 `adjust` 匹配且 candles 覆盖所选日期范围
- **THEN** 系统 SHALL 仍通过 typed adapter 读取本地缓存 dataset 作为回测执行输入
- **AND** 系统 SHALL NOT 使用当前图表 dataset 替代缺失或不完整的本地缓存
- **AND** 系统 SHALL 仅将当前图表 dataset 用于行情展示和策略信号标记渲染

#### Scenario: 本地缓存缺失或不完整
- **WHEN** 本地 K 线缓存为空、缺失区间或无法完整覆盖回测 query
- **THEN** 系统 SHALL 通过 typed adapter 触发该 query 对应的 K 线缓存下载或刷新
- **AND** 系统 SHALL 在缓存刷新完成后重新读取本地缓存 dataset 并执行回测
- **AND** renderer SHALL NOT 直接请求远端行情接口补齐数据

#### Scenario: 历史数据不完整
- **WHEN** 缓存刷新失败、数据源不支持、刷新后仍无法完整覆盖回测 query 或缓存数据无效
- **THEN** 系统 SHALL 阻止回测并展示刷新失败、缺失范围或不可用原因
- **AND** 系统 SHALL 保留此前已成功生成的策略结果，直到新的回测成功或用户切换 K 线 query 数据身份

#### Scenario: 输入 candles 无效
- **WHEN** 回测输入 candles 为空、时间倒序、存在重复 `timeKey` 或包含非有限 OHLC 数值
- **THEN** 系统 SHALL 拒绝执行回测并展示清晰错误

### Requirement: 策略信号生成确定性
系统 SHALL 使用策略模板和参数对时间升序 candles 生成确定性的买入/卖出信号，且每个信号 SHALL 包含 side、timeKey、timestamp、触发价格参考、模板 id 和解释文本。

#### Scenario: 生成买入信号
- **WHEN** 策略模板条件在某根 K 线上首次满足买入触发规则
- **THEN** 系统 SHALL 为该 K 线生成 `buy` 信号，并记录触发该信号的关键指标值

#### Scenario: 生成卖出信号
- **WHEN** 策略模板条件在持仓后满足卖出触发规则
- **THEN** 系统 SHALL 为该 K 线生成 `sell` 信号，并记录触发该信号的关键指标值

#### Scenario: 信号无法计算
- **WHEN** candles 数量少于模板最小样本数或指标预热期不足
- **THEN** 系统 SHALL 将该模板结果标记为样本不足，并 SHALL NOT 输出不完整信号

### Requirement: 回测执行规则明确
系统 SHALL 按多头、单笔持仓、全仓模型把策略信号转换为交易明细和权益曲线。默认成交规则 SHALL 使用下一根 K 线开盘价成交；最后仍持仓时 SHALL 按最后一根 K 线收盘价估值并标记为未平仓。

#### Scenario: 买入成交
- **WHEN** 空仓状态下出现有效 `buy` 信号且存在下一根 K 线
- **THEN** 系统 SHALL 使用下一根 K 线开盘价、扣除已配置费用和滑点后建立持仓

#### Scenario: 重复买入信号
- **WHEN** 已持仓状态下出现额外 `buy` 信号
- **THEN** 系统 SHALL 忽略该买入信号，并 SHALL NOT 建立重叠持仓

#### Scenario: 卖出成交
- **WHEN** 已持仓状态下出现有效 `sell` 信号且存在下一根 K 线
- **THEN** 系统 SHALL 使用下一根 K 线开盘价、扣除已配置费用和滑点后平仓并记录交易收益

#### Scenario: 期末仍持仓
- **WHEN** 回测结束时仍存在未平仓持仓
- **THEN** 系统 SHALL 按最后一根 K 线收盘价计算期末权益，并在交易明细中标记该持仓未平仓

### Requirement: 回测指标覆盖收益和回撤
系统 SHALL 为每个可运行策略结果计算并展示总收益率、年化收益率、最大回撤、胜率、交易次数、盈亏比、平均持仓 K 线数、期末权益和基准涨跌幅。

#### Scenario: 计算总收益率和期末权益
- **WHEN** 回测完成
- **THEN** 系统 SHALL 用 `initialCapital` 和期末权益计算总收益率，并展示所用初始资金、费用率和滑点率假设

#### Scenario: 计算最大回撤
- **WHEN** 回测生成权益曲线
- **THEN** 系统 SHALL 基于权益曲线的历史高点到后续低点计算最大回撤

#### Scenario: 没有已平仓交易
- **WHEN** 策略在回测区间内没有已平仓交易
- **THEN** 系统 SHALL 将胜率和盈亏比标记为不可用，并 SHALL NOT 展示伪造的 0% 胜率或无限盈亏比

### Requirement: 多策略历史表现排名可解释
系统 SHALL 支持对多个策略模板在同一 query、数据集和回测假设下运行，并按透明评分生成历史表现排名。默认评分 SHALL 使用 `returnDrawdownRatio = totalReturn / max(abs(maxDrawdown), 0.01)`。

#### Scenario: 多策略比较完成
- **WHEN** 用户对多个策略模板运行回测
- **THEN** 系统 SHALL 展示每个策略的排名、评分、收益指标、最大回撤、交易次数和不可用状态

#### Scenario: 策略结果不可用
- **WHEN** 某个策略因样本不足、参数无效或数据不完整无法回测
- **THEN** 系统 SHALL 将该策略排除出推荐排名，并在比较列表中展示不可用原因

#### Scenario: 排名文案
- **WHEN** 系统展示策略排名或最佳历史表现策略
- **THEN** 用户可见文案 SHALL 表述为历史回测排名或候选策略，且 SHALL NOT 表述为投资建议、买卖建议、荐股服务或收益承诺

### Requirement: 策略结果展示可检查
系统 SHALL 展示策略回测摘要、交易明细、信号列表、权益曲线状态和回撤状态，并将买入/卖出信号传递给 K 线图表渲染层。

#### Scenario: 图表展示策略信号
- **WHEN** 某个策略结果被用户选中
- **THEN** K 线图表 SHALL 在对应 K 线上展示该策略的买入/卖出信号标记，并 SHALL NOT 在 chart adapter 中重新计算策略逻辑
- **AND** 买入和卖出标记 SHALL 使用明显不同的颜色和足够对比度，保证在深色 K 线背景上可区分

#### Scenario: 用户查看交易明细
- **WHEN** 用户展开策略交易明细
- **THEN** 系统 SHALL 展示每笔交易的买入时间、卖出时间或未平仓状态、成交价格、持仓 K 线数、单笔收益率和触发信号说明

#### Scenario: 用户切换选中策略
- **WHEN** 用户在多个策略结果之间切换选中项
- **THEN** 系统 SHALL 更新摘要、交易明细和图表信号标记，并 SHALL 保留其他策略结果用于比较

#### Scenario: 回测区间与实际数据区间不同
- **WHEN** 成功回测结果绑定 query 区间和 `dataStartDate` / `dataEndDate`
- **THEN** 系统 SHALL 在结果展示中优先展示用户选择的回测区间
- **AND** 系统 SHALL NOT 只用实际数据区间替代用户选择的回测区间
- **AND** 若实际数据区间不能覆盖用户选择的回测区间，系统 SHALL NOT 将该结果展示为成功回测

### Requirement: 回测假设和限制必须可见
系统 SHALL 在策略结果中展示用户选择的回测区间、实际参与计算的数据区间、数据源、周期、复权口径、成交规则、初始资金、费用率、滑点率和限制说明。

#### Scenario: 默认回测假设
- **WHEN** 用户首次打开 K 线策略面板且尚未保存策略回测假设
- **THEN** 系统 SHALL 默认使用 `initialCapital = 100000`、`feeRate = 0.0005` 和 `slippageRate = 0.0002`

#### Scenario: 旧零成本默认假设升级
- **WHEN** 已保存策略设置没有 `assumptionDefaultsVersion` 且假设仍为旧默认 `initialCapital = 100000`、`feeRate = 0`、`slippageRate = 0`
- **THEN** 系统 SHALL 将该旧默认假设升级为 `feeRate = 0.0005` 和 `slippageRate = 0.0002`
- **AND** 用户在升级后显式保存 `feeRate = 0` 或 `slippageRate = 0` 时 SHALL 保留用户输入

#### Scenario: 用户查看回测结果
- **WHEN** 回测结果成功展示
- **THEN** 系统 SHALL 同时展示回测假设和“历史回测不代表未来表现”的限制说明

#### Scenario: 用户修改回测假设
- **WHEN** 用户修改初始资金、费用率或滑点率并重新运行回测
- **THEN** 系统 SHALL 使用新的假设重新计算所有选中策略结果
