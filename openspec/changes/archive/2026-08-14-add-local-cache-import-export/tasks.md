## 1. 备份格式与主进程服务

- [x] 1.1 定义本地缓存备份文件类型、`schemaVersion: 1` 顶层结构、未压缩未加密 JSON 格式、导入策略类型和结果摘要类型
- [x] 1.2 新增主进程 `local-cache-portability` 服务，导出 settings snapshot 和有效 K 线缓存 entries
- [x] 1.3 实现备份文件校验逻辑，覆盖顶层字段、应用标识、schema 版本、settings 分区和 K 线缓存 entries
- [x] 1.4 实现 `merge` 导入策略，覆盖同名 settings 分区和同 series K 线缓存，保留备份未包含的本地 series
- [x] 1.5 实现 `replace` 导入策略，显式确认后按备份内容重建本地可恢复数据并清理未包含的 K 线缓存 series
- [x] 1.6 为 K 线缓存导入增加 staging 写入和路径边界校验，确保无效 entry 不覆盖本地有效缓存

## 2. IPC、Preload 与 Adapter

- [x] 2.1 在 `src/preload/stock-api.ts` 增加导入导出 typed API 和相关请求/响应类型
- [x] 2.2 在 `src/main/ipc.ts` 注册本地缓存导入导出 IPC handlers，并委托给主进程服务
- [x] 2.3 在 renderer data adapter 中暴露导入导出方法，保持 renderer 不直接读写文件系统
- [x] 2.4 更新 IPC handler 测试，覆盖新 channel 注册、重复注册和参数委托

## 3. 工作区 ViewModel 与 UI

- [x] 3.1 在 `StockWorkspaceViewModel` 中新增导入导出状态、触发方法、确认流程和结果摘要状态
- [x] 3.2 导入成功后重新读取 settings 并刷新工作区、自选股、代理草稿、指标设置、策略偏好和交易计算器设置
- [x] 3.3 若 K 线缓存管理弹窗已打开，导入成功后重新查询缓存状态且不触发远端行情刷新
- [x] 3.4 在工作区添加本地缓存导入导出入口、导入策略确认和成功/失败摘要展示，并在导入确认中提示代理配置恢复
- [x] 3.5 确认用户可见文案不包含投资建议、买卖建议、收益承诺或荐股表述

## 4. 测试覆盖

- [x] 4.1 新增主进程导入导出服务测试，覆盖空缓存导出、有效缓存导出、损坏缓存跳过和备份格式校验
- [x] 4.2 新增 K 线缓存导入测试，覆盖同 series 替换、无效 entry 跳过、`merge` 保留未包含 series 和 `replace` 清理未包含 series
- [x] 4.3 更新工作区 ViewModel 测试，覆盖导入导出调用、导入确认、导入成功后本地状态刷新和不触发远端行情刷新
- [x] 4.4 更新 UI 相关测试，覆盖入口展示、确认流程和结果摘要

## 5. 文档与验证

- [x] 5.1 在 `CHANGELOG.md` 的 `Unreleased / <current package.json version>` 区块记录本地缓存导入导出功能
- [x] 5.2 运行 `yarn test tests/ipc-handlers.test.ts`
- [x] 5.3 运行 `yarn test tests/kline-cache-service.test.ts`
- [x] 5.4 运行 `yarn test tests/stock-workspace-view-model.test.ts`
- [x] 5.5 运行 `yarn typecheck`
- [x] 5.6 运行 `yarn test`
- [x] 5.7 运行 `yarn build`
- [x] 5.8 运行 `openspec validate add-local-cache-import-export --strict`
