## ADDED Requirements

### Requirement: K 线缓存可随本地备份导出
系统 SHALL 将所有可解析且符合当前缓存格式的历史 K 线缓存 series 纳入本地缓存备份。

#### Scenario: 导出多个 K 线缓存 series
- **WHEN** 用户导出本地缓存且本地存在多个历史 K 线缓存文件
- **THEN** 备份 SHALL 为每个有效 series 记录 `seriesKey`、query 维度、meta、interval、columns、candles、coveredRanges、lastRefreshedAt、lastError 和数据源元数据
- **AND** 每个 series SHALL 继续以 `sourceId + symbol + period + adjust` 作为唯一身份

#### Scenario: 导出跳过无效 K 线缓存 series
- **WHEN** 某个 K 线缓存文件无法解析、`seriesKey` 与 query 维度不匹配或不符合当前缓存版本
- **THEN** 系统 SHALL 跳过该 series
- **AND** 系统 SHALL 在导出摘要中记录该 series 的跳过原因
- **AND** 系统 SHALL NOT 因单个损坏 series 阻止其他有效 series 导出

### Requirement: K 线缓存可从本地备份导入
系统 SHALL 能从合法本地缓存备份中恢复历史 K 线缓存 series，并保持现有缓存状态查询和读取能力可用。

#### Scenario: 导入有效 K 线缓存 series
- **WHEN** 用户导入包含有效 K 线缓存 entries 的备份
- **THEN** 系统 SHALL 将每个有效 entry 写入本地 K 线缓存目录
- **AND** 导入后的缓存状态查询 SHALL 能按对应 query 维度返回覆盖范围、记录数和最近刷新信息

#### Scenario: 导入同 series 缓存
- **WHEN** 备份中的某个 K 线缓存 entry 与本地现有缓存使用相同 `sourceId + symbol + period + adjust`
- **THEN** 系统 SHALL 按用户选择的导入策略替换或保留未涉及的本地 series
- **AND** 系统 SHALL NOT 将不同数据源、周期或复权口径的数据合并到同一个 series

#### Scenario: 导入无效 K 线缓存 entry
- **WHEN** 备份中的某个 K 线缓存 entry 缺少必需字段、字段类型无效、日期范围无效或 candles 无法归一化
- **THEN** 系统 SHALL 跳过该 entry
- **AND** 系统 SHALL 在导入结果摘要中报告跳过原因
- **AND** 系统 SHALL NOT 覆盖本地同 series 的现有有效缓存

#### Scenario: 导入时存在缓存刷新任务
- **WHEN** 用户确认导入且历史 K 线缓存刷新任务仍在进行
- **THEN** 系统 SHALL 阻止本次导入
- **AND** 系统 SHALL 展示清晰错误
- **AND** 系统 SHALL NOT 修改现有 K 线缓存

### Requirement: K 线缓存导入不触发远端刷新
系统 SHALL 将 K 线缓存导入视为本地恢复操作，不得因导入本身发起远端行情请求。

#### Scenario: 导入缓存后查看状态
- **WHEN** 用户导入历史 K 线缓存并查看缓存管理弹窗
- **THEN** 系统 SHALL 基于导入后的本地文件计算缓存状态
- **AND** 系统 SHALL NOT 自动请求远端行情源补齐缺失范围

#### Scenario: 导入缓存后运行策略回测
- **WHEN** 用户导入的 K 线缓存已完整覆盖当前策略回测 query
- **THEN** 策略回测 SHALL 能读取导入后的本地缓存
- **AND** 工作区 SHALL NOT 因缓存来自导入文件而强制重新刷新远端数据
