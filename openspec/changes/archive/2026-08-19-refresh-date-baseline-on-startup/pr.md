# M-44(feat): 重启滚动 K 线日期基准

OpenSpec Change: refresh-date-baseline-on-startup

## 背景:

- 工作区会持久化 K 线 query 的 `startDate` 和 `endDate`，保存过设置后重启会继续使用旧结束日期。
- 默认 K 线范围本来以启动日为基准生成近两年区间，保存设置后的重启行为需要继续保持这个滚动日期基准。

## 方案概述:

- 在工作区启动加载 settings 时刷新 K 线 query 日期基准，将 `endDate` 调整为启动当天。
- 当保存日期有效时，按原 `startDate` 到 `endDate` 的天数跨度同步平移 `startDate`，保持用户原日期窗口长度。
- 当保存日期不可解析或倒置时，回退到以启动当天结尾的默认滚动窗口。
- 日期基准只在重启加载阶段刷新；当前会话中用户手动选择历史日期后，刷新、缓存弹窗和策略回测继续使用用户手动范围。

## 实现改动:

- 在 `StockWorkspaceViewModel` 增加 `refreshStockQueryDateBaseline` 和日期解析/平移 helper，并通过 `getStartupDate` 选项让测试可注入启动日。
- 在 `loadSettings()` 中应用日期基准刷新，启动刷新前写入运行态 query；发生调整时通过现有 `setWorkspaceSettings` 路径写回，保存失败不阻塞启动刷新。
- 补充 `tests/stock-workspace-view-model.test.ts` 覆盖日期平移、当天重复重启不保存、保存失败仍启动刷新、异常日期回退、当前会话手动历史日期不被覆盖。
- 更新 `README.md`、应用内 `使用说明书` 和 `CHANGELOG.md`，说明重启日期滚动行为。
- 归档 OpenSpec change，并同步更新 `openspec/specs/stock-workspace/spec.md`。

## 测试计划(UT):

- `openspec validate refresh-date-baseline-on-startup --strict`
- `openspec archive refresh-date-baseline-on-startup --yes`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn test tests/stock-workspace-view-model.test.ts`
- `yarn test tests/changelog-release-notes.test.mjs`
- `yarn test tests/release-version.test.mjs`
- `yarn typecheck`
- `yarn test`

## 影响范围(建议手动测试范围):

- 重启应用后检查保存过的 K 线日期范围是否滚动到启动当天，并保持原日期窗口长度。
- 在同一会话内手动输入历史 K 线日期范围后，检查手动刷新、历史 K 线缓存弹窗和策略回测是否继续使用该历史范围。
- 检查保存失败或异常设置恢复时，应用启动刷新不被阻塞。

## 风险与后续:

- 本次使用自然日作为启动日，不引入交易日历；周末或节假日由现有行情返回和图表展示逻辑处理。
- 本次不新增固定日期范围开关；如后续用户需要长期固定历史区间，可另行设计配置项。
