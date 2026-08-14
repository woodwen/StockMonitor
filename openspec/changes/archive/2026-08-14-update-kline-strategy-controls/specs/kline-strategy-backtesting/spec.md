## MODIFIED Requirements

### Requirement: 回测数据输入可复现
系统 SHALL 基于当前 K 线 query 的数据身份和日期范围执行策略回测，并 SHALL 保持 `sourceId`、`symbol`、`period`、`adjust`、`startDate` 和 `endDate` 与回测结果绑定。第一版 SHALL 只对 `day`、`week`、`month` 周期执行回测。策略回测面板 SHALL NOT 提供独立的回测开始日期或结束日期设置。本 change SHALL NOT 改变最大回撤指标算法或展示口径。

#### Scenario: 用户运行回测
- **WHEN** 用户在策略面板运行回测
- **THEN** 系统 SHALL 使用当前 K 线 query 的 `sourceId`、`symbol`、`period`、`adjust`、`startDate` 和 `endDate` 组成回测 query
- **AND** 系统 SHALL NOT 从策略设置或策略面板读取独立的 `startDate` 或 `endDate`

#### Scenario: 用户选择回测区间
- **WHEN** 用户需要调整策略回测区间
- **THEN** 系统 SHALL 要求用户通过外部 K 线日期范围修改当前 K 线 query 的 `startDate` 或 `endDate`
- **AND** 策略面板 SHALL NOT 提供独立的回测 `startDate` 或 `endDate` 输入
- **AND** 系统 SHALL NOT 维护另一套独立于当前 K 线 query 的策略回测区间

#### Scenario: 用户调整外部 K 线区间
- **WHEN** 用户通过外部 K 线日期范围修改当前 K 线 query 后运行回测
- **THEN** 系统 SHALL 使用修改后的当前 K 线 query 日期范围执行回测
- **AND** 策略面板 SHALL NOT 保存另一套独立回测区间

#### Scenario: 旧策略区间设置存在
- **WHEN** 已保存策略设置中存在旧版 `dateRange`
- **THEN** 系统 SHALL 兼容读取该设置但不使用它组成回测 query
- **AND** 下次保存策略设置时 SHALL NOT 继续写入旧版 `dateRange`

#### Scenario: 本地缓存覆盖回测范围
- **WHEN** 本地 K 线缓存完整覆盖回测 query
- **THEN** 系统 SHALL 通过 typed adapter 读取缓存 dataset，并用缓存返回的 candles 执行回测

#### Scenario: 缓存状态完整但实际数据范围不足
- **WHEN** typed adapter 返回 `status = complete` 但 dataset 的实际 candles 起止范围在有效交易边界外无法覆盖回测 query 的 `startDate` 到 `endDate`
- **THEN** 系统 SHALL 将该缓存结果视为不完整
- **AND** 系统 SHALL 先触发对应 query 的 K 线缓存下载或刷新
- **AND** 若刷新后实际 candles 起止范围仍无法覆盖回测 query，系统 SHALL 阻止本次回测并展示缺失范围

#### Scenario: 缓存状态完整且 query 边界是非交易日
- **WHEN** typed adapter 返回 `status = complete`，且 dataset 的实际 candles 只在回测 query 首尾存在合理的非交易日自然日偏移
- **THEN** 系统 SHALL 使用该完整缓存执行回测
- **AND** 系统 SHALL NOT 因日线最多 10 天、周线最多 14 天或月线最多 45 天的首尾边界偏移误报缓存缺失
- **AND** 回测结果 SHALL 继续绑定当前 K 线 query 的 `startDate` 和 `endDate`，并单独展示实际参与计算的 `dataStartDate` 和 `dataEndDate`

#### Scenario: 当前图表数据覆盖回测范围
- **WHEN** 当前 K 线图表 dataset 与回测 query 的 `sourceId`、`symbol`、`period`、`adjust`、`startDate` 和 `endDate` 匹配且 candles 覆盖日期范围
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
- **AND** 系统 SHALL 保留此前已成功生成的策略结果，直到新的回测成功或用户切换 K 线 query 数据身份或日期范围

#### Scenario: 输入 candles 无效
- **WHEN** 回测输入 candles 为空、时间倒序、存在重复 `timeKey` 或包含非有限 OHLC 数值
- **THEN** 系统 SHALL 拒绝执行回测并展示清晰错误

### Requirement: 策略结果展示可检查
系统 SHALL 展示策略回测摘要、交易明细、信号列表、权益曲线状态和回撤状态，并在 K 线指标 `策略` 信号开关开启时将选中成功策略结果的买入/卖出信号传递给 K 线图表渲染层。

#### Scenario: 图表展示策略信号
- **WHEN** K 线指标 `策略` 信号开关开启，且某个成功策略结果被用户选中
- **THEN** K 线图表 SHALL 在对应 K 线上展示该策略的买入/卖出信号标记，并 SHALL NOT 在 chart adapter 中重新计算策略逻辑
- **AND** 买入和卖出标记 SHALL 使用明显不同的颜色和足够对比度，保证在深色 K 线背景上可区分

#### Scenario: 策略信号开关关闭
- **WHEN** K 线指标 `策略` 信号开关关闭，或 K 线指标 `B/S` 信号开关开启
- **THEN** K 线图表 SHALL 移除选中策略的买入/卖出信号标记
- **AND** 策略面板 SHALL 继续展示已生成的摘要、交易明细和信号列表

#### Scenario: 用户查看交易明细
- **WHEN** 用户展开策略交易明细
- **THEN** 系统 SHALL 展示每笔交易的买入时间、卖出时间或未平仓状态、成交价格、持仓 K 线数、单笔收益率和触发信号说明

#### Scenario: 用户切换选中策略
- **WHEN** 用户在多个策略结果之间切换选中项
- **THEN** 系统 SHALL 更新摘要、交易明细和信号列表，并 SHALL 保留其他策略结果用于比较
- **AND** 若 K 线指标 `策略` 信号开关开启，系统 SHALL 同步更新图表信号标记

#### Scenario: 回测区间与实际数据区间不同
- **WHEN** 成功回测结果绑定当前 K 线 query 区间和 `dataStartDate` / `dataEndDate`
- **THEN** 系统 SHALL 在结果展示中优先展示当前 K 线 query 的回测区间
- **AND** 系统 SHALL NOT 只用实际数据区间替代当前 K 线 query 的回测区间
- **AND** 若实际数据区间不能覆盖当前 K 线 query 的回测区间，系统 SHALL NOT 将该结果展示为成功回测

### Requirement: 回测假设和限制必须可见
系统 SHALL 在策略结果中展示当前 K 线 query 的回测区间、实际参与计算的数据区间、数据源、周期、复权口径、成交规则、初始资金、费用率、滑点率和限制说明。

#### Scenario: 默认回测假设
- **WHEN** 用户首次打开 K 线策略面板且尚未保存策略回测假设
- **THEN** 系统 SHALL 默认使用 `initialCapital = 100000`、`feeRate = 0.0005` 和 `slippageRate = 0.0002`

#### Scenario: 旧零成本默认假设升级
- **WHEN** 已保存策略设置没有 `assumptionDefaultsVersion` 且假设仍为旧默认 `initialCapital = 100000`、`feeRate = 0`、`slippageRate = 0`
- **THEN** 系统 SHALL 将该旧默认假设升级为 `feeRate = 0.0005` 和 `slippageRate = 0.0002`
- **AND** 用户在升级后显式保存 `feeRate = 0` 或 `slippageRate = 0` 时 SHALL 保留用户输入

#### Scenario: 用户查看回测结果
- **WHEN** 回测结果成功展示
- **THEN** 系统 SHALL 同时展示当前 K 线 query 的回测区间、回测假设和“历史回测不代表未来表现”的限制说明

#### Scenario: 用户修改回测假设
- **WHEN** 用户修改初始资金、费用率或滑点率并重新运行回测
- **THEN** 系统 SHALL 使用新的假设和当前 K 线 query 日期范围重新计算所有选中策略结果
