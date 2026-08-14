# watchlist Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: 自选股本地管理
系统 SHALL 提供本地自选股面板，用于保存、查看、添加和删除常看证券。

#### Scenario: 用户切换自选股面板
- **WHEN** 用户点击自选股入口
- **THEN** 系统 SHALL 打开或关闭本地自选股面板，并且不主动改变当前图表数据

#### Scenario: 自选股为空
- **WHEN** 没有保存任何自选股
- **THEN** 面板 SHALL 展示空状态和添加控件

### Requirement: 自选股添加解析一致
系统 SHALL 从单行或多行文本解析自选股添加内容，并处理 symbol 前缀 normalize、重复项和输入大小限制。

#### Scenario: 用户输入裸 6 位代码
- **WHEN** 用户输入裸 6 位证券代码
- **THEN** 系统 SHALL 按项目市场前缀规则推断市场前缀，并保存 normalize 后的 symbol

#### Scenario: 用户输入重复代码
- **WHEN** 输入包含重复 symbol 或 watchlist 中已存在的 symbol
- **THEN** 系统 SHALL 每个新 symbol 只添加一次，并在预览中报告跳过的重复项

### Requirement: 自选股删除显式确认
系统 SHALL 提供管理模式，用于选择、确认和删除自选股条目。

#### Scenario: 用户删除选中条目
- **WHEN** 用户确认删除选中的自选股条目
- **THEN** 系统 SHALL 删除这些条目、保存更新后的 watchlist、清空选择，并保持当前图表数据不变

### Requirement: 自选股点击刷新当前视图
系统 SHALL 切换到被点击的自选股 symbol，并刷新当前视图，同时不改变当前 K 线或分时数据源选择。

#### Scenario: 用户点击自选股条目
- **WHEN** 用户点击一个自选股条目
- **THEN** 工作区 SHALL 设置当前 symbol，并刷新 active view mode 的数据

#### Scenario: 选中股票加载成功
- **WHEN** 当前 symbol 已在 watchlist 中，且数据加载返回 display name
- **THEN** 系统 MAY 回填保存的 watchlist 名称并持久化

### Requirement: 自选股本地持久化
系统 SHALL 在本地设置中持久化 watchlist，并在加载时 normalize 非法或超限条目。

#### Scenario: 应用带已保存 watchlist 重启
- **WHEN** 应用重启
- **THEN** 有效的已保存 watchlist 条目 SHALL 在配置数量限制内按保存顺序恢复

### Requirement: 自选股面板暴露 K 线缓存入口
系统 SHALL 在自选股面板提供历史 K 线缓存管理入口，用于打开当前 watchlist 的缓存管理弹窗。

#### Scenario: 用户打开缓存管理弹窗
- **WHEN** 用户点击自选股面板中的 K 线缓存管理入口
- **THEN** 系统 SHALL 打开缓存管理弹窗，并使用当前 watchlist 条目作为默认缓存对象

#### Scenario: 自选股为空时打开缓存管理
- **WHEN** watchlist 为空且用户打开缓存管理弹窗
- **THEN** 系统 SHALL 展示空状态，并 SHALL NOT 发起缓存状态查询或远端刷新任务

### Requirement: 缓存管理对象跟随当前 watchlist
系统 SHALL 以当前 watchlist 的有效 symbol 集合作为缓存管理弹窗的默认对象集合。

#### Scenario: watchlist 条目被删除后查看缓存管理
- **WHEN** 用户删除某个自选股条目后重新打开缓存管理弹窗
- **THEN** 系统 SHALL NOT 在默认缓存状态列表中展示已删除 symbol

#### Scenario: watchlist 条目名称被回填
- **WHEN** 自选股条目名称因行情刷新被回填
- **THEN** 缓存管理弹窗 SHALL 使用更新后的名称展示对应 symbol，并 SHALL NOT 改变缓存 key

### Requirement: 自选股切换搜索筛选
系统 SHALL 在自选股切换面板提供本地搜索筛选能力，用于按股票名称、完整 symbol 或裸代码过滤当前 watchlist 展示列表。搜索筛选 SHALL 只影响面板中的可见条目和管理模式的可见选择范围，SHALL NOT 改变 watchlist 持久化顺序，SHALL NOT 因输入搜索词触发行情刷新。搜索词 SHALL 作为面板临时状态处理，SHALL NOT 持久化，并 SHALL 在自选股面板关闭时清空。

#### Scenario: 自选股面板展示搜索入口
- **WHEN** 用户打开自选股面板
- **THEN** 面板 SHALL 展示搜索输入入口
- **AND** 搜索输入为空时 SHALL 按 watchlist 原始持久化顺序展示全部自选股条目

#### Scenario: 用户按名称或代码筛选
- **WHEN** 用户在搜索输入中输入股票名称片段、完整 symbol 片段或去市场前缀后的裸代码片段
- **THEN** 面板 SHALL 以大小写不敏感方式展示匹配的自选股条目
- **AND** 匹配结果 SHALL 保持这些条目在 watchlist 中的原始相对顺序

#### Scenario: 搜索无匹配结果
- **WHEN** watchlist 非空且当前搜索词没有匹配任何自选股条目
- **THEN** 面板 SHALL 展示无匹配状态
- **AND** 面板 SHALL 提供清空搜索或等效方式恢复完整列表
- **AND** 系统 SHALL NOT 将 watchlist 视为空列表

#### Scenario: 用户点击筛选结果
- **WHEN** 用户点击一个当前筛选结果中的自选股条目
- **THEN** 工作区 SHALL 设置当前 symbol，并刷新 active view mode 的数据
- **AND** 搜索筛选 SHALL NOT 改变当前 K 线或分时数据源选择

#### Scenario: 搜索输入不触发行情刷新
- **WHEN** 用户修改自选股搜索词
- **THEN** 系统 SHALL 只更新自选股面板可见列表
- **AND** 系统 SHALL NOT 修改当前 symbol
- **AND** 系统 SHALL NOT 发起分时、K 线或缓存刷新请求

#### Scenario: 关闭面板清空搜索
- **WHEN** 用户关闭自选股面板后再次打开
- **THEN** 搜索输入 SHALL 为空
- **AND** 面板 SHALL 按 watchlist 原始持久化顺序展示全部自选股条目
- **AND** 系统 SHALL NOT 从本地设置恢复上次搜索词

#### Scenario: 管理模式按当前筛选结果选择
- **WHEN** 用户在管理模式下输入搜索词并点击全选或反选
- **THEN** 系统 SHALL 只对当前筛选结果中的可见条目执行选择切换
- **AND** 系统 SHALL 保留未匹配隐藏条目的既有选中状态
- **AND** 删除确认和删除执行 SHALL 继续基于实际已选中条目集合
