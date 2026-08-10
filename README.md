# Stock Monitor

Stock Monitor 是一个跨平台 K 线桌面应用，用 Electron + React + MobX MVVM 实现远端行情查询、多源切换和 K 线展示。

一期目标是支持沪深京股票、ETF、指数的远端 K 线查询。默认数据源为东方财富，用户可以手动切换到新浪财经、网易财经 163、腾讯/QQ 财经，并可在应用内检测数据源状态、配置网络代理和管理图表指标。

## 技术栈

- 桌面框架：`Electron`
- 构建工具：`electron-vite`
- 前端框架：`React + TypeScript`
- MVVM 状态：`MobX + mobx-react-lite`
- UI 框架：`Ant Design`
- K 线图表：`klinecharts`
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
  sourceId: 'eastmoney',
  symbol: 'sh000001',
  period: 'day',
  adjust: 'qfq'
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

- 数据源：东方财富、腾讯/QQ 财经、新浪财经、网易财经 163
- 市场范围：沪深京股票、ETF、指数
- 默认查询：东方财富、`sh000001`、日线、前复权、近 2 年
- 首次加载：先请求东方财富；如果当前网络下东财不可用，会自动尝试腾讯/QQ 财经、新浪财经、网易财经 163
- 数据源管理：弹窗中可测试所有数据源的请求状态、耗时和返回记录数，并一键切换当前数据源
- 周期：日线、周线、月线、5/15/30/60 分钟
- 复权：不复权、前复权、后复权；不支持复权的数据源会自动收敛到不复权
- 主图：K 线、BOLL、MA、EMA、B/S 信号
- 副图：成交量、VOL、MACD、KDJ、RSI，最多同时开启 3 个副图指标
- 交互：缩放、拖拽、十字线、tooltip
- 顶部工具栏：证券代码、周期、复权、日期范围、刷新、数据源、代理、指标、检查更新、启动检查更新开关
- 状态栏：数据源、证券代码、记录数、最新行情、加载状态、更新状态
- 本地持久化：查询条件、指标开关与参数、网络代理、启动检查更新配置会保存到 `electron-store`

## 数据源能力

| 数据源 | 周期 | 复权 | 市场 | 备注 |
|---|---|---|---|---|
| 东方财富 | 日/周/月/5/15/30/60 分钟 | 不复权/前复权/后复权 | 股票/ETF/指数 | 默认主源 |
| 腾讯/QQ 财经 | 日/周/月 | 不复权/前复权/后复权 | 股票/ETF/指数 | K 线备用源 |
| 新浪财经 | 日/周/月/5/15/30/60 分钟 | 不复权 | 股票/ETF/指数 | 分钟线备用源 |
| 网易财经 163 | 日线 | 不复权 | 股票 | 当前只作为日线股票备用源 |

免费网页接口不提供稳定 SLA。每个源都封装在 main process 的数据源 adapter 里，后续替换正式数据服务时不需要改图表和指标层。

## 架构说明

项目采用 Electron 三端结构：

```text
Electron Main
  ├─ 窗口、菜单
  ├─ 远端数据源 clients
  ├─ 数据源注册表
  ├─ 本地配置、网络代理、日志
  ├─ 自动更新
  └─ IPC handlers

Preload
  └─ window.stockApi typed bridge

Renderer
  ├─ View: React + Ant Design
  ├─ ViewModel: MobX class
  ├─ Model: 行情数据、指标计算
  └─ Adapter: Electron 数据桥、klinecharts、自动更新状态
```

MVVM 约束：

- View 只负责展示和触发命令。
- ViewModel 负责状态、查询条件和流程编排。
- Model 负责纯业务逻辑，例如指标计算和行情类型。
- Adapter 负责外部依赖，例如 Electron IPC、远端行情源、klinecharts。
- Renderer 不直接访问远端行情接口，只通过 preload 暴露的 `window.stockApi`。

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
        models/               # 行情类型、指标定义、指标计算
        view-models/          # MobX ViewModel
        adapters/             # Electron 数据桥和 klinecharts 适配
        views/                # React + Ant Design 界面

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
```

## 查询格式

前端统一使用 `StockQuery`：

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

证券代码支持 `sh/sz/bj` 前缀，例如 `sh000001`、`sz399001`、`sh600519`、`sz159915`。不带前缀时会按代码段推断市场；指数代码建议显式输入前缀，避免 `000001` 同时代表上证指数和平安银行。

各数据源返回后都会归一化为现有 `StockDataset`，再进入 `enrichStockDataset` 计算指标并渲染图表。

切换数据源、周期或复权时，ViewModel 会按当前数据源能力自动收敛不支持的选项。例如新浪财经不支持复权，会自动改为不复权；网易财经 163 只支持日线股票。

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
- `workspace.query`：当前数据源、证券代码、周期、复权和日期范围
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

- 远端数据源元信息、请求归一化、能力校验和网络错误透传
- 旧版行情文件解析
- 指标定义、参数校验、旧配置迁移、副图指标数量限制
- 指标计算
- StockWorkspace ViewModel 远端查询、启动 fallback、数据源测试、配置持久化、代理保存
- klinecharts Adapter 指标开关、参数变更和 B/S overlay 不重复累加

## 设计取舍

- 远端请求统一放在 Electron main process，renderer 只通过 typed preload bridge 调用。
- 多源差异集中在 `remote-stock-sources.ts`，图表和指标层只接收统一 `StockDataset`。
- 一期只在首次加载时做有限 fallback；日常查询由用户在数据源弹窗里手动切源，避免不同数据源结果不一致时难以排查。
- 代理默认直连且不隐式读取环境变量，避免开发机代理配置污染行情请求结果。
