# 修复图表左上角标题与指标信息重叠

## 背景

当前 K 线图左上角同时展示两类信息：

- 应用自定义的股票标题：`上证指数(000001) 日线`
- klinecharts 内置的指标 legend：例如 `BOLL(20,2)`、`UP: 3,263.17`

由于自定义标题使用绝对定位叠加在图表区域内，位置与 klinecharts 内置 legend 重合，导致文字相互覆盖，影响可读性。

本次目标是消除图表左上角重叠，同时保留当前股票和周期信息。

## 方案概述

采用最小 UI 调整方案：

- 移除图表区域内部的自定义 `.chart-title` 叠加层。
- 将股票标题移动到顶部工具栏，紧跟“示例”按钮后展示。
- 图表区域左上角只保留 klinecharts 内置指标 legend。
- 工具栏标题使用单行省略，悬停时通过原生 `title` 展示完整文本。
- 不调整 klinecharts 内置 legend 样式，不改变图表绘制和指标计算逻辑。

该方案避免继续通过 `z-index` 或 canvas padding 规避重叠，因为 klinecharts 的 legend 内容会随指标和鼠标位置变化。将自定义标题移出绘图区更稳定。

## 问题定位

重叠来源如下：

- `KLineChartView.tsx` 在 `.chart-shell` 内渲染 `<div className="chart-title">`。
- `.chart-title` 使用 `position: absolute; top: 10px; left: 12px; z-index: 2;`。
- klinecharts 内置 BOLL legend 同样绘制在图表左上角附近。

因此两者处在同一区域，且分别来自 HTML 叠加层和 canvas/图表内部绘制，无法通过普通文本流自动避让。

## 实现改动

### 图表视图

- 修改 `src/renderer/features/stock-workspace/views/KLineChartView.tsx`。
- 移除 `.chart-title` 节点。
- 图表容器只保留 klinecharts 挂载节点、空状态和加载状态。

### 顶部工具栏

- 修改 `src/renderer/features/stock-workspace/views/TopToolbar.tsx`。
- 在“示例”按钮后新增工具栏标题区域。
- 标题内容复用 `stock.chart.title`，格式保持为 `上证指数(000001) 日线`。
- 通过 `title` 属性支持悬停查看完整标题。

### 样式

- 修改 `src/renderer/styles.css`。
- 删除 `.chart-title` 样式。
- 新增 `.toolbar-symbol-title`：
  - 固定合理最小宽度和最大宽度。
  - 单行展示。
  - 超出使用省略号。
  - 保持与工具栏按钮同一视觉层级。

## 测试计划(UT)

本次改动主要是布局调整，不涉及 Model、ViewModel、指标计算、文件解析和 Electron IPC。

需要执行：

- `yarn typecheck`
  - 校验 JSX 和 TypeScript 类型无误。
- `yarn build`
  - 校验 Electron main/preload/renderer 生产构建通过。

不新增 UT 的原因：

- 重叠问题是视觉布局问题，现有单元测试无法可靠断言 canvas 内置 legend 与 HTML 叠加层的实际像素重叠。
- 当前改动没有修改可被纯函数或 ViewModel 直接验证的业务逻辑。

## 影响范围(建议手动测试范围)

### 图表区域

- 启动应用，确认图表左上角不再出现股票标题。
- 确认 `BOLL(20,2)`、`UP/MID/DN` 等 klinecharts 内置 legend 可正常显示。
- 打开/关闭 `BOLL`，确认 legend 不再被其他标题遮挡。
- 打开/关闭 `VOL MA`、`B/S`，确认图表区域没有新的重叠。

### 顶部工具栏

- 确认“示例”按钮后显示当前股票标题。
- 确认标题内容为 `上证指数(000001) 日线`。
- 缩小窗口宽度，确认标题单行省略，不挤压后续工具栏控件到不可用状态。
- 鼠标悬停标题，确认可以看到完整标题。

### 数据加载

- 启动应用，确认示例数据仍能自动加载。
- 点击“示例”，确认重新加载后标题和图表同步更新。
- 导入本地行情文件，确认标题随数据集更新。

## 风险与后续

- 当前仅移动股票标题位置，不调整 klinecharts 内置 legend 的布局。
- 如果后续增加更多顶部工具栏控件，工具栏空间可能再次紧张，需要引入更明确的分区布局。
- 如果后续需要在图表区域内展示更多自定义信息，应优先使用独立信息栏或 klinecharts 原生扩展能力，避免再次使用绝对定位叠加在 legend 区域。

## 验收标准

- 图表左上角不再出现股票标题与 BOLL legend 重叠。
- 当前股票标题在顶部工具栏可见。
- 标题过长时单行省略，不造成工具栏明显挤压。
- `yarn typecheck` 通过。
- `yarn build` 通过。
