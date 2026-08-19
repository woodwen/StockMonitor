# stock-workspace Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: 工作区视图模式
系统 SHALL 提供分时和 K 线两种工作区模式，并以分时作为默认启动视图。

#### Scenario: 应用启动
- **WHEN** 应用使用默认设置启动
- **THEN** 工作区 SHALL 进入分时模式

#### Scenario: 用户切换视图模式
- **WHEN** 用户在分时和 K 线模式之间切换
- **THEN** 工作区 SHALL 展示与当前模式匹配的控件和图表行为

### Requirement: K 线和分时数据源选择互相独立
系统 SHALL 保持 K 线数据源选择和分时数据源选择互相独立，同时共享当前证券代码。

#### Scenario: 用户切换 K 线数据源
- **WHEN** 用户选择 K 线数据源
- **THEN** 分时数据源 SHALL 保持不变

#### Scenario: 用户切换分时数据源
- **WHEN** 用户选择分时数据源
- **THEN** K 线数据源 SHALL 保持不变

### Requirement: 工作区设置本地持久化
系统 SHALL 通过应用设置存储持久化工作区查询状态、按视图区分的数据源选择、指标设置、策略回测偏好、代理设置、启动检查更新设置和本地用户工作流状态。策略回测偏好 SHALL 持久化策略模板、策略参数和回测假设，但 SHALL NOT 持久化或恢复独立于当前 K 线 query 的策略回测区间。应用每次重启加载工作区设置时，工作区 SHALL 将 K 线 query 的日期基准刷新到当前启动日，并保留用户保存的日期窗口长度。

#### Scenario: 用户重启应用
- **WHEN** 应用在设置保存后重启
- **THEN** 工作区 SHALL 恢复已保存的兼容设置，包括策略模板、策略参数和回测假设，或恢复 normalize 后的默认值
- **AND** 若旧设置包含策略回测 `dateRange`，工作区 SHALL 忽略该字段并使用当前 K 线 query 的 `startDate` 和 `endDate`

#### Scenario: 应用在新的一天重启
- **GIVEN** 本地设置已保存 K 线 query，且保存的 `endDate` 不等于当前启动日
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 将当前 K 线 query 的 `endDate` 调整为当前启动日的 `YYYYMMDD`
- **AND** 工作区 SHALL 按保存的 `startDate` 与 `endDate` 之间的天数跨度平移 `startDate`，保持用户已选择的日期窗口长度
- **AND** 工作区 SHALL 保留保存的 `sourceId`、`symbol`、`period`、`adjust`、视图模式、分时数据源、指标设置、策略回测偏好和自选股
- **AND** 工作区 SHALL 使用调整后的 query 触发启动刷新、K 线缓存弹窗默认日期和策略回测日期来源
- **AND** 工作区 SHALL 通过现有工作区设置保存路径持久化调整后的 query；保存失败 SHALL NOT 阻止启动刷新

#### Scenario: 应用当天重复重启
- **GIVEN** 本地设置已保存 K 线 query，且保存的 `endDate` 等于当前启动日
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 保持保存的 `startDate` 和 `endDate` 不变
- **AND** 工作区 SHALL NOT 因日期基准刷新产生不必要的工作区设置保存

#### Scenario: 用户在当前会话查看历史日期
- **GIVEN** 应用已完成启动加载
- **WHEN** 用户通过顶部 K 线日期范围输入设置历史 `startDate` 或 `endDate`
- **THEN** 工作区 SHALL 使用用户输入的日期范围刷新 K 线、打开 K 线缓存弹窗和运行策略回测
- **AND** 工作区 SHALL NOT 在当前会话内自动把该日期范围强制调整回当前启动日

#### Scenario: 保存的日期范围不可用
- **GIVEN** 本地设置中的 K 线 query 日期无法解析，或 `startDate` 晚于 `endDate`
- **WHEN** 应用重启并加载工作区设置
- **THEN** 工作区 SHALL 使用当前启动日结尾的默认滚动日期窗口恢复 query 日期
- **AND** 工作区 SHALL 保留可兼容的非日期 query 字段和其他工作区设置
- **AND** 工作区 SHALL 通过现有工作区设置保存路径持久化恢复后的 query；保存失败 SHALL NOT 阻止启动刷新

### Requirement: 刷新行为感知当前模式
系统 SHALL 支持当前工作区模式的手动刷新，并且 SHALL 只在窗口可见且本地 A 股交易时段条件满足时自动刷新分时数据。

#### Scenario: 用户点击刷新
- **WHEN** 用户点击刷新
- **THEN** 工作区 SHALL 刷新当前视图模式的数据

#### Scenario: 分时自动刷新定时器触发
- **WHEN** 工作区处于分时模式、窗口可见且交易时段条件满足
- **THEN** 系统 SHALL 执行静默分时刷新，并且不改变 K 线查询状态

### Requirement: 工作区展示可操作状态
系统 SHALL 在工作区状态区域展示当前数据源、证券代码、记录数或点数、最新行情、加载状态和更新状态。

#### Scenario: 数据刷新成功
- **WHEN** 行情数据刷新成功
- **THEN** 状态区域 SHALL 反映 active source、symbol、已加载数据量、最新数据和非错误加载状态

#### Scenario: 数据刷新失败
- **WHEN** 行情数据刷新失败
- **THEN** 工作区 SHALL 展示清晰失败状态，并且不清空无关用户设置

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

### Requirement: 缓存任务不破坏当前工作区行情状态
系统 SHALL 将 K 线缓存任务状态与当前图表加载状态分离。

#### Scenario: 缓存刷新成功
- **WHEN** K 线缓存刷新任务成功写入一个或多个 symbol 的缓存
- **THEN** 工作区 SHALL 更新缓存弹窗内的行级状态，并 SHALL NOT 替换当前图表 dataset

#### Scenario: 缓存刷新失败
- **WHEN** K 线缓存刷新任务中的一个或多个 symbol 失败
- **THEN** 工作区 SHALL 在缓存弹窗内展示失败原因，并 SHALL NOT 清空当前图表错误状态、查询设置或已加载数据

### Requirement: 缓存管理控件遵守数据源能力
系统 SHALL 在缓存管理弹窗中只允许用户选择当前 K 线数据源支持的周期和复权选项，并以多选数组保存查询条件。

#### Scenario: 数据源保持单选
- **WHEN** 用户在缓存管理弹窗中配置查询条件
- **THEN** 弹窗 SHALL 只允许选择一个 K 线数据源，并 SHALL 将多个周期和多个复权组合展开到该数据源下查询和刷新

#### Scenario: 用户切换缓存数据源
- **WHEN** 用户在缓存管理弹窗中切换 K 线数据源
- **THEN** 工作区 SHALL 只保留该数据源支持的已选 periods 和 adjusts，并重新加载缓存状态

#### Scenario: 切换数据源后没有能力交集
- **WHEN** 用户切换 K 线数据源后，已选 periods 或 adjusts 与该数据源能力没有交集
- **THEN** 工作区 SHALL 清空对应选择、展示清晰错误，并 SHALL 阻止查询和刷新直到用户重新选择支持项

#### Scenario: 未选择周期或复权
- **WHEN** 用户清空所有周期或所有复权口径
- **THEN** 工作区 SHALL 展示清晰错误，并 SHALL 阻止查询缓存状态和启动缓存刷新

#### Scenario: 查询条件日期无效
- **WHEN** 用户输入无效或倒置的缓存日期范围
- **THEN** 工作区 SHALL 阻止启动缓存刷新，并展示清晰的表单错误

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

### Requirement: 策略面板遵守工作区产品安全文案
系统 SHALL 在 K 线策略面板中使用历史回测、候选策略、信号和表现排名等描述，不得使用投资建议、买卖建议、荐股、保证收益或类似承诺性文案。

#### Scenario: 展示最佳历史表现策略
- **WHEN** 策略面板展示排名第一的策略结果
- **THEN** 工作区 SHALL 将其描述为所选区间内历史表现最佳的候选策略，并 SHALL 同时展示回测假设和限制说明

#### Scenario: 展示买入或卖出信号
- **WHEN** 工作区展示某个策略生成的 `buy` 或 `sell` 信号
- **THEN** 用户可见文案 SHALL 将其描述为策略信号或历史触发点，并 SHALL NOT 表述为应当买入或应当卖出

### Requirement: 工作区提供本地缓存导入导出入口
系统 SHALL 在工作区提供本地缓存导入和导出入口，用于备份或恢复应用本地可恢复数据。

#### Scenario: 工作区展示导入导出入口
- **WHEN** 用户打开工作区
- **THEN** 工作区 SHALL 提供清晰的本地缓存导入和本地缓存导出操作入口
- **AND** 入口 SHALL NOT 使用投资建议、收益承诺或荐股相关文案

#### Scenario: 用户触发导出
- **WHEN** 用户从工作区触发本地缓存导出
- **THEN** 工作区 SHALL 通过 data adapter 调用 `window.stockApi` 的导出能力
- **AND** 工作区 SHALL 在导出完成后展示成功或失败结果
- **AND** 工作区 SHALL NOT 改变当前图表 dataset、当前 symbol 或当前视图模式

#### Scenario: 用户触发导入
- **WHEN** 用户从工作区触发本地缓存导入并选择备份文件
- **THEN** 工作区 SHALL 展示待导入摘要和导入策略确认
- **AND** 当备份包含网络代理设置时，确认内容 SHALL 提示会恢复代理配置
- **AND** 用户确认前 SHALL NOT 修改当前本地设置或缓存

### Requirement: 工作区导入后刷新本地状态
系统 SHALL 在本地缓存导入成功后重新加载受影响的本地状态，并保持远端行情刷新由用户显式触发。

#### Scenario: 导入设置成功
- **WHEN** 本地缓存导入成功且备份包含工作区设置、自选股、指标设置或策略偏好
- **THEN** 工作区 SHALL 重新读取应用设置并刷新 ViewModel 中对应状态
- **AND** 工作区 SHALL 使用当前版本 normalize 逻辑处理导入设置

#### Scenario: 导入 K 线缓存成功且缓存弹窗已打开
- **WHEN** 本地缓存导入成功且 K 线缓存管理弹窗处于打开状态
- **THEN** 工作区 SHALL 重新查询缓存状态
- **AND** 表格 SHALL 展示导入后的缓存覆盖范围、记录数和错误摘要

#### Scenario: 导入后不自动刷新远端行情
- **WHEN** 本地缓存导入成功
- **THEN** 工作区 SHALL NOT 自动触发分时、K 线或策略回测远端刷新
- **AND** 当前图表加载状态 SHALL 与导入结果状态分离展示

### Requirement: 工作区顶部工具栏聚合操作入口
系统 SHALL 在工作区顶部工具栏中按使用频率和上下文聚合操作入口，使行情查询主路径保持直接可见，并将低频配置和维护操作放入菜单式入口。

#### Scenario: 用户打开工作区
- **WHEN** 用户打开工作区
- **THEN** 顶部工具栏 SHALL 直接展示证券代码输入、自选股入口、分时/K 线视图切换、当前模式查询参数、刷新入口和当前证券标题
- **AND** 顶部工具栏 SHALL 提供名为 `更多` 的菜单式入口用于访问低频操作
- **AND** 顶部工具栏 SHALL 直接展示 `指标` 和 `做T` 工具入口

#### Scenario: 用户查看低频操作菜单
- **WHEN** 用户打开顶部工具栏的聚合菜单
- **THEN** 聚合菜单入口 SHALL 使用 `更多` 作为用户可见名称
- **AND** 菜单 SHALL 提供数据源、网络代理、本地缓存导出、本地缓存导入和检查更新入口
- **AND** 菜单 SHALL 提供启动检查更新设置的当前状态与切换能力
- **AND** 这些菜单项 SHALL 调用聚合前对应的 ViewModel action

#### Scenario: 用户处于 K 线模式
- **WHEN** 工作区处于 K 线模式
- **THEN** 顶部区域 SHALL 提供 K 线周期、复权、开始日期和结束日期参数
- **AND** 顶部区域 SHALL 直接展示策略入口用于打开 K 线历史回测面板

#### Scenario: 用户处于分时模式
- **WHEN** 工作区处于分时模式
- **THEN** 顶部区域 SHALL NOT 展示可触发 K 线策略面板的主入口
- **AND** 分时刷新、自选股、指标、做T、数据源切换、代理和更新相关入口 SHALL 保持可达

#### Scenario: 操作聚合后状态反馈保持一致
- **WHEN** 本地缓存导入检查、本地缓存导入、本地缓存导出、行情刷新或检查更新处于运行状态
- **THEN** 顶部工具栏 SHALL 保留对应入口的 loading、disabled 或等价状态反馈
- **AND** 聚合菜单 SHALL NOT 因入口位置变化重复触发同一个运行中的互斥操作

### Requirement: 工作区顶部工具栏保持稳定布局
系统 SHALL 在工作区顶部工具栏中使用稳定的分组和响应式约束，减少横向滚动和文本挤压造成的操作混乱。

#### Scenario: 默认桌面窗口宽度
- **WHEN** 应用以默认桌面窗口宽度展示工作区
- **THEN** 顶部工具栏 SHALL 不依赖横向滚动来访问证券代码输入、视图切换、当前模式查询参数、刷新、当前证券标题和聚合菜单
- **AND** 当前证券标题 SHALL 在空间不足时以省略号截断，而不是挤压查询控件

#### Scenario: 窄窗口展示
- **WHEN** 工作区窗口宽度不足以完整展示所有顶部工具
- **THEN** 顶部工具栏 SHALL 优先保持证券代码输入、视图切换、刷新和 `更多` 菜单可用
- **AND** 次级工具入口 MAY 压缩为图标按钮或收入菜单
- **AND** 顶部工具栏 SHALL NOT 让按钮文本与相邻控件重叠

#### Scenario: 用户使用键盘和辅助提示
- **WHEN** 用户聚焦或悬停顶部工具栏按钮与菜单入口
- **THEN** 入口 SHALL 保留清晰的 label、tooltip 或可访问名称
- **AND** 聚合后的入口 SHALL NOT 仅依赖视觉图标表达含义
