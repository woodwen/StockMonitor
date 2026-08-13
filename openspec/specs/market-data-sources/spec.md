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

### Requirement: 高级分时能力元数据
系统 SHALL 在行情数据源能力元数据中表达高级分时指标所需上下文的支持情况，包括分钟 OHLC、历史成交量、流通股本、盘口档位、逐笔方向和源端资金流聚合字段。能力元数据 SHALL 按数据源和适用市场范围区分支持、暂不支持或未知状态。第一版 SHALL 优先评估并支持东方财富高级上下文，腾讯作为后续补充验证源。

#### Scenario: 数据源声明高级分时能力
- **WHEN** renderer 通过 typed preload bridge 获取数据源列表
- **THEN** 每个数据源 SHALL 返回高级分时上下文能力，供工作区和指标设置判断指标可用性

#### Scenario: 数据源不支持高级上下文
- **WHEN** 当前数据源不支持某个高级分时上下文
- **THEN** 系统 SHALL 在请求前或数据返回后让依赖该上下文的指标保持不可用，并提供清晰原因

#### Scenario: 非优先数据源高级上下文
- **WHEN** 腾讯或其他非第一版优先数据源尚未确认某个高级分时上下文
- **THEN** 系统 SHALL 将对应能力声明为暂不支持或未知，而不是假定其与东方财富等价

### Requirement: 高级分时数据集补充前置上下文
系统 SHALL 在 `StockTimeshareDataset` 中以可选、规范化字段承载高级分时指标前置上下文。基础分时字段 SHALL 保持兼容；高级上下文缺失 SHALL NOT 使基础分时数据失败。

#### Scenario: 返回分钟 OHLC
- **WHEN** 数据源响应包含分钟级开盘价、最高价、最低价和收盘价
- **THEN** main process SHALL 将其规范化到分时点位的分钟 OHLC 字段，并只保留有限数值

#### Scenario: 返回历史成交量基准
- **WHEN** 数据源可提供历史成交量
- **THEN** main process SHALL 返回量比计算所需基准、样本范围和基准口径；默认基准 SHALL 使用最近 5 个有效交易日的日均每分钟成交量，若源提供同分钟累计历史基准则优先返回该口径

#### Scenario: 返回流通股本
- **WHEN** 数据源可提供流通股本
- **THEN** main process SHALL 返回正数流通股本，供换手率计算使用，并 SHALL NOT 用总股本填充流通股本字段

#### Scenario: 返回盘口数据
- **WHEN** 数据源可提供买卖盘口档位
- **THEN** main process SHALL 返回买卖前 5 档数量、买量合计、卖量合计、档位明细来源和对应时间

#### Scenario: 返回方向成交或资金流
- **WHEN** 数据源可提供逐笔方向、内外盘聚合字段或资金流聚合字段
- **THEN** main process SHALL 返回可区分来源的方向成交量、方向成交额、总流入、总流出或净流入值，且第一版 SHALL NOT 合成主力/散户或大单/小单资金流分层

#### Scenario: 高级上下文字段无效
- **WHEN** 数据源响应中的高级上下文字段缺失、非数值、负数或与证券类型不兼容
- **THEN** main process SHALL 丢弃无效字段并记录该上下文不可用原因，而不是返回误导性数值

#### Scenario: 高级上下文缓存
- **WHEN** 同一数据源、证券代码和交易日内重复刷新分时数据
- **THEN** 系统 SHALL 复用可缓存的历史成交量基准和流通股本，并 SHALL 随刷新更新盘口、逐笔方向、内外盘或资金流这类实时上下文

### Requirement: 高级分时数据获取遵守进程边界
系统 SHALL 继续通过 Electron main process 和 typed preload bridge 获取高级分时上下文。Renderer 代码 SHALL NOT 直接请求远端行情、盘口、逐笔或资金流接口。

#### Scenario: Renderer 需要高级分时上下文
- **WHEN** renderer 刷新分时数据或判断高级指标可用性
- **THEN** 它 SHALL 使用 `window.stockApi` 暴露的 typed API，而不是直接 fetch 远端接口

#### Scenario: 高级上下文请求失败
- **WHEN** 基础分时数据成功但某个高级上下文请求失败
- **THEN** 系统 SHALL 保留基础分时数据，标记受影响高级指标不可用，并展示该上下文失败原因

#### Scenario: 分时高级上下文 fallback
- **WHEN** 高级分时上下文不可用
- **THEN** 系统 SHALL NOT 静默跨数据源拼接高级上下文；同一数据源内的备用主机或等价接口 fallback MAY 被使用，并 SHALL 保留来源信息

### Requirement: K 线缓存请求遵守进程边界
系统 SHALL 通过 Electron main process 和 typed preload bridge 查询、刷新和读取 K 线缓存。Renderer 代码 SHALL NOT 直接请求远端行情接口来填充缓存。

#### Scenario: Renderer 查询缓存状态
- **WHEN** renderer 需要展示自选股 K 线缓存状态
- **THEN** 它 SHALL 调用 `window.stockApi` 暴露的 typed cache API，而不是直接读取缓存文件或请求远端行情接口

#### Scenario: Renderer 启动缓存刷新
- **WHEN** renderer 需要批量刷新自选股 K 线缓存
- **THEN** 它 SHALL 调用 typed preload bridge，由 main process 复用远端行情源 adapter 执行请求

### Requirement: K 线缓存请求复用数据源能力和代理设置
系统 SHALL 对缓存刷新请求执行与普通 K 线查询一致的数据源能力校验，并复用已保存网络代理设置。

#### Scenario: 缓存查询超出数据源能力
- **WHEN** 用户尝试缓存当前数据源不支持的市场、周期或复权组合
- **THEN** 系统 SHALL 在对应 `symbol + period + adjust` 缓存行返回 `unsupported` 或清晰错误，且 SHALL NOT 写入该 query 维度缓存

#### Scenario: 用户启用代理后刷新缓存
- **WHEN** 用户已保存启用的 SOCKS5 或 HTTP 代理配置并启动缓存刷新
- **THEN** 缓存刷新请求 SHALL 使用已保存代理设置，与普通 K 线刷新保持一致

### Requirement: K 线缓存刷新不静默跨源 fallback
系统 SHALL 保持缓存 key 的数据源语义稳定。缓存刷新失败时 SHALL NOT 静默跨数据源 fallback 到另一个 K 线源写入缓存。

#### Scenario: 指定数据源刷新失败
- **WHEN** 指定 `sourceId` 的缓存刷新请求失败，且其他数据源可能可以返回同一 symbol 的 K 线数据
- **THEN** 系统 SHALL 将该缓存行标记为失败，并 SHALL NOT 用其他数据源结果填充当前 `sourceId` 的缓存

#### Scenario: 同源备用主机可用
- **WHEN** 同一数据源内部存在等价备用主机或等价接口 fallback
- **THEN** 系统 MAY 复用该同源 fallback，但 SHALL 保留原始 `sourceId` 和来源信息
