## Context

Stock Monitor 当前已经支持 K 线查询、K 线指标配置、`bsSignal` 图表 overlay，以及按 `StockQuery` 读取完整历史 K 线缓存的能力。现有边界要求 renderer 通过 `window.stockApi` 访问主进程能力，ViewModel 负责编排，model 负责纯业务计算，chart adapter 只渲染准备好的数据。

本 change 新增的是面向 K 线历史数据的策略模板、回测和历史表现排名。它会跨越 model、ViewModel、renderer UI 和 KLineCharts adapter，但不应引入 renderer 直连远端行情接口，也不应把回测结果包装成投资建议。

## Goals / Non-Goals

**Goals:**

- 提供可发现、可参数化的 K 线策略模板，并支持同时比较多个模板。
- 基于当前 K 线数据或完整历史 K 线缓存生成买入/卖出信号、交易明细、收益指标和最大回撤。
- 在 K 线工作区中展示策略结果摘要、交易列表、收益/回撤曲线状态和图表信号标记。
- 让回测计算可复现：同一数据集、策略参数和回测假设 SHALL 得到一致结果。
- 明确用户可见文案边界：展示历史回测与策略信号分析，不提供投资建议、买卖建议、荐股服务、收益承诺或自动交易。

**Non-Goals:**

- 不实现自动下单、交易账户接入或实时交易提醒。
- 不实现机器学习选股、跨股票组合优化或跨市场套利。
- 不在 renderer 直接请求远端行情接口；策略回测触发的历史数据补齐必须通过现有 typed adapter 和主进程 K 线缓存刷新能力完成。
- 不把第一版做成通用脚本策略编辑器；仅支持内置模板和受控参数。
- 不在第一版模拟 T+1、涨跌停无法成交、最小交易单位、卖出印花税拆分等真实交易制度细节。
- 不在第一版提供 DatePicker 或“近 3 月 / 近 1 年 / 近 3 年”等回测区间快捷预设。

## Decisions

1. 回测核心放在 `stock-workspace/models`

   策略模板定义、参数 normalize、指标计算、信号生成、交易撮合和指标统计都作为纯 TypeScript model 函数实现。ViewModel 只维护策略面板状态、运行状态、当前结果和持久化触发；React View 只展示状态并触发命令；KLineCharts adapter 只渲染传入的信号 overlay。

   Alternatives considered: 将策略计算放入 ViewModel 可以更快接 UI，但会让状态编排和业务计算耦合，难以单测；放到 main process 可以复用缓存读取，但会增加 IPC 表面，并让纯计算测试变重。第一版优先在 renderer model 中计算，数据读取仍通过现有 typed adapter。

2. 第一版以 K 线缓存作为策略回测数据源

   策略面板 SHALL 提供独立的 `startDate` / `endDate` 回测区间输入，日期输入沿用工作区现有 `YYYYMMDD` 文本格式。首次使用且尚无已保存策略区间时，默认取当前 K 线 query 的日期范围；已保存策略区间时恢复上次回测区间。运行回测时使用当前 `sourceId`、`symbol`、`period`、`adjust` 加上策略面板选择的日期范围组成策略 query。

   策略回测 SHALL 通过 `StockDataAdapter.getCachedKlineDataset(query)` 读取完整本地缓存，保证回测输入可复现且和缓存覆盖范围绑定。当缓存为空、缺失区间、不完整，或返回 dataset 的实际 candles 起止范围无法覆盖所选回测区间时，ViewModel SHALL 通过现有 K 线缓存刷新能力为该策略 query 触发缓存下载/刷新，并在策略面板展示“正在准备历史 K 线缓存”的独立状态；缓存刷新完成后 SHALL 再读取缓存并校验实际 candles 起止范围，只有覆盖所选回测区间时才执行回测。缓存准备状态第一版使用运行按钮 loading 和面板内简短状态文本，不新增复杂进度条。当前 K 线图表 dataset 不作为缓存缺失或不完整时的替代输入，避免绕过缓存覆盖校验；图表 dataset 仅用于当前行情展示和图表信号渲染。结果展示 SHALL 区分用户选择的回测区间和实际参与计算的 K 线数据区间；成功回测结果的实际数据区间 SHALL 覆盖用户选择区间，若刷新后仍无法覆盖则阻止本次回测并展示缺失范围。第一版不提供“同步当前图表区间”按钮和区间快捷预设。

   Alternatives considered: 缓存缺失时直接阻止回测并提示用户手动刷新，交互更简单，但会打断策略分析流程；renderer 直接请求远端行情接口可以最快补齐数据，但违反项目边界。默认采用现有主进程 K 线缓存刷新链路，保持代理、数据源能力、落盘和错误处理一致。若后续要对 watchlist 批量排名，再扩展 main/preload/adapter 并补 IPC 测试。

3. 策略模板采用受控 registry

   第一版内置模板建议包含 `ma-cross`、`breakout-pullback`、`rsi-reversion`、`macd-trend-confirmation`。每个模板暴露稳定 id、名称、说明、参数 schema、默认参数、最小样本数、兼容周期和信号解释。第一版策略周期范围 SHALL 限定为 `day`、`week`、`month`，`5`、`15`、`30`、`60` 分钟 K 线 SHALL 标记为暂不支持策略回测。模板 registry 支持后续新增模板和扩展周期，但不支持用户自定义脚本。

   多策略比较中，模板参数校验 SHALL 按模板粒度处理：日期区间、回测假设和空模板选择属于阻塞整次运行的表单错误；单个模板参数无效时，该模板结果 SHALL 标记为不可用并展示原因，其他参数有效的模板 SHALL 继续运行并参与历史表现排名。

   Alternatives considered: 直接复用现有指标开关可以减少 UI，但策略模板不仅是指标展示，还包含交易触发、参数和回测假设，应独立建模。

4. 回测执行采用明确且简单的默认假设

   第一版默认使用多头、全仓、单笔持仓模型：买入信号在下一根 K 线开盘价成交；持仓期间忽略重复买入信号；卖出信号在下一根 K 线开盘价成交；最后仍持仓时按最后一根 K 线收盘价估值并标记为未平仓。默认 `initialCapital` 为 `100000`，默认 `feeRate` 为 `0.0005`（界面展示为 `0.050%`），默认 `slippageRate` 为 `0.0002`（界面展示为 `0.020%`），用于给历史回测提供接近真实但仍可编辑的成本假设；所有假设在结果中展示。第一版不拆分佣金、经手费、过户费、印花税和买卖方向差异，也不模拟 T+1 或涨跌停无法成交。

   Alternatives considered: 支持分批仓位、止损止盈、A 股真实税费和 T+1 规则更贴近实盘，但规则更复杂且容易让结果看起来像交易建议。第一版先保证 deterministic 和可解释。

5. 历史表现排名使用透明评分

   默认按 `returnDrawdownRatio = totalReturn / max(abs(maxDrawdown), 0.01)` 降序排序，并展示参与排序的总收益率、最大回撤、交易次数和样本区间。样本不足、交易次数为 0 或结果不可用的模板 SHALL 不进入推荐排名，只显示不可用原因。

   Alternatives considered: 只按总收益率排序容易忽略回撤风险；复杂多因子评分会增加解释成本。收益回撤比简单透明，适合作为第一版默认。

## Risks / Trade-offs

- [Risk] 历史回测被误读为未来收益或买卖建议 → Mitigation: UI 文案使用“历史回测排名”“信号”“候选策略”，展示免责声明，禁止收益承诺和直接买卖建议措辞。
- [Risk] 数据区间不完整导致回测结果不可复现 → Mitigation: 回测前先读取本地缓存并校验覆盖范围；缓存不完整时通过现有 K 线缓存刷新链路下载缺失数据，刷新后再读取缓存执行回测。
- [Risk] 多策略和较长历史区间造成 UI 卡顿 → Mitigation: 先以同步纯函数实现并限制第一版范围；若测试显示卡顿，再把计算切分为可取消任务或迁移到 worker。
- [Risk] 指标公式与 KLineCharts 内置指标不一致 → Mitigation: strategy model 自带公式和测试，不依赖 chart adapter 内部计算；结果展示说明模板参数和计算口径。
- [Risk] 费用、滑点、交易制度默认值争议 → Mitigation: 采用接近 A 股普通撮合交易的默认费用/滑点近似值，并在结果中显式展示且允许用户编辑；把真实税费拆分、T+1、涨跌停无法成交等制度模拟列为后续增强。

## Migration Plan

- 新增策略相关 model 类型、模板 registry、计算函数和单元测试，不迁移已有指标数据。
- 扩展 `WorkspaceSettings` normalize，旧设置缺少策略字段时补齐默认值；策略回测区间作为策略偏好持久化，已保存的兼容区间在下次打开策略面板时恢复；无默认版本标记且仍为旧 `100000 / 0 / 0` 成本假设的策略设置迁移到新的默认费用率和滑点率，后续用户显式保存 `0` 时保留用户输入。
- 在 K 线工作区中新增策略面板和图表信号 overlay，不改变分时默认启动模式。
- 复用现有 K 线缓存刷新能力补齐策略 query 对应历史数据；若实施需要新增 typed bridge 或 adapter 方法，应同步更新 preload、main IPC 和相关测试。
- 用户可见功能实施时更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块。
- 如实施过程中新增或修改 `StockApi`/IPC channel，同步更新 preload、adapter 和 `tests/ipc-handlers.test.ts`。

## Confirmed Defaults

- 回测区间 SHALL 持久化，默认恢复上次回测区间；尚未保存时使用当前 K 线 query 区间。
- 结果展示 SHALL 优先展示用户选择的回测区间；成功回测前 SHALL 校验实际 candles 起止范围覆盖所选区间，刷新后仍不覆盖时 SHALL 阻止本次回测并展示缺失范围。
- 用户切换股票、数据源、周期或复权口径时 SHALL 清空旧策略结果和旧图表信号，但 SHALL 保留策略面板中的回测区间输入，便于用户沿用同一历史窗口。
- 日期输入 SHALL 使用 `YYYYMMDD` 文本格式，保持和顶部 K 线查询一致；第一版不使用 DatePicker。
- 默认成本假设 SHALL 保持 `feeRate = 0.0005`、`slippageRate = 0.0002`；成本不拆分为买入/卖出不同税费。
- 历史数据缺失时 SHALL 通过现有 K 线缓存刷新能力先下载/刷新缓存，完成后再读取缓存执行策略回测；renderer SHALL NOT 直接请求远端行情接口。
- 第一版运行策略前 SHALL 先读取本地 K 线缓存；缓存缺失或不完整时 SHALL 触发缓存刷新，当前图表 dataset 不作为替代执行输入。
- 缓存刷新状态 SHALL 使用现有运行按钮 loading 和策略面板简短状态文本；第一版不新增复杂进度条。
- 缓存刷新失败时 SHALL 阻止本次回测并展示失败原因和缺失区间，SHALL NOT 改变当前图表或清空已有策略结果。
- 第一版 SHALL NOT 模拟 T+1、涨跌停无法成交、最小交易单位、卖出印花税等真实交易制度细节。
- 历史表现排名 SHALL 保持 `returnDrawdownRatio = totalReturn / max(abs(maxDrawdown), 0.01)`，文案使用“历史表现排名”或“候选策略”。
- 第一版 SHALL NOT 提供“近 3 月 / 近 1 年 / 近 3 年”等区间快捷预设；如后续高频使用再单独扩展。
