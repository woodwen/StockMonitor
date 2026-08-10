# M-7(chore): 本地化 spec 文档目录

背景:
- `docs/spec/` 用于本地需求、计划和 PR 草稿沉淀，不应继续随代码提交同步到远端仓库。
- 该目录下已有历史文档被 Git 跟踪，需要从索引中移除，同时保留开发者本地文件。

方案概述:
- 在 `.gitignore` 中加入 `docs/spec/`，阻止后续本地 spec 文档被默认纳入 Git。
- 使用 `git rm --cached` 从索引移除已跟踪的 `docs/spec/` 文件，避免删除本地文件。

实现改动:
- `.gitignore` 新增 `docs/spec/` 忽略规则。
- 从 Git 跟踪中移除 `docs/spec/feature/202608/` 下已有的 8 个 `plan.md` 和 `pr.md` 文件。

测试计划(UT):
- `yarn typecheck` 通过。
- `yarn build` 通过。
- `git diff --check` 通过。
- `git diff --cached --check` 通过。
- `git check-ignore -v docs/spec/feature/202608/0810-local-spec-only/pr.md` 通过，确认命中 `.gitignore:9:docs/spec/`。
- `yarn test` 未通过，失败原因是工作区存在未提交删除的 `fixtures/legacy/000002.txt`，测试读取该 fixture 时报 `ENOENT`；该删除不属于本次提交范围。

影响范围(建议手动测试范围):
- 影响 Git 跟踪行为：远端后续不再保存 `docs/spec/` 内容。
- 本地 `docs/spec/` 文件仍会保留，可继续作为本地私有规格文档使用。
- 手动确认 `git status --ignored docs/spec` 中该目录被忽略，且本地文件仍存在。
