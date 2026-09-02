## Why

当前 active change `add-ai-model-integration` 已经规划并部分实现 AI connector、AI 分析弹窗和多种 AI 使用场景，但基线设计仍是非流式一次性请求：用户点击分析后只能看到 loading，直到 connector 返回完整结果才看到内容。对于 HTTP provider 的长文本分析，这会让用户无法判断 AI 是否已经开始输出、当前生成到哪里、是否需要中止，也不利于及时发现模型输出方向不对。

用户希望“实时反馈 AI 内容”。本 change 将 AI 分析从只等待最终结果扩展为可观察的增量内容反馈：在 connector 支持流式输出时，分析面板 SHALL 边生成边展示文本；第一版不强制所有 connector 都真正流式输出，在 connector 不支持流式输出时，系统 SHALL 明确显示当前 connector 不支持流式内容，并按默认策略回退到非流式最终结果。

该变更依赖 `add-ai-model-integration` 的 connector、主进程调用、typed preload bridge、AI 分析弹窗和非投资建议边界。若实施时该 change 尚未归档，实施前应先确认它的 artifact 与代码状态，并把本 change 作为其后续增量处理，避免两个 active change 对同一 AI 分析 API 做互相冲突的改动。

用户已确认全部默认建议：IPC 采用 start/subscribe/cancel 三段式 typed bridge；取消是 UI 确定、底层 best-effort；仅明确不支持 streaming 时回退非流式；partial output 第一版不逐段拦截或改写；不保存 AI 流式历史；日志只记录生命周期元数据。

## What Changes

- 新增 AI 分析流式执行协议：一次 AI 分析 SHALL 产生 `started`、`chunk`、`completed`、`failed`、`cancelled` 或等价事件，事件包含 request id、use case、connector 信息、增量文本、完成时间、耗时和错误信息。
- HTTP provider 支持 OpenAI-compatible streaming response：当 provider 支持 `stream: true` 且返回可解析文本 delta 或 token payload 时，main process SHALL 逐块转发 AI 内容；若明确不支持 streaming 但仍可安全执行非流式请求，系统 SHALL 按默认策略回退到非流式最终结果；鉴权失败、网络失败、超时、危险参数或响应格式损坏 SHALL 直接失败，不自动重试。
- 扩展 IPC/preload：renderer SHALL 通过 `startAiAnalysisStream`、`onAiAnalysisStreamEvent`、`cancelAiAnalysis` 或等价三段式 typed bridge 发起流式 AI 分析、监听流式事件，并可取消当前请求；renderer 仍不得直接请求 HTTP provider endpoint 或读取 API key。
- 扩展 AI 分析弹窗：分析中 SHALL 展示已收到的部分内容、当前状态、connector、model/profile、耗时、取消和重试入口；最终结果 SHALL 复用同一输出区域，不再等待完整返回后才渲染文本。
- 保留 stale request 防护：较早请求的 chunk、完成或错误事件 SHALL NOT 覆盖较新的请求状态。
- 保留安全和隐私边界：partial output 和 final output SHALL 同样显示非投资建议提示；第一版不逐 chunk 拦截或改写模型输出，只在最终结果沿用高风险措辞 warning；日志 SHALL NOT 记录完整 prompt、完整上下文、API key、Authorization header 或完整模型输出。
- 默认不保存 AI 流式历史：系统 SHALL 只保留当前弹窗最近一次 partial/final output，不写入本地备份、跨会话历史或请求历史。
- `CHANGELOG.md` 的 `Unreleased / 0.1.11` 区块记录 AI 分析支持实时内容反馈。

## Capabilities

### Modified Capabilities

- `ai-model-integration`: 在既有 AI connector 和分析面板基础上，增加流式内容反馈、取消、事件生命周期、fallback、stale request 隔离和对应安全边界。

## Impact

- 影响 `src/renderer/features/stock-workspace/models/ai-models.ts`：新增或调整流式分析事件、运行状态、取消状态和结果模型。
- 影响 `src/main/ai-connector.ts` 和 `src/main/ai-http-provider.ts`：支持 HTTP streaming、AbortController 取消、超时与错误归一化。
- 影响 `src/main/ipc.ts`、`src/preload/index.ts`、`src/preload/stock-api.ts`：新增 typed streaming API、事件订阅和取消 API。
- 影响 `src/renderer/features/stock-workspace/adapters/ElectronStockDataAdapter.ts`、`src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts` 和 `src/renderer/features/stock-workspace/views/AiAnalysisPanel.tsx`：通过弹窗展示增量内容、取消、重试、状态、JSON 兜底格式化和 stale event 防护。
- 影响 AI provider/IPC/ViewModel/面板测试，并需要补充流式 response、取消、错误和 fallback 覆盖。
- 影响 `README.md`、`src/renderer/features/help/views/UserManualModal.tsx` 和 `CHANGELOG.md` 的用户说明。
- 实施阶段涉及 main process、preload、renderer、HTTP 请求和用户可见功能，应运行 `openspec validate stream-ai-analysis-output --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`、`yarn build`，以及 changelog 相关测试。
