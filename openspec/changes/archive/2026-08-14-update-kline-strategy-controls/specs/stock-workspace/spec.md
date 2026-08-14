## MODIFIED Requirements

### Requirement: 工作区设置本地持久化
系统 SHALL 通过应用设置存储持久化工作区查询状态、按视图区分的数据源选择、指标设置、策略回测偏好、代理设置、启动检查更新设置和本地用户工作流状态。策略回测偏好 SHALL 持久化策略模板、策略参数和回测假设，但 SHALL NOT 持久化或恢复独立于当前 K 线 query 的策略回测区间。

#### Scenario: 用户重启应用
- **WHEN** 应用在设置保存后重启
- **THEN** 工作区 SHALL 恢复已保存的兼容设置，包括策略模板、策略参数和回测假设，或恢复 normalize 后的默认值
- **AND** 若旧设置包含策略回测 `dateRange`，工作区 SHALL 忽略该字段并使用当前 K 线 query 的 `startDate` 和 `endDate`

### Requirement: 工作区编排 K 线缓存管理弹窗
系统 SHALL 由工作区 ViewModel 编排 K 线缓存管理弹窗的打开状态、缓存对象模式、查询条件草稿、缓存状态加载、表格行展示、表格选中项和刷新任务状态。缓存对象模式 SHALL 区分 `单只股票缓存` 与 `多只股票缓存`，并 SHALL 默认使用 `单只股票缓存`。缓存状态表格 SHALL 展示每行缓存 query 对应的数据源名称。

#### Scenario: 打开缓存管理弹窗
- **WHEN** 用户从自选股面板打开 K 线缓存管理弹窗
- **THEN** 工作区 SHALL 使用当前 K 线 query 的 `sourceId`、`startDate` 和 `endDate` 作为弹窗默认查询条件
- **AND** 工作区 SHALL 默认选择 `单只股票缓存`
- **AND** 工作区 SHALL NOT 记忆上次打开弹窗时选择的缓存对象模式
- **AND** 工作区 SHALL 默认仅选中 `day` 周期和 `qfq` 复权口径
- **AND** 工作区 SHALL NOT 默认选中 `week`、`month`、`none` 或 `hfq`

#### Scenario: 缓存对象模式控件
- **WHEN** 用户打开 K 线缓存管理弹窗
- **THEN** 弹窗 SHALL 在顶部查询区域展示缓存对象模式控件
- **AND** 缓存对象模式控件 SHALL 提供 `单只股票缓存` 和 `多只股票缓存` 两个选项

#### Scenario: 周期和复权使用复选框组
- **WHEN** 用户打开 K 线缓存管理弹窗
- **THEN** 弹窗 SHALL 将 `日线`、`周线`、`月线` 展示为周期复选框组，并将 `前复权`、`不复权`、`后复权` 展示为复权复选框组
- **AND** `日线` 和 `前复权` SHALL 默认勾选
- **AND** `周线`、`月线`、`不复权` 和 `后复权` SHALL 默认不勾选

#### Scenario: 默认单只股票缓存
- **WHEN** 用户打开 K 线缓存管理弹窗且未切换缓存对象模式
- **THEN** 工作区 SHALL 只使用当前 K 线 query 的 `symbol` 和当前证券显示名称构造缓存状态、刷新和清理请求
- **AND** 工作区 SHALL NOT 默认使用完整自选股列表构造缓存请求
- **AND** 当前证券不在自选股列表中时，工作区 SHALL 仍允许对该证券执行缓存状态查询和刷新

#### Scenario: 用户切换到多只股票缓存
- **WHEN** 用户将缓存对象模式切换为 `多只股票缓存`
- **THEN** 工作区 SHALL 使用当前自选股列表构造缓存状态、刷新和清理请求
- **AND** 工作区 SHALL 保持当前数据源、日期范围、周期选择和复权选择不变
- **AND** 工作区 SHALL 清空缓存表格选中项并重新查询缓存状态
- **AND** 工作区 SHALL NOT 因切换缓存对象模式修改自选股列表

#### Scenario: 多只股票缓存遇到空自选股
- **WHEN** 用户切换到 `多只股票缓存` 且当前自选股列表为空
- **THEN** 工作区 SHALL 展示空状态
- **AND** 工作区 SHALL 禁用刷新操作
- **AND** 工作区 SHALL NOT 提交空 items 的批量缓存刷新任务

#### Scenario: 用户切换回单只股票缓存
- **WHEN** 用户从 `多只股票缓存` 切换回 `单只股票缓存`
- **THEN** 工作区 SHALL 使用当前 K 线 query 的 `symbol` 和当前证券显示名称重新构造缓存状态、刷新和清理请求
- **AND** 工作区 SHALL 保持当前数据源、日期范围、周期选择和复权选择不变
- **AND** 工作区 SHALL 清空缓存表格选中项并重新查询缓存状态

#### Scenario: 刷新全部按当前缓存对象模式执行
- **WHEN** 用户点击历史 K 线缓存弹窗中的 `刷新全部`
- **THEN** 若当前为 `单只股票缓存`，工作区 SHALL 只刷新当前 K 线 query 对应证券
- **AND** 若当前为 `多只股票缓存`，工作区 SHALL 刷新当前自选股列表

#### Scenario: 缓存列表展示数据源列
- **WHEN** 缓存管理弹窗展示缓存状态表格
- **THEN** 表格 SHALL 在 `名称` 后、`周期` 前展示 `数据源` 列
- **AND** `数据源` 列默认宽度 SHALL 为 96px
- **AND** `数据源` 列 SHALL 基于每行 `query.sourceId` 显示用户可读的数据源名称，例如 `东方财富`
- **AND** 表格 SHALL NOT 只用当前弹窗顶部数据源选择值替代每行 query 的数据源身份

#### Scenario: 缓存列表遇到未知数据源
- **WHEN** 缓存状态行的 `query.sourceId` 无法映射到已知数据源显示名
- **THEN** `数据源` 列 SHALL 显示原始 `sourceId`
- **AND** `数据源` 列 SHALL NOT 显示为空白

#### Scenario: 缓存列表数据源列不改变交互能力
- **WHEN** 用户查看新增 `数据源` 列
- **THEN** 系统 SHALL NOT 因本 change 新增数据源筛选、排序或分组能力
- **AND** 既有查询、刷新、清理和选择行为 SHALL 保持不变

#### Scenario: 当前处于分时模式
- **WHEN** 工作区处于分时模式且用户打开 K 线缓存管理弹窗
- **THEN** 工作区 SHALL 保持当前视图模式不变，并 SHALL NOT 因打开弹窗触发图表刷新

### Requirement: K 线工作区暴露策略回测入口
系统 SHALL 在 K 线工作区提供策略回测面板入口，用于基于当前 K 线 query 运行策略模板和查看历史回测结果。

#### Scenario: 用户处于 K 线模式
- **WHEN** 工作区处于 K 线模式且已经加载或可读取历史 K 线数据
- **THEN** 工作区 SHALL 展示策略回测入口，并使用当前 `sourceId`、`symbol`、`period`、`adjust`、`startDate` 和 `endDate` 作为默认回测 query
- **AND** 工作区 SHALL NOT 从策略回测偏好中恢复独立的 `startDate` 或 `endDate`

#### Scenario: 用户处于分时模式
- **WHEN** 工作区处于分时模式
- **THEN** 工作区 SHALL NOT 自动运行 K 线策略回测，并 SHALL NOT 因策略面板状态改变触发分时数据刷新

### Requirement: 工作区编排策略回测状态
系统 SHALL 由工作区 ViewModel 编排策略面板打开状态、策略选择、参数草稿、回测假设、运行状态、错误状态、选中结果、策略信号开关同步和持久化触发。

#### Scenario: 打开策略面板
- **WHEN** 用户打开 K 线策略面板
- **THEN** 工作区 SHALL 初始化策略参数草稿和回测假设，并展示当前 K 线 query 的回测区间
- **AND** 工作区 SHALL 保持当前图表 dataset 不变

#### Scenario: 用户编辑回测区间
- **WHEN** 用户需要调整策略回测使用的开始日期或结束日期
- **THEN** 工作区 SHALL 要求用户通过外部 K 线日期范围修改当前 K 线 query
- **AND** 策略面板 SHALL NOT 提供独立的开始日期或结束日期输入

#### Scenario: 用户运行回测
- **WHEN** 用户选择一个或多个策略模板并运行回测
- **THEN** 工作区 SHALL 使用当前 K 线 query 的 `startDate` 和 `endDate` 设置独立的策略运行状态
- **AND** 当回测 query 的 K 线缓存缺失或不完整时，工作区 SHALL 先触发对应缓存下载/刷新，并通过运行按钮 loading 和策略面板简短状态文本展示缓存准备状态
- **AND** 工作区 SHALL 在缓存准备完成后执行回测并展示策略结果而不覆盖行情加载状态

#### Scenario: 用户修改策略偏好
- **WHEN** 用户应用策略模板选择、模板参数或回测假设
- **THEN** 工作区 SHALL 保存兼容的策略回测偏好到本地工作区设置
- **AND** 保存的策略回测偏好 SHALL NOT 包含独立回测区间

#### Scenario: 回测表单阻塞错误
- **WHEN** 用户未选择任何策略模板或回测假设无效
- **THEN** 工作区 SHALL 阻止回测并展示清晰的表单错误

#### Scenario: 单个策略模板参数无效
- **WHEN** 用户选择多个策略模板且其中某个模板参数无效
- **THEN** 工作区 SHALL 允许其他参数有效的模板运行回测
- **AND** 工作区 SHALL 将参数无效的模板结果标记为不可用并展示不可用原因

### Requirement: 策略结果不破坏当前工作区行情状态
系统 SHALL 将策略回测状态与当前图表行情加载状态、K 线缓存任务状态、K 线指标设置和分时自动刷新状态分离。

#### Scenario: 策略回测成功
- **WHEN** 策略回测成功生成结果
- **THEN** 工作区 SHALL 更新策略结果区域，并 SHALL NOT 替换当前 K 线 dataset 的行情 candles
- **AND** 若 K 线指标中的 `策略` 信号开关已开启，工作区 SHALL 将选中成功策略结果的买入和卖出信号同步到图表标记
- **AND** 图表中的策略买入和卖出标记 SHALL 使用明显不同的颜色

#### Scenario: 策略信号开关关闭
- **WHEN** 策略回测已有成功结果但 K 线指标中的 `策略` 信号开关关闭
- **THEN** 工作区 SHALL 保留策略结果区域
- **AND** 工作区 SHALL NOT 将该策略结果的买入或卖出信号渲染到 K 线图表

#### Scenario: 策略回测失败
- **WHEN** 策略回测因缓存刷新失败、数据缺失、样本不足或计算错误失败
- **THEN** 工作区 SHALL 在策略面板展示失败原因，并 SHALL NOT 清空当前查询设置、已加载行情数据、指标设置、已有策略结果或 K 线缓存任务状态

#### Scenario: K 线 query 发生变化
- **WHEN** 用户切换 symbol、数据源、周期、复权或日期范围
- **THEN** 工作区 SHALL 将旧策略结果标记为过期或清空，并 SHALL NOT 将旧 query 的策略信号继续渲染到新图表
