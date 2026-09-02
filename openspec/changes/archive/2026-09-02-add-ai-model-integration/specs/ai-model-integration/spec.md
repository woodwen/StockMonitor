## ADDED Requirements

### Requirement: AI connector 配置
系统 SHALL 允许用户配置一个当前启用的 AI connector，用于后续手动 AI 分析请求。

#### Scenario: 用户首次打开 AI 设置
- **WHEN** 用户尚未配置任何 AI connector
- **THEN** 系统 SHALL 展示默认禁用状态
- **AND** AI 分析请求 SHALL 被阻止并提示需要先配置 connector

#### Scenario: 用户查看 AI 设置
- **WHEN** 用户打开 AI 设置入口
- **THEN** 系统 SHALL 展示当前 provider 预设、显示名称、model/profile、温度、超时、启用状态和可用性状态
- **AND** 系统 SHALL NOT 展示、返回、保存或导出明文 API key、Authorization header 或环境变量密钥

#### Scenario: 旧本机 runtime 配置迁移
- **WHEN** 系统读取到旧版本保存的 `local-runtime` connector 配置
- **THEN** 系统 SHALL 将其迁移为默认禁用的 `http-provider` connector
- **AND** 系统 SHALL NOT 因旧配置已启用而自动发起 HTTP provider 请求

#### Scenario: 用户选择 HTTP provider
- **WHEN** 用户选择 `http-provider` connector
- **THEN** 系统 SHALL 展示 provider 预设、base URL、model 可搜索下拉框、温度、超时、API key 状态和测试入口
- **AND** 系统 SHALL 支持 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 和自定义 provider 的可编辑预设

#### Scenario: 用户配置多个 connector 预设
- **WHEN** 用户保存或切换 AI connector 配置
- **THEN** 系统 SHALL 只允许一个 connector 处于当前启用状态
- **AND** 第一版 SHALL NOT 同时调用多个 connector、做模型投票或自动比较不同模型结果

#### Scenario: 用户保存 AI connector 设置
- **WHEN** 用户保存 AI connector 配置
- **THEN** 系统 SHALL 持久化非敏感 connector 设置
- **AND** 系统 SHALL 将 API key 作为 main process 凭据保存，并只在后续状态中返回 `hasApiKey` 或等价脱敏状态
- **AND** 不同 HTTP provider 预设 SHALL 使用隔离的 connector id，避免切换 provider 后复用上一 provider 的 API key

#### Scenario: 用户粘贴 HTTP provider API key
- **WHEN** 用户在 AI 设置中配置 HTTP provider API key
- **THEN** API key 输入框 SHALL 支持系统粘贴事件写入当前草稿
- **AND** 系统 SHALL 提供粘贴按钮从剪贴板读取 API key 到当前草稿
- **AND** 粘贴 API key 本身 SHALL NOT 保存凭据；只有用户点击保存或测试连接时才可通过 main process 凭据流程处理

#### Scenario: 凭据加密不可用
- **WHEN** HTTP provider API key 需要保存但 Electron `safeStorage` 不可用
- **THEN** 系统 SHALL NOT 将明文 key、弱加密 key 或加密密文写入普通 settings 或本地备份
- **AND** 系统 SHALL 只允许本次会话临时使用该 API key，或提示用户当前平台不支持持久化保存

#### Scenario: 用户清除 HTTP provider API key
- **WHEN** 用户清除当前 HTTP provider 的 API key
- **THEN** 系统 SHALL 删除对应凭据
- **AND** 后续 HTTP provider 测试和 AI 分析 SHALL 被阻止并展示缺少 API key 的清晰错误

#### Scenario: 用户清除 AI connector 设置
- **WHEN** 用户清除当前 AI connector 配置
- **THEN** 系统 SHALL 恢复为默认禁用状态
- **AND** 后续 AI 分析 SHALL 被阻止并展示需要先配置 connector 的清晰错误

### Requirement: AI 调用遵守进程边界
系统 SHALL 只在 Electron main process 中执行 AI 调用，renderer SHALL 通过 typed preload bridge 使用 AI 能力。

#### Scenario: Renderer 测试 connector
- **WHEN** renderer 需要测试 AI connector
- **THEN** renderer SHALL 调用 `window.stockApi` 暴露的 typed AI API
- **AND** renderer SHALL NOT 直接请求 HTTP provider endpoint、读取 API key 或构造 Authorization header

#### Scenario: Renderer 发起 AI 分析
- **WHEN** renderer 需要发起 AI 分析
- **THEN** renderer SHALL 通过 typed preload bridge 提交结构化分析请求
- **AND** main process SHALL 拼接安全 prompt、选择 connector 并执行 HTTP provider 请求

#### Scenario: Main process 记录 AI 日志
- **WHEN** main process 记录 connector 测试或分析请求日志
- **THEN** 日志 SHALL NOT 包含明文 API key、Authorization header、环境变量密钥或完整分析上下文 payload

### Requirement: HTTP provider 连接测试
系统 SHALL 允许用户在保存或修改 HTTP provider 配置后手动测试当前 provider。

#### Scenario: 用户选择 HTTP provider 预设
- **WHEN** 用户选择 OpenAI-compatible、DeepSeek、MiniMax、智谱 GLM、通义千问/DashScope、Kimi/Moonshot、硅基流动/SiliconFlow、百川智能/Baichuan、火山方舟/Ark 或自定义 provider 预设
- **THEN** 系统 SHALL 允许用户编辑 `baseUrl`，并通过可搜索下拉框选择或自定义输入 `model`
- **AND** 若实施时无法按官方文档确认默认 `baseUrl` 或 `model`，对应字段 SHALL 保持为空并要求用户填写

#### Scenario: HTTP provider 配置完整且可用
- **WHEN** 用户点击测试且 provider 返回有效响应
- **THEN** 系统 SHALL 展示测试成功状态
- **AND** 状态 SHALL 包含 provider 名称、base URL host、model 和响应耗时

#### Scenario: HTTP provider 缺少必填配置
- **WHEN** 用户点击测试但 base URL、model 或 API key 缺失
- **THEN** 系统 SHALL 阻止请求
- **AND** 系统 SHALL 展示缺少配置项的清晰错误

#### Scenario: HTTP provider 请求失败
- **WHEN** provider 测试遇到鉴权失败、网络失败、超时、代理失败或响应格式不兼容
- **THEN** 系统 SHALL 展示归一化错误
- **AND** 系统 SHALL 保留用户已输入的非敏感配置，便于修改后重试

### Requirement: AI 分析由用户手动触发
系统 SHALL 仅在用户明确触发时，把当前工作区摘要交给已启用的 AI connector。

#### Scenario: 应用启动
- **WHEN** 应用启动并加载工作区
- **THEN** 系统 SHALL NOT 自动向 HTTP provider 发送证券、行情、指标、策略或自选股数据

#### Scenario: 行情自动刷新
- **WHEN** 分时自动刷新或用户手动刷新行情
- **THEN** 系统 SHALL NOT 因刷新动作自动触发 AI 分析请求

#### Scenario: 后台状态变化
- **WHEN** 应用发生缓存完成、日期切换、收盘时间、工作区切换或打开 AI 分析弹窗
- **THEN** 系统 SHALL NOT 自动触发 AI 分析、AI 每日复盘、参数优化或涨跌预测请求
- **AND** 用户必须通过明确按钮或确认动作手动触发 AI 请求

#### Scenario: 用户提交 AI 问题
- **WHEN** 用户在 AI 分析弹窗输入问题并点击分析
- **THEN** 系统 SHALL 基于当前工作区状态生成有限上下文摘要
- **AND** 系统 SHALL 将该摘要和用户问题提交给当前启用的 AI connector
- **AND** 默认上下文 SHALL 只分析当前证券，不发送自选股列表或其它股票样本
- **AND** 当前证券 SHALL 以工作区顶部证券输入框和当前图表正在展示的 `symbol`/`stockName` 为准，不以自选股选中项为准

### Requirement: AI 分析上下文范围明确
系统 SHALL 以有限、可解释的工作区摘要作为 AI 分析上下文，而不是原样发送完整运行态数据。

#### Scenario: AI 分析弹窗展示默认范围
- **WHEN** 用户打开 AI 分析弹窗
- **THEN** 系统 SHALL 展示当前仅分析的证券代码、证券名称、数据源和日期范围
- **AND** 系统 SHALL NOT 展示默认会发送自选股列表或其它股票样本的提示

#### Scenario: K 线模式下发起分析
- **WHEN** 用户在 K 线模式发起 AI 分析
- **THEN** 上下文 SHALL 包含当前证券、证券名称、K 线数据源、周期、复权、日期区间、最新 K 线摘要、启用指标和策略回测摘要
- **AND** 上下文 SHALL 限制 K 线记录数量或聚合后的文本长度

#### Scenario: 分时模式下发起分析
- **WHEN** 用户在分时模式发起 AI 分析
- **THEN** 上下文 SHALL 包含当前证券、证券名称、分时数据源、交易日、最新分时摘要、启用指标和高级分时上下文可用性摘要
- **AND** 上下文 SHALL 限制分时点位数量或聚合后的文本长度

#### Scenario: 当前没有已加载行情
- **WHEN** 用户在没有可用行情 dataset 的状态下发起 AI 分析
- **THEN** 需要行情数据的使用场景 SHALL 阻止请求并提示用户先刷新行情
- **AND** 通用自由问答 MAY 继续发送明确的空数据上下文
- **AND** 空数据上下文 SHALL 标注缺失行情数据

### Requirement: AI 使用场景可选择且结构化
系统 SHALL 将 AI 能力按明确使用场景组织，并为每个场景维护独立上下文、prompt 和输出结构。

#### Scenario: 用户查看 AI 入口
- **WHEN** 用户在工作区查看顶部工具栏或更多菜单
- **THEN** 系统 SHALL 提供 AI 入口
- **AND** AI 设置入口与 AI 分析入口 SHALL 清晰分离

#### Scenario: 用户打开 AI 使用场景入口
- **WHEN** 用户打开 AI 分析入口
- **THEN** 系统 SHALL 展示可选使用场景，包括自然语言生成策略、AI 解读回测报告、AI 策略诊断、AI 参数优化助手、自然语言智能选股、策略多周期/多股票对比、市场环境识别、AI 每日复盘、新闻/公告 + K 线联合分析和 AI/ML 涨跌预测
- **AND** 每个场景 SHALL 展示其会发送的数据范围和输出限制
- **AND** AI 分析入口 SHALL 使用弹窗展示，而不是右侧 Drawer

#### Scenario: 用户切换使用场景
- **WHEN** 用户选择不同 AI 使用场景
- **THEN** 系统 SHALL 使用该场景对应的上下文 builder 和输出 schema
- **AND** 系统 SHALL NOT 将其他场景的敏感草稿、结果或请求历史混入当前请求

#### Scenario: 用户使用通用自由问答
- **WHEN** 用户选择通用自由问答或补充追问入口
- **THEN** 系统 SHALL 将其作为补充场景处理
- **AND** 策略生成、参数优化、智能选股、新闻公告联合分析和 AI/ML 涨跌预测等高风险能力 SHALL 继续使用对应结构化场景

#### Scenario: 用户进入多标的场景
- **WHEN** 用户选择自然语言智能选股或策略多周期/多股票对比
- **THEN** 系统 SHALL 使用该场景专属的上下文 builder
- **AND** 系统 SHALL 在发送前明示将使用的标的范围
- **AND** 系统 SHALL NOT 通过默认 AI 分析上下文隐式包含自选股列表或其它股票样本

### Requirement: 自然语言生成策略
系统 SHALL 允许用户用自然语言生成可审查的策略草稿，但 SHALL NOT 自动保存或执行未经校验的策略。

#### Scenario: 用户生成策略草稿
- **WHEN** 用户输入自然语言策略描述并触发生成
- **THEN** 系统 SHALL 生成结构化策略草稿，包括策略名称、适用市场、适用周期、入场条件、出场条件、风控条件、参数草稿和不支持项说明
- **AND** 系统 SHALL 在本地校验字段完整性、参数范围和当前回测能力

#### Scenario: 策略草稿可回测
- **WHEN** AI 生成的策略草稿通过本地结构化校验且用户确认
- **THEN** 系统 MAY 将草稿转入后续回测准备流程
- **AND** 系统 SHALL 在执行前展示策略规则、参数和数据需求

#### Scenario: 策略草稿不可执行
- **WHEN** AI 生成的策略草稿无法映射到当前支持的策略模板或可执行规则
- **THEN** 系统 SHALL 展示不可执行原因
- **AND** 系统 SHALL NOT 保存为可运行策略或启动回测

### Requirement: AI 解读回测报告
系统 SHALL 允许用户基于本地回测结果生成 AI 解读，并区分事实、推断和限制。

#### Scenario: 用户解读回测报告
- **WHEN** 用户对已完成的回测结果触发 AI 解读
- **THEN** 系统 SHALL 发送本地回测摘要、交易统计、收益指标、回撤指标、胜率、盈亏比、数据区间和策略参数
- **AND** AI 输出 SHALL 区分本地回测事实、模型推断、风险点和待核实问题

#### Scenario: 回测结果缺失
- **WHEN** 当前没有可用回测结果
- **THEN** 系统 SHALL 阻止 AI 解读请求
- **AND** 系统 SHALL 提示用户先运行回测

### Requirement: AI 策略诊断
系统 SHALL 允许用户对策略表现进行 AI 诊断，并将诊断限定在已提供的数据和回测事实内。

#### Scenario: 用户诊断策略表现
- **WHEN** 用户对策略回测结果触发 AI 策略诊断
- **THEN** 系统 SHALL 提供策略规则、参数、回测区间、关键指标、交易分布、亏损片段摘要和数据缺口
- **AND** AI 输出 SHALL 给出可能失效原因、过拟合风险、数据不足点和后续验证建议

#### Scenario: AI 诊断遇到数据缺口
- **WHEN** 回测数据、交易明细或指标摘要不足以支持某项诊断
- **THEN** AI 输出 SHALL 标注缺失数据
- **AND** 系统 SHALL NOT 展示模型编造的未运行回测结论

### Requirement: AI 参数优化助手
系统 SHALL 允许 AI 生成参数优化候选，但 SHALL 使用本地回测结果验证和排序候选参数。

#### Scenario: AI 生成参数候选
- **WHEN** 用户触发参数优化助手
- **THEN** 系统 SHALL 向 AI 提供当前策略参数、可调参数范围、优化目标、回测区间和风险约束
- **AND** AI SHALL 返回候选参数集合、调整理由和潜在风险

#### Scenario: 本地验证参数候选
- **WHEN** AI 返回候选参数集合
- **THEN** 系统 SHALL 使用本地回测引擎验证候选参数后再展示排序
- **AND** 排序依据 SHALL 来自本地回测指标，而不是 AI 自称的最优判断

#### Scenario: 候选参数无法验证
- **WHEN** 候选参数超出范围、数据不足或回测失败
- **THEN** 系统 SHALL 标记该候选不可用并展示原因
- **AND** 系统 SHALL NOT 将该候选作为推荐参数

### Requirement: 自然语言智能选股
系统 SHALL 允许用户用自然语言描述筛选条件，并将其转换为可审查的本地筛选草稿。

#### Scenario: 用户生成选股筛选草稿
- **WHEN** 用户输入自然语言选股条件
- **THEN** 系统 SHALL 生成结构化筛选草稿，包括标的范围、周期、指标条件、回测条件、排序字段和数据需求
- **AND** 系统 SHALL 展示筛选草稿供用户确认或修改

#### Scenario: 系统执行智能选股
- **WHEN** 用户确认筛选草稿
- **THEN** 系统 SHALL 只基于已加载、可刷新或已缓存的数据执行筛选
- **AND** 结果 SHALL 展示匹配原因、排序依据、数据新鲜度和缺失项

#### Scenario: 选股条件包含买卖建议
- **WHEN** 用户输入要求直接推荐买入、卖出或保证收益的选股条件
- **THEN** 系统 SHALL 保留条件筛选能力
- **AND** 系统 SHALL 展示非投资建议边界并避免输出买卖指令

### Requirement: 策略多周期和多股票对比
系统 SHALL 支持对策略在多个周期或多个股票上的表现进行结构化 AI 对比。

#### Scenario: 用户对比多周期策略表现
- **WHEN** 用户选择同一策略的多个周期回测结果并触发 AI 对比
- **THEN** 系统 SHALL 提供每个周期的统一指标摘要、数据区间、样本数量和缺失项
- **AND** AI 输出 SHALL 总结差异、适用条件和风险点

#### Scenario: 用户对比多股票策略表现
- **WHEN** 用户选择多个股票的同一策略回测结果并触发 AI 对比
- **THEN** 系统 SHALL 使用可比日期范围和统一指标集合生成上下文
- **AND** AI 输出 SHALL NOT 给出应买入或卖出某只股票的结论

### Requirement: 市场环境识别
系统 SHALL 基于行情和指标摘要识别市场环境，并展示依据和置信度。

#### Scenario: 用户触发市场环境识别
- **WHEN** 用户触发市场环境识别
- **THEN** 系统 SHALL 提供当前证券的价格、成交量、波动和趋势摘要
- **AND** AI 输出 SHALL 包含环境标签、依据、置信度、适用前提和待观察指标

#### Scenario: 市场环境数据不足
- **WHEN** 当前证券的价格、成交量、趋势或样本不足
- **THEN** 系统 SHALL 标注数据不足
- **AND** AI 输出 SHALL 降低置信度或拒绝给出明确环境标签

### Requirement: AI 每日复盘
系统 SHALL 允许用户手动生成每日复盘，并明确复盘数据来源和生成时间。

#### Scenario: 用户生成每日复盘
- **WHEN** 用户触发 AI 每日复盘
- **THEN** 系统 SHALL 汇总当前证券当日行情、策略信号摘要、异常波动、缓存/数据缺失和待关注事项
- **AND** 复盘结果 SHALL 标注生成时间、数据日期和数据来源

#### Scenario: 当日数据不完整
- **WHEN** 当前证券当日行情或策略数据缺失
- **THEN** 复盘结果 SHALL 标注缺失项
- **AND** 系统 SHALL NOT 用模型推断填补缺失行情事实

### Requirement: 新闻公告与 K 线联合分析
系统 SHALL 支持把新闻或公告摘要与 K 线现象联合分析，并保留来源边界。

#### Scenario: 第一版缺少新闻公告材料
- **WHEN** 用户未提供新闻公告摘要且系统没有已接入的新闻公告摘要
- **THEN** 系统 SHALL 阻止新闻/公告 + K 线联合分析或仅分析 K 线事实
- **AND** 系统 SHALL NOT 自动抓取、伪造或补写新闻公告材料

#### Scenario: 用户提供新闻或公告摘要
- **WHEN** 用户提供新闻或公告标题、日期、来源和摘要并触发联合分析
- **THEN** 系统 SHALL 将新闻/公告摘要与当前 K 线区间、价格变化、成交量变化和指标摘要一起发送给 AI connector
- **AND** AI 输出 SHALL 区分新闻/公告事实、K 线事实和二者之间的关联推断

#### Scenario: 新闻公告来源缺失
- **WHEN** 新闻或公告缺少标题、日期或来源
- **THEN** 系统 SHALL 标记该材料未验证
- **AND** AI 输出 SHALL NOT 将未验证材料描述为已确认公告事实

#### Scenario: 自动抓取新闻公告
- **WHEN** 后续版本需要自动抓取新闻或公告
- **THEN** 远端请求 SHALL 继续通过 Electron main process 执行
- **AND** 系统 SHALL 补充数据来源、时间、失败和权限边界

### Requirement: AI/ML 涨跌预测保持实验性
系统 SHALL 将 AI/ML 涨跌预测作为实验性分析能力，并禁止将预测结果作为交易建议或策略信号。

#### Scenario: 用户触发涨跌预测
- **WHEN** 用户触发 AI/ML 涨跌预测
- **THEN** 系统 SHALL 展示预测周期、样本窗口、特征摘要、模型或 connector 来源、概率或方向假设、置信度和历史验证指标
- **AND** 结果 SHALL 标注“实验性预测，不构成交易建议”

#### Scenario: 样本或验证不足
- **WHEN** 历史样本、特征摘要或验证指标不足
- **THEN** 系统 SHALL 阻止预测或将结果标记为低可信度
- **AND** 系统 SHALL 展示不足原因

#### Scenario: 预测结果生成后
- **WHEN** 系统展示 AI/ML 涨跌预测结果
- **THEN** 系统 SHALL NOT 将预测结果写入策略信号、回测收益、智能选股推荐或自动交易动作
- **AND** 系统 SHALL NOT 使用“必涨”“必跌”“保证收益”或等价表述

### Requirement: HTTP provider 请求保护密钥并复用代理
系统 SHALL 保护 HTTP provider 密钥，并在用户启用应用网络代理时复用该代理。

#### Scenario: 用户未启用代理
- **WHEN** 用户测试 HTTP provider 或发起 HTTP provider AI 分析
- **THEN** AI 请求 SHALL 直连 provider endpoint

#### Scenario: 用户已启用代理
- **WHEN** 用户测试 HTTP provider 或发起 HTTP provider AI 分析
- **THEN** AI 请求 SHALL 使用已保存的 SOCKS5 或 HTTP 代理配置
- **AND** 代理配置无效或连接失败时，系统 SHALL 展示网络请求失败原因

#### Scenario: HTTP provider 请求日志
- **WHEN** 系统记录 HTTP provider 请求
- **THEN** 日志 MAY 包含 provider id、base URL host、model、耗时和状态
- **AND** 日志 SHALL NOT 包含 API key、Authorization header、完整 request body 或完整分析上下文

### Requirement: AI 分析状态独立
系统 SHALL 将 AI 分析状态与行情加载、图表 dataset、缓存任务和策略回测状态分离。

#### Scenario: 用户发起 AI 分析
- **WHEN** 用户提交 AI 分析请求
- **THEN** 系统 SHALL 优先通过流式请求/响应展示结果
- **AND** 系统 SHALL 展示 loading、成功、失败和重试状态

#### Scenario: AI 分析成功
- **WHEN** AI connector 返回分析结果
- **THEN** 系统 SHALL 在 AI 分析弹窗展示结果、connector、model/profile 和完成时间
- **AND** 系统 SHALL NOT 修改当前行情 dataset、图表指标设置、缓存状态、策略回测结果或自选股列表

#### Scenario: AI 分析失败
- **WHEN** AI connector 请求失败、超时或返回不兼容输出
- **THEN** 系统 SHALL 在 AI 分析弹窗展示清晰错误
- **AND** 系统 SHALL 保留当前行情和用户设置不变

#### Scenario: 用户连续发起多次分析
- **WHEN** 较早的 AI 请求晚于较新的 AI 请求返回
- **THEN** 系统 SHALL NOT 让较早结果覆盖较新的弹窗状态

### Requirement: AI 输出遵守投资安全边界
系统 SHALL 将 AI 输出定位为信息整理和历史数据解释，并明确其不构成投资建议。

#### Scenario: 构造 AI prompt
- **WHEN** main process 构造 AI 分析请求
- **THEN** prompt SHALL 要求模型只基于提供的历史数据和摘要进行解释、归纳风险点和列出待核实问题
- **AND** prompt SHALL 禁止输出买卖建议、荐股服务、收益承诺或未来表现保证
- **AND** prompt SHALL 要求模型使用简体中文可读小节而不是 JSON

#### Scenario: 用户查看 AI 分析结果
- **WHEN** AI 分析弹窗展示模型输出
- **THEN** 弹窗 SHALL 标注模型输出可能错误且仅用于信息整理
- **AND** 弹窗 SHALL 明确用户需要自行核验行情数据、模型输出和时效性
- **AND** 如果 provider 仍返回 JSON 字符串，弹窗 SHALL 将其格式化为可读小节展示

#### Scenario: 任意 AI 使用场景生成结果
- **WHEN** 系统展示任意 AI 使用场景结果
- **THEN** 结果 SHALL 默认标注“仅供信息整理和历史数据解释，不构成投资建议”或等价提示
- **AND** 结果 SHALL NOT 包含“必涨”“必跌”“稳赚”“保证收益”或等价收益承诺

#### Scenario: 模型返回带有投资建议倾向的内容
- **WHEN** AI connector 返回包含明确买卖建议、收益承诺或未来表现保证的内容
- **THEN** 系统 SHALL 在展示区域保留非投资建议提示
- **AND** 后续实现 MAY 增加更严格的输出拦截或重写策略

### Requirement: AI 配置导入导出排除敏感材料
系统 SHALL 允许非敏感 AI connector 配置参与本地设置恢复，但 SHALL 排除密钥、认证、会话和请求历史。

#### Scenario: 用户导出本地缓存备份
- **WHEN** 本地备份包含应用设置分区
- **THEN** 备份 MAY 包含 AI connector 类型、displayName、HTTP base URL、model/profile、温度、超时和启用状态
- **AND** 备份 SHALL NOT 包含 API key、加密密文、Authorization header、环境变量或 AI 请求历史

#### Scenario: 用户导入包含 AI connector 配置的备份
- **WHEN** 备份文件包含非敏感 AI connector 配置
- **THEN** 系统 SHALL 恢复可归一化的 connector 配置
- **AND** 对于 HTTP provider，系统 SHALL 将 API key 状态标记为需要重新输入
