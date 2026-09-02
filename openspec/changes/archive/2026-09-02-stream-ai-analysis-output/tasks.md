## 1. Artifact and baseline alignment

- [x] 1.1 确认 `add-ai-model-integration` 的当前状态；若尚未归档，实施前先核对其 AI connector、非流式分析面板、IPC/preload 和测试基线，避免互相覆盖。
- [x] 1.2 如现有 AI integration artifact 仍声明“第一版非流式”，在实施前同步说明本 change 是后续增量，并确保两个 active change 的职责边界清晰；已接受默认项不再作为待确认问题反复询问。
- [x] 1.3 运行 `openspec validate stream-ai-analysis-output --strict`，并在后续实现更新后重复验证。

## 2. Streaming domain model

- [x] 2.1 在 AI model 层新增流式事件类型、request id、运行状态、取消状态、chunk payload、fallback warning 和最终结果模型；第一版不要求所有 connector 都具备真流式能力。
- [x] 2.2 更新分析请求/结果 normalize 与校验逻辑，确保流式和非流式 fallback 共用同一 use case、上下文、安全提示和 connector run info。
- [x] 2.3 增加 model 单元测试，覆盖事件结构、状态流转、fallback warning、取消状态、不保存流式历史和不保存敏感材料。

## 3. Main process streaming execution

- [x] 3.1 新增或扩展 AI stream coordinator，统一 started/chunk/completed/failed/cancelled 事件、request id 分配、超时、清理和日志脱敏。
- [x] 3.2 为 HTTP provider 新增 OpenAI-compatible streaming 请求，发送 `stream: true`，解析 SSE delta 和 provider token payload，并复用代理、鉴权、超时和错误归一化。
- [x] 3.3 移除本机 CLI/runtime 流式路径，AI 内容实时反馈只依赖 HTTP provider streaming。
- [x] 3.4 实现取消：HTTP 请求使用 AbortController；取消后后续事件不得影响 renderer 当前状态。
- [x] 3.5 实现 unsupported streaming fallback：明确不支持流式但可安全非流式执行时回退最终结果；鉴权、网络、超时、危险参数和响应格式错误不得静默重试。
- [x] 3.6 增加 main process 测试，覆盖 HTTP stream 分块、跨 chunk SSE 行、provider `[DONE]`、取消、超时、fallback、stale cleanup 和日志脱敏。

## 4. IPC and preload

- [x] 4.1 扩展 `src/main/ipc.ts`，注册流式 AI start/cancel handlers，并通过 main-to-renderer event 转发流式事件。
- [x] 4.2 扩展 `src/preload/stock-api.ts` 和 `src/preload/index.ts`，按已接受默认暴露 typed `startAiAnalysisStream`、`onAiAnalysisStreamEvent` 和 `cancelAiAnalysis` 或等价三段式 API。
- [x] 4.3 确保 renderer 仍只能通过 `window.stockApi` 使用 AI 能力，不直接请求 provider endpoint 或读取 API key。
- [x] 4.4 增加 IPC/preload 测试，覆盖 handler 注册、事件订阅释放、取消委托、事件 payload 脱敏和旧非流式 API 兼容策略。

## 5. Renderer state and UI

- [x] 5.1 更新 renderer adapter 和 StockWorkspaceViewModel，管理当前 stream request id、partial output、running/cancelling/cancelled/success/error、warnings、elapsedMs、fallback 和重试状态。
- [x] 5.2 扩展 stale request 防护，确保旧请求的 chunk、completed、failed 或 cancelled 事件不会覆盖新请求。
- [x] 5.3 更新 AI 分析弹窗，展示实时 partial output、生成中状态、取消按钮、重试入口、fallback warning、connector/model/profile/耗时、最终 JSON 兜底格式化和非投资建议提示。
- [x] 5.4 弹窗关闭、切换场景或发起新请求时，按默认策略取消或隔离旧请求，并释放事件 listener；流式历史不写入本地备份、请求历史或跨会话持久化。
- [x] 5.5 增加 ViewModel 和视图测试，覆盖实时追加内容、取消、错误展示、fallback warning、旧请求 chunk 忽略、最终 JSON 兜底格式化、弹窗容器、非投资建议提示持续可见和 unsupported connector 文案。

## 6. Documentation and changelog

- [x] 6.1 更新应用内使用说明书，说明 AI 内容实时反馈、token payload 兼容、普通结果格式、弹窗展示、取消语义、非流式 fallback、手动触发、不会自动发送上下文、不保存流式历史和非投资建议边界。
- [x] 6.2 更新 README，说明 HTTP provider 的流式输出支持边界、token payload 兼容、普通结果格式、弹窗展示，以及 provider 不支持 streaming 时的行为。
- [x] 6.3 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.11` 区块，记录 AI 分析支持实时内容反馈、token payload 兼容、普通结果格式和弹窗展示。
- [x] 6.4 检查新增用户可见文案，确保不包含投资建议、买卖建议、荐股服务、收益承诺或未来表现保证。

## 7. Verification

- [x] 7.1 运行 `openspec validate stream-ai-analysis-output --strict`。
- [x] 7.2 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 7.3 运行 AI streaming 相关定向测试，包括 model、HTTP provider、IPC/preload、ViewModel 和面板测试。
- [x] 7.4 运行 `yarn typecheck`、`yarn test` 和 `yarn build`。
- [x] 7.5 因为实施阶段会更新 `CHANGELOG.md`，运行 `yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。
