## Why

当前分时图只覆盖基础行情展示和少量依赖字段可选指标，无法支持 KDJ、量比、换手率、委比、内外盘、资金流等需要更完整分钟与盘口上下文的高级指标。补齐这些指标前，需要先把分钟 OHLC、历史成交量、流通股本、盘口或逐笔方向数据纳入行情源能力与指标可用性契约，避免在数据缺失时给出误导性计算结果。

## What Changes

- 为分时模式增加高级指标能力规划：KDJ、量比、换手率、委比、内外盘、资金流。
- 为高级分时指标定义明确的数据前置条件，并要求缺失前置数据时隐藏、禁用或标记不可用，而不是使用不可靠推算。
- 扩展行情源能力元数据，表达分钟 OHLC、历史成交量、流通股本、盘口和逐笔方向数据的支持情况。
- 第一版优先评估并支持东方财富高级上下文，腾讯作为后续补充验证源；不做跨源静默拼接。
- 固定第一版指标口径：KDJ 使用分钟 `high/low/close`，量比默认使用最近 5 个有效交易日日均每分钟成交量，换手率使用流通股本，委比使用买卖前 5 档数量合计，内外盘只接受方向成交或源端聚合字段，资金流只做总流入、总流出和净流入。
- 规划主进程行情源、preload typed bridge、renderer adapter、MobX ViewModel、model 指标计算和图表渲染之间的数据流边界。
- 保持 renderer 不直接请求远端行情接口，所有新增行情上下文仍由 main process 数据源 adapter 提供。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `chart-indicators`: 增加分时高级指标、指标前置数据校验、可用性降级和分时指标设置契约。
- `market-data-sources`: 增加高级分时指标所需的行情源能力、数据字段和缺失数据错误/降级契约。

## Impact

- 影响 `src/main/remote-stock-sources.ts` 的数据源能力建模、请求、解析和 fallback 规则。
- 影响 `src/main/ipc.ts`、`src/preload/stock-api.ts` 和 renderer adapter 的 typed API 数据结构。
- 影响 `src/renderer/features/stock-workspace/view-models/StockWorkspaceViewModel.ts` 的分时刷新编排、指标可用性和设置持久化。
- 影响 model 层的分时指标定义、normalize、校验和计算逻辑。
- 影响 chart adapter 的分时高级指标渲染，但 chart adapter 不应重新计算业务指标。
- 需要更新相关 Vitest 覆盖；属于用户可见功能，实施时应更新 `CHANGELOG.md`。
