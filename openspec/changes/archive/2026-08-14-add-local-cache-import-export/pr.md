# M-41(feat): 新增本地缓存导入导出

OpenSpec Change: add-local-cache-import-export

背景:
- 用户已有工作区设置、自选股、做T测算设置和历史 K 线缓存等本地可恢复数据，但缺少重装、换机或手动备份时的一键迁移能力。
- OpenSpec change 已完成并归档，能力覆盖 `local-cache-portability`、`kline-cache-management` 和 `stock-workspace`。

方案概述:
- 新增版本化 UTF-8 JSON 备份格式，默认导出所有可恢复本地数据，不包含窗口位置、运行中任务、图表加载态、未保存草稿和远端临时响应。
- 由主进程负责文件选择、格式校验、settings snapshot、K 线缓存枚举和导入写入，renderer 仅通过 typed `window.stockApi` 调用。
- 导入分为预览确认和执行两个阶段，默认 `merge`，支持显式 `replace`；导入成功后只刷新本地状态和缓存状态，不自动触发远端行情刷新。

实现改动:
- 新增 `src/main/local-cache-portability.ts`，实现备份导出、导入预览、导入确认、格式校验和结果摘要。
- 扩展 `src/main/kline-cache.ts` 的缓存导出、导入、staging 写入、同 series 替换和 `replace` 清理能力。
- 扩展 IPC、preload typed bridge、renderer adapter、`StockWorkspaceViewModel`、顶部工具栏和导入导出弹窗，补齐导入确认、代理设置提示和结果展示。
- 更新 `RootViewModel` 与做T测算 ViewModel，使导入 settings 后可以刷新工作区、自选股、代理、指标、策略偏好和做T测算设置。
- 同步 README、CHANGELOG、OpenSpec 主 specs 和归档后的 change artifacts。

测试计划(UT):
- [x] `openspec validate add-local-cache-import-export --strict`
- [x] `openspec validate --all --strict`（归档前）
- [x] `git diff --check`（归档前）
- [x] `openspec archive add-local-cache-import-export --yes`
- [x] `openspec validate --all --strict`（归档后）
- [x] `git diff --check`（归档后）
- [x] `yarn typecheck`
- [x] `yarn test`（30 files / 264 tests）
- [x] `yarn build`

影响范围(建议手动测试范围):
- 在工作区手动导出本地缓存，确认生成 `.stock-monitor-backup.json` 且结果摘要包含 settings 和 K 线缓存数量。
- 使用备份文件分别执行 `merge` 和 `replace` 导入，确认导入前有摘要确认，包含代理设置时有恢复提示。
- 导入后检查工作区设置、自选股、指标偏好、策略偏好、做T测算设置和 K 线缓存管理弹窗状态刷新，并确认未自动发起远端行情刷新。
