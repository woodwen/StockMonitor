## MODIFIED Requirements

### Requirement: 使用说明书覆盖当前用户工作流
系统 SHALL 维护离线 `使用说明书` 内容，使其覆盖当前主要用户操作入口、功能限制和常见问题，并随应用打包在当前窗口内可读。说明书 SHALL 覆盖 K 线和分时不再提供 `B/S` 指标选择、K 线 `策略` 信号指标默认开启、策略模板默认全选、策略回测日期范围来自外部 K 线日期范围、历史 K 线缓存默认单只股票缓存且默认只勾选日线前复权、批量缓存需要手动切换多只股票缓存的使用方式。说明书 SHALL 解释当前各指标以及各策略模板的意义、基本原理、前置数据和限制。

#### Scenario: 用户打开更新后的使用说明书
- **WHEN** 用户打开 `帮助 -> 使用说明书`
- **THEN** 说明书 SHALL 覆盖免责声明、快速开始、证券代码、分时视图、K 线视图、指标设置、自选股、K 线缓存、策略回测、做T测算、数据源、网络代理、应用更新和常见问题
- **AND** 说明书 SHALL 说明 K 线指标设置不再提供 `B/S` 指标项
- **AND** 说明书 SHALL 说明分时指标设置不再提供 `B/S` 指标项
- **AND** 说明书 SHALL 说明 K 线 `策略` 信号指标默认开启，且只有在存在选中成功策略回测结果时才会在图表展示策略买入/卖出标记
- **AND** 说明书 SHALL 说明策略模板默认全选，用户可以按需取消选择模板
- **AND** 说明书 SHALL 说明策略回测使用顶部 K 线日期范围，策略面板不再单独设置开始日期或结束日期
- **AND** 说明书 SHALL 说明历史 K 线缓存列表会展示每行对应的数据源名称
- **AND** 说明书 SHALL 说明历史 K 线缓存默认使用 `单只股票缓存`，每次打开弹窗都默认只针对当前证券且不记忆上次模式；用户可切换 `多只股票缓存` 后对当前自选股列表批量缓存
- **AND** 说明书 SHALL 说明历史 K 线缓存默认只勾选 `日线` 和 `前复权`，其他周期和复权口径需用户手动勾选
- **AND** 说明书 SHALL 说明 `刷新全部` 在单只模式只刷新当前证券，在多只模式刷新当前自选股列表

#### Scenario: 用户阅读 K 线指标说明
- **WHEN** 用户阅读使用说明书的指标设置章节
- **THEN** 说明书 SHALL 解释当前 K 线指标 `BOLL`、`MA`、`EMA`、`策略`、`VOL`、`MACD`、`KDJ` 和 `RSI` 的用途、基本计算原理、主要参数、前置数据和常见限制
- **AND** 说明书 SHALL NOT 把 `B/S` 描述为当前 K 线可配置指标

#### Scenario: 用户阅读分时指标说明
- **WHEN** 用户阅读使用说明书的分时指标说明
- **THEN** 说明书 SHALL 解释当前分时指标 `均价线`、`昨收线`、`MA`、`EMA`、`BOLL`、`成交量`、`VOL MA`、`量比`、`换手率`、`MACD`、`KDJ`、`RSI`、`委比`、`内外盘` 和 `资金流` 的用途、基本计算原理、主要参数、前置数据和常见限制
- **AND** 说明书 SHALL NOT 把 `B/S` 描述为当前分时可配置指标

#### Scenario: 用户阅读策略模板说明
- **WHEN** 用户阅读使用说明书的策略回测章节
- **THEN** 说明书 SHALL 逐一解释 `ma-cross`、`breakout-pullback`、`rsi-reversion`、`macd-trend-confirmation`、`ma-bullish-alignment`、`n-day-high-breakout`、`volume-breakout`、`bollinger-breakout`、`bollinger-mean-reversion`、`kdj-oversold-rebound`、`atr-trend-following` 和 `low-volume-ma-pullback` 的名称、类型、基本逻辑、信号原理、关键参数和限制
- **AND** 说明书 SHALL 说明策略模板默认全选只代表候选模板默认参与比较，不代表投资推荐

#### Scenario: 用户阅读高风险功能说明
- **WHEN** 说明书描述策略信号、策略回测、指标计算或做T测算
- **THEN** 文案 SHALL 明确这些内容是程序化计算、历史回测或费用盈亏估算，并 SHALL NOT 表述为投资建议、买卖建议、荐股服务或收益承诺

### Requirement: README 与用户文档同步
项目 SHALL 维护 `README.md` 的用户可见说明，使仓库首页与应用内说明书、推广文章和当前截图资产保持一致。README SHALL 描述 K 线和分时不再提供 `B/S` 指标选择、K 线 `策略` 信号指标默认开启、策略模板默认全选、策略回测日期范围来自外部 K 线日期范围、历史 K 线缓存默认单只股票缓存且默认只勾选日线前复权、批量缓存需要手动切换多只股票缓存的使用方式。

#### Scenario: 读者查看 README
- **WHEN** 读者阅读 `README.md`
- **THEN** README SHALL 描述当前分时、K 线、多数据源、指标、自选股、K 线缓存、策略回测、做T测算、网络代理、本地持久化、帮助入口和更新发布能力
- **AND** README SHALL 说明 K 线指标设置不再提供 `B/S` 指标项
- **AND** README SHALL 说明分时指标设置不再提供 `B/S` 指标项
- **AND** README SHALL 说明 K 线 `策略` 信号指标默认开启，且只有在存在选中成功策略回测结果时才会在图表展示策略买入/卖出标记
- **AND** README SHALL 说明策略模板默认全选，用户可以按需取消选择模板
- **AND** README SHALL 说明策略回测使用顶部 K 线日期范围，策略面板不再单独设置开始日期或结束日期
- **AND** README SHALL 说明历史 K 线缓存列表会展示每行对应的数据源名称
- **AND** README SHALL 说明历史 K 线缓存默认使用 `单只股票缓存`，每次打开弹窗都默认只针对当前证券且不记忆上次模式；用户可切换 `多只股票缓存` 后对当前自选股列表批量缓存
- **AND** README SHALL 说明历史 K 线缓存默认只勾选 `日线` 和 `前复权`，其他周期和复权口径需用户手动勾选
- **AND** README SHALL 说明 `刷新全部` 在单只模式只刷新当前证券，在多只模式刷新当前自选股列表

#### Scenario: README 展示截图
- **WHEN** README 展示用户界面截图
- **THEN** README SHALL 引用仓库内 `docs/assets/screenshots/` 下的稳定截图文件，并 SHALL 至少覆盖自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测场景

### Requirement: 文档同步进入 changelog
项目 SHALL 在 `CHANGELOG.md` 中记录本次用户文档和指标默认行为同步，便于发版说明追踪。

#### Scenario: 更新 changelog
- **WHEN** 实施本 change 的指标默认行为、策略默认选择和文档更新
- **THEN** `CHANGELOG.md` 的 `Unreleased / 0.1.9` 区块 SHALL 记录 K 线和分时 `B/S` 指标删除、K 线 `策略` 信号默认开启、策略模板默认全选，以及使用说明书指标/策略原理说明更新
