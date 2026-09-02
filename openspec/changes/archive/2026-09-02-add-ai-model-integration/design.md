## Context

项目边界已经明确：外部依赖由 `src/main/` 发起，renderer 通过 typed preload bridge 使用主进程能力，View 只展示状态和触发命令，MobX ViewModel 编排用户工作流。AI 模型接入只保留远端 HTTP provider 依赖，renderer 不能直接请求 provider endpoint、读取密钥或拼接完整请求 payload。

当前应用设置保存在 `electron-store` 的 `settings` 下，本地缓存导入导出会导出设置分区。AI connector 的非敏感配置可以进入 settings；HTTP provider 的 API key、Authorization header 和请求历史不能进入普通 settings、renderer 响应、日志或本地备份。

用户反馈本机 CLI/runtime 路线不能稳定提供实时内容展示，且 CLI 状态、登录态和非交互输出格式不可控。最新方案移除 CLI 接入方式，HTTP provider 方案也不能固化可能漂移的 endpoint/model；实施时应按 provider 官方文档确认默认 `baseUrl`、model id 和协议差异，并保持 UI 字段可编辑。

## Goals / Non-Goals

**Goals:**

- 允许用户配置并启用一个 HTTP provider AI connector。
- `http-provider` 支持 OpenAI-compatible HTTP API，并提供 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 的可编辑预设。
- 默认 AI connector 处于禁用状态，用户首次完成配置并测试后再启用。
- 默认 UI 入口放在顶部工具栏或更多菜单，AI 设置弹窗与 AI 分析弹窗分开。
- 支持测试当前 connector，清晰展示 HTTP 配置缺失、鉴权失败、网络失败、超时和响应格式不兼容。
- 支持用户在工作区手动发起 AI 分析，把当前证券和已加载的行情/指标/策略摘要交给当前 connector。
- 支持 10 个明确 AI 使用场景：自然语言生成策略、AI 解读回测报告、AI 策略诊断、AI 参数优化助手、自然语言智能选股、策略多周期/多股票对比、市场环境识别、AI 每日复盘、新闻/公告 + K 线联合分析和 AI/ML 涨跌预测。
- 通过 use-case registry、prompt pack 和 output schema 组织 10 个使用场景；通用自由问答只作为补充入口。
- 保护密钥和认证材料：renderer 不读取明文 API key，日志不记录密钥或 Authorization header，本地备份不导出密钥或请求历史。
- HTTP provider 请求复用应用已有网络代理设置。
- 保持 AI 状态与行情刷新、图表 dataset、K 线缓存和策略回测状态分离。
- 更新说明书、README 和 changelog，明确 connector 类型、发送上下文范围、模型输出不确定性和非投资建议边界。

**Non-Goals:**

- 不内置或代理任何官方模型账号；用户需要自行提供 HTTP provider API key。
- 不让 AI 自动刷新行情、自动下单、自动推荐买卖点、自动改写策略模板或自动修改自选股。
- 不把自然语言策略直接作为可执行策略保存或运行；必须先生成结构化草稿、通过本地校验并由用户确认。
- 不把参数优化助手输出视为本地回测结果；候选参数必须由既有回测引擎验证后再展示排序。
- 不自动抓取或伪造新闻公告；第一版新闻/公告联合分析使用用户提供或已接入的数据摘要，自动新闻公告源应另行约束远端数据源。
- 不把 AI/ML 涨跌预测作为交易信号、买卖建议、收益承诺或未来表现保证。
- 不把 HTTP provider 做成多轮长期聊天、模型市场、用量计费系统或 provider 管理平台。
- 不做多 connector 并发对比、模型投票、长期聊天记忆或流式 markdown 富交互。
- 不做后台自动分析、自动复盘推送、自动调参运行或非用户确认的 AI 请求。
- 不把 AI 输出作为策略回测评分、指标计算结果或行情源数据的一部分。

## Decisions

1. 使用 AI connector 抽象统一 HTTP provider 配置。

   新增 AI connector 类型应包含 `connectorId`、`displayName`、`kind`、`model`、`profile`、`temperature`、`timeoutMs`、`contextLimit`、`availability` 和启用状态。默认状态为禁用，用户首次完成配置并测试后才可启用。`kind` 固定为 `http-provider`，UI 一次只启用一个 connector，避免第一版出现多模型并发和结果对比复杂度。

2. 移除本机 CLI/runtime 接入方式。

   AI 设置弹窗不展示接入方式切换、runtime、可执行文件路径或固定参数。main process 不再启动本机 AI 子进程；读取到旧 `local-runtime` 设置时迁移为禁用的 HTTP provider 默认配置，避免升级后自动发起外部 API 请求。

3. HTTP provider 使用 OpenAI-compatible 最小协议。

   第一版 HTTP provider client 只依赖最小 chat/completions 风格输入与文本输出，并支持 `baseUrl`、`model`、`apiKeyStatus`、`temperature`、`timeoutMs` 和可选 headers allowlist。OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 作为可编辑预设进入 UI。具体默认 endpoint 和常见 model 下拉选项按官方文档确认；如果无法确认，预设只填充 provider 名称和可编辑空字段。

4. HTTP provider 密钥与普通设置分离。

   HTTP API key 使用 main process 独立凭据存储。优先使用 Electron `safeStorage` 加密后保存；若当前平台不支持加密，默认只允许本次会话临时使用 API key，不落盘保存，不提供明文或弱加密持久化降级。任何 `settings:get`、AI settings 读取、IPC 响应、日志和导出备份都只返回 `hasApiKey`、`maskedApiKey` 或 `apiKeyStatus`，不返回明文 key、加密密文或 Authorization header。
   Provider 切换时使用 provider-scoped connector id，避免把上一 provider 的已保存 API key 发送给另一个 provider。
   AI 设置弹窗允许在 API key 输入框使用系统粘贴事件，也提供显式粘贴按钮读取剪贴板；粘贴只进入 renderer 草稿，保存或测试连接时才交给 main process 凭据流程。

5. 所有 AI 调用只在 main process 中发生。

   新增 `src/main/ai-connector.ts` 或等价模块协调 `http-provider` client。renderer 只提交结构化分析请求；main process 负责拼接安全 prompt、执行 HTTP 请求、超时控制、错误归一化和日志脱敏。

6. HTTP provider 请求复用代理并脱敏日志。

   当用户已启用应用网络代理时，HTTP provider 测试和 AI 分析请求 SHALL 复用同一代理配置。HTTP request log 只能记录 provider id、base URL host、model、耗时和状态；不得记录 API key、Authorization header、完整 request body 或包含用户完整上下文的 payload。

7. AI 上下文由 ViewModel 编排并保持可审计。

   工作区 ViewModel 负责从当前状态生成最小上下文：当前证券代码、显示名称、视图模式、数据源名称、日期区间、最新价格/成交量摘要、指标启用状态、策略回测摘要和用户输入问题。当前证券默认以工作区顶部证券输入框和当前图表正在展示的 `symbol`/`stockName` 为准，不以自选股选中项为准。默认上下文 SHALL NOT 发送自选股列表或其它股票样本；智能选股或多股票对比必须通过专门场景显式扩展，并在弹窗中明示将使用的标的范围。上下文 SHALL 限制记录数量和字段范围，避免把完整大 dataset 原样发送。AI 分析弹窗应展示“当前仅分析”的证券代码、名称、数据源和日期范围，让用户理解手动发送的数据范围。

8. 所有 AI 请求默认手动触发。

   第一版 AI 分析 SHALL 只在用户点击分析、测试 connector、确认策略草稿、确认筛选草稿或确认参数候选验证等明确动作后执行。应用启动、行情刷新、K 线缓存完成、日期切换、收盘时间、工作区切换和弹窗打开 SHALL NOT 自动向 HTTP provider 发送上下文。AI 每日复盘是手动生成的复盘报告，不是后台定时推送。

11. 使用场景通过 prompt pack 和输出 schema 分层实现。

   每个 AI 使用场景都应有独立 `useCaseId`、输入上下文 builder、prompt pack、输出 schema 和错误处理。通用自由问答只能作为补充入口；策略生成、参数优化、智能选股、预测等高风险场景必须走结构化输出，便于本地校验和 UI 明确标注限制。

12. 自然语言生成策略输出策略草稿。

   AI SHALL 将自然语言描述转换为策略名称、适用市场、周期、入场条件、出场条件、风控条件、参数草稿和不支持项说明。系统 SHALL 在本地校验字段完整性、参数范围和可回测能力；校验失败时只能展示草稿和原因，不能进入回测或保存。若草稿映射不到现有策略模板或可执行规则，系统 SHALL 要求用户修改或标记为“仅说明草稿”。

13. 回测解读、策略诊断和参数优化基于本地回测事实。

   AI 解读回测报告 SHALL 使用本地回测摘要、交易列表统计、收益/回撤/胜率/盈亏比等事实字段，并区分事实、推断和待验证问题。AI 策略诊断 SHALL 指出可能的失效原因和数据缺口，但 SHALL NOT 编造未运行的回测。AI 参数优化助手 SHALL 生成候选参数区间、优化目标和风险说明；候选参数的排序和采纳依据 SHALL 来自本地批量回测结果。

14. 智能选股和多维对比只做条件匹配与解释。

   自然语言智能选股 SHALL 将用户条件转换为可执行筛选草稿，例如标的范围、周期、指标条件、回测条件和排序字段。系统 SHALL 只基于已加载、可刷新或已缓存的数据执行筛选，并展示数据新鲜度和缺失项。智能选股和多股票对比不复用默认单证券上下文，只有用户明确选择对应场景并确认标的范围后才扩展到多标的数据。多周期/多股票对比 SHALL 使用统一指标集合和可比日期范围，输出差异解释和风险点，不得给出“应买入/卖出”结论。

15. 市场环境、每日复盘和新闻公告联合分析保留来源边界。

   市场环境识别 SHALL 基于当前证券的价格、成交量、波动和趋势等结构化摘要输出环境标签、依据和置信度。AI 每日复盘 SHALL 汇总当前证券当日行情、策略信号摘要、异常波动和待关注事项，并标注生成时间。新闻/公告 + K 线联合分析 SHALL 使用用户提供或已接入的新闻公告摘要，并在输出中保留标题、日期、来源和与 K 线现象的关联推断；缺失来源时必须标记未验证。

16. AI/ML 涨跌预测是实验性功能。

   预测功能 SHALL 明确预测周期、训练/观察窗口、特征摘要、模型或 connector 来源、概率/方向假设、置信度、适用前提和历史验证指标。系统 SHALL 展示“实验性预测，不构成交易建议”，并禁止将预测结果写入策略信号、回测收益或自动交易动作。若没有足够历史样本或验证结果，系统 SHALL 阻止预测或标记为低可信度。

17. AI 分析优先使用流式请求。

   HTTP provider 分析优先使用 `stream: true`，main process 解析 OpenAI-compatible SSE delta 或 provider token payload 并通过 typed bridge 转发 chunk。AI 分析弹窗展示生成中、成功结果、错误状态、取消和重试入口。请求应支持超时；如果用户关闭弹窗或发起新请求，旧请求结果不得覆盖较新的弹窗状态。不支持 streaming 且可安全执行非流式请求时，系统显示 fallback 提示并展示最终结果。

18. AI 设置和分析入口分离。

   默认入口放在顶部工具栏或更多菜单，保持工作区主要图表空间稳定。AI 设置负责 connector 配置、凭据状态和可用性测试；AI 分析弹窗负责场景选择、上下文摘要、问题输入、结果、错误和重试。分析弹窗可以提示进入设置，但不在分析结果区直接暴露密钥输入或明文密钥状态。

19. AI 输出保持信息整理定位。

   默认 prompt 和用户可见提示必须要求模型基于已提供历史数据做解释、摘要、风险点和待核实问题，不得给出“应买入/卖出”“推荐持仓”“保证收益”等表达。默认 prompt 要求模型只分析当前证券，不分析自选股列表或其它证券，并使用简体中文可读小节而不是 JSON；若 provider 仍返回 JSON 字符串，AI 分析弹窗将其格式化为可读小节。UI 应标注模型输出可能错误，用户需要自行核验数据来源和时效。

20. 本地备份排除密钥、认证和请求历史。

   本地缓存导出可以包含非敏感 AI connector 配置，例如 connector 类型、displayName、HTTP base URL、model/profile、温度、超时和启用状态，但 SHALL 排除 API key、加密密文、Authorization header、环境变量和请求历史。导入后 HTTP provider 应标记为需要重新输入密钥。

## Risks / Trade-offs

- [Risk] HTTP provider 增加 API key 泄露风险。→ Mitigation：密钥与普通 settings 分离，IPC 响应脱敏，日志脱敏，导出备份排除密钥，并补充测试。
- [Risk] OpenAI-compatible provider 之间响应细节不完全一致。→ Mitigation：第一版只依赖最小消息输入和文本输出，provider 错误统一归一化；高级能力后续再扩展。
- [Risk] provider endpoint 和 model id 会变化。→ Mitigation：实施前按官方文档确认默认值，model 使用可搜索下拉并允许自定义输入，无法确认时不固化默认 endpoint/model。
- [Risk] AI 输出可能被理解为投资建议。→ Mitigation：prompt、UI 文案、说明书和 changelog 同步约束，不使用推荐买卖、收益承诺或未来表现保证。
- [Risk] 发送完整行情 dataset 会造成隐私、成本和性能问题。→ Mitigation：只发送 ViewModel 汇总后的有限上下文，记录数量和文本长度设置上限。

## Migration Plan

- 新增 AI connector domain model：connector kind、HTTP provider preset、settings、credential status、availability、analysis request/result、error 类型和 normalize 函数。
- 新增 main process credential storage，保存/读取/清除 HTTP provider API key，并确保 settings、IPC、日志和本地备份只暴露脱敏状态。
- 新增主进程 AI connector coordinator，分发到 HTTP provider client，统一测试、分析、超时、错误归一化和日志脱敏。
- 新增 HTTP provider client，支持 OpenAI-compatible 非流式请求、provider 测试、代理复用、鉴权错误/网络错误/超时/响应格式错误归一化。
- 移除本机 CLI/runtime adapter，并确保旧 `local-runtime` 设置迁移为禁用的 HTTP provider 默认配置。
- 新增 AI use-case registry、prompt packs、上下文 builders 和输出 schema，覆盖策略生成、回测解读、策略诊断、参数优化、智能选股、多周期/多股票对比、市场环境识别、每日复盘、新闻公告联合分析和实验性涨跌预测。
- 新增策略草稿与参数候选模型，支持本地校验、回测前确认、批量参数回测结果关联和不可执行原因展示。
- 新增智能选股筛选草稿和多维比较摘要模型，复用现有自选股、K 线缓存、指标和回测摘要，展示数据新鲜度和缺失项。
- 新增新闻/公告输入摘要模型和每日复盘摘要模型；自动新闻公告远端数据源不纳入本 change 的第一版实现。
- 新增实验性预测结果模型，要求预测周期、样本窗口、特征、概率/方向假设、置信度和验证指标，并强制非投资建议提示。
- 扩展 typed preload bridge 和 IPC handlers，新增 AI connector settings 读取/保存、API key 保存/清除、connector 测试和 AI 分析请求。
- 扩展 renderer adapter、RootViewModel 或 StockWorkspaceViewModel，编排 AI 设置弹窗、AI 分析弹窗、上下文摘要、loading/error/result 和 stale request 防护。
- 在顶部工具栏或更多菜单加入 AI 入口，新增 AI connector 设置和分析视图，保持当前工作区布局稳定。
- 更新本地缓存导入导出逻辑，确保导出排除密钥、加密密文、环境变量和请求历史，并要求 HTTP provider 重新输入密钥。
- 更新使用说明书、README 和 `CHANGELOG.md`，说明 HTTP provider、手动发送上下文、密钥存储、模型输出限制和非投资建议边界。
- 增加单元测试覆盖 normalize、HTTP provider credentials、旧 `local-runtime` 配置迁移、HTTP 鉴权/超时/网络错误、代理复用、IPC 注册、ViewModel 上下文打包、AI 弹窗状态、本地备份敏感材料排除、文档/changelog 校验。
- 运行 `openspec validate add-ai-model-integration --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`、`yarn build`、`yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。

## Open Questions

无。默认决策已更新：

- 第一版支持 HTTP provider connector，不再提供本机 CLI/runtime 接入方式。
- 默认 AI connector 为禁用，用户首次配置并测试后才启用。
- 第一版只允许一个当前启用 connector；不做多模型并发、模型投票或自动比较不同模型结果。
- 默认 UI 入口放在顶部工具栏或更多菜单，AI 设置弹窗与 AI 分析弹窗分开。
- 所有 AI 请求默认手动触发；不做后台自动分析、自动复盘推送或自动调参运行。
- AI 使用场景以 use-case registry 和结构化输出实现，不把所有能力塞进一个自由聊天框。
- `http-provider` 默认支持 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider，可编辑 `baseUrl`，`model` 使用可搜索下拉并允许自定义输入，同时可编辑温度、超时和 API key；默认 `baseUrl/model` 按官方文档确认，无法确认则留空。
- HTTP provider API key 由 main process 凭据存储处理，renderer、日志和本地备份不暴露密钥；`safeStorage` 不可用时只允许本次会话临时使用，不落盘。
- 自然语言策略生成只产生可审查草稿，通过本地校验和用户确认后才可进入回测或保存。
- AI 参数优化只生成候选参数和解释，排序、采纳和展示依据来自本地批量回测。
- 新闻/公告 + K 线联合分析第一版只使用用户提供或系统已有的新闻公告摘要，不自动抓取或伪造新闻公告。
- AI/ML 涨跌预测作为实验性功能展示概率、置信度和验证指标，不进入交易建议、策略信号或收益承诺。
- 支持 HTTP provider 流式响应，并兼容 provider token payload；不保存长期 AI 会话，只保留当前弹窗最近结果。
- 默认 prompt 要求模型输出简体中文可读小节而不是 JSON；如果 provider 仍返回 JSON 字符串，AI 分析弹窗将其格式化为可读小节。
- 所有 AI 结果默认标注仅供信息整理和历史数据解释，不构成投资建议。
