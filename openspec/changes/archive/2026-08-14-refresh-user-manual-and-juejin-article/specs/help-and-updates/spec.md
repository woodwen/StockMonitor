## ADDED Requirements

### Requirement: 使用说明书覆盖当前用户工作流
系统 SHALL 维护离线 `使用说明书` 内容，使其覆盖当前主要用户操作入口、功能限制和常见问题，并随应用打包在当前窗口内可读。

#### Scenario: 用户打开更新后的使用说明书
- **WHEN** 用户打开 `帮助 -> 使用说明书`
- **THEN** 说明书 SHALL 覆盖免责声明、快速开始、证券代码、分时视图、K 线视图、指标设置、自选股、K 线缓存、策略回测、做T测算、数据源、网络代理、应用更新和常见问题

#### Scenario: 用户阅读高风险功能说明
- **WHEN** 说明书描述 B/S 信号、策略回测或做T测算
- **THEN** 文案 SHALL 明确这些内容是程序化计算、历史回测或费用盈亏估算，并 SHALL NOT 表述为投资建议、买卖建议、荐股服务或收益承诺

### Requirement: 推广文章与当前产品能力同步
项目 SHALL 维护 `docs/promotion/juejin-stock-monitor-article.md`，使其对外描述与当前产品能力、架构边界、发布策略、测试覆盖和协作流程保持一致。

#### Scenario: 读者查看推广文章
- **WHEN** 读者阅读 `docs/promotion/juejin-stock-monitor-article.md`
- **THEN** 文章 SHALL 描述当前分时、K 线、多数据源、指标、自选股、K 线缓存、策略回测、做T测算、网络代理、本地持久化和更新发布能力

#### Scenario: 文章描述工程流程
- **WHEN** 文章描述 Codex 协作开发流程
- **THEN** 文章 SHALL 使用当前 OpenSpec change、实现、测试、文档和 changelog 同步流程，避免继续把 legacy `docs/spec/feature/YYYYMM/*` 作为默认新规格落点

#### Scenario: 文章描述发布和更新
- **WHEN** 文章描述自动更新或安装方式
- **THEN** 文章 SHALL 区分 GitHub Releases 发布、macOS `dmg`/`zip` 产物、未签名 macOS 构建手动下载 DMG 安装和正式签名发布待完善状态

### Requirement: README 与用户文档同步
项目 SHALL 维护 `README.md` 的用户可见说明，使仓库首页与应用内说明书、推广文章和当前截图资产保持一致。

#### Scenario: 读者查看 README
- **WHEN** 读者阅读 `README.md`
- **THEN** README SHALL 描述当前分时、K 线、多数据源、指标、自选股、K 线缓存、策略回测、做T测算、网络代理、本地持久化、帮助入口和更新发布能力

#### Scenario: README 展示截图
- **WHEN** README 展示用户界面截图
- **THEN** README SHALL 引用仓库内 `docs/assets/screenshots/` 下的稳定截图文件，并 SHALL 至少覆盖自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测场景

### Requirement: 文档截图资产可复用
项目 SHALL 将用户提供的文档截图保存为仓库内可复用资产，避免 README 或推广文章依赖本机绝对路径。

#### Scenario: 实施截图同步
- **WHEN** 实施本 change 的截图更新
- **THEN** 系统 SHALL 将 `/Users/mac/Downloads/自选股管理.png`、`/Users/mac/Downloads/历史K线缓存.png`、`/Users/mac/Downloads/做T盈亏测算.png` 和 `/Users/mac/Downloads/K线历史回测.png` 复制到 `docs/assets/screenshots/` 下的 ASCII 稳定文件名

#### Scenario: 文档引用截图
- **WHEN** README 或推广文章引用这些新增截图
- **THEN** 文档 SHALL 使用仓库内相对路径，并 SHALL NOT 引用 `/Users/mac/Downloads/*`

### Requirement: 文档同步进入 changelog
项目 SHALL 在 `CHANGELOG.md` 中记录本次用户文档和截图同步，便于发版说明追踪。

#### Scenario: 更新 changelog
- **WHEN** 实施本 change 的文档更新
- **THEN** `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块 SHALL 记录使用说明书、README、推广文章和截图同步

### Requirement: 用户文档遵守产品安全文案边界
系统 SHALL 在应用内说明书、README、推广文章和 changelog 中使用一致的产品安全文案边界，不得暗示应用提供投资建议、交易建议、荐股服务、收益承诺或真实成交能力。

#### Scenario: 文档提及行情数据
- **WHEN** 说明书或推广文章提及远端行情数据
- **THEN** 文档 SHALL 说明数据来自公开网页接口或第三方服务，可能存在延迟、缺失、错误、接口变更、访问受限或服务不可用

#### Scenario: 文档提及策略或收益
- **WHEN** 说明书或推广文章提及策略回测、B/S 信号、收益率、盈亏或排名
- **THEN** 文档 SHALL 使用历史表现、估算、计算结果或候选策略等描述，并 SHALL NOT 承诺未来表现或引导用户按文档买入卖出
