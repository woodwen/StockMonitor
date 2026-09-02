## Why

当前应用已经具备行情数据源、K 线/分时图、指标设置、策略回测和自选股缓存能力，但用户仍需要自己把当前证券、指标、策略结果和行情摘要复制到外部 AI 工具中解释。这个流程割裂，也容易丢失数据来源、日期区间和风险边界。

用户希望接入 AI 模型，例如 DeepSeek、MiniMax、智谱 GLM、通义千问等。最新决策是移除本机 CLI/runtime 接入方式，只保留 OpenAI-compatible HTTP provider：HTTP provider 适合 DeepSeek、MiniMax、智谱 GLM、通义千问、Kimi、OpenAI-compatible 和自定义模型服务，并且更容易保证密钥、主进程边界、手动触发、流式输出和投资安全约束。

本次更新进一步明确 AI 的产品使用场景：自然语言生成策略、AI 解读回测报告、AI 策略诊断、AI 参数优化助手、自然语言智能选股、策略多周期/多股票对比、市场环境识别、AI 每日复盘、新闻/公告 + K 线联合分析，以及 AI/ML 涨跌预测。上述能力需要分用例规划输入、输出、验证和展示边界，尤其预测能力只能作为实验性概率/风险提示，不能变成买卖建议或收益承诺。

本次确认全部采用默认边界：AI connector 默认禁用，用户首次配置后才启用；第一版只启用一个当前 AI connector；所有 AI 分析均由用户手动触发；默认 AI 分析只分析当前工作区顶部证券输入框和当前图表对应的单只证券，不以自选股选中项为默认范围；10 个使用场景通过 use-case registry、prompt pack 和 output schema 结构化实现；通用自由问答只作为补充入口；不做多模型并发、模型投票、后台自动分析、自动复盘推送、自动抓取新闻公告或自动调参运行。

## What Changes

- 新增 AI 模型接入能力：用户可配置一个当前启用的 HTTP provider connector；第一版 SHALL NOT 同时调用多个 connector、做模型投票或自动比较不同模型结果。
- `http-provider` 支持 OpenAI-compatible HTTP API 形态，并提供 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 的可编辑预设；实施时按官方文档确认默认 `baseUrl` 和常见 `model` 下拉选项，无法确认时预设 SHALL 保持可编辑空字段。
- 新增 AI 设置入口：用户可配置 provider 预设、显示名称、model 下拉选项或自定义输入、profile、超时、温度、上下文长度限制、HTTP base URL/API key；API key 支持输入框直接粘贴和按钮粘贴；用户可以测试当前 connector；默认 UI 入口放在顶部工具栏或更多菜单，AI 设置弹窗与 AI 分析弹窗分开。
- 新增 AI 分析弹窗：用户可基于当前工作区的当前证券代码、数据源、视图模式、K 线/分时摘要、指标状态、策略回测摘要和自定义问题手动发起分析；弹窗 SHALL 展示“当前仅分析”的证券代码、名称、数据源和日期范围；默认上下文 SHALL NOT 发送自选股列表或其它股票样本；HTTP provider 优先使用流式输出并兼容 provider token payload；系统 SHALL NOT 因启动、行情刷新、缓存完成、日期切换或收盘时间自动触发 AI 请求，较早请求晚返回 SHALL NOT 覆盖较新结果。
- 新增 AI 用例入口和结构化 prompt packs：按策略生成、回测解读、策略诊断、参数优化、智能选股、多周期/多股票对比、市场环境识别、每日复盘、新闻公告联合分析和实验性涨跌预测组织上下文与输出；通用自由问答只能作为补充入口。
- 自然语言生成策略 SHALL 生成可审查的策略草稿和参数草稿；只有通过本地结构化校验并经用户确认后，才能进入后续回测或保存流程。
- AI 参数优化 SHALL 只生成候选参数和解释，真实排序 SHALL 依赖本地回测指标；AI SHALL NOT 直接声明“最佳买卖参数”。
- 自然语言智能选股、市场环境识别、每日复盘和新闻公告联合分析 SHALL 标注数据来源、日期、样本范围和缺失数据，不得伪造新闻、公告或实时行情；市场环境识别和每日复盘默认只使用当前证券；智能选股和多股票对比只有在用户明确选择对应场景后才允许扩展到多标的范围；第一版新闻/公告 + K 线联合分析只使用用户提供或系统已有的新闻公告摘要。
- AI/ML 预测涨跌 SHALL 作为实验性分析输出概率、方向假设、时间周期、置信度和验证指标；结果 SHALL NOT 作为交易信号、推荐结论或收益承诺。
- AI 调用 SHALL 只由 Electron main process 发起；renderer 通过 `window.stockApi` typed bridge 调用 AI 设置、可用性测试和分析 API。
- HTTP provider API key 等密钥 SHALL 只在 main process 凭据存储中处理，renderer、日志和本地备份 SHALL NOT 暴露明文密钥或认证材料；若 `safeStorage` 不可用，默认只允许本次会话临时使用 API key，不落盘保存。
- AI 分析结果 SHALL 标识 connector、model/profile、请求状态和错误原因；默认以简体中文可读小节展示，provider 返回 JSON 字符串时 SHALL 转成可读小节；结果 SHALL NOT 覆盖当前行情加载状态、图表 dataset、缓存任务或策略回测结果。
- 用户可见文案和默认 prompt SHALL 明确 AI 输出仅用于信息整理和历史数据解释，不构成投资建议、买卖建议、荐股服务、收益承诺或未来表现保证。
- `CHANGELOG.md` 的 `Unreleased / 0.1.11` 区块记录本次用户可见 AI 模型接入能力。

## Capabilities

### New Capabilities

- `ai-model-integration`: 配置 HTTP provider、测试可用性、按明确使用场景基于当前工作区上下文手动发起 AI 分析，并约束主进程边界、密钥、隐私、预测实验边界和投资安全行为。

### Modified Capabilities

- 无。第一版通过新增 capability 约束 AI 入口、connector 设置、主进程调用和工作区交互，不修改行情数据源 capability 的语义。

## Impact

- 影响 `src/preload/stock-api.ts`、`src/preload/index.ts`、`src/main/ipc.ts`，以及新增 main process AI connector 和 HTTP provider client 模块。
- 影响 `src/main/store.ts` 或独立凭据存储模块，用于保存非敏感 AI connector 设置并保护 HTTP provider API key。
- 影响现有网络代理复用逻辑：HTTP provider 请求 SHALL 复用已保存代理配置。
- 影响 `src/renderer/app/RootViewModel.ts`、工作区 ViewModel/adapter、顶部工具栏或更多菜单，以及新增 AI 设置和 AI 分析弹窗视图。
- 影响策略回测 ViewModel/model 的 AI 上下文摘要、策略草稿、参数候选、多周期/多股票比较和预测实验输入输出模型；不应直接改变既有回测算法。
- 影响自选股、K 线缓存和市场数据摘要使用方式：智能选股、每日复盘和多股票对比需要复用现有数据与缓存状态，并清晰展示缺失数据。
- 新闻/公告 + K 线联合分析第一版应支持用户提供或已接入的新闻公告摘要；若未来自动抓取新闻公告，远端请求仍必须走 main process 并另行补充数据源边界。
- 影响本地缓存导入导出，确保 AI 非敏感设置可恢复，密钥、认证材料和请求历史被排除。
- 影响 `src/renderer/features/help/views/UserManualModal.tsx`、`README.md` 和 `CHANGELOG.md` 的用户说明。
- 需要新增或更新 IPC、store normalize、credential、HTTP provider client、工作区 ViewModel、AI 分析弹窗、说明书和 changelog 测试。
- 实施阶段涉及主进程、preload、HTTP 请求、凭据和用户可见功能，应运行 `openspec validate add-ai-model-integration --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`、`yarn build`，以及 changelog 相关测试。
