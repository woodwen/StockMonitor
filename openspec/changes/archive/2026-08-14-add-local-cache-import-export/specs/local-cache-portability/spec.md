## ADDED Requirements

### Requirement: 本地缓存可导出为版本化备份文件
系统 SHALL 允许用户将当前所有本地可恢复数据导出为一个版本化本地备份文件。

#### Scenario: 用户导出本地缓存
- **WHEN** 用户触发本地缓存导出并选择保存位置
- **THEN** 系统 SHALL 写入一个未压缩、未加密的 UTF-8 JSON 备份文件
- **AND** 备份文件 SHALL 包含 `schemaVersion`、`appId`、`createdAt`、`appVersion`、`sections`、`settings` 和 `klineCache`
- **AND** 备份文件建议扩展名 SHALL 为 `.stock-monitor-backup.json`
- **AND** 系统 SHALL 展示导出成功摘要，包括文件路径、设置分区和 K 线缓存条目数

#### Scenario: 本地没有 K 线缓存
- **WHEN** 用户导出本地缓存且本地 K 线缓存目录为空或不存在
- **THEN** 系统 SHALL 仍导出合法备份文件
- **AND** `klineCache.entries` SHALL 为空数组
- **AND** 导出摘要 SHALL 清晰说明未导出历史 K 线缓存条目

#### Scenario: 导出遇到损坏的 K 线缓存文件
- **WHEN** 导出过程中发现某个 K 线缓存文件无法解析或不符合当前缓存格式
- **THEN** 系统 SHALL 跳过该缓存文件并继续导出其他有效数据
- **AND** 导出摘要 SHALL 标明跳过数量和原因

### Requirement: 本地缓存备份范围明确
系统 SHALL 将应用设置和历史 K 线缓存纳入本地缓存备份，并排除临时运行态数据。

#### Scenario: 备份包含可恢复设置
- **WHEN** 用户导出本地缓存
- **THEN** 备份文件 SHALL 包含启动检查更新设置、网络代理设置、工作区设置、自选股、指标设置、策略回测偏好和交易计算器设置
- **AND** 这些设置 SHALL 以当前应用版本可归一化的结构保存

#### Scenario: 备份排除临时运行态
- **WHEN** 用户导出本地缓存
- **THEN** 备份文件 SHALL NOT 包含正在运行或已完成的内存 job、`windowBounds`、窗口位置、图表加载状态、未保存表单草稿或远端请求临时响应

### Requirement: 本地缓存导入前必须校验备份文件
系统 SHALL 在写入任何本地数据之前校验备份文件的顶层格式、应用标识、schema 版本和数据分区。

#### Scenario: 导入合法备份文件
- **WHEN** 用户选择一个合法且兼容当前应用的备份文件
- **THEN** 系统 SHALL 展示待导入摘要
- **AND** 摘要 SHALL 包含设置分区、K 线缓存条目数、预计跳过项和导入策略
- **AND** 若备份包含网络代理设置，摘要 SHALL 提示导入会恢复代理配置

#### Scenario: 导入文件无法解析
- **WHEN** 用户选择的导入文件不是合法 JSON 或缺少必需顶层字段
- **THEN** 系统 SHALL 阻止导入
- **AND** 系统 SHALL 展示清晰错误
- **AND** 系统 SHALL NOT 修改现有本地设置或缓存

#### Scenario: 导入不兼容 schema
- **WHEN** 备份文件的 `appId` 不匹配或 `schemaVersion` 不被当前应用支持
- **THEN** 系统 SHALL 阻止导入
- **AND** 系统 SHALL 展示不兼容原因
- **AND** 系统 SHALL NOT 修改现有本地设置或缓存

### Requirement: 本地缓存导入策略可控
系统 SHALL 支持 `merge` 和 `replace` 两种导入策略，并以 `merge` 作为默认策略。

#### Scenario: 默认合并导入
- **WHEN** 用户使用默认 `merge` 策略确认导入
- **THEN** 系统 SHALL 用备份中的设置分区覆盖本地同名设置分区
- **AND** 系统 SHALL 用备份中的 K 线缓存条目替换本地相同 series 的缓存文件
- **AND** 系统 SHALL 保留备份中未包含的本地 K 线缓存 series

#### Scenario: 覆盖导入
- **WHEN** 用户选择 `replace` 策略并确认导入
- **THEN** 系统 SHALL 将本地可恢复设置恢复为备份值和当前版本默认值归一化后的结果
- **AND** 系统 SHALL 移除备份中未包含的本地 K 线缓存 series
- **AND** 系统 SHALL 展示覆盖导入会替换本地数据的确认提示

#### Scenario: 用户取消导入确认
- **WHEN** 用户在确认前取消导入
- **THEN** 系统 SHALL 关闭确认流程
- **AND** 系统 SHALL NOT 修改现有本地设置或缓存

### Requirement: 本地缓存导入结果可追踪
系统 SHALL 在导入完成后展示结构化结果摘要。

#### Scenario: 导入全部成功
- **WHEN** 备份中的设置和 K 线缓存条目全部导入成功
- **THEN** 系统 SHALL 展示成功结果
- **AND** 结果 SHALL 包含导入设置分区和 K 线缓存条目数

#### Scenario: 导入存在跳过项
- **WHEN** 备份中存在无效、重复或当前版本不支持的 K 线缓存条目
- **THEN** 系统 SHALL 导入其他有效条目
- **AND** 系统 SHALL 在结果摘要中列出跳过数量和原因

#### Scenario: 导入写入失败
- **WHEN** 系统在写入本地数据前或写入准备阶段发生失败
- **THEN** 系统 SHALL 展示失败原因
- **AND** 系统 SHALL 尽可能保持现有本地设置和缓存不变

### Requirement: 本地缓存导入导出遵守主进程边界
系统 SHALL 只在主进程执行本地备份文件和应用数据目录的读写，renderer SHALL 通过 typed bridge 触发导入导出。

#### Scenario: Renderer 触发导出
- **WHEN** renderer 需要导出本地缓存
- **THEN** renderer SHALL 调用 `window.stockApi` 暴露的 typed API
- **AND** renderer SHALL NOT 直接访问 Electron 文件系统 API 或本地应用数据目录

#### Scenario: Renderer 触发导入
- **WHEN** renderer 需要导入本地缓存
- **THEN** renderer SHALL 调用 `window.stockApi` 暴露的 typed API
- **AND** 主进程 SHALL 完成文件选择、文件读取、格式校验和本地写入
