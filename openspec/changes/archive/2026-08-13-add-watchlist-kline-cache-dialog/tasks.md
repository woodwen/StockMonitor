## 1. 类型与缓存模型

- [x] 1.1 将共享类型中的 `KlineCacheRequestQuery` 从单值 `period`、`adjust` 调整为 `periods: StockPeriod[]` 和 `adjusts: StockAdjust[]`，并同步状态查询、刷新、清理请求与 job row 类型。
- [x] 1.2 保持底层缓存 series key 为 `sourceId + symbol + period + adjust`，确保数组请求只在查询和任务层展开，不改变单组合缓存隔离语义。
- [x] 1.3 更新缓存状态行标识和选择模型，使一行稳定对应一个 `symbol + period + adjust` 组合，并携带可用于刷新/清理的完整 query 维度。
- [x] 1.4 补充 `periods` 或 `adjusts` 为空、日期范围无效、数据源能力不支持组合的 normalize 与错误状态处理，确保空周期或空复权同时阻止查询和刷新。

## 2. Main Process 缓存服务与 IPC

- [x] 2.1 更新缓存状态查询服务，按 `watchlist items × periods × adjusts` 展开并返回一行一个组合的 `complete`、`partial`、`empty`、`unsupported` 或错误状态。
- [x] 2.2 更新手动批量刷新 job，将请求展开为多个单组合 `StockQuery` 顺序执行；不支持的组合跳过远端请求并标记 `unsupported`。
- [x] 2.3 更新刷新 job 的进度和行级状态，使 `total`、`completed`、`current` 和错误消息都以组合行为单位统计。
- [x] 2.4 更新清理能力，按表格选中的 `symbol + period + adjust` 组合删除对应本地缓存 series，不删除 watchlist、不影响当前图表 dataset。
- [x] 2.5 同步 `src/main/ipc.ts`、`src/preload/stock-api.ts` 和 `src/preload/index.ts` 的 typed cache API，确保所有 IPC payload 都是可 structured clone 的普通对象。
- [x] 2.6 确认缓存读取 API 仍按单个 `StockQuery` 读取本地缓存，范围不完整时返回 `missingRanges`，不静默请求远端补齐。

## 3. Renderer ViewModel 与 UI

- [x] 3.1 更新 `StockWorkspaceViewModel` 的缓存弹窗查询草稿：数据源保持单选，默认 `sourceId` 和日期范围来自当前 K 线 query，默认 `periods = ['day', 'week', 'month']`、`adjusts = ['qfq', 'none', 'hfq']` 并按数据源能力过滤。
- [x] 3.2 实现切换缓存数据源时只保留该数据源支持的已选 periods/adjusts；若没有交集，清空对应选择、展示错误并阻止查询和刷新。
- [x] 3.3 将缓存弹窗 UI 中的周期和复权控件从单选下拉改为复选框组，默认全选基础日/周/月和前复权/不复权/后复权。
- [x] 3.4 将缓存状态表格调整为一行一个 `symbol + period + adjust` 组合，展示 `名称 / 周期 / 复权 / 状态 / 记录 / 缓存范围 / 缺失范围 / 最近刷新 / 消息`。
- [x] 3.5 更新按钮语义：`刷新全部` 刷新当前自选股全部选中组合，`刷新选中` 刷新表格选中组合，`清理选中` 清理表格选中组合。
- [x] 3.6 更新选中状态、全选、清空选择、取消任务、错误提示和窄窗口样式，确保组合行增多时交互和文本不重叠。

## 4. 测试覆盖

- [x] 4.1 更新缓存模型/范围工具测试，覆盖组合展开、空 periods/adjusts、unsupported、complete、partial、empty、lastError、重叠区间和重复 candle。
- [x] 4.2 更新 main process 缓存服务测试，覆盖组合状态查询、组合刷新失败继续、unsupported 跳过请求、取消任务和按组合清理。
- [x] 4.3 扩展 `tests/ipc-handlers.test.ts`，验证新增或调整后的 IPC channel 接收 `periods`/`adjusts` 数组并调用对应缓存服务。
- [x] 4.4 扩展 `tests/stock-workspace-view-model.test.ts`，验证默认全选、数据源单选、数据源切换能力过滤、无交集错误、未选择周期/复权阻止查询和刷新、分时模式不被切换、缓存任务不替换当前图表 dataset。
- [x] 4.5 扩展 `tests/remote-stock-sources.test.ts` 或缓存服务测试，验证缓存刷新使用数据源能力校验和代理设置，且不跨源 fallback。

## 5. 文档与验证

- [x] 5.1 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块，记录自选股历史 K 线缓存管理弹窗支持多周期、多复权组合。
- [x] 5.2 运行 `openspec validate add-watchlist-kline-cache-dialog --strict`。
- [x] 5.3 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 5.4 运行项目必要验证：`yarn typecheck`、`yarn test`、`yarn build`，以及相关定向测试。
