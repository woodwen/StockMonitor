# 应用图标与仓库主页配置

## 背景

当前项目是 Electron 桌面应用，已经具备 macOS、Windows、Linux 三端打包配置，但应用图标和仓库主页元数据仍不完整：

- `electron-builder` 没有显式配置三端图标，打包时会回退默认图标。
- 开发运行时和打包后运行时没有统一的窗口图标解析逻辑。
- macOS 开发运行时 Dock 图标仍依赖默认应用图标，不便于本地确认品牌视觉。
- `package.json` 中缺少 GitHub 仓库主页路径，GitHub About/包元数据没有明确落点。
- 图标资源属于发布体验的一部分，需要测试锁定配置，避免后续发布配置回退。

本次目标是接入用户提供的行情主题图标，覆盖 Electron 打包配置、开发运行时图标和仓库主页元数据。

## 方案概述

采用最小构建配置调整方案：

- 以用户提供的原始图像为来源，生成跨平台打包需要的 `png`、`icns`、`ico` 图标资源。
- 将图标资源统一放在根目录 `build/` 下，供 `electron-builder` 和主进程运行时复用。
- 在 `package.json` 中配置三端打包图标：
  - macOS 使用 `build/icon.icns`。
  - Windows 使用 `build/icon.ico`。
  - Linux 使用 `build/icon.png`。
- 通过 `extraResources` 将 `build/icon.png` 复制到打包产物资源目录，供运行时读取。
- 在 Electron 主进程中封装图标路径解析：
  - 开发环境读取仓库内 `build/icon.png`。
  - 打包环境读取 `process.resourcesPath/icon.png`。
  - 文件不存在时回退为 `undefined`，避免启动失败。
- 非 macOS 窗口通过 `BrowserWindow.icon` 设置窗口图标。
- macOS 开发运行时通过 `app.dock?.setIcon()` 设置 Dock 图标。
- 在 `package.json` 中补充 `homepage`，指向 GitHub README。
- 增加构建配置测试，锁定仓库元数据、图标配置和图标文件存在性。

不扩大范围处理：

- 不修改自动更新发布源。
- 不调整代码签名、notarization 或安装包权限。
- 不通过 API 直接修改 GitHub 远端 About；远端 Website 字段仍作为手动同步项。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 图标资源目录 | `build/` |
| 运行时通用图标 | `build/icon.png` |
| macOS 打包图标 | `build/icon.icns` |
| Windows 打包图标 | `build/icon.ico` |
| Linux 打包图标 | `build/icon.png` |
| 打包后运行时路径 | `process.resourcesPath/icon.png` |
| 开发运行时路径 | `build/icon.png` |
| GitHub homepage | `https://github.com/woodwen/StockMonitor#readme` |
| 远端 GitHub About | 本次不自动写入，保留人工确认 |

## 实现改动

### 图标资源

- 新增 `build/icon.png`，作为 Linux 打包图标和运行时窗口/Dock 图标。
- 新增 `build/icon.icns`，作为 macOS 打包图标。
- 新增 `build/icon.ico`，作为 Windows 打包图标。

### package.json

- 新增 `homepage` 字段，指向 GitHub README。
- 保留 `repository.url` 为 `git+https://github.com/woodwen/StockMonitor.git`。
- 在 `build.extraResources` 中复制 `build/icon.png` 到打包资源目录。
- 在 `build.mac.icon`、`build.win.icon`、`build.linux.icon` 中分别配置三端图标。

### Electron 主进程

- 修改 `src/main/index.ts`：
  - 新增 `getAppIconPath()`，根据 `app.isPackaged` 解析图标路径。
  - 通过 `existsSync()` 判断图标是否存在，缺失时不传入图标路径。
  - 非 macOS 窗口通过 `BrowserWindow.icon` 设置窗口图标。
  - macOS 开发运行时通过 `app.dock?.setIcon()` 设置 Dock 图标。

### 测试

- 修改 `tests/package-build-config.test.mjs`：
  - 校验 `packageJson.homepage` 指向 GitHub README。
  - 校验 `packageJson.repository.url` 指向当前仓库。
  - 校验 `extraResources` 包含运行时图标复制配置。
  - 校验 macOS、Windows、Linux 图标路径配置正确。
  - 校验三类图标文件实际存在。

## 测试计划(UT)

需要执行：

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `git diff --check`

补充检查：

- 如执行本地提交，还需要执行 `git diff --cached --check`。
- 可单独运行 `yarn test tests/package-build-config.test.mjs --reporter=verbose` 快速验证构建配置测试。

## 影响范围(建议手动测试范围)

### 开发运行时

- 在 macOS 执行开发启动，确认 Dock 图标显示为新图标。
- 在 Windows/Linux 开发或打包运行时，确认窗口图标显示为新图标。
- 在图标文件缺失或路径不可用时，确认应用仍可启动。

### 打包产物

- 执行 macOS 打包，确认 `.app` 或 `.dmg` 使用 `build/icon.icns`。
- 执行 Windows 打包，确认安装包和应用窗口使用 `build/icon.ico`。
- 执行 Linux 打包，确认 AppImage 和窗口使用 `build/icon.png`。
- 确认打包资源目录中包含 `icon.png`。

### 仓库元数据

- 确认 `package.json` 的 `homepage` 为 `https://github.com/woodwen/StockMonitor#readme`。
- 在 GitHub 仓库 About 中手动同步 Website 为同一地址。
- 确认自动发布和 GitHub Packages 配置不受 homepage 变更影响。

## 风险与后续

- 图标文件本身为二进制资源，UT 只能校验存在性和配置路径，不能验证视觉效果。
- 三端安装包图标最终仍需在目标系统上手动验收。
- 完整 `electron-builder --mac dir` 本地验证可能耗时较长，必要时放到发布 workflow 或单独打包任务中验证。
- GitHub 远端 About 需要已登录会话、`gh` 或 API token 才能写入，本次仅提交项目元数据路径。

## 验收标准

- `build/icon.png`、`build/icon.icns`、`build/icon.ico` 均存在。
- `package.json` 配置三端打包图标和运行时额外资源。
- 开发和打包环境均能解析运行时 `icon.png`。
- 非 macOS 窗口图标和 macOS 开发 Dock 图标使用新图标。
- `homepage` 指向 GitHub README。
- 构建配置测试覆盖图标路径、图标文件存在性和仓库元数据。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
