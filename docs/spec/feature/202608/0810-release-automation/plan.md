# GitHub 自动打包发布流程

## 背景

当前项目是 Electron 桌面应用，使用 `electron-builder` 打包，版本号维护在根目录 `package.json` 的 `version` 字段中。

现有发布相关状态：

- 当前本地开发分支为 `dev`，远端 `origin/HEAD` 指向 `origin/dev`。
- 远端仓库为 `woodwen/StockMonitor`。
- 根目录还没有 `.github/workflows` 自动发布工作流。
- `package.json` 中已有 `yarn dist`，内部执行 `yarn build && electron-builder`。
- `electron-builder` 当前输出目录为 `release/`。
- 当前 `electron-builder.publish` 使用 `generic` 占位地址 `https://updates.example.com/stock-monitor/`，还不能直接支持 GitHub Releases 自动更新。
- 当前应用已接入 `electron-updater`，正式发布后需要稳定的更新源。

本次目标是在远端新增 `master` 分支，并在代码合并到 `master` 后，由 GitHub Actions 自动判断版本号：只有 `package.json` 当前版本高于 GitHub Releases 中已经发布的最新正式版本时，才自动打包并发布到 GitHub Releases 和 GitHub Packages。

本期所有平台打包均采用无签名模式，不配置 macOS Developer ID、notarization 或 Windows 代码签名证书。

## 方案概述

发布流程以 `master` 为唯一自动发布入口：

- 从当前 `dev` 新建远端 `master`。
- GitHub 默认分支切换为 `master`。
- 后续功能开发继续通过分支或 `dev` 完成，发布只通过 PR 合并到 `master` 触发。
- GitHub Actions 监听 `push` 到 `master`。
- workflow 读取 `package.json` 的 `version`。
- workflow 查询 GitHub Releases 中最新的正式 `vX.Y.Z` release。
- 如果当前版本不高于已发布版本，workflow 直接跳过发布并成功结束。
- 如果当前版本高于已发布版本，先完成校验和三端打包，再发布 GitHub Release 和 GitHub Package。

默认发布目标：

- GitHub Releases：发布桌面安装包、自动更新 metadata 和 release tag。
- GitHub Packages：发布 npm package，作为同版本源码/包记录。

默认版本策略：

- 只接受稳定 semver，例如 `0.1.1`、`1.0.0`。
- tag 格式固定为 `v${package.version}`。
- GitHub Releases 只比较正式 release，忽略 draft 和 prerelease。
- 没有历史 release 时，已发布版本按 `0.0.0` 处理。
- 暂不支持 `alpha`、`beta`、`rc` 等预发布版本和多发布通道。

默认打包策略：

- macOS：`dmg`
- Windows：`nsis`
- Linux：`AppImage`
- 三个平台全部成功后才创建 tag 和 release。
- 任意平台失败，则不创建 tag、不创建 release、不发布 package。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 发布分支 | `master` |
| 触发条件 | PR 合并或 push 到 `master` 后触发 |
| 版本来源 | 根目录 `package.json` 的 `version` |
| 已发布版本来源 | GitHub Releases 中最新正式 `vX.Y.Z` release |
| 无历史 release | 按 `0.0.0` 比较 |
| tag 格式 | `v${package.version}` |
| release 名称 | `Stock Monitor v${package.version}` |
| prerelease/draft | 默认忽略，不参与最新版本比较 |
| 预发布版本 | 本期不支持 |
| macOS 打包 | `dmg` |
| Windows 打包 | `nsis` |
| Linux 打包 | `AppImage` |
| 代码签名 | 全平台无签名 |
| macOS notarization | 不执行 |
| Releases 内容 | 安装包、blockmap、latest metadata 等 `electron-builder` 产物 |
| Packages 内容 | npm package，不承载大型安装包 |
| GitHub Token | 使用 Actions 自动注入的 `GITHUB_TOKEN` |
| workflow 权限 | `contents: write`、`packages: write` |
| 发布门槛 | typecheck、UT、build、三平台打包全部成功 |

## 发布流程

### 1. 分支准备

首次落地时，从当前 `dev` 推送远端 `master`：

```bash
git push origin dev:master
```

GitHub 仓库侧手动调整：

- 默认分支改为 `master`。
- 对 `master` 配置分支保护。
- 推荐禁止直接 push。
- 推荐要求 PR 合并。
- 推荐要求 release workflow 或基础 CI 通过后才能合并。

### 2. 自动触发

新增 GitHub Actions workflow，只监听 `master`：

```yaml
on:
  push:
    branches:
      - master
```

workflow 不监听 `dev`，避免开发分支上每次合并都打包发布。

### 3. 版本检查

workflow 启动后先读取当前版本：

```bash
node -p "require('./package.json').version"
```

然后查询 GitHub Releases 中最新正式版本：

- release tag 必须匹配 `vX.Y.Z`。
- 跳过 draft。
- 跳过 prerelease。
- 如果没有 release，则使用 `0.0.0`。

比较规则：

- `currentVersion <= latestReleasedVersion`：跳过发布。
- `currentVersion > latestReleasedVersion`：继续校验和打包。

版本检查失败时应直接终止 workflow，避免发布未知版本。

### 4. 校验与打包

发布前必须通过：

```bash
yarn typecheck
yarn test
yarn build
```

三平台打包使用 matrix：

- `macos-latest`
- `windows-latest`
- `ubuntu-latest`

每个平台安装依赖后执行对应平台的 `electron-builder` 打包，并显式关闭自动发布：

```bash
electron-builder --publish never
```

### 5. 汇总发布

所有平台打包产物上传为 GitHub Actions artifact。

汇总 job 在三平台都成功后执行：

- 下载所有平台 artifact。
- 创建 tag `v${package.version}`。
- 创建 GitHub Release。
- 上传安装包和自动更新 metadata。
- 发布 GitHub npm package。

汇总 job 是唯一拥有发布动作的 job，避免多平台并发创建 release 或 tag 时发生冲突。

## 实现改动

### GitHub Actions

新增 `.github/workflows/release.yml`。

workflow 结构建议拆为三个阶段：

1. `check-version`
   - checkout 代码。
   - 设置 Node.js。
   - 读取 `package.json` 当前版本。
   - 查询 GitHub Releases 最新正式版本。
   - 校验当前版本是否为稳定 semver。
   - 输出 `should_release`、`version`、`tag`。

2. `build`
   - 依赖 `check-version`。
   - 当 `should_release == true` 时才运行。
   - 使用 matrix 分别在 macOS、Windows、Linux 打包。
   - 安装依赖。
   - 运行 `yarn typecheck`、`yarn test`、`yarn build`。
   - 执行平台打包。
   - 上传 `release/` 下产物为 artifact。

3. `publish`
   - 依赖所有 `build` matrix 成功。
   - 下载 artifact。
   - 创建 GitHub Release。
   - 上传所有平台产物。
   - 执行 `npm publish` 发布到 GitHub Packages。

workflow 权限：

```yaml
permissions:
  contents: write
  packages: write
```

### package.json

调整 npm package 信息：

- 将包名改为 GitHub Packages 需要的 scoped package：

```json
"name": "@woodwen/stock-monitor-electron"
```

- 增加仓库信息：

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/woodwen/StockMonitor.git"
}
```

- 增加 GitHub Packages 发布配置：

```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
}
```

- 建议增加 npm package 发布白名单，避免把本地临时产物或不需要的文件发布到 GitHub Packages：

```json
"files": [
  "out/**/*",
  "src/**/*",
  "package.json",
  "README.md"
]
```

注意：`package.json` 中已有 `build.files` 是 `electron-builder` 的应用打包配置，和 npm package 的顶层 `files` 不是同一个概念。

### electron-builder 发布源

将当前 `build.publish` 从 `generic` 占位地址改为 GitHub provider：

```json
"publish": [
  {
    "provider": "github",
    "owner": "woodwen",
    "repo": "StockMonitor",
    "releaseType": "release"
  }
]
```

这样 `electron-updater` 后续可以使用 GitHub Releases 里的更新 metadata，而不是继续指向占位 generic 地址。

### 无签名配置

macOS 默认禁用签名：

```json
"mac": {
  "target": [
    "dmg"
  ],
  "category": "public.app-category.finance",
  "identity": null
}
```

workflow 中同时设置：

```yaml
env:
  CSC_IDENTITY_AUTO_DISCOVERY: false
```

Windows 默认不配置：

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`
- `CSC_LINK`
- `CSC_KEY_PASSWORD`

不配置 macOS notarization 相关变量：

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

### GitHub Packages 认证

workflow 中通过 `actions/setup-node` 配置 GitHub npm registry：

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: yarn
    registry-url: https://npm.pkg.github.com
    scope: '@woodwen'
```

发布时使用：

```yaml
env:
  NODE_AUTH_TOKEN: ${{ github.token }}
```

执行：

```bash
npm publish
```

如果当前版本已经存在于 GitHub Packages，应视为发布失败或在发布前显式检查并跳过。默认建议与 Releases 保持一致：版本已存在时不重复发布。

## 测试计划(UT)

### 版本比较脚本

如新增独立版本检查脚本，应覆盖以下 UT：

- 当前版本 `0.1.1`，已发布版本 `0.1.0`，应输出 `should_release=true`。
- 当前版本 `0.1.0`，已发布版本 `0.1.0`，应输出 `should_release=false`。
- 当前版本 `0.0.9`，已发布版本 `0.1.0`，应输出 `should_release=false`。
- 没有历史 release 时，当前版本 `0.1.0` 应输出 `should_release=true`。
- draft release 不参与最新版本比较。
- prerelease 不参与最新版本比较。
- 非 `vX.Y.Z` tag 不参与最新版本比较。
- `package.json` 中版本为 `1.0.0-beta.1` 时应失败或明确跳过。
- `package.json` 中版本不是合法 semver 时应失败。

### workflow 逻辑

如使用 shell 内联逻辑，至少用本地脚本或 `act` 等工具模拟以下场景：

- `should_release=false` 时，build 和 publish job 不执行。
- `should_release=true` 时，build job 生成平台 artifact。
- 任一平台 build 失败时，publish job 不执行。
- publish job 只在所有平台成功后执行一次。

### package 配置

- 校验 `package.json` 能被 Node 正常读取。
- 校验 `name` 为 `@woodwen/stock-monitor-electron`。
- 校验 `publishConfig.registry` 为 `https://npm.pkg.github.com`。
- 校验 `build.publish[0].provider` 为 `github`。
- 校验 `build.mac.identity` 为 `null`。

### 现有项目回归

发布工作流落地后，现有基础校验仍需通过：

```bash
yarn typecheck
yarn test
yarn build
```

如果修改 `package.json` 后影响 Electron 应用名、自动更新或依赖解析，需要补充相关回归用例。

## 影响范围(建议手动测试范围)

### GitHub 仓库设置

- 确认远端存在 `master` 分支。
- 确认 GitHub 默认分支已切换为 `master`。
- 确认 `master` 分支保护规则已生效。
- 确认 PR 合并到 `master` 后会触发 release workflow。
- 确认直接 push 到 `dev` 不触发发布 workflow。

### 版本跳过场景

- 将 `package.json` 版本保持为已发布版本，合并到 `master`。
- 确认 workflow 只执行版本检查，不打包、不发布 release、不发布 package。
- 确认 workflow 结果为成功，而不是失败。

### 新版本发布场景

- 将 `package.json` 版本提升一个 patch，例如 `0.1.0` 到 `0.1.1`。
- 合并到 `master`。
- 确认三平台打包 job 都成功。
- 确认 GitHub Releases 中创建 `v0.1.1`。
- 确认 release 名称为 `Stock Monitor v0.1.1`。
- 确认 release assets 包含 macOS、Windows、Linux 产物和自动更新 metadata。
- 确认 GitHub Packages 中出现同版本 npm package。

### 安装包手动验证

- macOS：下载 `dmg`，确认可以打开安装包；由于无签名，确认 Gatekeeper 警告符合预期。
- Windows：下载 `nsis` 安装包，确认可以启动安装；由于无签名，确认 SmartScreen 警告符合预期。
- Linux：下载 `AppImage`，添加执行权限后确认可以启动。

### 自动更新验证

- 从旧版本安装应用。
- 发布更高版本后，点击“检查更新”。
- 确认应用能从 GitHub Releases 读取更新 metadata。
- 确认发现新版本、下载进度、下载完成提示符合现有更新 UI。
- macOS/Windows 无签名环境下，如系统阻止安装或覆盖，记录为发布策略限制，不作为本期 workflow 失败。

### GitHub Packages 验证

- 确认 package 名为 `@woodwen/stock-monitor-electron`。
- 确认 package 关联仓库为 `woodwen/StockMonitor`。
- 确认 package 版本与 release tag 一致。
- 确认未把大型安装包重复发布进 npm package。

## 风险与后续

- 无签名安装包会触发 macOS Gatekeeper 和 Windows SmartScreen 警告，影响普通用户安装体验。
- macOS 未 notarize 时，用户可能需要手动在系统安全设置中允许打开应用。
- GitHub Packages 的 npm package 不适合作为大型安装包仓库，安装包仍应以 GitHub Releases 为准。
- `electron-updater` 使用 GitHub Releases 后，需要实际发布一次新旧版本才能完整验证更新链路。
- 如果 release 创建成功但 package 发布失败，需要明确是否允许保留 release。默认建议发布阶段失败时保留现场，由人工检查后决定是否删除 release 或补发 package。
- 后续如需要 beta/alpha 通道，应新增 prerelease 策略、tag 规则和更新 channel，不要复用本期稳定版 workflow。
- 后续如需要正式面向普通用户分发，应补充 macOS Developer ID 签名、notarization 和 Windows 代码签名。

## 验收标准

- 仓库存在远端 `master` 分支，且 `master` 是自动发布入口。
- 合并到 `master` 后，只有当前版本高于最新正式 release 时才执行发布。
- 当前版本不高于最新正式 release 时，workflow 成功跳过。
- 发布前必须通过 `yarn typecheck`、`yarn test`、`yarn build`。
- macOS、Windows、Linux 三个平台打包全部成功后，才创建 GitHub Release。
- GitHub Release tag 使用 `v${package.version}`。
- GitHub Release assets 包含三平台安装包和自动更新 metadata。
- GitHub Packages 中发布同版本 `@woodwen/stock-monitor-electron`。
- macOS 和 Windows 均不使用签名证书或 notarization。
- `electron-builder.publish` 不再使用占位 generic 地址。
