## ADDED Requirements

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
