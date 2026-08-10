# Stock Monitor

Stock Monitor 是一个跨平台行情桌面应用，用 Electron + React + MobX MVVM 实现远端行情查询、多源切换、当日分时和 K 线展示。

当前默认进入分时视图，默认分时数据源为东方财富；K 线数据源和分时数据源已经拆分保存，用户可以分别在对应视图下切换东方财富、腾讯/QQ 财经、新浪财经、网易财经 163 的可用能力，并可在应用内检测数据源状态、配置网络代理和管理图表指标。

## 技术栈

- 桌面框架：`Electron`
- 构建工具：`electron-vite`
- 前端框架：`React + TypeScript`
- MVVM 状态：`MobX + mobx-react-lite`
- UI 框架：`Ant Design`
- K 线图表：`klinecharts`
- 分时图表：`Canvas`
- 文本编码：`iconv-lite`
- 本地配置：`electron-store`
- 日志：`electron-log`
- 自动更新：`electron-updater`
- 测试：`Vitest`
- 打包：`electron-builder`
- 包管理器：`yarn`

## 快速启动

```bash
# 从项目父目录进入
cd StockMonitor
yarn install
yarn dev
```

如果 Electron 二进制没有下载完整，可以先执行：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
yarn dev
```

启动后会默认加载：

```ts
{
  viewMode: 'timeshare',
  timeshareSourceId: 'eastmoney',
  query: {
    sourceId: 'eastmoney',
    symbol: 'sh000001',
    period: 'day',
    adjust: 'qfq',
    startDate: 'YYYYMMDD', // 启动日往前 2 年
    endDate: 'YYYYMMDD' // 启动日
  }
}
```

## 常用命令

```bash
yarn dev         # 启动开发模式
yarn test        # 运行单元测试
yarn typecheck   # 运行 TypeScript 类型检查
yarn build       # 生产构建
yarn dist        # 构建安装包
```

## 功能范围

- 视图：默认分时，可切换到 K 线；顶部切换顺序为“分时 / K线”
- 数据源：东方财富、腾讯/QQ 财经、新浪财经、网易财经 163
- 市场范围：沪深京股票、ETF、指数
- 默认查询：分时视图、东方财富分时源、`sh000001`；K 线保留东方财富、日线、前复权、近 2 年
- 数据源拆分：K 线使用 `workspace.query.sourceId`，分时使用 `workspace.timeshareSourceId`，两者共享证券代码但互不覆盖
- 分时：价格线、均价线、昨收参考线、右侧涨跌幅轴、成交量柱、十字线、tooltip，并压缩午间休市空档
- 分时刷新：分时视图在窗口可见且处于 A 股交易时段时每 15 秒自动静默刷新；K 线仍由用户手动刷新
- 首次加载：K 线首次加载支持跨源 fallback；分时不做跨源自动 fallback，东方财富分时会在同一数据源内从 `push2.eastmoney.com` fallback 到 `push2delay.eastmoney.com`
- 数据源管理：弹窗按当前视图测试数据源请求状态、耗时和返回记录数，并展示分时能力；分时视图只允许切换到支持分时的数据源
- 周期：日线、周线、月线、5/15/30/60 分钟
- 复权：不复权、前复权、后复权；不支持复权的数据源会自动收敛到不复权
- 主图：K 线、BOLL、MA、EMA、B/S 信号
- 副图：成交量、VOL、MACD、KDJ、RSI，最多同时开启 3 个副图指标
- 交互：缩放、拖拽、十字线、tooltip
- 顶部工具栏：证券代码、分时/K线、周期、复权、日期范围、刷新、数据源、代理、指标、检查更新、启动检查更新开关；分时视图隐藏 K 线专属控件
- 状态栏：当前视图的数据源、证券代码、记录数或分时点数、最新行情、加载状态、更新状态
- 本地持久化：查询条件、指标开关与参数、网络代理、启动检查更新配置会保存到 `electron-store`

## 数据源能力

| 数据源 | K 线周期 | 复权 | 市场 | 分时 | 备注 |
|---|---|---|---|---|---|
| 东方财富 | 日/周/月/5/15/30/60 分钟 | 不复权/前复权/后复权 | 股票/ETF/指数 | 支持 | 默认主源；分时主机支持 `push2` -> `push2delay` 同源 fallback |
| 腾讯/QQ 财经 | 日/周/月 | 不复权/前复权/后复权 | 股票/ETF/指数 | 支持 | K 线和分时备用源 |
| 新浪财经 | 日/周/月/5/15/30/60 分钟 | 不复权 | 股票/ETF/指数 | 不支持 | 可作为 K 线分钟线备用源 |
| 网易财经 163 | 日线 | 不复权 | 股票 | 不支持 | 当前只作为 K 线日线股票备用源 |

免费网页接口不提供稳定 SLA。每个源都封装在 main process 的数据源 adapter 里，K 线和分时分别归一化为 `StockDataset`、`StockTimeshareDataset`，后续替换正式数据服务时不需要改图表和指标层。

## 分时数据

- 东方财富分时使用 `trends2/get` 接口，启动失败场景下会保留当前分时源，只在东方财富内部切换延迟主机重试。
- 腾讯/QQ 财经分时使用 minute query 接口，按累积成交量和成交额换算单分钟增量，并读取昨收用于涨跌幅轴。
- 新浪财经当前没有接入标准分时源；其 1 分钟 K 线接口可作为后续降级分时方案评估。
- 网易财经 163 当前没有接入分时能力。
- 分时自动刷新只按工作日交易时间判断，暂未接入节假日交易日历。

## 架构说明

项目采用 Electron 三端结构：

```text
Electron Main
  ├─ 窗口、菜单
  ├─ 远端 K 线/分时数据源 clients
  ├─ 数据源注册表
  ├─ 本地配置、网络代理、日志
  ├─ 自动更新
  └─ IPC handlers

Preload
  └─ window.stockApi typed bridge

Renderer
  ├─ View: React + Ant Design
  ├─ ViewModel: MobX class
  ├─ Model: K 线/分时行情数据、指标计算
  └─ Adapter: Electron 数据桥、klinecharts、Canvas 分时图、自动更新状态
```

MVVM 约束：

- View 只负责展示和触发命令。
- ViewModel 负责状态、查询条件和流程编排。
- Model 负责纯业务逻辑，例如指标计算和行情类型。
- Adapter 负责外部依赖，例如 Electron IPC、远端行情源、klinecharts。
- Renderer 不直接访问远端行情接口，只通过 preload 暴露的 `window.stockApi`，其中 K 线和分时分别走 `fetchStockDataset`、`fetchStockTimeshareDataset`。

## 目录结构

```text
src/
  main/
    index.ts                  # Electron 主入口
    ipc.ts                    # IPC handlers
    menu.ts                   # 中文应用菜单
    remote-stock-sources.ts   # 远端行情源注册表和数据归一化
    store.ts                  # electron-store 配置
    logger.ts                 # electron-log
    update-manager.ts         # electron-updater

  preload/
    index.ts                  # contextBridge 注入
    stock-api.ts              # preload 类型定义

  renderer/
    app/
      App.tsx
      RootViewModel.ts

    features/
      stock-workspace/
        models/               # K 线/分时类型、指标定义、指标计算
        view-models/          # MobX ViewModel、K 线和分时图状态
        adapters/             # Electron 数据桥、klinecharts 和 Canvas 分时图适配
        views/                # React + Ant Design 界面、K 线和分时图视图

      app-update/
        models/
        view-models/
        views/

tests/
  remote-stock-sources.test.ts
  indicator-definitions.test.ts
  indicator-engine.test.ts
  legacy-stock-parser.test.ts
  stock-workspace-view-model.test.ts
  klinecharts-adapter.test.ts
  timeshare-chart.test.ts
```

## 查询与工作区设置

K 线查询使用 `StockQuery`：

```ts
interface StockQuery {
  sourceId: 'eastmoney' | 'sina' | 'netease163' | 'tencent'
  symbol: string
  period: 'day' | 'week' | 'month' | '5' | '15' | '30' | '60'
  adjust: 'none' | 'qfq' | 'hfq'
  startDate: string
  endDate: string
}
```

分时查询使用独立的 `StockTimeshareQuery`：

```ts
interface StockTimeshareQuery {
  sourceId: 'eastmoney' | 'sina' | 'netease163' | 'tencent'
  symbol: string
  tradeDate?: string
}
```

工作区配置会同时保存当前视图和两类数据源：

```ts
interface WorkspaceSettings {
  viewMode?: 'kline' | 'timeshare'
  timeshareSourceId?: StockQuery['sourceId']
  query: StockQuery
  indicatorSettings?: IndicatorSettingsMap
  enabledIndicators?: Partial<Record<IndicatorName, boolean>>
}
```

证券代码支持 `sh/sz/bj` 前缀，例如 `sh000001`、`sz399001`、`sh600519`、`sz159915`。不带前缀时会按代码段推断市场；指数代码建议显式输入前缀，避免 `000001` 同时代表上证指数和平安银行。

K 线数据源返回后会归一化为 `StockDataset`，再进入 `enrichStockDataset` 计算指标并渲染图表。分时数据源返回后会归一化为 `StockTimeshareDataset`，由分时 ViewModel 和 Canvas adapter 渲染。

切换 K 线数据源、周期或复权时，ViewModel 会按当前数据源能力自动收敛不支持的选项。例如新浪财经不支持复权，会自动改为不复权；网易财经 163 只支持日线股票。切换分时数据源时，ViewModel 会拒绝新浪财经、网易财经 163 这类未声明分时能力的数据源，避免把 K 线源误用成分时源。

## 指标说明

默认开启：

- `BOLL`：20 周期、2 倍标准差
- `VOL`：成交量与 MA5、MA10、MA20
- `B/S`：快线 5、慢线 20，基于典型价格 `(close + high + low) / 3` 的 EMA 交叉信号

可选指标：

- 主图：`MA` 默认 5/10/20/60，`EMA` 默认 12/26
- 副图：`MACD` 默认 12/26/9，`KDJ` 默认 9/3/3，`RSI` 默认 6/12/24

指标设置：

- 指标弹窗支持开关、参数调整和恢复默认参数。
- 副图指标最多同时开启 3 个。
- 参数会校验范围，部分指标要求周期不能重复，`MACD` 要求快线小于慢线。
- 指标开关和参数会随工作区设置持久化，并兼容旧版 `enabledIndicators` 配置。

指标开关行为：

- 关闭 `BOLL` 只隐藏 BOLL，不影响 K 线。
- 关闭 `VOL` 会移除成交量指标面板。
- 关闭 `B/S` 删除所有 B/S 标记，不影响 K 线。
- 重复切换不会累加重复指标或重复标记。

本地 model 会为数据集计算 `BOLL`、`VOL MA` 和 `B/S` 信号；图表层通过 `klinecharts` 创建 `BOLL`、`VOL`、`MA`、`EMA`、`MACD`、`KDJ`、`RSI` 指标，并使用自定义 overlay 渲染 `B/S` 标记。

## 本地设置与代理

本地设置通过 `electron-store` 保存，配置名为 `stock-monitor`。当前保存内容包括：

- `checkUpdatesOnStartup`：是否在启动后检查更新
- `networkProxy`：代理开关、协议、地址、端口
- `workspace.viewMode`：当前视图，默认 `timeshare`
- `workspace.timeshareSourceId`：分时数据源，默认 `eastmoney`
- `workspace.query`：K 线数据源、证券代码、周期、复权和日期范围
- `workspace.indicatorSettings`：指标开关和参数

网络代理默认关闭，关闭时行情请求不读取 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY` 环境变量。代理支持 `SOCKS5` 和 `HTTP`，默认草稿配置为 `127.0.0.1:7890`。

## 自动更新

自动更新使用 `electron-updater`。

默认策略：

- 发布源：`generic`
- 占位地址：`https://updates.example.com/stock-monitor/`
- 启动后延迟 5 秒检查更新
- 菜单入口：`帮助 -> 检查更新`
- 工具栏入口：`检查更新`
- 工具栏开关：控制是否启动后检查更新
- 有新版本时提示下载
- 下载完成后提示重启安装
- 开发环境不真实更新，只走日志和状态流

正式发布前需要替换更新地址，并准备 macOS/Windows 签名。

## 打包

`package.json` 中已配置：

- macOS：`dmg`
- Windows：`nsis`
- Linux：`AppImage`
- 应用 ID：`com.stockmonitor.desktop`
- 产品名：`Stock Monitor`

执行：

```bash
yarn dist
```

## 验证

提交前建议运行：

```bash
yarn test
yarn typecheck
yarn build
```

当前测试覆盖：

- 远端数据源元信息、K 线/分时请求归一化、能力校验和网络错误透传
- 东方财富分时解析、分时同源主机 fallback、腾讯/QQ 财经分时解析、未支持分时源拦截
- 旧版行情文件解析
- 指标定义、参数校验、旧配置迁移、副图指标数量限制
- 指标计算
- StockWorkspace ViewModel 远端查询、K 线启动 fallback、默认分时启动、分时/K 线源独立、数据源测试、配置持久化、代理保存
- TimeshareChart ViewModel 分时摘要、点数和 revision 更新
- klinecharts Adapter 指标开关、参数变更和 B/S overlay 不重复累加

## 设计取舍

- 远端请求统一放在 Electron main process，renderer 只通过 typed preload bridge 调用。
- 多源差异集中在 `remote-stock-sources.ts`，图表和指标层只接收统一后的 `StockDataset` 或 `StockTimeshareDataset`。
- K 线和分时数据源拆开保存，避免某个平台只支持其中一种行情时污染另一种视图的选择。
- K 线只在首次加载时做有限跨源 fallback；分时不做跨源自动 fallback，日常切源由用户在数据源弹窗里手动完成，避免不同数据源结果不一致时难以排查。
- 代理默认直连且不隐式读取环境变量，避免开发机代理配置污染行情请求结果。
