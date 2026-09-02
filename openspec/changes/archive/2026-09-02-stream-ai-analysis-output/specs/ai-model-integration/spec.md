## ADDED Requirements

### Requirement: AI 分析实时内容反馈
系统 SHALL 在用户手动触发 AI 分析后，尽可能实时展示 AI 已生成的内容，并保持主进程调用、typed preload bridge、隐私和投资安全边界。

#### Scenario: HTTP provider 返回流式内容
- **WHEN** 用户触发 AI 分析且当前 HTTP provider 支持 OpenAI-compatible streaming response
- **THEN** main process SHALL 使用受控 HTTP client 发起流式请求
- **AND** renderer SHALL 通过 typed preload bridge 接收增量内容事件
- **AND** main process SHALL 从 OpenAI-compatible SSE delta 或 provider token payload 中提取文本 chunk
- **AND** AI 分析弹窗 SHALL 在请求完成前展示已经收到的 AI 文本

#### Scenario: Renderer 发起流式请求
- **WHEN** renderer 需要发起流式 AI 分析
- **THEN** renderer SHALL 通过 `startAiAnalysisStream`、`onAiAnalysisStreamEvent`、`cancelAiAnalysis` 或等价 typed bridge 创建请求、订阅事件并取消请求
- **AND** 单次流式分析 SHALL 使用 request id 关联 started、chunk、completed、failed 和 cancelled 事件
- **AND** renderer SHALL NOT 将长时间 streaming 绑定到一个必须等待完整输出的 invoke 返回值

#### Scenario: Connector 不支持流式内容
- **WHEN** 当前 connector 明确不支持流式内容或流式能力不可用但仍可安全执行非流式请求
- **THEN** 系统 SHALL 展示当前 connector 不支持流式内容的清晰提示
- **AND** 系统 MAY 回退到非流式最终结果
- **AND** 系统 SHALL NOT 将鉴权失败、网络失败、超时、危险参数或响应格式错误静默重试为非流式请求

#### Scenario: Connector 支持能力不同
- **WHEN** 当前 connector 不能提供真流式输出但可以完成非流式 AI 分析
- **THEN** 系统 SHALL NOT 要求该 connector 必须实现 streaming 才能继续作为可用 connector
- **AND** 系统 SHALL 将该次分析标记为非流式 fallback 或等价状态
- **AND** 用户 SHALL 能在 AI 分析弹窗看到该 fallback 状态

#### Scenario: 用户取消流式分析
- **WHEN** 用户在 AI 分析生成过程中点击取消
- **THEN** 系统 SHALL 将当前请求标记为取消中或已取消
- **AND** main process SHALL best-effort 中止底层 HTTP 请求
- **AND** 取消后的 chunk、完成或失败事件 SHALL NOT 继续追加到当前 AI 分析输出

#### Scenario: 后台状态变化
- **WHEN** 应用启动、行情刷新、K 线缓存完成、日期切换、收盘时间、工作区切换或打开 AI 分析弹窗
- **THEN** 系统 SHALL NOT 自动发起流式 AI 分析请求
- **AND** 系统 SHALL NOT 自动向 HTTP provider 发送证券、行情、指标、策略、新闻公告或自选股上下文

#### Scenario: 较早请求事件晚到
- **WHEN** 较早 AI 请求的 chunk、完成、失败或取消事件晚于较新的请求到达 renderer
- **THEN** StockWorkspaceViewModel SHALL 根据 request id 忽略较早事件
- **AND** 较早事件 SHALL NOT 覆盖较新请求的 partial output、final output、错误、loading 或取消状态

#### Scenario: 用户查看生成中的部分输出
- **WHEN** AI 分析弹窗展示 partial output
- **THEN** 弹窗 SHALL 标注内容仍在生成中或尚未完成
- **AND** 弹窗 SHALL 持续展示“仅供信息整理和历史数据解释，不构成投资建议”或等价提示
- **AND** 第一版 SHALL NOT 逐 chunk 拦截、改写或删除 partial output
- **AND** partial output SHALL NOT 写入行情 dataset、策略信号、回测收益、本地缓存或自选股

#### Scenario: 用户查看最终 AI 输出
- **WHEN** AI 分析弹窗展示 final output
- **THEN** 默认 prompt SHALL 要求模型使用简体中文可读小节而不是 JSON
- **AND** 如果 provider 仍返回 JSON 字符串，弹窗 SHALL 将顶层字段格式化为可读小节
- **AND** 弹窗 SHALL NOT 向用户直接展示原始 JSON 字段名作为主要结果格式

#### Scenario: 流式历史保存
- **WHEN** AI 流式分析产生 partial output、final output 或生命周期事件
- **THEN** 系统 SHALL NOT 将完整 AI 请求历史、完整 partial output 或完整 final output 写入本地备份、跨会话历史或持久化请求历史
- **AND** 当前弹窗 MAY 仅保留最近一次 partial output 或 final output 用于当前用户查看

#### Scenario: 记录流式分析日志
- **WHEN** 系统记录 AI 流式分析生命周期日志
- **THEN** 日志 MAY 包含 request id、connector id、kind、base URL host、model/profile、useCaseId、chunk 数量、总字符数、耗时和状态
- **AND** 日志 SHALL NOT 包含 API key、Authorization header、完整 prompt、完整上下文、完整 chunk 文本、完整 final output 或环境变量密钥
