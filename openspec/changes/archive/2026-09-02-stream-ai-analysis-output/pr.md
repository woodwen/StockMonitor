# M-47(docs): 归档 AI 分析实时内容反馈

OpenSpec Change: stream-ai-analysis-output

背景:
- `add-ai-model-integration` 已在当前本地 `M-46` 提交中落地 AI connector、AI 分析弹窗和 HTTP provider 主路径。
- `stream-ai-analysis-output` 作为后续增量，要求 AI 分析支持实时 partial output、取消、非流式 fallback、stale event 隔离和日志脱敏边界。

方案概述:
- 归档 `stream-ai-analysis-output` OpenSpec change，并把 AI 分析实时内容反馈 requirement 合入主 `ai-model-integration` capability。
- 补全 `openspec/specs/ai-model-integration/spec.md` 的 `Purpose`，避免保留 OpenSpec archive 自动生成的占位说明。
- 代码实现沿用当前 HEAD 中已经完成的 AI streaming API、main process coordinator、preload bridge、ViewModel、面板和测试覆盖；本提交不再重复修改应用源码。

实现改动:
- 新增归档记录 `openspec/changes/archive/2026-09-02-stream-ai-analysis-output/`，保留 proposal、design、tasks、delta spec 和本地 PR 文档。
- 更新 `openspec/specs/ai-model-integration/spec.md`，新增 AI 分析实时内容反馈 requirement，覆盖 HTTP streaming、typed bridge、unsupported fallback、取消、后台不自动触发、stale request、防投资建议提示、JSON 可读格式、历史保存和日志脱敏。
- `CHANGELOG.md` 已在 `M-46` 功能提交中记录用户可见 AI 实时内容反馈，本次归档提交不重复修改 changelog。

测试计划(UT):
- `openspec validate stream-ai-analysis-output --strict`
- `openspec validate --all --strict`
- `git diff --check`
- `rg -n "[ \t]+$" openspec/changes/archive/2026-09-02-stream-ai-analysis-output openspec/specs/ai-model-integration/spec.md`
- `yarn typecheck`
- `yarn test`
- `yarn build`
- `yarn test tests/release-version.test.mjs`
- `yarn test tests/changelog-release-notes.test.mjs`

影响范围(建议手动测试范围):
- OpenSpec `ai-model-integration` capability 的归档文档和主 spec。
- AI 实时输出相关源码已在 `M-46` 验证范围内；本提交不新增运行时代码路径。
- 建议手动复查 AI 分析弹窗的实时输出、取消、fallback 提示、JSON 格式化和非投资建议提示是否与主 spec 一致。

风险与后续:
- 真实 HTTP provider 的流式兼容性仍依赖用户配置的 provider endpoint、model 和 API key，自动化测试覆盖协议解析和 UI 状态，但不替代真实账号联调。
- 当前工作区存在与本 change 无关的 agent/skill 配置变更，提交时只 stage 本次归档相关路径。
