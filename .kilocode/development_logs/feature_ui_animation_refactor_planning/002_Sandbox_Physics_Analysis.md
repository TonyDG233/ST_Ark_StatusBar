# 沙盒版 GlobalStatusBar 物理层 (拖拽与边缘检测) 代码分析

**分析对象:**
- `.kilocode\development_logs\feature_ui_animation_refactor_planning\ARK_STATUSBAR\components\global_tabs\useDraggablePhysics.ts`
- `.kilocode\development_logs\feature_ui_animation_refactor_planning\ARK_STATUSBAR\components\GlobalStatusBar.vue`
- `.kilocode\development_logs\feature_ui_animation_refactor_planning\ARK_STATUSBAR\components\global_tabs\ui_events_automator.ts`

---

## 1. 核心状态与物理常量 (State & Constants)

在 `useDraggablePhysics.ts` 中：
*   **物理常量 (`PHYSICS_CONSTANTS`)**: 定义了触发贴边的阈值 (`HIDE_THRESHOLD = -20`, `SNAP_ALIGN_THRESHOLD = 20`)、拉扯释放阈值 (`STRETCH_RELEASE_THRESHOLD = 45`) 以及胶囊气泡的宽度限制 (`BUBBLE_WIDTH = 32`, `MAX_STRETCH = 80`)。
*   **响应式状态**: 
    *   `transformX`, `transformY`: 当前坐标偏移。
    *   `isDraggingState`: 对外暴露的拖拽中状态标识。
    *   `isSnappedToEdge`: 吸附状态枚举，类型为 `false | 'left' | 'right'`。
    *   `snappedStretchWidth`: 气泡吸附时的动态弹性宽度。
*   **逻辑特征**: 建立了一套独立于 Vue 生命周期的纯 TS 状态管理，用于追踪当前组件是处于自由悬浮还是边缘吸附（胶囊）状态。

---

## 2. 拖拽初始化：`startDrag(e: MouseEvent | TouchEvent)`

*   **所在文件**: `useDraggablePhysics.ts`
*   **输入**: 鼠标或触摸的按下事件。
*   **内部逻辑**:
    1.  **目标过滤**: `if ((e.target as HTMLElement).closest('button, .icon-btn')) return;` 阻止内部按钮触发拖拽。
    2.  开启内部与外部拖拽标识 (`isDragging`, `isDraggingState`)。
    3.  提取初始鼠标/触摸坐标 `clientX/clientY` 至 `startX/Y`，快照当前位移至 `initialX/Y`。
    4.  向全局 `document` 挂载 `mousemove/touchmove` 和 `mouseup/touchend` 监听器。

---

## 3. 位移计算与弹性拉扯：`onDrag(e: MouseEvent | TouchEvent)`

*   **所在文件**: `useDraggablePhysics.ts`
*   **内部逻辑**:
    1.  防抖与阻止默认行为。
    2.  计算鼠标物理偏移量 `dx`, `dy`。
    3.  **模式分发**:
        *   **处于自由悬浮模式 (`isSnappedToEdge.value === false`)**: 直接更新 `transformX = initialX + dx`, `transformY = initialY + dy`。
        *   **处于边缘吸附模式 (`isSnappedToEdge.value !== false`)**:
            *   **坐标锁定**: `transformX` 坐标被死锁在边缘（右侧锁死为 `0`，左侧锁死为 `snappedStretchWidth - innerWidth`）。
            *   **弹性形变 (Rubber-banding)**: 将鼠标横向拉扯距离 (`pullDist`) 乘以阻尼系数 (`0.5`)，赋值给 `snappedStretchWidth`，最大不超过 `MAX_STRETCH` (80px)。只改变形变宽度，不改变 X 坐标。
            *   Y 轴依然允许自由滑动。

---

## 4. 拖拽终止与吸附判定：`stopDrag()`

*   **所在文件**: `useDraggablePhysics.ts`
*   **内部逻辑**:
    1.  移除全局监听器。
    2.  **气泡模式判定**:
        *   若当前弹性拉扯宽度 `snappedStretchWidth` > `STRETCH_RELEASE_THRESHOLD` (45px)，判定为**展开**。解除吸附 (`isSnappedToEdge = false`)，进入 `isMiniMode = true` 状态，并向屏幕内侧弹开固定距离 (`EXPAND_BOUNCE_MARGIN`)。
        *   若拉扯不足，则触发回弹，`snappedStretchWidth` 恢复默认 `BUBBLE_WIDTH` (32px)，坐标锁死贴边。
    3.  **自由悬浮模式判定**:
        *   计算左右两侧距离屏幕边缘的绝对距离 (`distRight`, `distLeft`)。
        *   若距离极近 (`< HIDE_THRESHOLD`)，则触发深度贴边，进入 `isSnappedToEdge` 胶囊模式。
        *   若距离较近 (`<= SNAP_ALIGN_THRESHOLD`)，则执行普通吸附对齐（坐标强行归零或贴紧左墙）。
    4.  推迟 50ms 触发最终的绝对边界兜底防御 `checkBounds()`。
*   **逻辑缺陷**: 展开判定时，代码写为 `isMiniMode.value = true`。根据上下文，组件从隐藏的侧边拉出，理论上应退出 mini 模式或展示更多内容，此处的设值可能导致视觉呈现与预期背离。

---

## 5. 核心物理防御：`checkBounds()`

*   **所在文件**: `useDraggablePhysics.ts`
*   **内部逻辑**:
    1.  提取 `getBoundingClientRect()`。为防提取失败或动画中途尺寸不准，引入双保险推算 `rect.width || (isMiniMode ? 180 : 400)`。
    2.  **绝对物理墙防御 (Clamping)**:
        *   右墙：`newX > 0` 强制截断为 `0`。
        *   左墙：`newX < currentWidth - viewportWidth` 强制截断。
        *   顶墙：`newY < SAFE_TOP` 强制截断。
        *   底墙：非拖拽状态下，依据 `newY + currentHeight > viewportHeight - SAFE_MARGIN_BOTTOM` 进行阻挡。
    3.  发生越界时，直接覆盖赋值给 `transformX/Y`。
*   **架构特征**: 这里的边界防御从稳定版的“相对误差补偿”演进为了“绝对值截断”。它更为生硬但更安全，阻断了坐标异常累加导致飞出屏幕的隐患。

---

## 6. 渲染层视图绑定 (`GlobalStatusBar.vue`)

*   **内部逻辑**:
    *   通过解构赋值导入物理引擎：`const { transformX, transformY, isDraggingState, isSnappedToEdge, snappedStretchWidth } = useDraggablePhysics(...)`。
    *   **动态类名绑定**: 将物理状态转化为 CSS 类名：`'edge-snapped'`, `'edge-snapped-left'`, `'is-dragging'`。
    *   **CSS 变量注入**: 将拉伸宽度转化为 `--snapped-width`，供 SCSS 读取。
    *   移除了自身所有的鼠标中间状态监听，仅在特定区域（Header、边缘指示器）保留 `@mousedown="startDrag"` 作为物理引擎入口。
*   **解耦现状**: Vue 文件已经剥离了拖拽计算逻辑，降级为物理状态的消费者与视觉反馈载体。

---

## 7. 尺寸监听防线 (`ui_events_automator.ts`)

*   **内部逻辑**:
    *   在 `setupUiEventsAutomator` 中初始化 `ResizeObserver` 监听 `.ark-global-statusbar` 节点。
    *   当触发尺寸变动时，通过 `callbacks.requestCheckBounds()` 向外抛出回调，由 Vue 组件在下一帧调度物理引擎的 `checkBounds()`。
*   **潜在冲突点**: 虽然 `useDraggablePhysics` 在计算边界时加入了 `currentWidth` 推算双保险，但如果通过 CSS 为宽度附加了 `transition` 动画，`ResizeObserver` 仍会在动画期间高频触发。若 `getBoundingClientRect` 占主导，仍可能在边缘变形展开时引起瞬间的错位干涉。