# release-process Specification

## Purpose
TBD - created by archiving change adopt-openspec-workflow. Update Purpose after archive.
## Requirements
### Requirement: Changelog 是 release notes 来源
系统 SHALL 维护根目录 `CHANGELOG.md`，并将其作为用户可见 release notes 和 GitHub Release notes 提取来源。

#### Scenario: 用户可见变更被提交
- **WHEN** 一个 change 影响用户可见应用行为、安装、更新行为或 release 行为
- **THEN** `CHANGELOG.md` SHALL 在匹配的 `Unreleased / <package version>` 区块下新增一条简洁 bullet

#### Scenario: 内部 workflow-only 变更被提交
- **WHEN** 一个 change 只影响内部规划流程、agent instructions 或非用户可见文档
- **THEN** app changelog bullet 不是必需项

### Requirement: Release validation 保护打包输出
系统 SHALL 在发布 artifacts 前校验 version/changelog 一致性、release notes 提取、项目测试、typecheck 和 build。

#### Scenario: Release workflow 运行
- **WHEN** release workflow 准备新 release
- **THEN** 它 SHALL 在发布 artifacts 前运行配置的验证和构建步骤

#### Scenario: Release notes 生成
- **WHEN** GitHub Release notes 被创建
- **THEN** 它们 SHALL 从匹配的 `CHANGELOG.md` 版本区块提取

### Requirement: 发版后准备下一开发版本
系统 SHALL 按项目 release 规则，在 release 后准备下一开发版本和 changelog 状态。

#### Scenario: Release 完成
- **WHEN** 一个 release version finalized
- **THEN** development branch SHALL 准备下一版本，并创建新的匹配 unreleased changelog 区块

### Requirement: Commit packaging 适配 OpenSpec
`project-commit-pr` workflow SHALL 在打包本地 commit 和 PR markdown 时优先使用 active OpenSpec change 上下文。

#### Scenario: 当前任务存在 OpenSpec change
- **WHEN** `project-commit-pr` 为存在 active OpenSpec change 的任务打包
- **THEN** 它 SHALL 读取 change artifacts、运行 `openspec validate <change> --strict`、将 PR markdown 写入 `openspec/changes/<change>/pr.md`，并在 commit 和 PR body 中包含 `OpenSpec Change: <change>`

#### Scenario: 不存在 OpenSpec change
- **WHEN** `project-commit-pr` 为没有 active OpenSpec change 的任务打包
- **THEN** 它 SHALL 仅对已经绑定 legacy plan 的任务使用 legacy feature `pr.md` 位置，否则 SHALL 将 PR markdown 写入 `docs/pr/`

### Requirement: Commit packaging 不隐式 archive
`project-commit-pr` workflow SHALL NOT archive OpenSpec change，除非用户明确要求 archive、finalize 或 complete OpenSpec change。

#### Scenario: 用户只要求 commit
- **WHEN** 用户要求 `project-commit-pr` 创建本地 commit
- **THEN** workflow SHALL 在 commit 后保持 OpenSpec change active，除非用户明确要求 archive

### Requirement: OpenSpec artifacts 默认使用中文正文
OpenSpec proposal、design、tasks 和 specs 的正文描述 SHALL 默认使用简体中文。Capability id、文件夹名、文件路径、代码标识符、命令名、API 名和 OpenSpec 解析所需结构关键字 SHALL 保持英文稳定形式。

#### Scenario: 创建新的 OpenSpec change
- **WHEN** 后续创建新的 OpenSpec change
- **THEN** proposal、design、tasks 和 specs 的人类可读描述 SHALL 默认使用简体中文

#### Scenario: 编写 OpenSpec spec 场景
- **WHEN** 编写或更新 OpenSpec spec 文件
- **THEN** `Requirement`、`Scenario`、`WHEN` 和 `THEN` 等解析敏感标记 SHALL 保持英文，标记后的描述可以使用简体中文
