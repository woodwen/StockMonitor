## Why

当前应用已经具备 K 线展示、指标配置和历史 K 线缓存能力，但用户无法基于本地缓存中的历史数据评估买入/卖出策略，也无法比较不同策略模板在收益和回撤上的表现。新增 K 线策略回测与推荐能力，可以让用户在不离开工作区的情况下，用可解释、可复现的历史数据结果辅助分析。

## What Changes

- 新增 K 线策略模板能力，第一版提供多种内置模板，例如均线交叉、突破回撤、RSI 超买超卖、MACD 趋势确认等。
- 支持用户在 K 线级别选择历史区间、周期、复权口径和策略模板，基于历史 K 线数据生成买入/卖出信号；第一版策略周期范围限定为 `day`、`week`、`month`。
- 策略回测优先使用本地 K 线缓存作为可复现数据输入；当所选区间缓存缺失或不完整时，先触发对应 K 线缓存下载/刷新，缓存完成后再执行回测。
- 支持按统一回测假设计算策略表现，包括总收益率、年化收益率、最大回撤、胜率、交易次数、盈亏比和持仓周期等指标。
- 在工作区展示策略推荐结果、收益/回撤摘要、交易明细和信号标记，并允许用户比较多个策略模板。
- 明确用户可见文案边界：系统展示的是历史回测和策略信号分析，不提供投资建议、买卖建议、收益承诺或自动交易能力。
- 对历史数据缺失、数据源不支持、样本不足、参数无效和回测计算失败提供清晰状态。

## Capabilities

### New Capabilities

- `kline-strategy-backtesting`: 定义 K 线策略模板、历史回测、策略推荐排序、收益/回撤指标展示、信号解释和风险文案边界。

### Modified Capabilities

- `stock-workspace`: 在 K 线工作区中新增策略面板入口、策略回测状态编排、结果展示和本地设置持久化行为。

## Impact

- 影响 renderer 工作区 UI、MobX ViewModel、K 线图表 adapter、model 层策略与回测计算模块。
- 可能新增或扩展 typed preload bridge 与 main process IPC，用于读取历史 K 线缓存或触发回测所需的数据访问；renderer 仍不得直接请求远端行情接口。
- 复用现有 K 线缓存和数据源能力校验，避免跨数据源或跨周期混用历史数据。
- 用户可见功能需要在实施阶段更新 `CHANGELOG.md` 的 `Unreleased / <current package.json version>` 区块。
- 验证范围预计包括 `yarn typecheck`、`yarn test`、`yarn test tests/stock-workspace-view-model.test.ts`；如修改 IPC 或 preload，额外运行 `yarn test tests/ipc-handlers.test.ts`；如修改主进程数据访问或构建配置，额外运行 `yarn build`。
