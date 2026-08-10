# Stock Monitor

Stock Monitor 是一个跨平台 K 线桌面应用，用 Electron + React + MobX MVVM 实现本地行情导入和 K 线展示。

首版目标是稳定支持旧版制表符 `txt` 行情文件导入，并展示主图 K 线、BOLL、成交量、VOL MA 和 B/S 信号。项目内置了一份示例数据：`fixtures/legacy/000002.txt`。

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
cd /Users/mac/code/NodeProjects/StockMonitor
yarn install
yarn dev
```

如果 Electron 二进制没有下载完整，可以先执行：

```bash
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ node node_modules/electron/install.js
yarn dev
```

启动后会自动加载项目内的示例数据 `fixtures/legacy/000002.txt`。

## 常用命令

```bash
yarn dev         # 启动开发模式
yarn test        # 运行单元测试
yarn typecheck   # 运行 TypeScript 类型检查
yarn build       # 生产构建
yarn dist        # 构建安装包
```

## 功能范围

- 本地旧版 `txt` 文件导入
- 自动解析 `UTF-8 / GBK`
- 支持周期：`日线 / 周线 / 月线 / 5分钟 / 15分钟 / 30分钟 / 60分钟`
- 主图：K 线、BOLL、B/S 信号
- 副图：成交量、VOL MA5/10/20
- 交互：缩放、拖拽、十字线、tooltip
- 顶部工具栏：导入、加载示例、指标开关、检查更新
- 状态栏：记录数、最新行情、编码、数据来源、导入状态、更新状态
- 菜单：导入行情文本、加载示例数据、检查更新

## 架构说明

项目采用 Electron 三端结构：

```text
Electron Main
  ├─ 窗口、菜单、文件选择
  ├─ 本地配置、日志
  ├─ 自动更新
  └─ IPC handlers

Preload
  └─ window.stockApi typed bridge

Renderer
  ├─ View: React + Ant Design
  ├─ ViewModel: MobX class
  ├─ Model: 行情数据、旧文件解析、指标计算
  └─ Adapter: Electron 文件、klinecharts、自动更新状态
```

MVVM 约束：

- View 只负责展示和触发命令。
- ViewModel 负责状态、命令和流程编排。
- Model 负责纯业务逻辑，例如文件解析、周期识别、指标计算。
- Adapter 负责外部依赖，例如 Electron IPC、文件系统、klinecharts。
- Renderer 不直接访问 Node 文件系统，只通过 preload 暴露的 `window.stockApi`。

## 目录结构

```text
fixtures/
  legacy/
    000002.txt

src/
  main/
    index.ts             # Electron 主入口
    ipc.ts               # IPC handlers
    menu.ts              # 中文应用菜单
    file-utils.ts        # 文件读取和编码解码
    store.ts             # electron-store 配置
    logger.ts            # electron-log
    update-manager.ts    # electron-updater

  preload/
    index.ts             # contextBridge 注入
    stock-api.ts         # preload 类型定义

  renderer/
    app/
      App.tsx
      RootViewModel.ts

    features/
      stock-workspace/
        models/          # 行情类型、旧文件解析、指标计算
        view-models/     # MobX ViewModel
        adapters/        # 文件和 klinecharts 适配
        views/           # React + Ant Design 界面

      app-update/
        models/
        view-models/
        views/

tests/
  indicator-engine.test.ts
  legacy-stock-parser.test.ts
  stock-workspace-view-model.test.ts
  klinecharts-adapter.test.ts
```

## 数据格式

首版支持旧版制表符行情文本。示例：

```text
日线    000001    上证指数
时间    开盘价    最高价    最低价    收盘价    成交量    成交额
20100430 ...
```

解析策略：

- 按列位置优先，不强依赖中文表头。
- 第一行读取周期、代码、名称。
- 第二行作为列名。
- 第三行开始读取行情数据。
- 导入后统一按时间正序排序。
- `日线/周线` 使用 `yyyyMMdd`。
- `月线` 使用 `yyyyMM`。
- 分钟线兼容旧格式和完整时间格式。

## 指标说明

当前实现：

- `BOLL`：20 周期、2 倍标准差
- `VOL MA`：成交量 MA5、MA10、MA20
- `B/S`：基于典型价格 `(close + high + low) / 3` 的 EMA 交叉信号

指标开关行为：

- 关闭 `BOLL` 只隐藏 BOLL，不影响 K 线。
- 关闭 `VOL MA` 只关闭成交量指标面板中的均量线相关指标，成交量副图保留。
- 关闭 `B/S` 删除所有 B/S 标记，不影响 K 线。
- 重复切换不会累加重复指标或重复标记。

## 自动更新

自动更新使用 `electron-updater`。

默认策略：

- 发布源：`generic`
- 占位地址：`https://updates.example.com/stock-monitor/`
- 启动后延迟 5 秒检查更新
- 菜单入口：`帮助 -> 检查更新`
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
- 示例数据通过 `extraResources` 打入包内

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

- 旧版行情文件解析
- 指标计算
- StockWorkspace ViewModel 导入流程
- klinecharts Adapter 指标开关不重复累加

## 设计取舍

- 采用 Electron/React 图表层实现桌面 K 线体验。
- 将导入、解析、指标、图表适配拆成可测试模块。
- 首版只做本地文件导入，实时行情后续通过 Adapter 扩展。
