## ADDED Requirements

### Requirement: K 线缓存请求遵守进程边界
系统 SHALL 通过 Electron main process 和 typed preload bridge 查询、刷新和读取 K 线缓存。Renderer 代码 SHALL NOT 直接请求远端行情接口来填充缓存。

#### Scenario: Renderer 查询缓存状态
- **WHEN** renderer 需要展示自选股 K 线缓存状态
- **THEN** 它 SHALL 调用 `window.stockApi` 暴露的 typed cache API，而不是直接读取缓存文件或请求远端行情接口

#### Scenario: Renderer 启动缓存刷新
- **WHEN** renderer 需要批量刷新自选股 K 线缓存
- **THEN** 它 SHALL 调用 typed preload bridge，由 main process 复用远端行情源 adapter 执行请求

### Requirement: K 线缓存请求复用数据源能力和代理设置
系统 SHALL 对缓存刷新请求执行与普通 K 线查询一致的数据源能力校验，并复用已保存网络代理设置。

#### Scenario: 缓存查询超出数据源能力
- **WHEN** 用户尝试缓存当前数据源不支持的市场、周期或复权组合
- **THEN** 系统 SHALL 在对应 `symbol + period + adjust` 缓存行返回 `unsupported` 或清晰错误，且 SHALL NOT 写入该 query 维度缓存

#### Scenario: 用户启用代理后刷新缓存
- **WHEN** 用户已保存启用的 SOCKS5 或 HTTP 代理配置并启动缓存刷新
- **THEN** 缓存刷新请求 SHALL 使用已保存代理设置，与普通 K 线刷新保持一致

### Requirement: K 线缓存刷新不静默跨源 fallback
系统 SHALL 保持缓存 key 的数据源语义稳定。缓存刷新失败时 SHALL NOT 静默跨数据源 fallback 到另一个 K 线源写入缓存。

#### Scenario: 指定数据源刷新失败
- **WHEN** 指定 `sourceId` 的缓存刷新请求失败，且其他数据源可能可以返回同一 symbol 的 K 线数据
- **THEN** 系统 SHALL 将该缓存行标记为失败，并 SHALL NOT 用其他数据源结果填充当前 `sourceId` 的缓存

#### Scenario: 同源备用主机可用
- **WHEN** 同一数据源内部存在等价备用主机或等价接口 fallback
- **THEN** 系统 MAY 复用该同源 fallback，但 SHALL 保留原始 `sourceId` 和来源信息
