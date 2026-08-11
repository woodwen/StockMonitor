# M-20(fix): 修复 macOS 自动更新缺少 ZIP 产物

背景:
- macOS 端手动触发“检查更新”时，`electron-updater` 报错 `ZIP file not provided`。
- 已发布的 `v0.1.2` 只包含 macOS DMG 和 `latest-mac.yml`，没有 Squirrel.Mac 自动更新需要的 ZIP 产物。
- 远端 `latest-mac.yml` 和 GitHub Release asset 还存在文件名不一致风险，后续即使绕过 ZIP 检查也可能下载失败。

调查结论:
- 主进程更新检查、IPC 和渲染层状态流不是直接原因。
- `package.json` 中 `build.mac.target` 只配置 `dmg`，导致 `latest-mac.yml` 中没有 ZIP 条目。
- `electron-updater` 的 macOS 下载逻辑会优先查找 ZIP，缺失时抛出 `ERR_UPDATER_ZIP_FILE_NOT_FOUND`。

方案概述:
- 将发版版本推进到 `0.1.3`，用新 Release 修复最新自动更新入口，不直接修改历史 `v0.1.2` assets。
- macOS 继续保留 `dmg` 给用户手动安装，同时新增 `zip` 供 `electron-updater` 安装更新使用。
- 固定安装包产物命名模板，避免 GitHub Release asset 名和 `latest-mac.yml` URL 不一致。
- 优化更新失败弹窗文案，原始 updater 错误仍保留在日志。

实现改动:
- 更新 `package.json`：
  - 版本从 `0.1.2` 推进到 `0.1.3`。
  - 新增 `build.artifactName = Stock-Monitor-${version}-${arch}.${ext}`。
  - macOS target 改为同时生成 `dmg` 和 `zip`。
- 更新 `.github/workflows/release.yml`：
  - Release artifact 上传路径新增 `release/*.zip`。
- 更新 `src/main/update-manager.ts`：
  - 对 `ERR_UPDATER_ZIP_FILE_NOT_FOUND` 和 `ZIP file not provided` 映射为用户可读文案。
  - 保留 `logger.error` 记录原始错误。
- 更新 `tests/package-build-config.test.mjs`：
  - 增加 macOS ZIP target、稳定 artifactName 和 workflow ZIP 上传规则断言。
- 更新 `README.md`、`CHANGELOG.md` 和方案文档，明确 macOS 自动更新需要 ZIP 产物。

测试计划(UT):
- `yarn test tests/package-build-config.test.mjs --reporter=verbose`
- `yarn typecheck`
- `yarn test`
- `yarn build`
- `node scripts/extract-changelog-release-notes.mjs --check`
- `git diff --check`
- `yarn electron-builder --mac --publish never`

影响范围(建议手动测试范围):
- macOS 自动更新发布产物和 `latest-mac.yml` 生成内容。
- GitHub Release assets 上传范围。
- 应用内更新失败弹窗文案。
- 建议发布 `v0.1.3` 后，用旧版 macOS 客户端手动触发“检查更新”，确认能发现新版本、下载 ZIP 并进入重启安装流程。

风险与后续:
- 当前仍是无签名构建，macOS 自动安装体验仍可能受 Gatekeeper、签名和 notarization 影响。
- 本次保持当前 arm64 产物策略，不扩展 Intel/x64 或 universal；如需支持 Intel Mac，需要单独设计多架构发布方案。
- 不直接修复历史 `v0.1.2` assets，避免缓存和发布追溯混乱。

验收标准:
- 本地 macOS 打包生成 `.zip`、`.dmg`、对应 blockmap 和 `latest-mac.yml`。
- `latest-mac.yml` 的 `path` 指向 ZIP，且 `files` 同时列出 ZIP 和 DMG。
- 配置回归测试覆盖 macOS ZIP 和 workflow 上传规则。
- 发布 `v0.1.3` 后，旧版本客户端不再出现 `ZIP file not provided`。
