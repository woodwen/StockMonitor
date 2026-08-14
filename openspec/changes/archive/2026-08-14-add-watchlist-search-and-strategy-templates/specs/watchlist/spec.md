## ADDED Requirements

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
