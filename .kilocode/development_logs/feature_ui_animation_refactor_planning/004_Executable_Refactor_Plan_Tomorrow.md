# 真正的可执行任务规划 (面向双层架构与动画重构)

**日期：** 2026-04-09
**目标：** 吸收沙盒版优点，规避历史雷区，以“双层 DOM 物理隔离”为核心，彻底重构 `GlobalStatusBar.vue`（依托 Git 原地修改）。

---

## 一、 沙盒版（失败的分支）资产锚定 (The Good & The Bad)

在动手前，我们必须明确沙盒版留下了什么遗产：

### ✅ 好的部分（必须继承）
1.  **绝对物理防线 (Clamping)**：`checkBounds` 中使用绝对值截断（如 `newX > 0 则 newX = 0`），抛弃了旧版危险的 `delta` 相对补偿。
2.  **边缘吸附与弹性交互 (Rubber-banding)**：引入了 `isSnappedToEdge` 状态，以及靠近边缘时的磁吸拉扯效果（`snappedStretchWidth`），这是极佳的 UI 体验。
3.  **精细的 UI 样式**：`shared_ui.scss` 中的四角伸缩按钮 (`.toggle-btn` 直角内外翻转动画) 视觉效果优秀，必须保留。
4.  **右上角开关锚点**：初衷是将 UI 向下延伸（避免顶栏被覆盖），这是一个非常刚需的业务动效体验。

### ❌ 坏的部分（致死雷区，绝对规避）
1.  **事件总线大屠杀**：为了“抽离”逻辑，粗暴地用原生 `document` 替换了系统生命线 `ArkEventBus`。
2.  **错位的 `ResizeObserver` 与脆弱的事件驱动**：将本质上属于物理布局层的尺寸监听器，错误地塞进了处理业务事件的 `ui_events_automator.ts`，导致生命周期脱节。同时，过于依赖原生的 `ResizeObserver` 导致了严重的漏报 Bug（如手机软键盘弹出、Vue 异步渲染导致尺寸变化但监听器未触发，最终 UI 溢出视窗外）。
3.  **锚点反噬与动画撕裂**：将锚点锁定在右上角时，一旦组件移到屏幕左侧，其生长的物理原点与期望的横向展开方向发生了强烈的几何干涉。AI 未能建立动态的 `transform-origin` 翻转机制，反而在一片混乱中不断添加脏代码。
4.  **开发纪律丧失**：在重构坐标、更改动画逻辑、提取 Hook 这三件毫无关联的重构之间，没有进行任何原子化 Commit 提交。最终全部绞肉在一起，无法回滚排错。

---

## 二、 明天的工作步骤与护城河 (The Executable Steps)

为了确保绝对安全，明天的工作将严格划分为三个完全隔离的原子步骤（每跑通一步必须立刻 `git commit` 保存快照，拒绝 V2 套娃）。

### 步骤 1：重铸基石，打造纯物理 Hook
**目标**：编写一个完全无副作用、只吐出绝对坐标的纯 JS 物理引擎。
**文件名**：直接修改/新建 `src/ARK_STATUSBAR/components/global_tabs/useDraggablePhysics.ts`
**具体执行细则**：
1.  **坐标系重整**：明确这个引擎输出的 `transformX/Y` 与 CSS 锚点系统的换算关系。无论基础锚点定在右上角还是左上角，必须在这个 Hook 内部提供统一的映射，屏蔽外部组件的数学计算。
2.  **收回监听器管辖权与引入心跳兜底**：`ResizeObserver` 必须写在这个 Hook 的内部。Hook 接收一个 `HTMLElement`，在 `onMounted` 时挂载，在 `onUnmounted` 时销毁。**更重要的是，必须在 Hook 内补充一个 1000ms（1秒）的低频心跳轮询（`setInterval`）。** 这个心跳作为终极物理防线，无视任何原生事件的漏报，每秒强制侦测一次 DOM 是否溢出，若溢出则强行拉回，彻底根绝移动端或复杂异步渲染下的幽灵出界 Bug。
3.  **输出契约**：仅输出 `{ x, y, isDragging, snappedEdge: false | 'left' | 'right', stretchWidth }` 以及暴露 `startDrag` 方法。
4.  **强制提交点**：写完且纯逻辑测试通过后，**必须停下进行 Commit**，无论 UI 是否对接完毕。

### 步骤 2：搭建双层套娃结构 (Dual-DOM Skeleton)
**目标**：在原地重构 `GlobalStatusBar.vue`，实现“物理”与“动画”的绝对隔离。
**文件名**：`src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
**具体执行细则**：
1.  **外层物理壳 (The Shell)**：
    外壳负责承载 `transform: translate(x, y)` 并在 `mousedown` 触发物理引擎。
    **【红线】**：外壳的 CSS 绝对禁止包含 `transition` 或任何改变自身形变的属性，它是 0 延迟防越界的基盘。
2.  **内层视觉面板 (The Visual Panel)**：
    **【红线】**：所有的宽度变化、向下延伸、颜色收缩 `transition` 全部限定在这个内层里。
    **【核心难点攻坚：锚点魔法】**：利用外层传进来的 `snappedEdge` 状态，动态修改内层盒子的 `transform-origin`（如左侧贴边则 `left top`，右侧贴边则 `right top`）。彻底解决左右动效撕裂的问题。
3.  **强制提交点**：拖拽与空盒子的 UI 形变不撕裂后，**必须停下进行 Commit**。

### 步骤 3：业务逻辑与状态机回填
**目标**：恢复业务功能与历史总线连接。
**具体执行细则**：
1.  引入单一真相源枚举 `UiMode` (FULL, MINI, BUBBLE)，废除离散的布尔值。
2.  原汁原味地恢复对 `ark-interceptor-triggered` 等核心 `ArkEventBus` 或强类型 `CustomEvent` 的响应。
3.  **强制提交点**：业务联调无误后，**进行最终 Commit**。