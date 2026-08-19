## 1. 工作区启动日期基准

- [x] 1.1 增加可测试的日期基准刷新辅助逻辑：输入保存的 K 线 query 和启动日期，输出 `endDate` 为当天、`startDate` 按原跨度平移后的 query。
- [x] 1.2 在 `StockWorkspaceViewModel.loadSettings()` 中应用日期基准刷新，确保启动刷新前运行态 query 已对齐当天。
- [x] 1.3 当日期基准发生刷新时，通过现有 `setWorkspaceSettings` 路径保存调整后的 workspace 设置；保存失败不阻止启动刷新。
- [x] 1.4 保持同一会话内用户手动修改 `startDate` / `endDate` 的行为不变，不在普通保存、刷新、策略回测或打开缓存弹窗时强制重置到当天。

## 2. 联动行为和回归测试

- [x] 2.1 更新 `tests/stock-workspace-view-model.test.ts`，覆盖保存范围 `20260801-20260810` 在 `20260819` 重启后调整为 `20260810-20260819`，且启动 K 线刷新使用调整后的 query。
- [x] 2.2 补充当天重复重启场景：保存 `endDate` 已等于当前启动日时，日期范围保持不变且不产生不必要保存。
- [x] 2.3 补充同会话手动历史日期场景：用户通过顶部日期 setter 设置历史范围后，后续刷新、策略回测和缓存弹窗默认日期继续使用用户手动值。
- [x] 2.4 补充异常日期场景：保存日期不可解析或 `startDate > endDate` 时，日期范围回退为当前启动日结尾的默认滚动窗口，并保留非日期 query 字段。

## 3. 文档和变更记录

- [x] 3.1 更新 `README.md`，说明保存过工作区后重启仍会把 K 线日期基准滚动到当天，并保持原日期窗口长度。
- [x] 3.2 更新应用内 `使用说明书`，同步 K 线日期范围的重启自动滚动行为，以及手动历史日期在当前会话内仍可使用。
- [x] 3.3 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.10` 区块，记录本次用户可见行为变更。

## 4. 验证

- [x] 4.1 运行 `openspec validate refresh-date-baseline-on-startup --strict`。
- [x] 4.2 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 4.3 运行 `yarn test tests/stock-workspace-view-model.test.ts`。
- [x] 4.4 运行 `yarn test tests/changelog-release-notes.test.mjs` 和 `yarn test tests/release-version.test.mjs`。
- [x] 4.5 运行 `yarn typecheck` 和 `yarn test`。
