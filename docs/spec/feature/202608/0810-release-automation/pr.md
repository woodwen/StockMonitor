# M-14(build): 修复 Linux AppImage 可执行文件名

## 背景

- M-13 合并到远端 `master` 后 Release workflow 再次触发，但 Linux matrix 仍在 `Package linux` 步骤失败。
- 用户提供的 GitHub Actions 日志显示，AppImage 已开始构建，但 electron-builder 报错 `executableName contains characters that cannot be safely used in file paths`。
- 当前项目 npm 包名是 scoped package：`@woodwen/stock-monitor-electron`，用于 GitHub Packages 发布，不能直接改名。

## 方案概述

- 保留 scoped npm 包名，避免影响 GitHub Packages 发布坐标。
- 只在 Linux build 配置中显式指定安全的 `executableName`。
- 新增配置保护 UT，防止后续删除 Linux executableName 或重新引入 `@`、`/` 等 AppImage 不允许的路径字符。

## 实现改动

- 更新 `package.json`：
  - 在 `build.linux` 下新增 `executableName = "stock-monitor"`。
  - 保持 Linux target 为 `AppImage`，保留 `toolsets.appimage = "1.0.3"`。
- 新增 `tests/package-build-config.test.mjs`：
  - 校验 package name 仍为 `@woodwen/stock-monitor-electron`。
  - 校验 Linux executableName 固定为 `stock-monitor`。
  - 校验 executableName 满足 AppImage 安全字符白名单，且不包含 `@` 或 `/`。

## 测试计划(UT)

- `yarn test tests/package-build-config.test.mjs --reporter=verbose`
- `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"`
- `git diff --check`
- `yarn typecheck`
- `yarn test --reporter=verbose`
- `yarn build`

## 影响范围(建议手动测试范围)

- push/merge 到 `master` 后，确认 Release workflow 的 Linux matrix 能完成 `Package linux`。
- 确认 Linux artifact 中包含 `.AppImage`。
- 确认 GitHub Packages 仍使用 `@woodwen/stock-monitor-electron` 作为 npm package name。
- 确认 macOS 和 Windows 打包不受 Linux-only executableName 配置影响。
- 确认三平台 artifact 都上传成功后，`publish` job 创建 GitHub Release 并发布 GitHub Package。

## 调查结论

- 当前失败不是 workflow 触发问题，也不是版本校验、FUSE 依赖或 AppImage toolset 下载问题。
- Linux AppImage 失败的直接原因是 electron-builder 从 scoped package name 派生出的 executableName 为 `@woodwenstock-monitor-electron`，包含 AppImage 新 runtime 不允许的 `@` 字符。
- electron-builder Linux packager 支持通过 `build.linux.executableName` 覆盖该派生值。

## 风险与后续

- Linux 完整 AppImage 打包仍以 GitHub Actions runner 为最终验收环境，本地 macOS 只能验证配置、UT 和应用构建。
- `desktopName` 和 icon warning 不是本次失败原因，本次不扩大范围处理。

## 验收标准

- Linux executableName 不再从 scoped npm package name 派生。
- 本地配置保护 UT 通过。
- 下一次 `master` 发布 run 生成 Linux AppImage artifact。
