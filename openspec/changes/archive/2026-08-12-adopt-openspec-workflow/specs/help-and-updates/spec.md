## ADDED Requirements

### Requirement: 帮助菜单暴露支持入口
系统 SHALL 通过 Help menu 暴露应用内帮助、版本更新说明、检查更新和关于信息。

#### Scenario: 用户打开 Help menu
- **WHEN** 用户打开 Help menu
- **THEN** 菜单 SHALL 包含使用说明书、版本更新说明、检查更新和关于信息入口

### Requirement: 应用内文档离线打包
系统 SHALL 在当前应用窗口内展示打包随附的文档和版本更新说明，并且不要求网络请求。

#### Scenario: 用户打开使用说明书
- **WHEN** 用户打开使用说明书
- **THEN** 系统 SHALL 在应用内展示打包的帮助内容

#### Scenario: 用户打开版本更新说明
- **WHEN** 用户打开版本更新说明
- **THEN** 系统 SHALL 展示当前安装包内置的 changelog 内容

### Requirement: 检查更新使用 update manager
系统 SHALL 通过应用 update manager 处理手动和启动检查更新，并通过 typed bridge 向 renderer 暴露更新状态。

#### Scenario: 用户手动检查更新
- **WHEN** 用户触发检查更新
- **THEN** 系统 SHALL 通过既有 main/preload 更新流程请求更新状态

#### Scenario: 启动检查更新关闭
- **WHEN** 已保存的启动检查更新设置为关闭
- **THEN** 应用 SHALL NOT 执行启动检查更新

### Requirement: 帮助菜单命令保持 typed
系统 SHALL 通过 typed menu command values 暴露菜单触发的 renderer action，避免在 renderer components 中散落临时字符串处理。

#### Scenario: 新增 Help menu renderer action
- **WHEN** 一个 Help menu item 需要打开 renderer UI
- **THEN** menu command type、preload bridge、renderer handler 和 tests SHALL 同步更新
