## Context

Stock Monitor 当前已经有 `帮助 -> 使用说明书` 的离线 Modal，也有 `docs/promotion/juejin-stock-monitor-article.md` 作为外部传播文章。两份文档都属于用户可读材料，但承担的任务不同：说明书帮助用户在应用内完成操作，推广文章帮助读者理解项目能力、工程实践和开源入口。

近期功能已经从基础分时/K 线扩展到自选股、K 线缓存管理、策略回测、做T测算、版本更新说明、macOS 无签名手动安装更新等场景。文档如果只停留在早期功能，会让用户无法发现新入口，也可能误解策略信号、历史回测或盈亏测算的边界。

## Goals / Non-Goals

**Goals:**

- 让应用内 `使用说明书` 覆盖当前主要用户工作流，并保持离线可读。
- 让 `README.md` 覆盖当前用户可见能力、截图说明、帮助入口和文档入口，作为仓库首页的最新说明。
- 让 `docs/promotion/juejin-stock-monitor-article.md` 与当前功能、架构、发布策略、测试覆盖和 Codex/OpenSpec 协作流程保持一致。
- 将用户提供的自选股管理、历史 K 线缓存、做T盈亏测算、K 线历史回测 4 张截图作为仓库截图资产纳入文档引用。
- 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7`，记录本次说明书、README、推广文章和截图同步。
- 对策略回测、B/S 信号、做T测算和行情数据限制使用一致的安全文案，避免投资建议或收益承诺。
- 控制变更范围，只做内容更新和必要的文档结构调整。

**Non-Goals:**

- 不新增帮助菜单入口、搜索、截图查看器、多语言、远程文档加载或独立帮助窗口。
- 不修改远端行情源、K 线缓存、策略回测、做T测算、自动更新或任何 IPC/preload API 行为。
- 不迁移历史 `docs/spec/feature/YYYYMM/*` 文档。
- 不把推广文章改成完整产品官网或发布公告。
- 不重新采集或生成截图；本次使用用户提供的 4 张截图。

## Decisions

1. 说明书以“应用内操作路径”为主线

   `UserManualModal.tsx` 继续保留内置 JSX 文本和目录结构，更新时按用户会看到的入口组织内容：免责声明、快速开始、证券代码、分时、K 线、指标、自选股、K 线缓存、策略回测、做T测算、数据源、网络代理、应用更新和常见问题。这样用户不需要理解项目架构，也能按当前界面找到入口。

   Alternatives considered: 直接把 README 复制进说明书可以减少整理成本，但 README 包含开发、架构、打包和测试内容，不适合作为应用内操作手册。

2. 推广文章以“技术实践叙事”为主线

   `docs/promotion/juejin-stock-monitor-article.md` 继续保持掘金文章格式，更新标题备选、封面文案、正文介绍、功能章节、架构章节、发布/测试章节和后续计划。文章可以保留工程细节和 Codex 协作流程，但需要把旧的 `docs/spec/feature/` 表述调整为当前 OpenSpec 工作流，避免读者看到过时流程。

   Alternatives considered: 把文章改成纯用户手册会和 README/说明书重复，也不适合掘金技术文章的阅读场景。

3. README 和 OpenSpec specs 同步更新

   实施时 SHALL 先对照当前 OpenSpec specs、现有 UI 文案和 README，确认功能清单和边界；随后同步更新 README，使仓库首页与说明书、推广文章保持一致。README 更新重点是用户可见能力、截图说明、帮助入口、文档入口和安全边界，不做架构大重写。

   Alternatives considered: 只按现有说明书和推广文章局部增删容易遗漏近期功能；只按实现代码逐项反推则成本更高且容易写入内部细节。

4. 截图作为仓库内稳定资产

   用户提供的 4 张截图实施时 SHALL 复制到 `docs/assets/screenshots/`，使用 ASCII 稳定文件名，默认命名为 `watchlist-management.png`、`kline-cache-management.png`、`trade-profit-calculator.png`、`kline-strategy-backtesting.png`。README 和推广文章 SHALL 引用仓库内相对路径，不引用 `/Users/mac/Downloads/*`。

   Alternatives considered: 直接引用用户本机 Downloads 路径不可移植；重新截图会扩大范围且当前附件已经覆盖需要展示的 4 个新增场景。

5. CHANGELOG 记录文档同步

   `CHANGELOG.md` SHALL 更新 `Unreleased / 0.1.7` 区块，默认归入 `Docs` 或现有等价分类，记录使用说明书、README、推广文章和截图补充。虽然本 change 不改变应用行为，但用户明确要求同步 changelog，且截图/说明书属于用户可见文档输出。

   Alternatives considered: 不更新 changelog 可减少文档噪音，但会和用户确认不一致，也不利于发版时追踪文档同步内容。

6. 文案安全作为验收条件

   所有用户可见文案 SHALL 避免投资建议、买卖建议、荐股服务、保证收益和类似承诺。涉及策略回测、B/S 信号或做T测算时，默认表述为“程序化计算结果”“历史回测”“费用和盈亏估算”“不代表真实成交结果”。

   Alternatives considered: 只在文章开头保留一次免责声明不够，用户可能直接阅读功能章节；关键高风险功能附近也需要局部边界说明。

## Risks / Trade-offs

- [Risk] 文档列出的功能与实际 UI 入口不一致 -> Mitigation: 实施前对照 README、现有组件和 OpenSpec specs；实施后人工通读关键章节。
- [Risk] 策略回测或做T测算文案被误读为交易建议 -> Mitigation: 在说明书和文章中保留免责声明，并在相关章节使用历史、估算、限制说明措辞。
- [Risk] 推广文章为了完整覆盖功能而变得冗长 -> Mitigation: 文章保留技术叙事，只把近期能力归入合适段落，不把所有 README 细节搬入正文。
- [Risk] 截图文件名包含中文或引用本机绝对路径导致仓库外不可用 -> Mitigation: 复制到 `docs/assets/screenshots/` 并使用 ASCII 稳定文件名。
- [Risk] JSX 文案调整引入格式或类型错误 -> Mitigation: 实施后至少运行 `yarn typecheck`；如触及测试覆盖的行为，再运行相关测试。

## Migration Plan

- 只更新 OpenSpec planning artifacts 时，运行 `openspec validate refresh-user-manual-and-juejin-article --strict`。
- 后续实施文档更新时，先校对现有功能清单，再修改 `UserManualModal.tsx`、`README.md`、`docs/promotion/juejin-stock-monitor-article.md` 和 `CHANGELOG.md`。
- 将 4 张用户提供截图复制到 `docs/assets/screenshots/`，并在 README 和推广文章中引用仓库内路径。
- 文档实施完成后运行 `yarn typecheck` 和 `git diff --check`；若触及菜单、状态或 API 行为，则按项目规则补跑相关测试。

## Confirmed Defaults

- 说明书新增独立“K 线缓存”和“策略回测”章节。
- 推广文章保留 Codex 协作开发叙事，并更新为 OpenSpec change 驱动的协作流程。
- 使用用户提供的 4 张截图，不重新采集；默认复制到 `docs/assets/screenshots/` 并使用 ASCII 文件名。
- README 和 `CHANGELOG.md` 都纳入实施范围，changelog 目标为 `Unreleased / 0.1.7`。
