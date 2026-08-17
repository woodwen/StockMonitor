## MODIFIED Requirements

### Requirement: K 线指标可配置
系统 SHALL 支持 K 线主图指标、副图指标和 overlay 信号指标配置，并通过校验后的设置限制可见副图数量。K 线用户可见指标设置 SHALL NOT 提供 `B/S` 指标项。K 线 overlay 信号指标 SHALL 包含 `策略`，且 `策略` SHALL 在 fresh/default K 线指标设置中默认开启；系统 SHALL 仅在存在选中成功策略回测结果时通过 `策略` 信号指标展示该策略的买入/卖出标记。

#### Scenario: 用户打开 K 线指标设置
- **WHEN** 工作区处于 K 线模式且用户打开指标设置
- **THEN** 系统 SHALL 展示支持的 K 线主图、副图和 overlay 信号指标控件
- **AND** overlay 信号指标控件 SHALL 包含 `策略`
- **AND** overlay 信号指标控件 SHALL NOT 包含 `B/S`

#### Scenario: 用户开启过多 K 线副图指标
- **WHEN** 额外开启一个 K 线副图指标会超过配置的副图数量限制
- **THEN** 系统 SHALL 阻止额外开启，或把设置 normalize 回有效限制内

#### Scenario: 默认 K 线信号设置
- **WHEN** 用户首次使用默认 K 线指标设置
- **THEN** `策略` SHALL 默认开启
- **AND** `B/S` SHALL NOT 作为默认或可配置 K 线指标出现

#### Scenario: 图表展示策略信号
- **WHEN** K 线指标 `策略` 开启，且存在选中成功策略回测结果
- **THEN** K 线图表 SHALL 在对应 K 线上展示该策略的买入/卖出信号标记
- **AND** K 线图表 SHALL NOT 同时展示 K 线 B/S 标记

#### Scenario: 用户开启策略信号
- **WHEN** 用户在 K 线指标设置中开启 `策略`
- **THEN** 系统 SHALL 保持 `B/S` 不作为当前可配置指标出现
- **AND** 若存在选中的成功策略回测结果，K 线图表 SHALL 只展示该策略的买入/卖出信号标记
- **AND** K 线图表 SHALL NOT 同时展示 K 线 B/S 标记

#### Scenario: 图表没有成功策略结果
- **WHEN** K 线指标 `策略` 开启，但不存在选中成功策略回测结果
- **THEN** K 线图表 SHALL 不展示策略买入/卖出标记
- **AND** K 线图表 SHALL NOT 回退展示 K 线 B/S 标记

#### Scenario: 用户关闭策略信号
- **WHEN** 用户在 K 线指标设置中关闭 `策略`
- **THEN** K 线图表 SHALL 移除选中策略信号标记
- **AND** K 线图表 SHALL NOT 展示 K 线 B/S 标记

#### Scenario: 用户开启 B/S 信号
- **WHEN** 已保存的旧版 K 线指标设置启用了 `B/S`
- **THEN** 系统 SHALL 兼容读取该设置但忽略 `B/S`
- **AND** K 线图表 SHALL NOT 展示 K 线 B/S 标记
- **AND** `策略` SHALL 按可识别的已保存状态或默认开启规则确定状态

#### Scenario: 旧版 K 线指标设置启动
- **WHEN** 已保存的 K 线指标设置包含旧版 `B/S` 信号开关
- **THEN** 系统 SHALL 兼容读取该设置但不再把 `B/S` 恢复为可见指标
- **AND** 系统 SHALL NOT 因旧版 `B/S` 设置导致启动、指标设置或图表渲染失败

#### Scenario: 旧版 K 线指标设置缺少策略信号
- **WHEN** 已保存的 K 线指标设置缺少可识别的 `策略` 信号开关状态
- **THEN** 系统 SHALL 补齐 `策略` 信号开关为开启

#### Scenario: 异常设置同时开启两类信号
- **WHEN** 读取到的 K 线指标设置同时包含旧版 `B/S` 和 `策略`
- **THEN** 系统 SHALL 忽略旧版 `B/S` 并保留可识别的 `策略` 状态
- **AND** 系统 SHALL NOT 在 K 线图表上同时渲染两套买入/卖出标记

### Requirement: 分时指标独立配置
系统 SHALL 支持分时专用指标设置，且这些设置独立于 K 线指标设置。分时用户可见指标设置 SHALL NOT 提供 `B/S` 指标项，分时图 SHALL NOT 展示分时 B/S 标记、图例项或 tooltip 命中文案。

#### Scenario: 用户编辑分时指标
- **WHEN** 工作区处于分时模式且用户应用分时指标设置
- **THEN** K 线指标设置 SHALL 保持不变

#### Scenario: 用户打开分时指标设置
- **WHEN** 工作区处于分时模式且用户打开指标设置
- **THEN** 系统 SHALL 展示支持的分时基础显示、主图、成交量、副图和高级指标控件
- **AND** 分时指标控件 SHALL NOT 包含 `B/S`

#### Scenario: 旧版分时指标设置启动
- **WHEN** 已保存的分时指标设置包含旧版 `B/S` 信号开关
- **THEN** 系统 SHALL 兼容读取该设置但不再把 `B/S` 恢复为可见指标
- **AND** 系统 SHALL NOT 因旧版 `B/S` 设置导致启动、指标设置或分时图渲染失败

#### Scenario: 分时图渲染
- **WHEN** 分时图使用 normalize 后的分时指标设置渲染
- **THEN** 分时图 SHALL NOT 绘制 B/S 标记
- **AND** 分时图图例和 tooltip SHALL NOT 展示 B/S 买入或卖出文案

#### Scenario: 分时字段缺失
- **WHEN** 分时数据源缺少均价、昨收或有效成交量等可选字段
- **THEN** 图表 SHALL 隐藏受影响的可选指标或视觉元素，并且不让整个图表失败
