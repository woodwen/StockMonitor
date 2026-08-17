## MODIFIED Requirements

### Requirement: K 线策略模板可发现且可参数化
系统 SHALL 提供 K 线策略模板 registry，用于展示可用模板、类型、基本逻辑、推荐程度、说明、参数、默认值、参数约束、最小样本数、兼容周期和信号解释。系统 SHALL 保留既有 `ma-cross`、`breakout-pullback`、`rsi-reversion` 和 `macd-trend-confirmation` 模板 id 的兼容性，并 SHALL 保留附件中的 8 个候选策略模板。策略周期范围 SHALL 限定为 `day`、`week`、`month`。推荐程度 SHALL 按附件星级固定为 1-5 的模板元数据，SHALL NOT 替代历史回测评分或排名。fresh/default settings SHALL 默认选中全部可用策略模板；已有用户设置 SHALL 保留已保存的可识别非空模板选择，设置缺失、无效、全部未知或过滤后为空时 SHALL 回落为全部可用策略模板。

新增模板 SHALL 至少包含以下元数据：

| id | 策略模板 | 类型 | 基本逻辑 | 推荐程度 |
| --- | --- | --- | --- | --- |
| `ma-bullish-alignment` | 均线多头排列 | 趋势 | `MA5 > MA10 > MA20 > MA60` | 5 |
| `n-day-high-breakout` | N 日新高突破 | 趋势/突破 | 收盘突破过去 N 日最高价 | 5 |
| `volume-breakout` | 放量突破 | 量价 | 突破压力位 + 成交量明显放大 | 5 |
| `bollinger-breakout` | 布林带突破 | 波动/趋势 | 收盘突破 Bollinger 上轨 | 4 |
| `bollinger-mean-reversion` | 布林带均值回归 | 反转 | 跌破下轨后重新回到通道 | 4 |
| `kdj-oversold-rebound` | KDJ 超卖反弹 | 反转 | K/D 低位金叉 | 3 |
| `atr-trend-following` | ATR 趋势跟踪 | 趋势/波动 | ATR 动态止损 + 趋势持有 | 5 |
| `low-volume-ma-pullback` | 缩量回踩均线 | 趋势回撤 | 上涨趋势中缩量回踩 MA20/MA60 | 5 |

#### Scenario: 用户查看策略模板
- **WHEN** 用户打开 K 线策略面板
- **THEN** 系统 SHALL 展示可用策略模板的名称、类型、基本逻辑、推荐程度、说明、参数、默认值、最小样本数和兼容 K 线周期
- **AND** 新增附件模板 SHALL 与既有模板一起可被选择和取消选择

#### Scenario: 用户修改策略参数
- **WHEN** 用户编辑策略模板参数
- **THEN** 系统 SHALL 对参数执行 normalize 和校验，并在参数超出模板约束时展示清晰错误

#### Scenario: 模板不兼容当前周期
- **WHEN** 当前 K 线周期不被某个策略模板支持
- **THEN** 系统 SHALL 将该模板标记为不可运行，并 SHALL 展示不兼容原因

#### Scenario: 分钟 K 线周期
- **WHEN** 当前 K 线周期为 `5`、`15`、`30` 或 `60`
- **THEN** 系统 SHALL 将策略回测标记为暂不支持当前周期，并 SHALL NOT 运行策略模板

#### Scenario: 读取旧版策略偏好
- **WHEN** 已保存策略回测偏好包含既有模板 id、参数或已选择模板集合
- **THEN** 系统 SHALL 保留仍被 registry 支持的既有模板 id 和参数含义
- **AND** 系统 SHALL NOT 将既有模板 id 静默改写为新增附件模板 id
- **AND** 系统 SHALL 过滤未知模板 id 并补齐新增模板的默认参数

#### Scenario: 新用户默认模板选择
- **WHEN** 用户尚未保存任何策略回测偏好并首次打开 K 线策略面板
- **THEN** 系统 SHALL 使用 fresh/default settings 默认选中全部可用策略模板
- **AND** 默认选择 SHALL 同时包含既有模板和新增附件模板
- **AND** 系统 SHALL 为全部可用模板补齐默认参数

#### Scenario: 策略模板选择缺失或无效
- **WHEN** 已保存策略回测偏好缺少 `selectedTemplateIds`，或 `selectedTemplateIds` 无效、全部未知、过滤后为空
- **THEN** 系统 SHALL 默认选中全部可用策略模板
- **AND** 系统 SHALL 为全部可用模板补齐默认参数

#### Scenario: 已保存有效模板选择
- **WHEN** 已保存策略回测偏好包含可识别的非空模板选择
- **THEN** 系统 SHALL 保留这些可识别模板选择
- **AND** 系统 SHALL 过滤未知模板 id

#### Scenario: 展示模板推荐程度
- **WHEN** 系统展示模板推荐程度或星级
- **THEN** 用户可见文案 SHALL 将其表达为模板元数据或候选策略参考
- **AND** 系统 SHALL NOT 将推荐程度表述为投资建议、买卖建议、收益承诺或未来表现保证
- **AND** 历史表现排名 SHALL 继续由回测评分决定，而不是由推荐程度决定
