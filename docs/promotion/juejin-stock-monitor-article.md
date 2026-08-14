# 掘金推广文章：Stock Monitor

## 标题备选

1. 我用 Electron + React 做了一个跨平台 A 股行情桌面应用
2. 做了一个开源股票行情桌面应用：分时、K 线、自选股、缓存和策略回测
3. 从 0 到可发布：用 Electron 打造一款股票行情桌面工具
4. 我用 Codex + OpenSpec 协作开发了一个 Electron 股票行情桌面应用

## 推荐标签

`Electron`、`React.js`、`TypeScript`、`Codex`、`OpenSpec`、`桌面端`、`开源`

## 封面文案

Stock Monitor：用 Codex 协作开发的跨平台股票行情桌面应用，支持分时、K 线、多数据源、自选股、K 线缓存、历史回测、做T测算和自动更新。

## 正文

# 我用 Codex 协作开发了一个 Electron + React 股票行情桌面应用

最近做了一个开源小项目：[Stock Monitor](https://github.com/woodwen/StockMonitor)。

它是一个跨平台股票行情桌面应用，基于 `Electron + React + TypeScript + MobX MVVM` 实现，当前支持 A 股分时、K 线、多数据源切换、指标配置、自选股管理、历史 K 线缓存、K 线历史回测、做T盈亏测算、网络代理、本地持久化和 GitHub Releases 自动更新。

这个项目还有一个特点：主要开发过程是我和 Codex 协作完成的。不是让 AI 一次性生成一个 demo，而是把它放进真实开发流程里：用 OpenSpec 拆需求，读代码，做实现，补测试，更新文档，整理 changelog，再进入下一轮迭代。

先放一句免责声明：这个项目只用于个人学习、技术研究和行情展示验证，不构成任何投资建议、交易建议、荐股服务或收益承诺。应用里的数据来自公开网页接口或第三方服务，可能有延迟、缺失、错误、接口变更、访问受限或服务不可用，所有指标、B/S 信号、策略回测和做T测算都只是程序化计算或历史估算结果。

## 为什么做这个项目

我最初只是想要一个轻量的行情桌面窗口：不用打开一堆网页，不依赖某个平台的完整客户端，也不需要复杂交易功能，只想快速看当日分时、历史 K 线、成交量和常用技术指标。

但真正做起来之后，发现这里面有几个挺典型的工程问题：

- 免费行情接口没有稳定 SLA，必须支持多数据源和能力检测。
- K 线和分时不是同一种数据模型，不能硬塞到一套状态里。
- Electron 桌面应用要处理 main、preload、renderer 三端边界。
- 图表指标、缓存、策略回测不能只靠 UI 开关，参数校验、持久化和回归测试也要补上。
- 桌面应用发布后还要考虑自动更新、打包配置和跨平台安装包。

所以这个项目不只是一个“行情页面”，更像是一次完整的 Electron 桌面应用实战。

## Codex 是怎么参与开发的

这次我没有把 Codex 当成“写一段代码”的工具，而是把它当成一个可以持续协作的 coding agent。每一轮功能开发基本按这个节奏走：

1. 先描述目标和约束，比如“接入远端行情源”“分时和 K 线数据源要独立保存”“新增分时指标但不能影响 K 线指标配置”。
2. Codex 先读仓库里的代码、README、测试和已有规格文档，确认当前架构。
3. 对复杂功能，先用 OpenSpec change 写 proposal、design、specs 和 tasks，明确范围、状态流、数据结构、测试点和风险。
4. 开始实现时，Codex 按现有模块边界改代码：main process 处理远端数据，preload 暴露 typed bridge，renderer 里继续按 View / ViewModel / Model / Adapter 拆分。
5. 每个功能完成后补对应测试，再跑 `yarn test`、`yarn typecheck`、`yarn build` 做验证。
6. 最后更新 README、应用内使用说明书、截图说明、OpenSpec tasks 和 `CHANGELOG.md`，确保代码和说明同步。

这个流程对我最有价值的地方是：Codex 不只是“补全代码”，它能在已有代码风格里继续工作，并且把实现、测试和文档一起收口。

举几个项目里的真实迭代例子。

第一个是远端行情源。最开始项目还保留过本地行情文件解析，后来改成只走远端数据源。这里 Codex 先把东方财富、新浪财经、网易财经 163、腾讯/QQ 财经封装到 main process 的数据源注册表里，再把不同接口返回的数据统一成 `StockDataset`。后续加分时能力时，又拆出 `StockTimeshareDataset`，避免把分时数据硬塞进 K 线模型。

第二个是分时视图。分时不是简单画一条线，还要处理昨收线、均价线、成交量、涨跌幅轴、午间休市空档、十字线 tooltip 和自动刷新。Codex 在这一轮里把查询状态放在 ViewModel，把指标计算放在 model，把 Canvas 绘制放进 adapter，然后补了分时图相关测试。

第三个是指标系统。K 线已经有 BOLL、MA、EMA、VOL、MACD、KDJ、RSI 和 B/S 信号，分时又有另一套 MA、EMA、BOLL、VOL MA、MACD、RSI 和 B/S。这里如果只堆 UI 开关，很快会失控。Codex 按“指标定义 -> 参数校验 -> 指标计算 -> ViewModel 草稿状态 -> 弹窗 UI -> 持久化 -> 测试”的顺序推进，让 K 线和分时指标互不污染。

第四个是自选股和历史 K 线缓存。自选股不是一个简单数组，还要处理批量粘贴、去重、管理模式、点击切换和本地持久化；历史 K 线缓存又要按 `sourceId + symbol + period + adjust` 隔离数据，展示缓存范围、缺失范围、刷新任务和清理操作。这里 Codex 按 main/preload/renderer 边界补了缓存服务、IPC、ViewModel 和测试。

第五个是策略回测。这个功能很容易写成“推荐股票”或“提示买卖”，所以我把边界限定在“候选策略在历史区间里的表现排名”。策略模板、信号生成、交易撮合、收益回撤计算都放在纯 model，ViewModel 负责读取缓存和编排状态，UI 只展示历史结果和限制说明。

第六个是发布链路。应用已经配置了 `electron-builder`、GitHub Releases 和 `electron-updater`。后来又补了一段 release notes 提取流程：发版时从 `CHANGELOG.md` 读取当前版本说明，缺少对应版本内容就提前失败。这类脚本和测试也很适合交给 Codex 做，因为边界明确、验证明确。

在这个过程中，我的角色更像是控制方向和验收：决定功能取舍、确认数据口径、检查交互是否合理、把不该做的范围砍掉。Codex 更适合承担那些需要持续读上下文、跨文件修改、补测试和更新文档的工程性工作。

## 当前能做什么

Stock Monitor 默认进入分时视图，默认数据源是东方财富，默认证券代码是 `sh000001`。

![分时首页](../assets/screenshots/timeshare-home.png)

分时视图当前支持：

- 当日分时价格线、均价线、昨收参考线
- 右侧涨跌幅轴
- 单分钟成交量柱
- 主图、成交量区、副图区图例
- 十字线和 tooltip
- 午间休市空档压缩
- 分时 MA、EMA、BOLL、VOL MA、MACD、RSI
- 基于快慢 EMA 交叉的 B/S 信号
- A 股交易时段内每 15 秒静默刷新

也可以切换到 K 线视图：

![K 线首页](../assets/screenshots/kline-home.png)

K 线视图支持日线、周线、月线和 5/15/30/60 分钟周期，支持不复权、前复权、后复权。主图可以叠加 BOLL、MA、EMA 和 B/S 信号，副图支持 VOL、MACD、KDJ、RSI，最多同时开启 3 个副图指标。

自选股管理放在左侧栏：

![自选股管理](../assets/screenshots/watchlist-management.png)

这里支持单只添加、批量粘贴、管理模式删除所选和点击切换证券。K 线模式下，自选股栏还能打开历史 K 线缓存：

![历史 K 线缓存](../assets/screenshots/kline-cache-management.png)

缓存弹窗会按自选股、周期、复权和日期范围展开组合，显示缓存状态、记录数、缓存范围、缺失范围和刷新任务进度。这个缓存能力也给后面的策略回测提供可复现的数据输入。

K 线历史回测面板如下：

![K 线历史回测](../assets/screenshots/kline-strategy-backtesting.png)

第一版只支持日线、周线和月线，内置均线交叉、突破回撤、RSI 超买超卖和 MACD 趋势确认四类候选策略。它展示的是所选区间内的历史信号和表现排名，不代表未来表现，也不是买卖建议。

做T盈亏测算是另一个本地工具：

![做T盈亏测算](../assets/screenshots/trade-profit-calculator.png)

它基于用户输入的买入价、卖出价、股数、手续费、印花税和最低佣金估算费用明细、本次盈亏和多笔记录汇总。测算结果不代表真实成交结果。

## 多数据源不是简单换 URL

项目当前接入了四类公开行情源：

| 数据源 | K 线 | 分时 | 备注 |
| --- | --- | --- | --- |
| 东方财富 | 支持 | 支持 | 默认主源，分时支持同源 host fallback |
| 腾讯/QQ 财经 | 支持 | 支持 | K 线和分时备用源 |
| 新浪财经 | 支持 | 不支持 | 适合作为 K 线分钟线备用源 |
| 网易财经 163 | 支持 | 不支持 | 当前作为 K 线日线备用源 |

这里一个关键点是：K 线数据源和分时数据源是拆开保存的。

原因很简单：有的数据源支持 K 线，但不支持分时；有的数据源支持日线，但不支持复权或分钟线。如果把所有选择都混在一个 `sourceId` 里，用户在 K 线视图切了新浪财经，回到分时视图就可能变成一个不可用状态。

所以项目里把它们拆成两套配置：

```ts
interface WorkspaceSettings {
  viewMode?: 'kline' | 'timeshare'
  timeshareSourceId?: StockQuery['sourceId']
  query: StockQuery
  indicatorSettings?: IndicatorSettingsMap
  timeshareIndicatorSettings?: TimeshareIndicatorSettingsMap
  klineStrategySettings?: KlineStrategySettings
  watchlist?: WatchlistItem[]
}
```

K 线使用 `workspace.query.sourceId`，分时使用 `workspace.timeshareSourceId`。两者共享证券代码，但不会互相覆盖数据源选择。

数据源弹窗也会按当前视图做测试：

![分时数据源](../assets/screenshots/timeshare-data-sources.png)

在分时模式下，不支持分时的数据源会被明确标记出来，避免用户误切。K 线模式下，则会按当前证券代码、周期、复权和日期范围测试各源返回情况。

## 架构：Electron 三端边界要清楚

项目采用比较标准的 Electron 三端结构：

```text
Electron Main
  - 窗口、菜单
  - 远端 K 线/分时数据源 clients
  - 数据源注册表
  - 本地配置、网络代理、日志
  - 自动更新
  - IPC handlers

Preload
  - window.stockApi typed bridge

Renderer
  - View: React + Ant Design
  - ViewModel: MobX class
  - Model: K 线/分时行情数据、指标计算
  - Adapter: Electron 数据桥、klinecharts、Canvas 分时图、自动更新状态
```

远端请求统一放在 Electron main process，renderer 不直接访问远端行情接口，只通过 preload 暴露的 `window.stockApi` 调用。

这样做有几个好处：

- 网络请求、代理、编码转换、日志都集中在 main process。
- renderer 保持成一个普通 React 应用，更容易测试和维护。
- preload 只暴露明确的 typed bridge，边界更清楚。
- 后续如果替换正式数据服务，图表层和指标层不需要大改。

## MVVM：让 UI 少管流程

前端部分用了 `React + MobX`，整体按 MVVM 拆分：

- View 只负责展示和触发命令。
- ViewModel 负责状态、查询条件、加载流程、刷新流程和配置保存。
- Model 负责纯业务逻辑，例如指标定义、参数校验和指标计算。
- Adapter 负责外部依赖，例如 Electron IPC、`klinecharts` 和 Canvas 分时图。

这个结构对行情应用比较合适。

例如用户点击“刷新”，View 不需要知道当前是分时还是 K 线，也不需要知道应该走哪个接口。ViewModel 会根据当前 `viewMode` 分发到对应查询流程，然后把结果归一化并推给图表 ViewModel。

K 线返回后会进入 `StockDataset`，分时返回后会进入 `StockTimeshareDataset`。两类数据分别计算指标，再交给对应的图表 adapter 渲染。

## 分时图为什么用 Canvas 自己画

K 线图表使用的是 `klinecharts`，但分时图我选择用 Canvas 自己实现。

原因是分时视图里有一些比较定制的展示要求：

- 主图、成交量区、副图区需要动态组合。
- 午间休市空档需要压缩。
- 鼠标所在区域不同，tooltip 展示的指标也不同。
- B/S 信号需要命中检测和悬浮提示。
- 成交量、VOL MA、MACD、RSI 要跟分时价格共用同一套横轴。

这些东西用通用图表库也能做，但会把大量逻辑藏到图表配置里。自己用 Canvas 实现后，数据、布局、指标和交互的责任更清晰，也方便写针对性的回归测试。

分时指标设置如下：

![分时指标设置](../assets/screenshots/timeshare-indicators.png)

分时指标和 K 线指标也是独立保存的。K 线有 KDJ，但分时当前没有分钟 OHLC、流通股本、盘口或逐笔方向数据，所以暂时不实现 KDJ、量比、换手率、委比、内外盘和资金流等需要额外数据口径的指标。

这个取舍很重要：不要为了“功能看起来多”去拼凑口径不清楚的指标。

## 指标系统：开关只是最表层

指标弹窗不只是几个 checkbox。

项目里每个指标都有自己的定义、默认参数、参数范围和校验规则。比如：

- 周期类参数必须是 `1-250` 的整数。
- `MACD` 要求快线小于慢线。
- B/S 信号同样要求快线小于慢线。
- K 线副图最多同时开启 3 个。
- 分时副图最多同时开启 2 个。
- 关闭指标后不能留下重复 overlay 或残留标记。

K 线指标设置：

![K 线指标设置](../assets/screenshots/kline-indicators.png)

这些规则看起来琐碎，但它们会直接影响用户体验。如果指标参数可以随便填，或者重复切换后图表上叠出一堆重复标记，整个工具很快就不可用了。

## 网络代理和本地持久化

行情接口经常会受网络环境影响，所以项目内置了 SOCKS5/HTTP 代理配置。

![网络代理配置](../assets/screenshots/network-proxy.png)

一个刻意的设计是：默认直连，不读取 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY` 环境变量。

这么做是为了避免开发机、CI 或用户系统环境里的代理变量隐式影响行情请求。用户需要代理时，在应用里显式开启并配置地址和端口。

本地配置通过 `electron-store` 保存，目前包括：

- 当前视图
- K 线查询条件
- 分时数据源
- K 线指标配置
- 分时指标配置
- K 线策略模板、参数、回测区间和回测假设
- 自选股列表
- 网络代理配置
- 是否启动后检查更新
- 做T测算草稿和最近记录

历史 K 线缓存则保存到本地应用数据目录。也就是说，用户关掉应用再打开，之前的工作区状态、自选股、策略偏好和做T草稿会被恢复；缓存数据也可以继续用于后续查询和回测。

## 自动更新和发布

桌面应用做完功能还不够，发布链路也要补齐。

项目使用 `electron-builder` 打包：

- macOS：`dmg` + `zip`
- Windows：`nsis`
- Linux：`AppImage`

自动更新使用 `electron-updater`，发布源配置为 GitHub Releases。工具栏和帮助菜单都有“检查更新”入口，也可以开启启动后自动检查更新。

macOS 这里有一个现实限制：当前构建在完成 Developer ID 签名和 notarization 前，不执行应用内自动安装。检查到新版本时会打开 GitHub Release 下载页，由用户手动下载 DMG 安装。正式签名后，macOS 自动更新仍需要同时上传 `dmg` 和 `zip`，其中 `zip` 供 `electron-updater` 安装更新使用。

当前 release 流程还会从 `CHANGELOG.md` 提取对应版本的 release notes，避免发布说明和项目变更脱节。

## 测试覆盖

这个项目里不少逻辑都适合用单元测试保护，例如：

- 远端数据源元信息、请求归一化、能力校验和网络错误透传
- 东方财富分时解析和同源 host fallback
- 腾讯/QQ 财经分时解析
- 不支持分时的数据源拦截
- K 线指标定义、参数校验、旧配置迁移
- 分时指标定义、参数校验、副图数量限制
- K 线和分时指标计算
- 工作区配置持久化、默认分时启动、分时/K 线源独立
- 自选股管理、批量粘贴、管理模式和本地恢复
- K 线缓存状态、批量刷新、取消任务、读取缓存 dataset 和清理缓存
- K 线策略模板、参数校验、历史信号生成、交易撮合、收益回撤指标和历史表现排名
- 做T盈亏测算费用规则、记录管理和持久化
- Canvas 分时图午间休市压缩、tooltip、B/S 标记和动态副图区

常用验证命令：

```bash
yarn test
yarn typecheck
yarn build
```

对桌面应用来说，测试不是为了追求覆盖率数字，而是保护那些“看起来不起眼，但一坏就很难排查”的状态流和边界规则。

## 快速体验

项目地址：

[https://github.com/woodwen/StockMonitor](https://github.com/woodwen/StockMonitor)

本地开发启动：

```bash
git clone https://github.com/woodwen/StockMonitor.git
cd StockMonitor
yarn install
yarn dev
```

如果 Electron 二进制下载不完整，可以切换镜像后重新安装：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
yarn dev
```

## 后续计划

后面可能继续补这些方向：

- 更完整的交易日历，避免节假日误刷新。
- 更多稳定数据源或可插拔数据源配置。
- 更细的 UI 视觉打磨和快捷键。
- 正式的 macOS/Windows 签名发布。
- 更完善的端到端测试。

Stock Monitor 目前还是一个偏学习和研究用途的小工具，但它已经覆盖了 Electron 桌面应用里很多真实问题：远端数据、跨源归一化、状态持久化、本地缓存、图表交互、指标计算、策略回测、代理配置、自动更新和跨平台打包。

如果你也在做 Electron、React 桌面端、行情可视化或者多数据源聚合，欢迎看看源码，也欢迎提 issue 和 PR。

再次强调：项目不提供投资建议，所有行情、指标、回测和测算仅用于学习、技术研究和展示验证。
