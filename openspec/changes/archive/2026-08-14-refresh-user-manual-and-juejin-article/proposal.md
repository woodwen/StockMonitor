## Why

当前应用内 `使用说明书` 和 `docs/promotion/juejin-stock-monitor-article.md` 已经覆盖早期功能，但项目近期新增了 K 线缓存管理、策略回测、做T测算、macOS 无签名更新降级等能力，文档需要与实际功能和安全边界保持一致。

本次变更先建立文档更新方案，确保后续实施时不会只补零散文案，而是按用户阅读路径、功能覆盖、安装更新说明和免责声明统一校准。

## What Changes

- 更新应用内 `使用说明书` 的内容结构和正文，补齐当前核心功能、使用步骤、限制说明和常见问题。
- 更新 `README.md`，补充当前说明书、推广文章和新增截图所覆盖的用户可见能力。
- 更新 `docs/promotion/juejin-stock-monitor-article.md`，让文章内容与当前产品能力、架构描述、发布策略和测试覆盖保持同步。
- 将用户提供的 4 张截图纳入仓库截图资产，并在 README 和推广文章中引用：自选股管理、历史 K 线缓存、做T盈亏测算、K 线历史回测。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7`，记录本次说明书、README、推广文章和截图文档同步。
- 校对所有用户可见文案，避免出现投资建议、买卖建议、荐股服务、收益承诺或过度营销措辞。
- 明确文档更新后的验证方式：OpenSpec strict validation、必要的类型/测试检查，以及人工阅读校对。
- 不修改应用行为、远端数据源、IPC、preload API、图表逻辑或发布流程。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `help-and-updates`: 扩展应用内帮助文档的内容覆盖和文案安全要求，并把外部推广文章纳入用户文档同步约束。

## Impact

- 影响 `src/renderer/features/help/views/UserManualModal.tsx` 中的内置说明书正文。
- 影响 `README.md` 的用户可见功能说明、截图说明和文档入口。
- 影响 `docs/promotion/juejin-stock-monitor-article.md` 的推广文章正文、功能清单、截图说明和风险提示。
- 影响 `docs/assets/screenshots/`，实施时将用户提供的截图复制为仓库内稳定文件名，避免文档引用本机 Downloads 路径。
- 影响 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块，记录本次文档和截图同步。
- 不新增依赖，不修改 typed bridge，不改变 main/preload/renderer 架构边界。
- 若实施阶段发现需要改变应用行为，应停止扩大范围并另行确认；本 change 默认只实施文档、截图资产和 changelog 更新。
