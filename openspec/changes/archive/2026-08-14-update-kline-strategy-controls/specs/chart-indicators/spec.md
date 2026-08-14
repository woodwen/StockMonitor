## MODIFIED Requirements

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
