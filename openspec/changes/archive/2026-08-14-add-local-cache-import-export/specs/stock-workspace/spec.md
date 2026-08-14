## ADDED Requirements

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
