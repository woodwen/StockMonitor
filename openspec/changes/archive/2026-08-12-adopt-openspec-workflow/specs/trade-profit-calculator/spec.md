## ADDED Requirements

### Requirement: 做T测算是应用内旁路工具
系统 SHALL 提供应用内做T盈亏测算工具，该工具在工作区旁侧打开，并且不改变 active market chart view。

#### Scenario: 用户打开测算器
- **WHEN** 用户点击做T测算入口
- **THEN** 系统 SHALL 在当前窗口打开测算器，并且不切换当前分时或 K 线视图

#### Scenario: 用户使用测算器
- **WHEN** 用户输入测算值
- **THEN** 测算器 SHALL 只基于用户输入计算，并且 SHALL NOT 请求远端行情数据或执行交易

### Requirement: 测算遵循配置费用规则
系统 SHALL 根据配置的费率、最低佣金、股数和 ETF 标记计算买入金额、卖出金额、买入佣金、卖出佣金、印花税和盈亏。

#### Scenario: 非 ETF 测算
- **WHEN** 输入代表非 ETF 交易
- **THEN** 印花税 SHALL 根据卖出金额和印花税率计算

#### Scenario: ETF 测算
- **WHEN** 输入标记为 ETF
- **THEN** 印花税 SHALL 为零

#### Scenario: 佣金低于最低佣金
- **WHEN** 计算出的佣金低于配置的最低佣金
- **THEN** 测算器 SHALL 对该方向使用最低佣金

### Requirement: 测算设置本地持久化
系统 SHALL 本地持久化测算草稿输入和近期记录，normalize 非法设置，并限制保存记录数量。

#### Scenario: 用户新增记录
- **WHEN** 用户保存一条测算记录
- **THEN** 记录 SHALL 包含输入、结果、时间戳，以及可选的当前 symbol/name 快照

#### Scenario: 应用重启
- **WHEN** 应用在测算设置保存后重启
- **THEN** 有效草稿输入和近期记录 SHALL 被恢复

### Requirement: 测算文案避免投资建议
系统 SHALL 将测算输出描述为测算或估算，不得呈现买卖建议、交易推荐或收益保证。

#### Scenario: 新增用户可见测算文案
- **WHEN** 用户可见测算文案被修改
- **THEN** 文案 SHALL 避免投资建议、交易推荐和收益承诺
