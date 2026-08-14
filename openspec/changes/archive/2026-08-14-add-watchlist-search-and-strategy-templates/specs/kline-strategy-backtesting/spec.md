## MODIFIED Requirements

### Requirement: K 线策略模板可发现且可参数化
系统 SHALL 提供 K 线策略模板 registry，用于展示可用模板、类型、基本逻辑、推荐程度、说明、参数、默认值、参数约束、最小样本数、兼容周期和信号解释。系统 SHALL 保留既有 `ma-cross`、`breakout-pullback`、`rsi-reversion` 和 `macd-trend-confirmation` 模板 id 的兼容性，并 SHALL 新增附件中的 8 个候选策略模板。策略周期范围 SHALL 限定为 `day`、`week`、`month`。推荐程度 SHALL 按附件星级固定为 1-5 的模板元数据，SHALL NOT 替代历史回测评分或排名。fresh settings SHALL 默认选中全部可用策略模板；已有用户设置 SHALL 保留已保存的可识别模板选择。

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
- **THEN** 系统 SHALL 使用 fresh settings 默认选中全部可用策略模板
- **AND** 默认选择 SHALL 同时包含既有模板和新增附件模板
- **AND** 系统 SHALL 为全部可用模板补齐默认参数

#### Scenario: 展示模板推荐程度
- **WHEN** 系统展示模板推荐程度或星级
- **THEN** 用户可见文案 SHALL 将其表达为模板元数据或候选策略参考
- **AND** 系统 SHALL NOT 将推荐程度表述为投资建议、买卖建议、收益承诺或未来表现保证
- **AND** 历史表现排名 SHALL 继续由回测评分决定，而不是由推荐程度决定

## ADDED Requirements

### Requirement: 附件策略模板信号逻辑
系统 SHALL 为附件 8 个新增策略模板实现确定性的买入/卖出策略信号生成。每个模板 SHALL 基于时间升序 candles 和 normalize 后的模板参数计算信号，且 SHALL 继续复用现有多头、单笔持仓、全仓回测执行规则。

#### Scenario: 均线多头排列触发信号
- **WHEN** `ma-bullish-alignment` 使用默认均线参数 `5`、`10`、`20`、`60` 运行
- **THEN** 系统 SHALL 在 `MA5 > MA10 > MA20 > MA60` 首次成立时生成 `buy` 信号
- **AND** 系统 SHALL 在多头排列失效或 `MA5` 下穿 `MA20` 时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含参与判断的均线值

#### Scenario: N 日新高突破触发信号
- **WHEN** `n-day-high-breakout` 使用默认突破观察窗口运行
- **THEN** 系统 SHALL 在收盘价突破过去 N 根 K 线最高价时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价跌破退出均线或跌回突破价下方时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含观察窗口高点、收盘价和退出参考值

#### Scenario: 放量突破触发信号
- **WHEN** `volume-breakout` 使用默认压力位窗口、成交量均线窗口和放量倍数运行
- **THEN** 系统 SHALL 在收盘价突破压力位且成交量达到成交量均线倍数阈值时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价跌破退出均线或突破参考位时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含压力位、成交量、成交量均线和放量倍数

#### Scenario: 布林带突破触发信号
- **WHEN** `bollinger-breakout` 使用默认 Bollinger 周期和标准差倍数运行
- **THEN** 系统 SHALL 在收盘价向上突破 Bollinger 上轨时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价跌回 Bollinger 中轨或上轨突破失效时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含上轨、中轨和收盘价

#### Scenario: 布林带均值回归触发信号
- **WHEN** `bollinger-mean-reversion` 使用默认 Bollinger 周期和标准差倍数运行
- **THEN** 系统 SHALL 在收盘价曾跌破下轨且随后重新回到 Bollinger 通道内时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价回到中轨或达到目标通道位置时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含下轨、中轨和收盘价

#### Scenario: KDJ 超卖反弹触发信号
- **WHEN** `kdj-oversold-rebound` 使用默认 RSV、K/D 平滑和超卖阈值运行
- **THEN** 系统 SHALL 在 K 线和 D 线均处于低位区域且 K 线上穿 D 线时生成 `buy` 信号
- **AND** 系统 SHALL 在 K 线下穿 D 线或进入高位区域后回落时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含 K、D 和超卖或高位阈值

#### Scenario: ATR 趋势跟踪触发信号
- **WHEN** `atr-trend-following` 使用默认趋势均线、ATR 周期和 ATR 倍数运行
- **THEN** 系统 SHALL 在趋势过滤条件成立且收盘价站上 ATR 动态止损参考时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价跌破 ATR 动态止损参考或趋势过滤条件失效时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含 ATR、动态止损参考和趋势过滤值

#### Scenario: 缩量回踩均线触发信号
- **WHEN** `low-volume-ma-pullback` 使用默认趋势均线、支撑均线和缩量阈值运行
- **THEN** 系统 SHALL 在上涨趋势中价格回踩 `MA20` 或 `MA60` 附近且成交量低于成交量均线阈值后重新走强时生成 `buy` 信号
- **AND** 系统 SHALL 在收盘价跌破支撑均线或上涨趋势失效时生成 `sell` 信号
- **AND** 信号解释 SHALL 包含趋势均线、支撑均线、成交量和成交量均线
