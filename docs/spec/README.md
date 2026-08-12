# Stock Monitor Spec Archive

`docs/spec/feature/YYYYMM/DD-topic` 保存历史 feature plan 和 PR note，是已经完成或历史规划工作的归档材料。

后续新需求默认使用 OpenSpec：

```bash
openspec new change <change-id>
openspec validate <change-id> --strict
```

OpenSpec 使用规则：

- proposal、design、tasks 和 specs 的正文默认使用简体中文。
- capability id、文件夹名、文件路径、命令、API、包名和代码标识符保留英文稳定形式。
- spec 中的 OpenSpec 结构关键字保持英文，包括 `ADDED Requirements`、`MODIFIED Requirements`、`REMOVED Requirements`、`Requirement`、`Scenario`、`WHEN` 和 `THEN`。
- Requirement 名称、Scenario 名称以及 WHEN/THEN 后面的描述可以使用中文。
- baseline 和 delta specs 只记录可验收行为、架构边界和约束，不搬入历史实现过程。

只有在任务明确要求延续某个 legacy archived plan 时，才继续更新 `docs/spec/feature/YYYYMM/DD-topic` 下的文件。
