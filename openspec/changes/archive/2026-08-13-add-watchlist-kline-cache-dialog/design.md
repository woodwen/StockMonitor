## Context

Stock Monitor 当前通过 `StockWorkspaceViewModel` 编排单只证券的 K 线和分时刷新，renderer 侧通过 `ElectronStockDataAdapter` 调用 `window.stockApi`，再由 preload bridge 进入 main process 的 IPC handler，最终由 `remote-stock-sources` 请求远端行情源。自选股只作为本地工作区设置中的 watchlist 存在，尚无批量历史 K 线缓存、缓存完整性状态或可供后续策略读取的本地数据层。

这个 change 要新增一个面向自选股的历史 K 线缓存管理弹窗。它跨越 main process 持久化、typed preload API、MobX ViewModel、Ant Design UI 和行情源能力校验，因此需要先明确缓存维度、完整性定义和任务模型。

## Goals / Non-Goals

**Goals:**
- 为自选股提供历史 K 线缓存管理弹窗，按每个 `symbol + period + adjust` 组合展示缓存状态、覆盖范围、缺失范围、记录数、最近刷新时间和错误原因。
- 在 main process 侧提供文件型 K 线缓存服务，按 `sourceId`、`symbol`、`period`、`adjust` 维度隔离缓存数据。
- 支持用户基于当前 K 线查询默认值选择单一 source、多个 periods、多个 adjusts、startDate 和 endDate，对全部组合或表格选中的组合执行手动批量刷新。
- 通过 typed preload bridge 提供缓存状态查询、刷新任务启动/查询/取消、缓存数据读取能力，保证 renderer 不直接请求远端行情接口。
- 保持缓存任务与当前图表刷新互不破坏：缓存失败不清空图表，图表刷新失败不清空缓存。
- 支持用户按表格选中的 `symbol + period + adjust` 组合清理缓存。

**Non-Goals:**
- 不在本 change 中实现策略回测、策略扫描或策略编辑 UI。
- 不默认让当前 K 线图表优先读取缓存；图表远端刷新行为保持现有语义。
- 不引入 SQLite、IndexedDB 或外部数据库依赖。
- 不提供跨设备同步、云端缓存或自动定时全量缓存。
- 不在第一版实现全局缓存容量策略、缓存压缩或跨 query 维度批量清理。
- 不尝试维护完整交易日历；完整性以成功缓存过的请求范围为准。
- 不在第一版默认包含 `5`、`15`、`30`、`60` 分钟线组合。

## Decisions

1. **缓存存储放在 main process 文件目录，而不是 `WorkspaceSettings`**

   方案：新增 `src/main/kline-cache.ts`，默认使用 `app.getPath('userData')/kline-cache/v1` 作为缓存根目录。每个 series key 保存独立 JSON 文件，series key 由 `sourceId`、normalize 后的 `symbol`、`period`、`adjust` 组成。文件内保存 normalized candles、成功覆盖区间、最近刷新时间和最近错误摘要。

   理由：历史 K 线数据量明显大于用户设置，把 candles 写进 `electron-store` 的 settings 会扩大设置文件、增加损坏影响面，也会让 watchlist 设置和行情缓存难以独立清理。文件型缓存无需新增依赖，便于测试时注入临时目录。

   备选：使用 `electron-store` 保存所有缓存。放弃原因是文件体积和写放大风险较高，且缓存清理粒度差。使用 SQLite 更适合长期策略数据仓库，但会引入新依赖和打包复杂度，不适合第一版。

2. **完整性以“成功覆盖区间”判定，而不是推断所有交易日**

   方案：缓存服务记录每次成功远端请求的 normalized query range。查询状态时把用户请求范围与已成功覆盖区间相减，得到 `missingRanges`。若 requested range 全部被覆盖且缓存中存在有效 candles，则状态为 `complete`；部分覆盖为 `partial`；无覆盖为 `empty`；能力不支持为 `unsupported`；最近一次刷新失败但仍有旧覆盖时同时返回 `lastError`。

   理由：A 股交易日、停牌、指数/ETF 差异和分钟周期缺口都不能靠简单自然日推断。把远端响应视为该请求范围内的权威数据，能避免把节假日误报为缺口。后续如引入交易日历，可在这个状态模型上扩展更严格的缺口检测。

   备选：按自然日或固定分钟间隔推断缺失。放弃原因是误报多，且会把数据源自身不返回的非交易时段误判为不完整。

3. **批量刷新使用 main process job，renderer 轮询状态**

   方案：新增缓存任务模型：`startKlineCacheRefresh(request)` 创建 job，main process 将 `KlineCacheRequestQuery` 中的自选股、`periods` 和 `adjusts` 展开为多个单组合 `StockQuery`，再按队列顺序逐个缓存；展开时执行数据源能力校验，不支持的组合跳过远端请求并标记为 `unsupported`。`getKlineCacheJob(jobId)` 返回总数、已完成数、当前行、每行 `symbol + period + adjust` 状态和错误；`cancelKlineCacheJob(jobId)` 标记取消，任务在当前请求结束后停止。renderer 弹窗定时轮询 job 状态并在结束后刷新 status list。终态 job 只保留短时间查询窗口，并设置保留数量上限，避免主进程长期累积历史行状态。

   理由：批量请求可能持续较久，任务状态属于 main process 更稳定；轮询比新增多条事件通道更简单，也避免 renderer 重载时丢失短时事件。第一版顺序刷新可以降低远端限流和代理错误放大风险。

   备选：renderer 逐个调用 `fetchStockDataset` 并自行汇总。放弃原因是 renderer 会承担批量远端编排，削弱 main/preload 数据边界，也无法稳定复用缓存服务。

4. **缓存请求使用 `periods` / `adjusts` 数组，底层 series 仍保持单组合 key**

   方案：共享类型中的 `KlineCacheRequestQuery` 从单值 `period`、`adjust` 扩展为 `periods: StockPeriod[]` 和 `adjusts: StockAdjust[]`。状态查询、刷新和清理入口都接受数组请求，但缓存服务内部仍以单个 `sourceId + symbol + period + adjust` 生成 series key。状态列表一行对应一个 series，行 id 也包含 `sourceId`、`symbol`、`period`、`adjust`，便于选中部分组合刷新或清理。

   理由：用户需要一次覆盖多个周期和复权口径，但缓存文件天然应按单组合隔离，避免不同周期或复权混写。表格按组合拆行比把同一股票的 9 个组合折叠到一行更直接，完整性、失败原因、选中刷新和清理都更容易解释和测试。

   备选：保留单值 query，由 renderer 循环多次查询和刷新。放弃原因是会把组合展开逻辑分散到 UI 层，并让进度、取消和错误聚合更复杂。把 9 个组合折叠到同一股票行。放弃原因是行内状态过多，不利于部分重试和清理。

5. **缓存读取不静默补远端**

   方案：新增缓存读取 API，例如 `getCachedKlineDataset(query)`。当请求范围完整时返回 `StockDataset` 形态的数据；不完整时返回带 `missingRanges` 的明确错误或结果状态，由未来策略模块自行决定是否先触发缓存刷新。

   理由：策略运行需要可重复的数据输入。如果读取缓存时隐式请求远端，策略结果会受网络、数据源变化和失败重试影响。

   备选：读取缓存时自动补齐缺失数据。放弃原因是策略数据可复现性较差，也会让 UI 查询与策略读取边界不清晰。

6. **弹窗默认范围取当前 K 线查询，周期/复权默认全选基础组合**

   方案：缓存弹窗打开时读取 `StockWorkspaceViewModel.query` 的 K 线 `sourceId`、`startDate`、`endDate` 作为默认值；数据源控件保持单选。周期控件使用复选框组，默认 `periods = ['day', 'week', 'month']`；复权控件使用复选框组，默认 `adjusts = ['qfq', 'none', 'hfq']`。默认值会按当前数据源能力过滤，只保留该 source 支持的周期和复权。用户切换数据源时，只保留新数据源支持的已选周期/复权；若没有交集，则清空对应选择并显示错误，用户重新选择后才能查询或刷新。若用户清空所有周期或所有复权，查询和刷新都被阻止并提示。即使当前工作区处于分时模式，也允许管理 K 线缓存，但不切换图表模式、不触发图表刷新。

   理由：缓存是管理动作，不应破坏用户正在查看的分时或 K 线状态；复用当前 K 线 query 的 source 和日期能减少用户重复输入。默认全选基础日/周/月和三种复权口径，可以一次准备后续策略常用的 9 个组合，同时避免第一版把分钟线纳入高流量默认任务。

   备选：只在 K 线模式展示入口。放弃原因是自选股缓存管理与当前图表模式没有强依赖，会降低可发现性。

7. **第一版只做手动批量刷新，不做自动定时缓存**

   方案：缓存任务只能由用户在缓存管理弹窗内显式点击刷新触发。应用启动、弹窗打开、watchlist 变化和图表刷新 SHALL NOT 自动启动批量缓存任务。

   理由：历史 K 线批量请求可能带来较长网络耗时、数据源限流和代理失败；手动触发让用户能明确控制请求时机和范围。

   备选：应用启动后自动缓存全部自选股。放弃原因是后台网络行为不透明，且在 watchlist 较大时容易造成启动体验和行情源稳定性问题。

8. **清理能力限定为表格选中的组合**

   方案：第一版提供按弹窗表格选中的行清理缓存 series，每行包含 `sourceId`、`symbol`、`period`、`adjust`。按钮语义固定为：`刷新全部` 刷新当前 watchlist 在已选 periods 和 adjusts 下展开的全部组合；`刷新选中` 只刷新表格选中组合；`清理选中` 只清理表格选中组合。清理不删除 watchlist，不改变当前图表 dataset，也不提供全局容量上限或自动清理策略。

   理由：用户最直接的需求是修复某些自选股在特定缓存口径下的数据；全局清理策略需要更多容量、保留期和策略数据依赖规则，适合后续单独设计。

   备选：提供“一键清空全部缓存”和容量上限。放弃原因是容易误删后续策略依赖数据，且容量策略需要额外产品约束。

## Risks / Trade-offs

- [Risk] 文件型 JSON 缓存在 watchlist 很大或分钟周期范围很长时体积可能增长较快 → Mitigation：第一版展示缓存大小并提供按行清理/刷新前覆盖；缓存目录版本化，后续可增加容量上限或迁移到数据库。
- [Risk] 无交易日历的完整性只能表示“请求范围是否成功缓存过”，不能证明每个交易日或分钟都存在 → Mitigation：UI 文案使用“覆盖范围/缺失范围”，不承诺交易日级完整；spec 明确完整性定义，后续可扩展交易日历校验。
- [Risk] 批量刷新可能触发行情源限流或代理不稳定 → Mitigation：第一版顺序请求，行级记录错误，不因为单个 symbol 失败终止全部任务，用户可取消剩余任务。
- [Risk] 默认全选会把每个自选股展开为最多 9 个缓存请求，watchlist 较大时任务时间明显增加 → Mitigation：刷新前展示总行数和进度，第一版顺序执行并支持取消；分钟线不纳入默认组合。
- [Risk] app 退出或崩溃时正在运行的 job 会中断 → Mitigation：已写入成功覆盖区间的数据保留，未完成行下次仍显示缺失；job 状态不要求跨重启恢复。
- [Risk] 后续策略模块可能需要更高性能的查询能力 → Mitigation：缓存服务 API 与文件格式版本化，策略先依赖服务接口而不是直接读文件，未来可替换存储实现。

## Migration Plan

1. 新增 `kline-cache` 文件目录和 `v1` 数据格式；旧版本用户没有该目录时视为无缓存。
2. 新增 typed preload API 和 IPC handlers，保持既有 `fetchStockDataset` API 不变。
3. 新增 renderer 弹窗入口和 ViewModel 状态，使用周期/复权复选框组，默认不自动启动缓存任务。
4. 实施用户可见变更时更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块。
5. 回滚时可移除新入口和 API；用户本地缓存目录可保留为惰性无害数据，或由后续清理工具删除。

## Confirmed Defaults

- 缓存数据源保持单选；默认数据源使用当前 K 线 query 的 `sourceId`，默认日期范围使用当前 K 线 query 的 `startDate` 和 `endDate`；默认设置仍由现有工作区默认 query 提供近 2 年范围。
- 缓存默认周期为 `periods = ['day', 'week', 'month']`，默认复权为 `adjusts = ['qfq', 'none', 'hfq']`；默认值需按当前数据源能力过滤。
- 第一版不默认包含 `5`、`15`、`30`、`60` 分钟线组合。
- 切换数据源后只保留该 source 支持的已选 periods/adjusts；没有交集或用户清空任一组选择时，查询和刷新都被阻止并展示错误。
- 表格保持一行一个 `symbol + period + adjust` 组合，不折叠同一股票的多个组合。
- `刷新全部` 表示当前 watchlist 的全部已选组合；`刷新选中` 和 `清理选中` 只作用于表格选中组合。
- 第一版不做自动定时缓存；只支持用户在缓存管理弹窗内手动批量刷新。
- 完整性按成功覆盖区间判断，不引入交易日历推断。
- 缓存刷新不跨数据源 fallback；同一数据源内部等价备用主机或等价接口 fallback MAY 复用。
- 缓存读取 API 只读本地缓存；范围不完整时返回缺失范围，不静默联网补齐。
- 第一版支持按表格选中的 `symbol + period + adjust` 组合清理缓存，不删除 watchlist，不做全局容量策略。
