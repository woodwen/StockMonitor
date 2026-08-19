## MODIFIED Requirements

### Requirement: 工作区设置本地持久化
系统 SHALL 通过应用设置存储持久化工作区查询状态、按视图区分的数据源选择、指标设置、策略回测偏好、代理设置、启动检查更新设置和本地用户工作流状态。策略回测偏好 SHALL 持久化策略模板、策略参数和回测假设，但 SHALL NOT 持久化或恢复独立于当前 K 线 query 的策略回测区间。应用每次重启加载工作区设置时，工作区 SHALL 将 K 线 query 的日期基准刷新到当前启动日，并保留用户保存的日期窗口长度。

#### Scenario: 用户重启应用
- **WHEN** 应用在设置保存后重启
- **THEN** 工作区 SHALL 恢复已保存的兼容设置，包括策略模板、策略参数和回测假设，或恢复 normalize 后的默认值
- **AND** 若旧设置包含策略回测 `dateRange`，工作区 SHALL 忽略该字段并使用当前 K 线 query 的 `startDate` 和 `endDate`

#### Scenario: 应用在新的一天重启
- **GIVEN** 本地设置已保存 K 线 query，且保存的 `endDate` 不等于当前启动日
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 将当前 K 线 query 的 `endDate` 调整为当前启动日的 `YYYYMMDD`
- **AND** 工作区 SHALL 按保存的 `startDate` 与 `endDate` 之间的天数跨度平移 `startDate`，保持用户已选择的日期窗口长度
- **AND** 工作区 SHALL 保留保存的 `sourceId`、`symbol`、`period`、`adjust`、视图模式、分时数据源、指标设置、策略回测偏好和自选股
- **AND** 工作区 SHALL 使用调整后的 query 触发启动刷新、K 线缓存弹窗默认日期和策略回测日期来源
- **AND** 工作区 SHALL 通过现有工作区设置保存路径持久化调整后的 query；保存失败 SHALL NOT 阻止启动刷新

#### Scenario: 应用当天重复重启
- **GIVEN** 本地设置已保存 K 线 query，且保存的 `endDate` 等于当前启动日
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 保持保存的 `startDate` 和 `endDate` 不变
- **AND** 工作区 SHALL NOT 因日期基准刷新产生不必要的工作区设置保存

#### Scenario: 用户在当前会话查看历史日期
- **GIVEN** 应用已完成启动加载
- **WHEN** 用户通过顶部 K 线日期范围输入设置历史 `startDate` 或 `endDate`
- **THEN** 工作区 SHALL 使用用户输入的日期范围刷新 K 线、打开 K 线缓存弹窗和运行策略回测
- **AND** 工作区 SHALL NOT 在当前会话内自动把该日期范围强制调整回当前启动日

#### Scenario: 保存的日期范围不可用
- **GIVEN** 本地设置中的 K 线 query 日期无法解析，或 `startDate` 晚于 `endDate`
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 使用当前启动日结尾的默认滚动日期窗口恢复 query 日期
- **AND** 工作区 SHALL 保留可兼容的非日期 query 字段和其他工作区设置
- **AND** 工作区 SHALL 通过现有工作区设置保存路径持久化恢复后的 query；保存失败 SHALL NOT 阻止启动刷新
