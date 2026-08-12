## ADDED Requirements

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
