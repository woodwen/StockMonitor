# stock-workspace Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: 工作区视图模式
系统 SHALL 提供分时和 K 线两种工作区模式，并以分时作为默认启动视图。

#### Scenario: 应用启动
- **WHEN** 应用使用默认设置启动
- **THEN** 工作区 SHALL 进入分时模式

#### Scenario: 用户切换视图模式
- **WHEN** 用户在分时和 K 线模式之间切换
- **THEN** 工作区 SHALL 展示与当前模式匹配的控件和图表行为

### Requirement: K 线和分时数据源选择互相独立
系统 SHALL 保持 K 线数据源选择和分时数据源选择互相独立，同时共享当前证券代码。

#### Scenario: 用户切换 K 线数据源
- **WHEN** 用户选择 K 线数据源
- **THEN** 分时数据源 SHALL 保持不变

#### Scenario: 用户切换分时数据源
- **WHEN** 用户选择分时数据源
- **THEN** K 线数据源 SHALL 保持不变

### Requirement: 工作区设置本地持久化
系统 SHALL 通过应用设置存储持久化工作区查询状态、按视图区分的数据源选择、指标设置、代理设置、启动检查更新设置和本地用户工作流状态。

#### Scenario: 用户重启应用
- **WHEN** 应用在设置保存后重启
- **THEN** 工作区 SHALL 恢复已保存的兼容设置，或恢复 normalize 后的默认值

### Requirement: 刷新行为感知当前模式
系统 SHALL 支持当前工作区模式的手动刷新，并且 SHALL 只在窗口可见且本地 A 股交易时段条件满足时自动刷新分时数据。

#### Scenario: 用户点击刷新
- **WHEN** 用户点击刷新
- **THEN** 工作区 SHALL 刷新当前视图模式的数据

#### Scenario: 分时自动刷新定时器触发
- **WHEN** 工作区处于分时模式、窗口可见且交易时段条件满足
- **THEN** 系统 SHALL 执行静默分时刷新，并且不改变 K 线查询状态

### Requirement: 工作区展示可操作状态
系统 SHALL 在工作区状态区域展示当前数据源、证券代码、记录数或点数、最新行情、加载状态和更新状态。

#### Scenario: 数据刷新成功
- **WHEN** 行情数据刷新成功
- **THEN** 状态区域 SHALL 反映 active source、symbol、已加载数据量、最新数据和非错误加载状态

#### Scenario: 数据刷新失败
- **WHEN** 行情数据刷新失败
- **THEN** 工作区 SHALL 展示清晰失败状态，并且不清空无关用户设置
