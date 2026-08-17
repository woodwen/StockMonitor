## Why

当前 K 线和分时指标设置中都暴露 `B/S` 信号项。随着 K 线策略回测能力完善，K 线图表已经存在更可解释的策略信号来源，继续保留独立 `B/S` 指标会让用户在“指标信号”和“策略信号”之间产生混淆。分时 `B/S` 同样属于程序化快慢线交叉标记，不适合作为默认用户工作流中的独立指标入口。

当前使用说明书对指标和策略模板的解释偏使用流程，缺少“指标含义、基本原理、前置数据和限制”的系统说明。用户在启用指标、默认选择策略模板或查看策略结果时，需要能在应用内说明书中理解这些内容的计算含义，同时明确这些内容不是投资建议或收益承诺。

## What Changes

- 从 K 线指标设置中删除 `B/S` 指标项；K 线指标 UI 不再展示 `B/S` 开关、参数或样式配置，K 线图表不再渲染 K 线 `B/S` 标记。
- 从分时指标设置中删除 `B/S` 指标项；分时指标 UI 不再展示 `B/S` 开关或参数配置，分时图不再渲染分时 `B/S` 标记、图例或 tooltip 文案。
- K 线 `策略` 信号指标保留，并作为 K 线默认选择的 overlay 信号指标；它用于展示当前选中成功策略回测结果的买入/卖出标记。
- 策略回测 fresh settings 默认选择全部可用策略模板；已有用户设置保留可识别的已保存模板选择，设置缺失、无效或过滤后为空时回落为全选全部可用模板。
- 应用内 `使用说明书` 增补各 K 线指标、分时指标、策略信号指标和所有策略模板的意义与基本原理说明，包括用途、计算口径、前置数据、常见限制和安全边界。
- README 中与指标默认状态和策略模板默认选择相关的现有用户说明需要同步，避免与应用内使用说明书冲突；详细原理说明以应用内 `使用说明书` 为主。
- `CHANGELOG.md` 的 `Unreleased / 0.1.9` 区块记录本次用户可见指标默认行为、策略默认选择和说明书更新。
- 不新增策略模板，不改变既有策略模板的信号算法、回测评分、成交模型、费用率、滑点率或缓存完整性校验规则。
- 不提供投资建议、交易建议、荐股服务、收益承诺或未来表现保证。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `chart-indicators`: 删除 K 线和分时 `B/S` 指标选择项，调整 K 线 `策略` 信号指标默认状态和旧设置兼容规则。
- `kline-strategy-backtesting`: 明确策略模板 fresh/default settings 默认选择全部可用模板，并保留已有可识别用户选择。
- `help-and-updates`: 使用说明书补充指标和策略模板的意义与原理说明，并同步 README、changelog 的相关用户说明。

## Impact

- 影响 K 线指标和分时指标 definitions、settings normalize、ViewModel 草稿/应用逻辑、图表 adapter 渲染路径和相关测试。
- 影响旧版持久化指标设置兼容：历史保存的 `bsSignal` 应安全读取但不再作为可见或可渲染指标恢复。
- 影响 K 线策略信号默认展示编排：`策略` 指标默认开启时，只有存在选中成功策略结果才会在 K 线图表展示策略标记。
- 影响 K 线策略设置 normalize 和测试，需要验证 fresh/default settings 全选全部模板，旧设置仍保留可识别选择。
- 影响 `src/renderer/features/help/views/UserManualModal.tsx`、`README.md`、`CHANGELOG.md` 和文档相关测试。
- 按项目规则，实施阶段需要运行 `openspec validate <change> --strict`、`openspec validate --all --strict`、`git diff --check`、`yarn typecheck`、`yarn test`，以及 changelog 相关测试。
