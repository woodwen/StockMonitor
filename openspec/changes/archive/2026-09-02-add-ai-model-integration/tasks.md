## 1. AI connector 设置模型与凭据

- [x] 1.1 新增 AI connector preset、settings、credential status、availability、analysis request/result 和 error 类型，并实现 normalize/default 函数；默认状态为 AI connector 禁用。
- [x] 1.2 支持 HTTP provider connector，包含 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 预设。
- [x] 1.3 扩展应用设置归一化，持久化非敏感 AI connector 配置，并保持旧设置缺失时回落默认禁用状态。
- [x] 1.4 新增 main process HTTP provider 凭据存储，保存、读取、清除 API key，并确保普通 settings、IPC 响应、日志和本地备份不包含明文密钥、加密密文或 Authorization header；`safeStorage` 不可用时只允许本次会话临时使用，不落盘；不同 provider 预设使用隔离 connector id，避免复用错误 API key。
- [x] 1.5 增加 store/credential 单元测试，覆盖默认禁用、单一启用 connector、非法 connector 配置归一化、HTTP provider key 脱敏、`safeStorage` 不可用时临时 key 不落盘、非敏感设置持久化和本地备份敏感材料排除。

## 2. Main process AI connector 与 IPC/preload

- [x] 2.1 新增 main process AI connector coordinator，统一 connector 测试、分析请求、超时、错误归一化和日志脱敏。
- [x] 2.2 新增 HTTP provider client，支持 OpenAI-compatible 非流式请求、provider 测试、代理复用、鉴权失败、网络失败、超时和响应格式错误归一化；provider 预设默认 `baseUrl/model` 按官方文档确认，model 使用可搜索下拉并允许自定义输入。
- [x] 2.3 移除本机 CLI/runtime 接入路径，main process AI connector 只通过 HTTP provider 发起模型请求。
- [x] 2.4 兼容旧 `local-runtime` 设置导入或读取：旧 CLI 配置 SHALL 迁移为禁用的 HTTP provider 默认配置，不自动启用外部 API 请求。
- [x] 2.5 扩展 `src/main/ipc.ts`，注册 AI connector settings 读取/保存、HTTP provider API key 保存/清除、connector 测试和 AI 分析请求 handlers。
- [x] 2.6 扩展 `src/preload/stock-api.ts` 和 `src/preload/index.ts`，暴露 typed AI connector API，renderer 不直接请求 provider endpoint 或读取 API key。
- [x] 2.7 增加 IPC、HTTP provider client 和 connector coordinator 测试，覆盖 handler 注册、请求委托、HTTP 缺 key、鉴权失败、网络失败、超时、代理复用、日志脱敏和旧 `local-runtime` 配置迁移。

## 3. Renderer 工作区入口与 AI 分析弹窗

- [x] 3.1 扩展 renderer adapter 和 ViewModel，加载/保存 AI connector 设置，打开/关闭拆分的 AI 设置弹窗和 AI 分析弹窗，并处理 loading、error、result 和 stale request。
- [x] 3.2 实现工作区 AI 上下文摘要生成，默认只包含当前工作区顶部证券输入框/当前图表对应证券、视图模式、数据源、日期区间、最新行情摘要、指标状态、策略回测摘要和用户问题，不以自选股选中项为默认范围，不发送自选股列表或其它股票样本，并限制记录数量和文本长度。
- [x] 3.3 新增 AI connector 设置弹窗，提供 HTTP provider 预设、base URL、model 可搜索下拉/profile、API key 直接粘贴和按钮粘贴、温度、超时、可用性测试和密钥清除入口；分析结果区不暴露明文密钥输入。
- [x] 3.4 新增 AI 分析弹窗，展示“当前仅分析”的证券代码/名称/数据源/日期范围、上下文摘要、问题输入、当前 connector、实时生成内容、普通结果格式、错误、重试入口和非投资建议提示。
- [x] 3.5 在顶部工具栏或更多菜单增加 AI 入口，并确保 AI 设置与 AI 分析入口清晰分离，AI 状态不覆盖行情加载、图表 dataset、缓存任务或策略回测结果。
- [x] 3.6 增加 ViewModel 和视图测试，覆盖默认禁用、配置保存、connector 测试、HTTP key 状态、上下文摘要、手动发起分析、启动/刷新/日期切换不自动触发 AI、实时结果展示、最终 JSON 兜底格式化、弹窗容器、错误展示、旧请求不覆盖新结果和未配置状态。

## 4. AI 使用场景工作流

- [x] 4.1 新增 AI use-case registry、prompt packs、上下文 builders 和输出 schema，覆盖 10 个使用场景；通用自由问答只作为补充入口，高风险场景必须走结构化输出。
- [x] 4.2 实现自然语言生成策略草稿：输出策略名称、适用市场/周期、入场/出场/风控条件、参数草稿、不支持项和本地校验结果。
- [x] 4.3 实现 AI 解读回测报告和 AI 策略诊断：基于本地回测事实输出摘要、风险、失效原因、数据缺口和待验证问题，并区分事实与推断。
- [x] 4.4 实现 AI 参数优化助手：生成候选参数、优化目标和风险说明，并将候选参数交给本地批量回测验证后再展示排序。
- [x] 4.5 实现自然语言智能选股：将用户条件转换为筛选草稿，仅在用户选择该场景并确认标的范围后扩展到多标的数据，复用已有行情、自选股、缓存和指标摘要，展示匹配结果、排序依据、数据新鲜度和缺失项。
- [x] 4.6 实现策略多周期/多股票对比：仅在用户选择该场景并确认对比范围后，基于统一指标集合和可比日期范围生成对比摘要、差异解释和风险提示。
- [x] 4.7 实现市场环境识别和 AI 每日复盘：输出当前证券环境标签、依据、置信度、当日行情/策略摘要、异常波动和待关注事项。
- [x] 4.8 实现新闻/公告 + K 线联合分析：第一版仅支持用户提供或已接入新闻公告摘要，与 K 线现象关联分析，并保留标题、日期、来源和未验证标记；不自动抓取或伪造新闻公告。
- [x] 4.9 实现实验性 AI/ML 涨跌预测：输出预测周期、样本窗口、特征摘要、概率/方向假设、置信度和验证指标，并禁止进入交易建议或策略信号。
- [x] 4.10 增加使用场景测试，覆盖策略草稿校验和用户确认、回测事实引用、参数候选回测验证、智能选股数据缺失、新闻来源标记、预测低样本阻断、预测不进入策略信号和非投资建议文案。

## 5. 文档、说明书和 changelog

- [x] 5.1 更新应用内 `使用说明书`，说明 HTTP provider、10 个 AI 使用场景、默认禁用、单一启用 connector、设置与分析入口分离、手动发送上下文、不自动抓取新闻公告、密钥存储、模型输出限制、隐私边界和非投资建议边界。
- [x] 5.2 更新 README，摘要说明 AI 模型接入入口、HTTP provider、自定义 OpenAI-compatible provider、10 个使用场景、第一版默认边界、`safeStorage` 降级行为和用户需要自行配置 API key。
- [x] 5.3 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.11` 区块，记录 AI 模型接入和 AI 使用场景能力。
- [x] 5.4 检查新增用户可见文案，确保不包含投资建议、买卖建议、荐股服务、收益承诺或未来表现保证。

## 6. 验证

- [x] 6.1 运行 `openspec validate add-ai-model-integration --strict`。
- [x] 6.2 运行 `openspec validate --all --strict` 和 `git diff --check`。
- [x] 6.3 运行 AI connector、credential、store、IPC、preload、HTTP provider、AI use-case、工作区 ViewModel、AI 分析弹窗和本地备份相关定向测试。
- [x] 6.4 运行 `yarn typecheck`、`yarn test` 和 `yarn build`。
- [x] 6.5 因为实施阶段会更新 `CHANGELOG.md`，运行 `yarn test tests/release-version.test.mjs` 和 `yarn test tests/changelog-release-notes.test.mjs`。
