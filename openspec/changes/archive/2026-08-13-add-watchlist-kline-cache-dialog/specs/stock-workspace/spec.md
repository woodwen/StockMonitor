## ADDED Requirements

### Requirement: 工作区编排 K 线缓存管理弹窗
系统 SHALL 由工作区 ViewModel 编排 K 线缓存管理弹窗的打开状态、查询条件草稿、缓存状态加载和刷新任务状态。

#### Scenario: 打开缓存管理弹窗
- **WHEN** 用户从自选股面板打开 K 线缓存管理弹窗
- **THEN** 工作区 SHALL 使用当前 K 线 query 的 `sourceId`、`startDate` 和 `endDate` 作为弹窗默认查询条件，并 SHALL 默认选中支持的 `day`、`week`、`month` 周期和 `qfq`、`none`、`hfq` 复权口径

#### Scenario: 周期和复权使用复选框组
- **WHEN** 用户打开 K 线缓存管理弹窗
- **THEN** 弹窗 SHALL 将 `日线`、`周线`、`月线` 展示为周期复选框组，并将 `前复权`、`不复权`、`后复权` 展示为复权复选框组

#### Scenario: 当前处于分时模式
- **WHEN** 工作区处于分时模式且用户打开 K 线缓存管理弹窗
- **THEN** 工作区 SHALL 保持当前视图模式不变，并 SHALL NOT 因打开弹窗触发图表刷新

### Requirement: 缓存任务不破坏当前工作区行情状态
系统 SHALL 将 K 线缓存任务状态与当前图表加载状态分离。

#### Scenario: 缓存刷新成功
- **WHEN** K 线缓存刷新任务成功写入一个或多个 symbol 的缓存
- **THEN** 工作区 SHALL 更新缓存弹窗内的行级状态，并 SHALL NOT 替换当前图表 dataset

#### Scenario: 缓存刷新失败
- **WHEN** K 线缓存刷新任务中的一个或多个 symbol 失败
- **THEN** 工作区 SHALL 在缓存弹窗内展示失败原因，并 SHALL NOT 清空当前图表错误状态、查询设置或已加载数据

### Requirement: 缓存管理控件遵守数据源能力
系统 SHALL 在缓存管理弹窗中只允许用户选择当前 K 线数据源支持的周期和复权选项，并以多选数组保存查询条件。

#### Scenario: 数据源保持单选
- **WHEN** 用户在缓存管理弹窗中配置查询条件
- **THEN** 弹窗 SHALL 只允许选择一个 K 线数据源，并 SHALL 将多个周期和多个复权组合展开到该数据源下查询和刷新

#### Scenario: 用户切换缓存数据源
- **WHEN** 用户在缓存管理弹窗中切换 K 线数据源
- **THEN** 工作区 SHALL 只保留该数据源支持的已选 periods 和 adjusts，并重新加载缓存状态

#### Scenario: 切换数据源后没有能力交集
- **WHEN** 用户切换 K 线数据源后，已选 periods 或 adjusts 与该数据源能力没有交集
- **THEN** 工作区 SHALL 清空对应选择、展示清晰错误，并 SHALL 阻止查询和刷新直到用户重新选择支持项

#### Scenario: 未选择周期或复权
- **WHEN** 用户清空所有周期或所有复权口径
- **THEN** 工作区 SHALL 展示清晰错误，并 SHALL 阻止查询缓存状态和启动缓存刷新

#### Scenario: 查询条件日期无效
- **WHEN** 用户输入无效或倒置的缓存日期范围
- **THEN** 工作区 SHALL 阻止启动缓存刷新，并展示清晰的表单错误
