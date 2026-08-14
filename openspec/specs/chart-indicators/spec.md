# chart-indicators Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: K 线指标可配置
系统 SHALL 支持 K 线主图指标、副图指标和 overlay 信号指标配置，并通过校验后的设置限制可见副图数量。K 线 overlay 信号指标 SHALL 至少包含 `B/S` 和 `策略`，其中 `策略` SHALL 默认关闭，且 `B/S` 与 `策略` SHALL 互斥；系统同一时刻 SHALL NOT 在 K 线图表上同时展示 K 线 B/S 标记和选中策略信号标记。

#### Scenario: 用户打开 K 线指标设置
- **WHEN** 工作区处于 K 线模式且用户打开指标设置
- **THEN** 系统 SHALL 展示支持的 K 线主图、副图和 overlay 信号指标控件
- **AND** overlay 信号指标控件 SHALL 包含 `B/S` 和 `策略`

#### Scenario: 用户开启过多 K 线副图指标
- **WHEN** 额外开启一个 K 线副图指标会超过配置的副图数量限制
- **THEN** 系统 SHALL 阻止额外开启，或把设置 normalize 回有效限制内

#### Scenario: 默认 K 线信号设置
- **WHEN** 用户首次使用默认 K 线指标设置
- **THEN** `B/S` SHALL 默认开启
- **AND** `策略` SHALL 默认关闭

#### Scenario: 用户开启策略信号
- **WHEN** 用户在 K 线指标设置中开启 `策略`
- **THEN** 系统 SHALL 关闭 `B/S`
- **AND** 若存在选中的成功策略回测结果，K 线图表 SHALL 只展示该策略的买入/卖出信号标记
- **AND** K 线图表 SHALL NOT 同时展示 K 线 B/S 标记

#### Scenario: 用户开启 B/S 信号
- **WHEN** 用户在 K 线指标设置中开启 `B/S`
- **THEN** 系统 SHALL 关闭 `策略`
- **AND** K 线图表 SHALL 展示 K 线 B/S 标记
- **AND** K 线图表 SHALL 移除选中策略信号标记

#### Scenario: 旧版 K 线指标设置启动
- **WHEN** 已保存的 K 线指标设置缺少 `策略` 信号开关
- **THEN** 系统 SHALL 补齐 `策略` 信号开关为关闭
- **AND** 已保存的 `B/S` 开关 SHALL 按旧设置保持兼容

#### Scenario: 异常设置同时开启两类信号
- **WHEN** 读取到的 K 线指标设置同时开启 `B/S` 和 `策略`
- **THEN** 系统 SHALL normalize 为仅开启 `B/S`
- **AND** 系统 SHALL NOT 在 K 线图表上同时渲染两套买入/卖出标记

### Requirement: 分时指标独立配置
系统 SHALL 支持分时专用指标设置，且这些设置独立于 K 线指标设置。

#### Scenario: 用户编辑分时指标
- **WHEN** 工作区处于分时模式且用户应用分时指标设置
- **THEN** K 线指标设置 SHALL 保持不变

#### Scenario: 分时字段缺失
- **WHEN** 分时数据源缺少均价、昨收或有效成交量等可选字段
- **THEN** 图表 SHALL 隐藏受影响的可选指标或视觉元素，并且不让整个图表失败

### Requirement: 指标计算归属于 model
系统 SHALL 将指标定义、校验、normalize 和计算保留在 model 代码中，由 ViewModel 编排状态，由 chart adapter 渲染已准备好的数据。

#### Scenario: Chart adapter 渲染指标
- **WHEN** chart adapter 接收到包含已计算指标值的数据集
- **THEN** 它 SHALL 渲染这些值，并且不在绘制代码中重新计算业务指标

### Requirement: 指标修改支持草稿应用和取消
系统 SHALL 允许用户以草稿形式编辑指标设置，并且只在用户应用时持久化变更。

#### Scenario: 用户取消指标修改
- **WHEN** 用户编辑指标设置后取消
- **THEN** 当前图表设置和持久化设置 SHALL 保持不变

#### Scenario: 用户应用指标修改
- **WHEN** 用户应用有效指标设置
- **THEN** 当前图表 SHALL 更新，并且设置 SHALL 保存到本地

### Requirement: 高级分时指标可配置
系统 SHALL 在分时指标设置中支持 `kdj`、`volumeRatio`、`turnoverRate`、`orderRatio`、`inOutVolume` 和 `capitalFlow`。这些设置 SHALL 独立于 K 线指标设置，默认关闭，并在本地工作区设置 normalize 时补齐缺失键。

#### Scenario: 用户打开分时指标设置
- **WHEN** 工作区处于分时模式且用户打开指标设置
- **THEN** 系统 SHALL 展示 KDJ、量比、换手率、委比、内外盘和资金流的可配置项，并展示当前数据源是否满足各指标前置数据

#### Scenario: 用户应用高级分时指标设置
- **WHEN** 用户启用或关闭高级分时指标并应用设置
- **THEN** 系统 SHALL 更新分时图指标设置并持久化，且 K 线指标设置 SHALL 保持不变

#### Scenario: 用户启用过多分时副图指标
- **WHEN** 用户启用 KDJ、MACD、RSI 或其他分时副图指标会超过分时副图数量限制
- **THEN** 系统 SHALL 阻止额外开启，或将设置 normalize 回有效限制内

#### Scenario: 高级分时指标默认状态
- **WHEN** 用户从旧版本设置启动应用或首次进入分时指标设置
- **THEN** KDJ、量比、换手率、委比、内外盘和资金流 SHALL 默认关闭，且已有基础分时指标设置 SHALL 保持兼容

### Requirement: 高级分时指标按前置数据计算
系统 SHALL 只在当前分时数据集包含指标所需前置数据时计算高级分时指标。缺少前置数据时，系统 SHALL 标记该指标不可用并给出原因，且 SHALL NOT 输出由不可靠替代字段推断出的数值。第一版 SHALL 优先支持 A 股股票；ETF 和指数在缺少流通股本、盘口或方向成交数据时 SHALL 降级为不可用。

#### Scenario: KDJ 前置数据满足
- **WHEN** 当前分时数据集包含分钟 `high`、`low` 和 `close` 序列，且用户启用 KDJ
- **THEN** 系统 SHALL 按默认 `[9, 3, 3]` 或用户配置参数计算每个有效分钟点的 K、D、J 值；区间最高价等于最低价时 RSV SHALL 按 50 处理

#### Scenario: KDJ 前置数据缺失
- **WHEN** 当前分时数据集只有价格点或均价点，缺少分钟 OHLC 字段，且用户启用 KDJ
- **THEN** 系统 SHALL 将 KDJ 标记为不可用，并 SHALL NOT 使用单点价格伪造 `high` 或 `low`

#### Scenario: 量比前置数据满足
- **WHEN** 当前分时数据集包含有效累计成交量，且具备最近 5 个有效交易日的日均每分钟成交量基准或更精确的同分钟累计历史基准
- **THEN** 系统 SHALL 计算量比，并在指标值中保留所用基准口径

#### Scenario: 换手率前置数据满足
- **WHEN** 当前分时数据集包含有效累计成交量和正数流通股本，且用户启用换手率
- **THEN** 系统 SHALL 用当前累计成交量除以流通股本计算换手率

#### Scenario: 换手率缺少流通股本
- **WHEN** 当前分时数据集缺少正数流通股本，且用户启用换手率
- **THEN** 系统 SHALL 将换手率标记为不可用，并 SHALL NOT 使用总股本替代流通股本

#### Scenario: 委比前置数据满足
- **WHEN** 当前分时数据集包含盘口买卖前 5 档数量，且用户启用委比
- **THEN** 系统 SHALL 按 `(买量 - 卖量) / (买量 + 卖量) * 100%` 计算最新委比；买量与卖量合计为 0 时 SHALL 标记不可用

#### Scenario: 内外盘和资金流前置数据满足
- **WHEN** 当前分时数据集包含逐笔方向数据，或包含数据源提供的内外盘、资金流聚合字段
- **THEN** 系统 SHALL 计算或转写内外盘与总流入、总流出、净流入，并保留字段来源

#### Scenario: 内外盘和资金流方向缺失
- **WHEN** 当前分时数据集缺少逐笔方向和源端内外盘、资金流聚合字段
- **THEN** 系统 SHALL 将内外盘和资金流标记为不可用，并 SHALL NOT 根据价格涨跌方向推断成交方向

### Requirement: 高级分时指标展示可解释
系统 SHALL 将高级分时指标的计算结果、展示形态和不可用原因传递给分时图渲染层。图表渲染层 SHALL 只渲染已准备好的指标数据，且 SHALL NOT 重新计算业务指标。

#### Scenario: 高级指标有序列值
- **WHEN** 已启用的 KDJ、量比或换手率返回随分钟变化的序列值
- **THEN** 图表 SHALL 在对应分时区域、tooltip 或图例中展示该指标值

#### Scenario: 高级指标只有最新态值
- **WHEN** 已启用的委比只具备最新盘口快照
- **THEN** 系统 SHALL 以最新态指标展示该值，并 SHALL NOT 将其伪装成历史序列

#### Scenario: 高级指标只有累计态值
- **WHEN** 已启用的内外盘或资金流只具备源端累计聚合字段
- **THEN** 系统 SHALL 以累计态指标展示该值和来源，并 SHALL NOT 将其伪装成逐分钟序列

#### Scenario: 高级指标不可用
- **WHEN** 已启用的高级分时指标因数据源能力、证券类型或本次响应缺字段不可用
- **THEN** 系统 SHALL 展示清晰不可用状态，并保持基础分时图可用

#### Scenario: 高级指标文案
- **WHEN** 系统展示 KDJ、量比、换手率、委比、内外盘或资金流
- **THEN** 用户可见文案 SHALL 仅描述指标名称、数值、口径或不可用原因，且 SHALL NOT 包含投资建议、买卖建议或收益承诺
