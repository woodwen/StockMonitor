## 1. 内容核对

- [x] 1.1 对照 README、现有 OpenSpec specs 和当前 UI 文案，整理说明书、README、推广文章和 changelog 必须同步覆盖的功能清单。
- [x] 1.2 核对 `src/renderer/features/help/views/UserManualModal.tsx` 当前目录和正文，标记缺失或过时章节。
- [x] 1.3 核对 `docs/promotion/juejin-stock-monitor-article.md` 当前标题、封面文案、功能描述、架构描述、发布说明和测试覆盖段落，标记过时表述。
- [x] 1.4 核对用户提供截图 `/Users/mac/Downloads/自选股管理.png`、`/Users/mac/Downloads/历史K线缓存.png`、`/Users/mac/Downloads/做T盈亏测算.png` 和 `/Users/mac/Downloads/K线历史回测.png` 可读取，并确认目标截图文件名。

## 2. 更新使用说明书

- [x] 2.1 更新 `UserManualModal.tsx` 的目录，新增或调整 K 线缓存、策略回测等当前用户工作流章节。
- [x] 2.2 更新说明书正文，补齐分时、K 线、指标、自选股、K 线缓存、策略回测、做T测算、数据源、网络代理、应用更新和常见问题的操作说明。
- [x] 2.3 在策略回测、B/S 信号、做T测算和行情数据说明附近补充清晰限制，避免投资建议、买卖建议、荐股服务或收益承诺表述。
- [x] 2.4 检查说明书章节顺序、目录锚点、 JSX 文本换行和移动窄宽度下的可读性，不引入新的交互行为。

## 3. 更新掘金推广文章

- [x] 3.1 更新文章标题备选、推荐标签和封面文案，使其覆盖当前核心能力但不过度承诺。
- [x] 3.2 更新正文开篇和“当前能做什么”章节，补齐自选股、K 线缓存、策略回测、做T测算、网络代理、本地持久化和更新发布能力。
- [x] 3.3 更新 Codex 协作开发流程描述，改为当前 OpenSpec change、实现、测试、文档和 changelog 同步流程。
- [x] 3.4 更新架构、数据源、发布/自动更新和测试覆盖段落，区分 macOS `dmg`/`zip`、未签名手动安装和正式签名待完善状态。
- [x] 3.5 更新文章截图引用，加入用户提供的自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测截图。

## 4. 更新 README、CHANGELOG 和截图资产

- [x] 4.1 将用户提供的 4 张截图复制到 `docs/assets/screenshots/`，默认文件名为 `watchlist-management.png`、`kline-cache-management.png`、`trade-profit-calculator.png` 和 `kline-strategy-backtesting.png`。
- [x] 4.2 更新 `README.md` 的功能说明和截图章节，引用新增截图并补齐自选股管理、历史 K 线缓存、做T盈亏测算和 K 线历史回测说明。
- [x] 4.3 更新 `CHANGELOG.md` 的 `Unreleased / 0.1.7` 区块，记录使用说明书、README、推广文章和截图同步。
- [x] 4.4 检查 README 和推广文章中的截图引用均指向存在的 `docs/assets/screenshots/*` 文件，且没有引用 `/Users/mac/Downloads/*`。

## 5. 文案安全与一致性校对

- [x] 5.1 全文搜索并校对“推荐、买入、卖出、收益、策略、信号、做T”等高风险词，确保上下文没有投资建议或收益承诺。
- [x] 5.2 确认说明书、README、推广文章和 changelog 对数据源限制、数据延迟/缺失/错误、策略回测历史性和做T测算估算性质的描述一致。
- [x] 5.3 确认新增截图说明不包含收益承诺、买卖建议或对未来表现的暗示。

## 6. 验证

- [x] 6.1 运行 `yarn typecheck`，确认 `UserManualModal.tsx` 文案结构调整没有引入 TypeScript/JSX 错误。
- [x] 6.2 运行 `git diff --check` 检查空白和格式问题。
- [x] 6.3 如实施中触及菜单、Root ViewModel、IPC、preload 或应用行为，按项目规则补跑对应测试。
- [x] 6.4 运行 `openspec validate refresh-user-manual-and-juejin-article --strict`，确认 change artifacts 通过严格校验。
