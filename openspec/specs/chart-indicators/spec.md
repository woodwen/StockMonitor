# chart-indicators Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: K 线指标可配置
系统 SHALL 支持 K 线主图指标和副图指标配置，并通过校验后的设置限制可见副图数量。

#### Scenario: 用户打开 K 线指标设置
- **WHEN** 工作区处于 K 线模式且用户打开指标设置
- **THEN** 系统 SHALL 展示支持的 K 线主图和副图指标控件

#### Scenario: 用户开启过多 K 线副图指标
- **WHEN** 额外开启一个 K 线副图指标会超过配置的副图数量限制
- **THEN** 系统 SHALL 阻止额外开启，或把设置 normalize 回有效限制内

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
