## Context

`add-ai-model-integration` 目前将 AI 分析建模为非流式一次性请求：renderer 调用 typed preload API，main process 通过 `http-provider` 等待完整输出后返回 `AiAnalysisResult`。这个模型实现简单，但长文本分析时用户只能看到 loading，无法看到已生成内容，也无法基于当前输出及时取消。

实时反馈 AI 内容需要把“最终结果”拆成可观察事件，但仍必须保持现有架构边界：

- HTTP provider 请求仍只能发生在 Electron main process。
- renderer 只能通过 typed preload bridge 发起请求、订阅事件和取消请求。
- View 只展示状态和触发命令；StockWorkspaceViewModel 负责请求生命周期、stale event 防护、错误和状态编排。
- AI 输出仍定位为信息整理和历史数据解释，不构成投资建议。
- 日志不能记录完整 prompt、完整上下文、完整模型输出或认证材料。

用户已确认采用本方案中的默认建议。本 design 将这些默认从 open questions 固化为已接受决策：不强制所有 connector 真流式、IPC 使用 start/subscribe/cancel 三段式、取消为 UI 确定且底层 best-effort、仅明确 unsupported streaming 时回退非流式、partial output 第一版不逐段拦截、不保存 AI 历史、日志只记录生命周期元数据。

## Goals / Non-Goals

**Goals:**

- 用户手动触发 AI 分析后，支持边生成边展示 AI 内容。
- 为每次 AI 分析建立明确 request id，保证 started/chunk/completed/failed/cancelled 事件只影响对应请求。
- HTTP provider 在支持 OpenAI-compatible streaming response 时逐块展示文本 delta 或 provider token payload。
- 用户可以取消当前 AI 分析；取消后 UI 停止追加内容，并尽量中止底层 HTTP 请求。
- connector 不支持流式输出时，用户能看到明确状态，并按默认策略回退到非流式最终结果。
- partial output 和 final output 都保留非投资建议提示、错误状态、耗时和 connector 信息。
- 补齐单元测试，覆盖 HTTP stream、取消、超时、错误、fallback 和 stale event。

**Non-Goals:**

- 不新增自动 AI 请求、后台复盘推送、自动调参运行或长期聊天记忆。
- 不实现多 connector 并发、多模型投票或多个模型同时流式对比。
- 不把 AI partial output 写入策略信号、回测收益、行情 dataset、本地缓存或自选股。
- 不在 renderer 中直接解析 provider 认证、发 HTTP 请求或读取 API key。
- 不在第一版实现完整 Markdown 富文本编辑器、代码块执行、引用折叠或多轮会话历史管理。
- 不保存完整 AI 请求历史或完整模型输出历史；默认仍只保留当前弹窗最近一次结果。

## Decisions

1. 使用 main process 管理流式请求生命周期。

   main process 新增 stream coordinator，负责分配 request id、启动 HTTP provider、转发事件、处理取消、超时和错误归一化。renderer 不直接持有 provider response，只接收脱敏后的事件。

2. IPC 采用 request/subscribe/cancel 三段式 typed bridge。

   默认新增等价 API：`startAiAnalysisStream(request)` 返回 request id 或初始事件；`onAiAnalysisStreamEvent(callback)` 订阅 main process 事件；`cancelAiAnalysis(requestId)` 请求取消。这样避免把长时间 streaming 绑在单个 `ipcRenderer.invoke` 返回值上，也便于用户关闭面板或发起新请求时取消旧请求。

3. 事件模型以 append-only chunk 为主。

   `chunk` 事件只承载本次新增文本，不重复传完整输出。ViewModel 负责按 request id 追加到当前 partial output。`completed` 事件提供最终 connector/model/profile、耗时、完成时间、warnings 和可选 final output；若 final output 存在，ViewModel 可用它校准最终文本。

4. HTTP provider streaming 优先支持 OpenAI-compatible SSE。

   HTTP client 在流式模式下发送 `stream: true`，解析 `data:` SSE 行中的 choices delta、message content、顶层 token 或 provider 等价文本字段。遇到 `[DONE]` 或流结束后发送 completed。解析器应集中在 main process provider client 中，并通过测试覆盖分块 JSON、跨 chunk 行、token payload、空 delta、错误事件和非 JSON 行。

5. Unsupported connector 默认回退到非流式结果。

   默认策略：如果当前 connector 明确不支持流式内容或流式握手失败但仍可安全执行非流式请求，系统展示“当前 connector 不支持流式内容，已转为非流式结果”或等价提示，然后复用既有非流式结果。若失败原因是鉴权、网络、超时、危险参数或响应格式错误，则直接 failed，不静默重试。

6. 取消是 best-effort，但 UI 状态必须确定。

   用户取消后，ViewModel 立即把当前请求置为 cancelling/cancelled，不再追加后续 chunk。main process 使用 AbortController 取消 HTTP 请求。若底层请求后来返回完成或错误，renderer SHALL 通过 request id 忽略旧事件。

7. 非投资建议提示覆盖部分输出。

   分析开始后，弹窗持续显示“仅供信息整理和历史数据解释，不构成投资建议”或等价提示。若 partial output 中出现高风险投资措辞，第一版 MAY 只在最终 warnings 中提示；实施时不要求逐 token 拦截或重写，但 UI 不得因为 streaming 而移除安全提示。

8. 日志只记录生命周期元数据。

   日志 MAY 记录 request id、connector id、kind、base URL host、model/profile、useCaseId、chunk 数量、总字符数、耗时和状态。日志 SHALL NOT 记录 API key、Authorization header、完整 prompt、完整上下文、完整 chunk 文本或完整 final output。

9. 默认不保存流式历史。

    当前弹窗可保留最近一次 partial/final output。关闭弹窗或发起新请求时可以清空或替换当前结果；本 change 不新增持久化 AI 历史、导出请求记录或跨会话恢复。

10. 最终输出默认使用普通可读格式。

    默认 prompt 要求模型用简体中文小节输出，不输出 JSON。若 provider 仍返回 JSON 字符串，renderer 展示层将顶层字段格式化为可读小节；partial output 仍按原始 chunk 追加，避免在生成中反复解析不完整 JSON。

## Risks / Trade-offs

- [Risk] OpenAI-compatible streaming response 在不同 provider 间存在字段差异。→ Mitigation：解析器只支持明确的最小 delta 字段；不兼容时展示错误或回退非流式，不猜测 provider 私有协议。
- [Risk] IPC 流式事件可能乱序或旧请求晚到。→ Mitigation：所有事件带 request id，ViewModel 只接受当前 request id，已有 stale request 防护扩展到 chunk 事件。
- [Risk] partial output 被误认为最终结论。→ Mitigation：面板明确展示生成中状态，partial 区域持续显示非投资建议提示，completed 前不标记为最终结果。
- [Risk] 流式日志泄露模型输出。→ Mitigation：日志只记录 chunk count 和字符数，不记录 chunk 文本。
- [Risk] 把非流式 API 直接替换为流式 API 会影响现有测试和调用方。→ Mitigation：实施时保留兼容层或一次性迁移所有调用点，并补齐 IPC/preload/ViewModel 测试。

## Migration Plan

- 在 `ai-models.ts` 中新增流式请求事件模型，例如 request id、event type、chunk text、status、warnings、error、elapsedMs 和 completedAt。
- 在 main process 新增或扩展 AI stream coordinator，统一 `start`、`emit chunk`、`complete`、`fail`、`cancel`、`timeout` 和清理逻辑。
- 在 HTTP provider client 中新增 streaming chat completion 路径，解析 OpenAI-compatible SSE delta，并复用现有代理、超时、鉴权和错误归一化。
- 移除 local runtime streaming 路径，AI 内容实时反馈只依赖 HTTP provider streaming。
- 扩展 IPC/preload typed API，新增 start/subscribe/cancel 能力，并确保订阅释放函数可用，避免弹窗关闭后泄漏 listener。
- 更新 renderer adapter 和 StockWorkspaceViewModel，使用 request id 管理 partial output、running/cancelling/cancelled/success/error 状态、stale event 防护、取消和重试。
- 更新 AI 分析弹窗，展示实时 partial output、生成中状态、取消按钮、重试按钮、fallback warning、connector/model/profile/耗时、最终 JSON 兜底格式化和非投资建议提示。
- 更新现有非流式 `runAiAnalysis` 调用；默认推荐保留兼容方法供测试或 unsupported fallback 使用，直到所有 UI 调用完成迁移。
- 更新说明书、README 和 changelog，说明 AI 内容可实时反馈、取消语义、unsupported fallback、不会自动触发请求和非投资建议边界。
- 增加 HTTP provider stream parser、IPC event、ViewModel stale chunk、取消、fallback、弹窗渲染、最终 JSON 兜底格式化和日志脱敏测试。
- 运行 OpenSpec、TypeScript、Vitest、build 和 changelog 相关验证。

## Accepted Defaults

1. 第一版不强制所有 connector 都必须真正流式输出。

   已采纳：HTTP provider 支持则流式展示；不支持时清晰提示并回退非流式最终结果。这样能先覆盖主路径，同时不阻塞已有 connector。

2. partial output 第一版不逐段做投资安全拦截或改写。

   已采纳：只保持持续非投资建议提示，并在最终结果中沿用高风险措辞 warning。逐段拦截容易误判和破坏输出完整性，可后续单独评估。

3. 不保存 AI 流式历史。

   已采纳：只保留当前弹窗最近一次 partial/final output，不进入本地备份、请求历史或跨会话恢复，降低隐私和实现复杂度。

4. HTTP provider 流式失败时不默认自动重试非流式。

   已采纳：仅在明确是不支持 streaming 且非流式请求仍安全时回退；鉴权、网络、超时、响应格式损坏或 provider 错误不自动重试，避免重复请求和成本不可见。

5. IPC/preload 使用 start/subscribe/cancel 三段式 typed bridge。

   已采纳：`startAiAnalysisStream(request)` 创建请求，`onAiAnalysisStreamEvent(callback)` 订阅事件，`cancelAiAnalysis(requestId)` 取消请求，具体命名可按现有 `StockApi` 风格调整但语义保持一致。

6. 取消语义是 UI 确定、底层 best-effort。

   已采纳：用户取消后 ViewModel 立即进入取消状态并停止追加内容；main process 尽量 Abort HTTP 请求；晚到事件按 request id 忽略。

7. 日志只记录生命周期元数据。

   已采纳：日志只允许记录 request id、connector、useCase、chunk 数量、字符数、耗时和状态，不记录 prompt、上下文、chunk 文本、final output 或密钥。
