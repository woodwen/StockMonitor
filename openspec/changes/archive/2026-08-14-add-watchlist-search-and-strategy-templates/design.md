## Context

当前自选股面板由 `WatchlistPanel` 展示，`StockWorkspaceViewModel` 维护 watchlist、管理模式、添加预览、选择删除和持久化触发。自选股条目点击会切换当前 symbol 并刷新当前视图；管理模式下的选择和删除基于完整 watchlist。

当前 K 线策略回测由 `kline-strategy-backtesting` model 提供受控模板 registry、参数 normalize、信号生成、回测执行和排名计算；`StockWorkspaceViewModel` 负责策略面板状态、运行流程、结果选择和持久化；React View 只展示模板、参数、结果和触发命令。项目边界要求 renderer 不能直接请求远端行情接口，策略历史数据仍应通过现有 typed adapter 和 K 线缓存链路读取。

附件新增 8 个候选策略模板，并包含 `策略模板`、`类型`、`基本逻辑`、`推荐程度` 四类用户可见信息。本 change 的实现应保持这些元数据、信号逻辑、测试和用户说明一致。

## Goals / Non-Goals

**Goals:**

- 在自选股切换面板中提供轻量本地搜索筛选，提升大量自选股时的定位效率。
- 将搜索状态归入 ViewModel，派生出过滤后的 watchlist 展示列表，同时保持 watchlist 数据、持久化顺序和行情刷新边界不变。
- 扩展策略模板数据模型，支持类型、基本逻辑和 1-5 推荐程度元数据。
- 新增附件 8 个策略模板，并为每个模板定义稳定 id、默认参数、参数约束、最小样本数、兼容周期、信号解释和确定性触发规则。
- 保留既有策略模板 id 的兼容性，避免破坏已保存用户偏好。
- 继续使用历史回测、候选策略、历史表现和策略信号等安全文案。

**Non-Goals:**

- 不新增 renderer 直连远端行情接口。
- 不新增 main/preload IPC，除非实施时发现现有缓存 adapter 无法满足读取需求。
- 不实现用户自定义脚本策略、自动交易、实时交易提醒或跨股票批量选股。
- 不改变现有回测成交模型、评分算法、缓存覆盖校验或回测日期来源。
- 不把推荐程度用于自动买卖建议、收益承诺或默认排名替代。

## Decisions

1. 自选股搜索作为 ViewModel 派生状态

   增加 `watchlistSearchText` 和 `filteredWatchlist` 派生列表。输入 normalize 为 trim 后的小写文本，匹配 `symbol`、去市场前缀后的裸代码和 `name`。React View 只绑定输入框和展示 `filteredWatchlist`，不在组件内复制筛选逻辑。

   Alternatives considered: 在 `WatchlistPanel` 内直接 filter 最快，但会把业务行为藏在 View 层，管理模式选择、空状态和测试更难保持一致。放入 model 会让纯 watchlist 逻辑承载 UI 临时状态。ViewModel 是当前项目中最合适的编排位置。

2. 搜索筛选不参与持久化

   `watchlistSearchText` 是面板级临时状态，不写入 `WorkspaceSettings`。关闭自选股面板时清空搜索词，避免用户下次打开时误以为自选股丢失。

   Alternatives considered: 持久化搜索词可以延续用户上下文，但自选股切换属于短任务，持久化容易造成空列表误解。

3. 管理模式操作基于当前筛选结果

   搜索生效时，列表、空状态、`全选`、`反选` 和批量删除入口应只作用于当前过滤结果；已选中但当前被过滤隐藏的条目可以保留选择状态，但确认删除文案和删除行为必须清晰反映实际选中数量。切换或清空搜索不得改变 watchlist 本身。

   Alternatives considered: 管理操作始终作用于完整 watchlist 实现更简单，但用户在筛选结果中点击 `全选` 通常预期只选择可见条目。

4. 策略模板元数据扩展保持纯 model

   在 `KlineStrategyTemplateDefinition` 增加 `typeLabel`、`basicLogic` 和 `recommendationLevel`。`recommendationLevel` 使用 1-5 数值存储，UI 渲染为星级或等效短标签；排序和历史表现排名继续基于回测评分，不基于推荐程度。

   Alternatives considered: 只在 UI 中硬编码附件表格会减少类型改动，但 registry 才是模板发现、参数和说明的单一来源，测试也应直接覆盖元数据完整性。

5. 附件 8 个模板使用独立稳定 id

   新模板建议 id 为 `ma-bullish-alignment`、`n-day-high-breakout`、`volume-breakout`、`bollinger-breakout`、`bollinger-mean-reversion`、`kdj-oversold-rebound`、`atr-trend-following` 和 `low-volume-ma-pullback`。既有 `ma-cross`、`breakout-pullback`、`rsi-reversion`、`macd-trend-confirmation` 保留，避免旧设置中的 `selectedTemplateIds` 被静默改变含义。

   Alternatives considered: 复用或重命名既有相近模板可以减少模板数量，但会破坏已保存偏好和测试语义，也会把“均线交叉”和“均线多头排列”等不同触发逻辑混在一起。

6. 新策略信号仍走既有回测执行器

   每个新增模板只负责生成时间升序的 `buy` / `sell` 信号，交易撮合、成本、权益曲线、最大回撤和排名继续复用现有回测执行规则。通用指标计算优先放在 model 层可测试函数中，例如 Bollinger、KDJ、ATR、成交量均线和多周期 MA。

   Alternatives considered: 为每个模板复制完整回测流程会实现直接，但会导致成交规则和指标统计分叉。统一执行器能保证多策略比较口径一致。

## Risks / Trade-offs

- [Risk] 搜索筛选和管理选择范围不一致，导致误删隐藏条目 → Mitigation: `全选`/`反选` 明确只处理当前过滤结果，删除确认继续显示实际选中数量。
- [Risk] 搜索无结果被误解为 watchlist 为空 → Mitigation: 区分“暂无自选股”和“无匹配自选股”，并提供清空搜索入口。
- [Risk] 新增 8 个模板后默认全选导致运行变慢或 UI 拥挤 → Mitigation: 保留已保存用户选择；新用户默认可全选，但面板用可滚动模板区和表格列展示元数据。若实施验证显示体验过重，可默认只选推荐程度 5 的新增模板。
- [Risk] 推荐程度被误读为买卖建议 → Mitigation: UI 使用“模板推荐程度”或星级元数据，不参与自动排名，旁边保留历史回测限制说明。
- [Risk] 新策略公式边界不明确 → Mitigation: specs 固化默认触发规则和参数；实施时用 deterministic candle fixtures 覆盖每个模板的 buy/sell 信号。
- [Risk] 既有策略设置 normalize 遗漏新增 id → Mitigation: 更新 `KlineStrategyTemplateId`、registry、默认设置、clone/normalize 和测试，确保未知 id 仍被过滤，已知旧 id 保留。

## Migration Plan

- 自选股搜索新增临时 ViewModel 状态和派生列表，不迁移持久化数据。
- 扩展策略模板类型和 registry；旧设置中的既有模板 id 保持有效，未知 id 继续过滤。
- 新用户 fresh settings 默认选择全部可用策略模板；已有用户保留已保存选择，并为新增模板补齐默认参数。
- 用户可见功能实施时更新 `CHANGELOG.md` 的 `Unreleased / <current package.json version>` 区块，并同步说明文档中自选股和策略回测描述。
- 验证至少运行 `yarn typecheck`、`yarn test`、`yarn test tests/stock-workspace-view-model.test.ts` 和 `yarn test tests/kline-strategy-backtesting.test.ts`。

## Confirmed Defaults

- 附件星级按图片识别固定为：均线多头排列 5、N 日新高突破 5、放量突破 5、布林带突破 4、布林带均值回归 4、KDJ 超卖反弹 3、ATR 趋势跟踪 5、缩量回踩均线 5。
- 自选股搜索词不持久化，关闭自选股面板时清空。
- 搜索匹配范围为股票名称、完整 symbol 和裸代码，大小写不敏感。
- 搜索后管理模式的 `全选`/`反选` 只作用于当前筛选结果；隐藏但已选中的条目保留选择状态。
- 搜索无结果展示“无匹配自选股”语义，不展示“暂无自选股”。
- 新用户 fresh settings 默认选中全部策略模板；已有用户保留已保存的可识别模板选择。
- 推荐程度只作为模板元数据或星级参考展示，不参与历史表现排名。
