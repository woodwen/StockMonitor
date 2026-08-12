# market-data-sources Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: Renderer 数据边界
系统 SHALL 通过 Electron main process 和 typed preload bridge 访问远端行情数据。Renderer 代码 SHALL NOT 直接请求远端股票行情接口。

#### Scenario: Renderer 请求 K 线数据
- **WHEN** renderer 需要 K 线行情数据
- **THEN** 它 SHALL 调用 preload bridge API，而不是直接 fetch 远端行情接口

#### Scenario: Renderer 请求分时数据
- **WHEN** renderer 需要分时行情数据
- **THEN** 它 SHALL 调用 preload bridge API，而不是直接 fetch 远端行情接口

### Requirement: 数据源能力可见且被强制执行
系统 SHALL 为支持的行情数据源维护能力元数据，并在市场、周期、复权或分时能力不支持时返回清晰错误。

#### Scenario: 用户测试数据源状态
- **WHEN** 用户打开数据源弹窗并测试数据源
- **THEN** 系统 SHALL 展示每个源的状态、请求耗时、返回记录数或清晰错误详情

#### Scenario: 查询超出数据源能力
- **WHEN** 当前数据源不支持请求的市场、周期、复权或视图类型
- **THEN** 系统 SHALL 在请求前或请求过程中返回数据源能力错误

### Requirement: 代理行为显式
系统 SHALL 默认让行情请求直连网络，并且 SHALL 只在用户明确启用并保存 SOCKS5 或 HTTP 代理配置后使用代理。

#### Scenario: 环境代理变量存在
- **WHEN** 环境代理变量存在但应用代理设置关闭
- **THEN** 行情请求 SHALL 保持直连，并且 SHALL NOT 静默使用这些环境变量

#### Scenario: 用户启用代理
- **WHEN** 用户保存已启用的代理配置
- **THEN** 后续行情测试和刷新 SHALL 使用已保存代理设置

### Requirement: Fallback 行为按视图类型收敛
系统 SHALL 保持 K 线和分时 fallback 行为显式，并按视图类型限定边界。

#### Scenario: 初始 K 线加载失败
- **WHEN** 默认 K 线源在初始加载时失败，且另一个兼容数据源可以提供数据
- **THEN** 系统 MAY fallback 到另一个兼容 K 线源，同时保留清晰的数据源状态

#### Scenario: 分时源失败
- **WHEN** 分时数据源失败
- **THEN** 系统 SHALL NOT 静默跨源 fallback 到另一个分时数据源

#### Scenario: 东方财富分时主机失败
- **WHEN** 东方财富分时主机访问失败且 delay 主机可用
- **THEN** 系统 MAY 通过东方财富 delay 主机进行同源 fallback
