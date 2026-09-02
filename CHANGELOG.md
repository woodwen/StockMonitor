# Changelog

本文件记录每个版本的主要更新内容。版本日期以对应 Git tag 的合并时间为准。

## Unreleased / 0.1.11

### Added

- 新增 AI 模型接入入口，支持 OpenAI-compatible HTTP provider；内置 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 预设，model 可通过可搜索下拉框选择或自定义输入，API key 支持直接粘贴和按钮粘贴。
- 新增手动 AI 分析弹窗，覆盖自然语言生成策略、回测报告解读、策略诊断、参数优化助手、自然语言智能选股、策略多周期/多股票对比、市场环境识别、每日复盘、新闻/公告 + K 线联合分析和实验性涨跌预测；默认上下文只发送当前证券，不携带自选股列表或其它股票样本。
- AI 分析新增实时内容反馈：HTTP provider 优先使用 OpenAI-compatible streaming，并兼容 provider token payload；不支持 streaming 时提示并回退为非流式最终结果，弹窗支持取消当前请求，最终 JSON 字符串会转成可读小节展示。

### Changed

- AI 分析入口、弹窗和说明文档标注为“测试中”，提示当前能力仍处于验证阶段。

### Security

- HTTP provider API key 改由 main process 凭据仓库处理；普通设置、renderer 响应、日志和本地备份不包含明文密钥、加密密文或 Authorization header，`safeStorage` 不可用时只保留本次会话临时 key。

## v0.1.10 - 2026-08-19

### Changed

- 应用重启加载保存的工作区时，会自动将 K 线日期范围滚动到启动当天，并保持原日期窗口长度；当前会话手动选择历史日期仍按用户设置使用。

## v0.1.9 - 2026-08-17

### Changed

- K 线和分时指标设置移除 `B/S` 指标项；K 线 `策略` 信号指标默认开启，并仅在存在选中成功策略回测结果时展示图表买入/卖出标记。
- K 线历史回测策略模板默认选择全部可用候选模板，用户仍可按需取消选择；默认全选仅代表候选模板默认参与比较。

### Docs

- 更新应用内使用说明书和 README，补充当前 K 线指标、分时指标及 12 个策略模板的意义、基本原理、前置数据和限制说明，并同步指标默认行为变化。

## v0.1.8 - 2026-08-14

### Added

- 自选股栏新增搜索筛选，可按名称、完整代码或裸代码快速过滤本地自选股，并在筛选结果内执行管理选择。
- K 线历史回测新增 8 个候选策略模板，覆盖均线多头排列、N 日新高突破、放量突破、布林带突破、布林带均值回归、KDJ 超卖反弹、ATR 趋势跟踪和缩量回踩均线，并展示模板类型、基本逻辑和推荐程度。
- 在 K 线指标中新增 `策略` 信号开关，默认关闭，并与默认开启的 `B/S` 信号互斥，避免图表同时展示两套买入/卖出标记。
- 历史 K 线缓存列表新增 `数据源` 列，按每行缓存 query 展示东方财富等数据源名称，未知源显示原始 `sourceId`。
- 新增本地缓存导入导出，支持将应用设置、自选股、做T测算设置和历史 K 线缓存备份为 JSON 文件，并从备份恢复本地数据。

### Changed

- 顶部工具栏调整为主操作直接可见、低频配置收入 `更多` 菜单：证券输入、自选、视图切换、K 线参数、刷新、指标、做T 和当前证券标题保持可见，数据源、代理、缓存导入导出、检查更新和启动检查更新改由 `更多` 访问。
- 策略回测不再单独设置开始日期和结束日期，统一使用顶部 K 线日期范围，并停止保存旧版独立回测区间。
- 历史 K 线缓存弹窗默认改为 `单只股票缓存`，每次打开只缓存当前证券且不记忆上次模式；默认仅勾选 `日线` 和 `前复权`，批量缓存需手动切换到 `多只股票缓存`。

### Fixed

- 修复完整 K 线缓存的首尾日期落在非交易日附近时，策略回测误报历史 K 线缓存未覆盖回测区间的问题。

### Docs

- 更新 README 和应用内使用说明书，补充顶部 `更多` 菜单、K 线指标信号开关、策略回测区间来源、缓存数据源列、历史 K 线缓存默认单只/日线前复权行为和风险说明。

## v0.1.7 - 2026-08-14

### Added

- 在帮助菜单新增离线 `版本更新说明`，用于查看当前安装包内置的 `CHANGELOG.md` 版本记录。
- 新增分时高级指标规划与第一版实现，支持 KDJ、量比、换手率、委比、内外盘、资金流的配置、可用性提示和数据缺失降级。
- 新增自选股历史 K 线缓存管理弹窗，支持按日线/周线/月线与前复权/不复权/后复权组合查看缓存完整情况、手动批量刷新、取消任务和按选中组合清理缓存。
- 新增 K 线历史回测策略面板，支持日线/周线/月线下比较均线交叉、突破回撤、RSI 超买超卖和 MACD 趋势确认等候选策略的历史收益、回撤、交易明细和图表信号。

### Fixed

- 修复发布后 changelog 未归档导致 `v0.1.4`、`v0.1.5`、`v0.1.6` 历史版本说明缺失的问题。

### Docs

- 更新应用内使用说明书、README 和掘金推广文章，补充自选股管理、历史 K 线缓存、K 线历史回测、做T盈亏测算、macOS 更新边界和风险提示。
- 新增自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测截图，用于 README 与推广文章展示。

## v0.1.6 - 2026-08-12

### Added

- 新增 K 线指标颜色、线型、显示精度配置，支持指标弹窗内实时预览，点击应用后再持久化保存。
- 新增 `做T` 盈亏测算面板，支持费用明细、ETF 免印花税、多笔记录、总盈亏和本地持久化。

### Fixed

- macOS 安装包暂未签名时，应用内更新不再尝试自动下载安装，改为打开 GitHub Release 下载页手动安装 DMG。

### Docs

- 新增做T盈亏测算方案文档，并同步 README 与应用内说明书。

## v0.1.5 - 2026-08-11

### Added

- 在帮助菜单新增离线 `使用说明书`，覆盖快速开始、分时、K 线、指标、自选股、数据源、网络代理、应用更新和常见问题。
- 新增本地自选股管理，支持单只/批量添加、剪切板粘贴、管理模式删除所选、点击切换和持久化恢复。

### Docs

- 新增帮助菜单使用说明书方案文档和 PR 记录。

## v0.1.4 - 2026-08-11

### Build

- 发版成功后自动在 `dev` 分支准备下一开发版本，`master` 保持已发布版本不变。

### Docs

- 新增 Codex 项目工程接入方案文档、中文仓库级 `AGENTS.md` 指令和本地 Codex 任务模板。

## v0.1.3 - 2026-08-11

### Fixed

- 修复 macOS 自动更新元数据缺少 ZIP 产物导致更新检查失败的问题。
- 优化更新失败弹窗文案，避免直接向用户展示 updater 内部 JSON。
- 修复启动 IPC 重复注册、更新代理复用以及下载更新无法取消或后台运行的问题。

### Build

- macOS 打包目标新增 `zip`，保留 `dmg` 用于手动安装。
- 固定安装包产物命名模板，避免 GitHub Release asset 名与更新元数据 URL 不一致。
- Release workflow 上传 macOS ZIP 产物，保证 `latest-mac.yml` 可被 `electron-updater` 使用。

### Docs

- 新增 macOS 自动更新 ZIP 产物修复方案文档。
- 更新 README 中的 macOS 打包说明。

## v0.1.2 - 2026-08-11

### Added

- 新增分时常用指标、B/S 信号、分时指标设置持久化，并补充 README 截图、免责声明和免费数据源致谢。

### Changed

- 将 package 版本预备为 `0.1.2`。
- 取消 `docs/spec/` 忽略规则，把本地 feature plan 和 PR 文档重新纳入仓库追踪。
- 更新全局 `project-commit-pr` 技能规则，后续使用该流程提交 PR 时会自动维护已有项目的 `CHANGELOG.md`。

### Build

- `master` 发版流程改为从 `CHANGELOG.md` 提取当前版本 release notes，并传给 GitHub Release。
- 新增 changelog release notes 提取脚本，缺少对应版本内容时会在发布前失败。
- 在 release workflow 的 validate 阶段增加 changelog release notes 校验。

### Docs

- 恢复远端行情源、工作区持久化、指标弹窗、发布自动化、应用图标、GitHub Releases 自动更新源等历史方案文档。
- 补齐各功能的 plan 和 PR 记录，便于后续追溯需求背景、实现范围、测试计划和风险项。

## v0.1.1 - 2026-08-10

### Changed

- 将自动更新说明统一为 GitHub Releases 发布源。
- 将 package 版本从 `0.1.0` 提升到 `0.1.1`，用于触发稳定 Release。

### Build

- 固定 `electron-updater` 的发布配置为 GitHub provider。
- 锁定自动更新源为 `woodwen/StockMonitor` 的 GitHub Releases。
- 新增打包配置测试，校验 GitHub 发布 provider、owner、repo 和 releaseType。

### Docs

- 更新 README 中的自动更新说明，明确更新元数据由 `electron-builder` 随安装包生成并作为 Release assets 上传。

## v0.1.0 - 2026-08-10

### Added

- 初始化跨平台股票行情桌面应用，采用 Electron、React、TypeScript、MobX MVVM、Ant Design 和 klinecharts。
- 接入东方财富、新浪财经、网易财经 163、腾讯/QQ 财经远端 K 线数据源，覆盖沪深京股票、ETF、指数的第一期查询能力。
- 新增数据源管理弹窗，支持测试数据源请求状态、错误详情、耗时和返回记录数，并可在弹窗内切换数据源。
- 新增 SOCKS5/HTTP 网络代理配置，保存后影响后续远端行情请求。
- 新增股票工作区设置持久化，支持恢复查询条件、数据源、周期、复权、日期范围和指标配置。
- 新增指标管理弹窗，支持 BOLL、MA、EMA、B/S、VOL、MACD、KDJ、RSI 的开关和参数配置。
- 新增副图指标上限规则，VOL、MACD、KDJ、RSI 最多同时开启 3 个。
- 新增分时行情视图，支持价格线、均价线、昨收参考线、右侧涨跌幅轴、成交量柱、十字线 tooltip 和午间休市空档压缩。
- 新增 K 线和分时视图切换，默认进入分时视图。
- 新增 K 线源和分时源独立保存能力，两个视图共享证券代码但互不覆盖数据源选择。
- 新增分时自动刷新，窗口可见且处于 A 股交易时段时每 15 秒静默刷新一次。
- 新增东方财富分时同源 host fallback，从 `push2.eastmoney.com` fallback 到 `push2delay.eastmoney.com`。
- 新增应用图标资源，覆盖 macOS、Windows、Linux 和运行时窗口图标场景。
- 新增应用内检查更新入口和启动检查更新配置。

### Changed

- 默认查询调整为分时视图、东方财富分时源、`sh000001`。
- K 线刷新保持手动触发，分时刷新拥有独立自动刷新链路。
- K 线和分时数据模型拆分，分别使用 `StockDataset` 和 `StockTimeshareDataset`。
- 分时视图只允许切换到声明支持分时的数据源；新浪财经、网易财经 163 继续作为 K 线源使用。
- 不再依赖本地行情文件导入，启动和刷新改为只走远端行情源。
- 默认远端请求不读取环境代理变量，避免系统环境代理隐式影响行情请求。
- 将股票标题从图表内部叠加层迁移到顶部工具栏，减少与 klinecharts 内置指标 legend 的视觉冲突。
- README 同步为当前远端行情、分时、指标、持久化、自动更新和发布流程说明。

### Fixed

- 修复图表标题与 BOLL 等指标 legend 重叠的问题。
- 修复和加强 K 线图表 adapter 的显示逻辑与回归测试。
- 修复 Linux AppImage 打包时从 scoped package name 派生出的可执行文件名不安全问题。
- 修复 Release workflow 中打包与校验职责耦合导致的发布失败风险。
- 修复 Linux AppImage 发布打包依赖和 toolset 配置问题。

### Build

- 新增 GitHub Actions Release workflow，用于校验版本、构建三端安装包、上传 GitHub Release assets，并发布 GitHub Package。
- 新增 release 版本检查脚本和单元测试，避免重复发布已存在 tag。
- 配置 `electron-builder` 的 macOS、Windows、Linux 打包图标和 Linux `executableName`。
- 配置仓库 homepage、repository、publishConfig 和 Electron Builder 发布相关元数据。
- 新增 package build 配置测试，锁定图标、仓库元数据、Linux AppImage 可执行文件名和发布配置。

### Docs

- 新增并整理功能 plan/PR 文档，记录远端行情、工作区持久化、指标管理、分时行情、发布自动化、图标配置等功能背景和验收范围。
- 曾将 `docs/spec/` 作为本地规格目录从 Git 跟踪中移除，后续在 `0.1.2` 中重新纳入追踪。
