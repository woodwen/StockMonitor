# Changelog

本文件记录每个版本的主要更新内容。版本日期以对应 Git tag 的合并时间为准。

## Unreleased / 0.1.2

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
