## ADDED Requirements

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
