# M-46(feat): 新增 AI 模型接入与分析场景

OpenSpec Change: add-ai-model-integration

## 背景:

- 当前应用已有行情、指标、策略回测、自选股缓存和做T测算，但用户需要手动复制当前证券、行情摘要和策略结果到外部 AI 工具解释。
- 本次变更按 OpenSpec 约束只保留 HTTP provider 接入，移除本机 CLI/runtime 路线，避免 renderer 保存密钥或直接请求模型 endpoint。

## 方案概述:

- 新增一个默认禁用的 AI connector，支持 OpenAI-compatible HTTP provider 和常见 provider 预设。
- AI 分析改为独立弹窗，所有请求由用户手动触发，默认只发送当前证券的有限上下文摘要。
- 10 个 AI 使用场景通过 use-case registry、prompt guidance、workflow 和输出 schema 管理，高风险场景增加确认门禁、本地校验和非投资建议边界。

## 实现改动:

- 新增 main process AI connector coordinator、HTTP provider client 和凭据存储，支持连接测试、流式分析、取消、错误归一化、代理复用和敏感信息脱敏。
- 扩展 preload/IPC/renderer adapter/ViewModel，暴露 typed AI API，拆分 AI 设置弹窗和 AI 分析弹窗，支持实时生成内容、JSON 兜底可读格式化、API key 粘贴和 model 下拉。
- 增加自然语言策略草稿校验、参数优化本地批量回测验证、智能选股范围确认、策略对比统一指标事实和实验性预测边界。
- 更新 README、应用内使用说明书、CHANGELOG 和 OpenSpec 归档 spec，说明 AI connector、上下文范围、密钥边界、实时反馈和非投资建议边界。

## 测试计划(UT):

- `openspec validate add-ai-model-integration --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `yarn typecheck`
- `yarn test`
- `yarn build`

## 影响范围(建议手动测试范围):

- AI 设置：provider 预设、model 下拉、自定义 model、base URL、API key 粘贴/清除、测试连接和启用状态。
- AI 分析：当前证券范围展示、场景切换、确认门禁、实时输出、取消、JSON 格式化、错误提示和旧请求不覆盖新结果。
- 主进程边界：renderer 不直接请求 HTTP provider，不读取明文 API key；本地备份不包含密钥或请求历史。
- 策略相关高风险场景：策略草稿不自动保存或回测，参数优化排序来自本地批量回测，预测结果不写入策略信号或收益。

## 风险与后续:

- Provider endpoint 和 model id 可能继续变化，UI 已保留可编辑 base URL 和自定义 model。
- 当前只提交本地功能和测试验证；真实 provider 的鉴权、网络、流式兼容性仍建议用用户自己的 API key 做手动联调。
