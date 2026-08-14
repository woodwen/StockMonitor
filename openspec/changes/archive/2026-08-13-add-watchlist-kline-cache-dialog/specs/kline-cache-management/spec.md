## ADDED Requirements

### Requirement: K 线缓存按查询维度隔离
系统 SHALL 在本地缓存历史 K 线数据，并以 `sourceId`、normalize 后的 `symbol`、`period`、`adjust` 作为缓存 series 维度隔离数据。

#### Scenario: 查询自选股缓存状态
- **WHEN** 用户在缓存管理弹窗中选择数据源、多个周期、多个复权、开始日期和结束日期
- **THEN** 系统 SHALL 按每个 `symbol + period + adjust` 组合返回一行缓存状态，且每行状态 SHALL 包含 query 维度、记录数、缓存起止日期、覆盖范围、缺失范围和最近刷新时间

#### Scenario: 查询包含不支持的组合
- **WHEN** 用户选择的数据源不支持某个 `period + adjust` 组合
- **THEN** 系统 SHALL 将对应 `symbol + period + adjust` 行标记为 `unsupported`，并 SHALL NOT 使用其他组合的缓存计算完整性

#### Scenario: 不同查询维度互不混用
- **WHEN** 同一 symbol 存在不同 `sourceId`、`period` 或 `adjust` 的缓存
- **THEN** 系统 SHALL 只使用与当前查询维度完全匹配的缓存计算完整性，并 SHALL NOT 混用不同数据源、周期或复权口径的数据

### Requirement: K 线缓存完整性基于成功覆盖区间
系统 SHALL 使用成功远端请求记录的覆盖区间计算缓存完整性，而不是用自然日或固定分钟间隔推断交易日缺口。

#### Scenario: 请求范围已完全覆盖
- **WHEN** 请求的 `startDate` 到 `endDate` 全部包含在已成功缓存的覆盖区间内，且缓存中存在有效 candles
- **THEN** 系统 SHALL 将该行标记为 `complete`，并返回覆盖该范围的缓存记录数

#### Scenario: 请求范围只有部分覆盖
- **WHEN** 请求范围只有一部分包含在已成功缓存的覆盖区间内
- **THEN** 系统 SHALL 将该行标记为 `partial`，并返回尚未成功缓存的 `missingRanges`

#### Scenario: 请求范围没有缓存
- **WHEN** 请求范围没有任何成功覆盖区间
- **THEN** 系统 SHALL 将该行标记为 `empty`，并返回完整请求范围作为缺失范围

#### Scenario: 最近刷新失败但已有旧缓存
- **WHEN** 最近一次刷新失败，但该 symbol 和 query 维度仍存在旧的成功覆盖区间
- **THEN** 系统 SHALL 保留旧缓存状态和覆盖信息，并额外返回最近失败原因与失败时间

### Requirement: K 线缓存支持手动批量刷新任务
系统 SHALL 支持用户手动对全部或选中的自选股执行历史 K 线缓存刷新，并在任务运行期间返回可轮询的进度状态。

#### Scenario: 用户启动批量刷新
- **WHEN** 用户在缓存管理弹窗中确认刷新全部组合或表格选中的组合
- **THEN** 系统 SHALL 按 `自选股 × 已选周期 × 已选复权` 或选中行集合创建缓存刷新任务，并返回 job id、总行数、已完成行数、当前组合、每行状态和任务状态

#### Scenario: 单个组合刷新失败
- **WHEN** 批量刷新中的某个 `symbol + period + adjust` 组合远端请求失败
- **THEN** 系统 SHALL 将该行标记为失败并记录错误原因，同时继续刷新队列中的后续组合

#### Scenario: 批量刷新包含不支持的组合
- **WHEN** 批量刷新队列中的某个 `period + adjust` 组合不被当前数据源支持
- **THEN** 系统 SHALL 将该组合行标记为 `unsupported` 并跳过远端请求，且 SHALL NOT 写入该 query 维度缓存

#### Scenario: 未选择周期或复权时查询或刷新
- **WHEN** 用户未选择任何周期或未选择任何复权口径并尝试查询或刷新
- **THEN** 系统 SHALL 阻止查询缓存状态或启动缓存刷新任务，并展示清晰的错误提示

#### Scenario: 用户取消批量刷新
- **WHEN** 用户取消正在运行的缓存刷新任务
- **THEN** 系统 SHALL 在当前远端请求结束后停止剩余队列，并保留已经成功写入的缓存数据

#### Scenario: 非用户触发场景
- **WHEN** 应用启动、缓存管理弹窗打开、watchlist 变化或当前图表刷新
- **THEN** 系统 SHALL NOT 自动启动自选股历史 K 线缓存刷新任务

### Requirement: K 线缓存数据可读取且可复现
系统 SHALL 提供按 `StockQuery` 读取已缓存 K 线数据的能力，供后续策略模块复用。

#### Scenario: 缓存范围完整时读取数据
- **WHEN** 调用方请求读取一个完整缓存范围
- **THEN** 系统 SHALL 返回与 `StockDataset` 兼容的 candles，且 candles SHALL 按时间升序排列并去除重复 `timeKey`

#### Scenario: 缓存范围不完整时读取数据
- **WHEN** 调用方请求读取一个不完整缓存范围
- **THEN** 系统 SHALL 返回清晰的不完整状态或错误，并包含 `missingRanges`，且 SHALL NOT 静默请求远端接口补齐数据

### Requirement: K 线缓存可按查询维度清理
系统 SHALL 允许用户清理表格选中的 `symbol + period + adjust` 组合缓存数据。

#### Scenario: 用户清理选中缓存
- **WHEN** 用户确认清理一个或多个表格选中的 `symbol + period + adjust` 组合缓存
- **THEN** 系统 SHALL 删除对应本地缓存 series，并在弹窗状态刷新后展示这些组合行的缺失状态

#### Scenario: 清理缓存不影响 watchlist
- **WHEN** 用户清理某个自选股的 K 线缓存
- **THEN** 系统 SHALL NOT 删除 watchlist 条目，也 SHALL NOT 改变当前图表数据

### Requirement: K 线缓存持久化可恢复
系统 SHALL 将缓存数据和覆盖元数据保存在本地应用数据目录，并在应用重启后恢复缓存状态。

#### Scenario: 应用重启后查看缓存状态
- **WHEN** 用户已经成功缓存历史 K 线数据并重启应用
- **THEN** 缓存管理弹窗 SHALL 展示重启前已成功缓存的覆盖范围和最近刷新时间

#### Scenario: 缓存文件损坏
- **WHEN** 某个缓存文件无法解析或不符合缓存格式
- **THEN** 系统 SHALL 将对应缓存视为不可用，返回清晰错误状态，并 SHALL NOT 阻止其他 symbol 的缓存状态查询
