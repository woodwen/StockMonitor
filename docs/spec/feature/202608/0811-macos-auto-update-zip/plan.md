# macOS 自动更新 ZIP 产物修复

## 背景

用户在 macOS 端手动触发“检查更新”后，弹窗显示更新检查失败：

```text
ZIP file not provided
```

当前项目使用 `electron-updater` 从 GitHub Releases 读取更新元数据。`v0.1.2` 已发布到 GitHub Releases，但 macOS 自动更新链路无法继续下载和安装。

本次目标是修复 macOS 自动更新产物配置，避免后续发布继续生成缺失 ZIP 的 `latest-mac.yml`，并让 UI 错误提示从内部 JSON 降级为用户可理解的文案。

## 调查结论

- `src/main/update-manager.ts` 已正确接入 `electron-updater`，当前报错不是渲染层状态机或 IPC 调用问题。
- `package.json` 的 `build.mac.target` 只配置了 `dmg`。
- `electron-updater` 的 macOS 更新实现依赖 Squirrel.Mac，需要从 `latest-mac.yml` 的 `files` 中找到 ZIP 条目。
- `electron-builder` schema 明确提示：macOS `dmg` 包如需自动更新，必须同时启用 `dmg` 和 `zip`；禁用 `zip` 会破坏 `dmg` 包的自动更新。
- 远端 `v0.1.2` Release assets 中没有 `.zip`，只有 `latest-mac.yml`、`.dmg`、`.dmg.blockmap` 等文件。
- 远端 `latest-mac.yml` 中写的是 `Stock-Monitor-0.1.2-arm64.dmg`，但实际 GitHub asset 名为 `Stock.Monitor-0.1.2-arm64.dmg`，存在命名不一致导致下载 404 的后续风险。

## 默认实现决策

| 决策项 | 默认方案 |
| --- | --- |
| 发版版本 | 升到 `0.1.3` 发新 Release |
| 修复现有 `v0.1.2` asset | 不直接修，避免缓存和追溯混乱 |
| macOS 手动安装包 | 保留 `dmg` |
| macOS 自动更新包 | 新增 `zip` |
| macOS 架构范围 | 先保持当前 arm64，不扩大到 Intel/x64 或 universal |
| 产物命名 | 固定稳定 `artifactName`，避免 GitHub asset 与 yml 不一致 |
| 错误提示 | UI 显示用户可读文案，原始错误写日志 |
| 文档范围 | 更新方案文档、必要 README/CHANGELOG，不大改发布说明 |

## 实施记录

- 先在 `tests/package-build-config.test.mjs` 增加回归测试，确认当前配置下缺少稳定 `artifactName` 和 `release/*.zip` 上传规则会失败。
- `package.json` 已推进到 `0.1.3`，并加入 macOS `zip` target 和稳定产物命名。
- `.github/workflows/release.yml` 已补充上传 macOS ZIP artifact，避免 GitHub Release 只包含 DMG。
- `src/main/update-manager.ts` 已保留原始 updater 错误日志，同时向 UI 发送用户可读错误文案。

## 实现改动

### package.json

- 确认版本推进到 `0.1.3`。
- 修改 `build.mac.target`：
  - 从 `["dmg"]`
  - 改为同时包含 `["dmg", "zip"]`
- 增加稳定产物命名模板：
  - 优先放在顶层 `build.artifactName`，统一三端命名。
  - 模板建议为 `Stock-Monitor-${version}-${arch}.${ext}`。
- 保持现有 GitHub Releases publish 配置不变：
  - `provider = github`
  - `owner = woodwen`
  - `repo = StockMonitor`
  - `releaseType = release`

### release workflow

- 修改 `.github/workflows/release.yml` 的 artifacts 上传路径：
  - 保留 `release/*.dmg`
  - 新增 `release/*.zip`
  - 保留 `release/*.blockmap`，覆盖 ZIP/DMG/EXE 等 blockmap 文件。
- 不改变 release workflow 的触发分支、版本判断、三平台 matrix、release notes 和 npm publish 策略。

### 更新错误提示

- 修改 `src/main/update-manager.ts`：
  - `autoUpdater.on('error')` 继续记录原始错误到日志。
  - 发送给 UI 的 `message` 做归一化。
  - 遇到 `ERR_UPDATER_ZIP_FILE_NOT_FOUND` 或 `ZIP file not provided` 时，显示“更新包不完整，请下载最新版安装包或稍后再试”。
- 不改变 check/download/quitAndInstall 的主流程。

### 测试保护

- 修改 `tests/package-build-config.test.mjs`：
  - 断言 mac target 同时包含 `dmg` 和 `zip`。
  - 断言产物命名模板使用稳定的 `Stock-Monitor` 前缀，避免空格和点号导致远端 asset/yml 不一致。
- 新增或扩展 workflow 配置测试：
  - 断言 `.github/workflows/release.yml` 上传路径包含 `release/*.zip`。
  - 断言仍上传 `release/*.dmg`、`release/*.yml` 和 `release/*.blockmap`。

### 文档与更新日志

- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.3` 区块：
  - 记录 macOS 自动更新新增 ZIP 产物。
  - 记录更新错误提示优化。
- README 只做必要同步：
  - macOS 打包说明从 `dmg` 调整为 `dmg + zip`，说明 `zip` 用于自动更新。

## 测试计划(UT)

需要执行：

```bash
yarn test tests/package-build-config.test.mjs --reporter=verbose
yarn typecheck
yarn test
yarn build
git diff --check
```

如新增 workflow 配置测试，需要单独执行对应测试文件。

## 发布后验收

发布 `v0.1.3` 后检查 GitHub Release assets：

- 包含 macOS `.dmg`。
- 包含 macOS `.zip`。
- 包含 `latest-mac.yml`。
- 包含 `.blockmap`。
- `latest-mac.yml` 的 `files` 中包含 ZIP 条目。
- `latest-mac.yml` 中每个 `url` 都能通过 GitHub Releases 下载。

客户端验收：

- 安装旧版本后手动触发“检查更新”。
- 确认能发现 `0.1.3`。
- 点击“下载更新”后不再出现 `ZIP file not provided`。
- 下载完成后进入“立即重启安装”流程。
- 如仍遇到系统签名或 Gatekeeper 限制，作为签名/notarization 风险单独处理，不混入本次修复。

## 风险与后续

- 现有 `v0.1.2` 的 macOS 自动更新已经发布了错误元数据，推荐用 `v0.1.3` 覆盖最新更新入口，而不是修改历史 release。
- 当前仍是无签名构建，macOS 自动安装体验可能受 Gatekeeper、签名和 notarization 影响；本次只修复 updater 找不到 ZIP 的确定性问题。
- 如果后续要支持 Intel Mac，需要单独设计 `x64`、`arm64` 或 universal 产物策略，并验证 `latest-mac.yml` 的架构筛选。

## 验收标准

- `package.json` 的 mac target 同时包含 `dmg` 和 `zip`。
- release workflow 会上传 macOS ZIP 产物。
- 包配置测试覆盖 macOS 自动更新所需产物。
- UI 不再把 `ZIP file not provided` 的完整 JSON 直接暴露给用户。
- `yarn typecheck`、`yarn test`、`yarn build`、`git diff --check` 通过。
- `v0.1.3` 发布后，旧版本 macOS 客户端可下载更新包并进入重启安装流程。
