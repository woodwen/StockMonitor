## Context

当前默认工作区 query 由 `createDefaultStockQuery()` 和主进程 store 的默认 workspace 设置生成：`endDate` 使用启动日，`startDate` 使用启动日前两年。保存过工作区设置后，`loadSettings()` 会恢复保存的 query，并在启动刷新中使用该 query。

这导致日期范围从“基于启动日滚动”退化为“保存时固定”。例如用户在 2026-08-10 保存了最近 10 天范围，2026-08-19 重启后仍会查询到 2026-08-10，而不是自动滚动到 2026-08-19。

本 change 只规划用户可见行为和后续实施路径，不改实现代码、不提交、不 archive。

## Goals / Non-Goals

**Goals:**

- 每次应用重启加载工作区设置时，K 线 query 的结束日期自动对齐当前启动日。
- 保留用户保存的日期窗口长度，按原 `startDate` 到 `endDate` 的跨度平移开始日期。
- 让启动 K 线刷新、策略回测日期来源和历史 K 线缓存弹窗默认日期都使用调整后的 query。
- 保留用户保存的非日期工作区状态，包括 symbol、sourceId、period、adjust、viewMode、timeshareSourceId、指标设置、策略设置和 watchlist。
- 避免在同一会话内覆盖用户手动选择的历史日期范围。
- 补充测试和用户文档说明。

**Non-Goals:**

- 不新增“固定日期范围/滚动日期范围”开关。
- 不改变日期输入控件、日期格式或用户手动编辑能力。
- 不把日期调整到最近交易日；本 change 使用当前自然日的 `YYYYMMDD`，保持与现有默认日期生成逻辑一致。
- 不改变远端数据源请求参数协议或本地 K 线缓存文件格式。
- 不改变策略回测算法、评分、手续费、滑点、缓存完整性校验或分时自动刷新策略。

## Decisions

1. 重启加载阶段执行日期基准刷新。

   日期基准刷新应放在工作区 `loadSettings()` 读取保存设置之后、启动 `refreshStock({ allowStartupFallback: true })` 之前。这样启动刷新、顶部日期控件、策略回测 query 和缓存弹窗默认 query 都能看到同一份调整后的运行态 query。

2. `endDate` 始终对齐启动日。

   若保存的 `endDate` 不等于当前启动日，系统 SHALL 将运行态 query 的 `endDate` 设为当前启动日。该规则同时覆盖保存日期早于当天和由于系统时间变化导致保存日期晚于当天的情况。

3. `startDate` 按保存日期跨度平移。

   当保存的 `startDate` 和 `endDate` 可解析且 `startDate <= endDate` 时，系统 SHALL 计算两者之间的天数跨度，并用 `当前启动日 - 跨度` 得到新的 `startDate`。例如保存范围为 `20260801` 到 `20260810`，在 `20260819` 重启后应调整为 `20260810` 到 `20260819`。

4. 异常日期回退到默认滚动窗口。

   若保存日期无法解析或保存的 `startDate > endDate`，系统 SHALL 使用当前启动日结尾的默认日期窗口恢复日期范围。默认窗口沿用现有 fresh workspace 的近两年逻辑，不影响 symbol、sourceId、period、adjust 等非日期字段。

5. 同一会话内手动日期保持用户控制。

   用户通过顶部 K 线日期输入设置历史 `startDate` 或 `endDate` 后，系统 SHALL 按现有行为保存并使用该日期范围，不在本次会话内因为保存、刷新、策略回测或打开缓存弹窗而强制调整到当天。下一次应用重启时才再次刷新日期基准。

6. 调整后的 query 应持久化回工作区设置。

   当重启加载阶段发生日期基准刷新时，ViewModel SHOULD 通过现有 `setWorkspaceSettings` 路径保存调整后的 workspace 设置。这样本地缓存导出、后续设置读取和下次启动前的保存状态都与运行态一致。保存失败不应阻止启动刷新；应沿用现有设置保存失败处理。

## Risks / Trade-offs

- [Risk] 有用户希望重启后继续查看某个历史固定区间。→ Mitigation：本需求明确要求重启自动对齐当天；同一会话内仍允许手动查看历史区间。暂不增加额外开关，避免引入新配置复杂度。
- [Risk] 以自然日而非交易日作为结束日期，周末或节假日可能查询到没有当天 K 线。→ Mitigation：现有默认行为已经使用启动自然日；远端数据源和图表会按实际返回数据展示，避免本 change 引入交易日历依赖。
- [Risk] 自动平移较长历史窗口可能触发更大范围查询。→ Mitigation：保留用户原保存跨度，不扩展窗口长度；用户可在顶部日期控件缩短范围。
- [Risk] 启动阶段保存调整后的 query 失败。→ Mitigation：不阻塞启动刷新，记录现有告警并保持运行态 query 已调整。

## Migration Plan

- 在工作区 ViewModel 中增加纯日期辅助逻辑，用当前启动日刷新保存 query 的日期基准。
- 在 `loadSettings()` 中对读取到的 workspace query 执行日期基准刷新，并在发生变化时通过现有工作区设置保存路径持久化调整后的 query。
- 确保 `refreshStock({ allowStartupFallback: true })` 使用调整后的 query。
- 确保历史 K 线缓存弹窗打开时继续从当前 K 线 query 读取调整后的 `startDate` 和 `endDate`。
- 确保策略回测仍统一使用当前 K 线 query 的 `startDate` 和 `endDate`。
- 更新 `tests/stock-workspace-view-model.test.ts`，覆盖重启日期平移、当天重复重启不改变日期、同会话手动历史日期不被强制覆盖。
- 更新 README、应用内 `使用说明书` 和 `CHANGELOG.md`。
- 运行 OpenSpec、类型、单测和 changelog 校验。

## Confirmed Decisions

用户已确认全部采用默认建议：

- change-id 使用 `refresh-date-baseline-on-startup`。
- 日期基准使用当前自然日，而不是最近交易日。
- 自动调整发生在应用重启加载工作区设置阶段。
- 调整 `endDate` 到当天，同时按原日期跨度平移 `startDate`。
- 不新增用户配置开关。
- 同一会话内用户手动选择历史日期后，系统不强制改回当天。
- 日期基准发生调整后写回工作区设置；保存失败不阻止启动刷新。
