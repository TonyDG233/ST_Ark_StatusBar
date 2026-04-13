# 详细规划 3: GlobalStatusBar.vue 越权监听分离与解耦

**日期：** 2026-04-13
**背景：** 在生命周期重构过程中，发现 `GlobalStatusBar.vue` 内部承载了大量本不应属于视图层 (View) 的业务与调度逻辑。这不仅破坏了单一职责原则，还导致系统的业务流转（如放行消息发送）强依赖于 UI 组件的挂载状态。

## 1. 监听器越权度分析

当前 `GlobalStatusBar.vue` (`onMounted` 钩子内) 注册了 6 个事件监听器，其越权程度分析如下：

### 1.1 严重越权 (必须剥离至 Controller/Automator)

*   **`configUpdatedListener` (监听 `ark-config-updated`)**
    *   **行为：** 监听到配置更新后，调用内部定义的 `loadPrimaryWorldbookName()` 和 `loadWorldbookLists()`，这些函数直接通过 `StatusBarManager` 请求后端数据，并覆写 `shared_ui_state.ts` 中的全局数据缓存。
    *   **判定：** 严重越权。数据缓存的更新是由数据中枢 (`shared_ui_state` 或外部控制器) 负责的，UI 层只需被动读取。
*   **`chatChangedListener` (监听 `ark:system-chat-changed`)**
    *   **行为：** 切换聊天对象时，再次去拉取当前绑定的世界书名字。
    *   **判定：** 严重越权。同上。
*   **`interceptorTriggeredListener` (监听 `ark-interceptor-triggered`)**
    *   **行为：** 这是最严重的耦合点。它不仅对传入的条目数据做业务级别的过滤（剔除 constant 等），修改 `currentTab` 等全局 UI 状态，它甚至在判定没有需要警告的条目时，**直接调用 `manager.releaseInterceptAndSend()` 向底层系统下达了放行真实消息的指令**。
    *   **判定：** 极其严重的越权与架构反向依赖。UI 组件绝对不应该决定是否发送消息。

### 1.2 逻辑错位 (需要剥离)

*   **`baselineDiffListener` (监听 `ark:worldbook-baseline-diff-detected`)**
    *   **行为：** 弹出 Toast 警告框提示用户有脏数据残留。
    *   **判定：** 错位。虽然弹窗属于展示行为，但这是一个全局级别的警告。即便用户关闭了状态栏 UI（`isSystemEnabled=false`，组件未渲染或处于 mini 隐藏状态），这个警告依然应该生效。因此，它应绑定在生命周期更长的数据层或 Automator 身上。

### 1.3 纯粹的 UI 表现相关 (允许保留)

*   **`systemToggleListener` (监听 `ark:system-toggle`)**
    *   **行为：** 切换状态栏的开关面板，并执行 `checkBounds()` 让物理引擎重新计算位置。
    *   **判定：** 允许保留。但它目前直接修改了 `configStore` 中的状态，这部分逻辑建议移交，UI 仅监听 Config 变化来展开/折叠自己。
*   **`ST_WIN.addEventListener('resize', handleWindowResize)`**
    *   **行为：** 监听浏览器缩放，让物理引擎防穿模。
    *   **判定：** 完美，纯粹的 UI 挂载，应该留下。

## 2. 重构执行策略 (延后至生命周期修复完毕后执行)

1.  **解耦第一步：** 将 `loadPrimaryWorldbookName`, `loadWorldbookLists` 及相关的状态更新监听逻辑迁移至更底层（例如 `shared_ui_state.ts` 或即将建立的 `ui_event_controller.ts`）。
2.  **解耦第二步：** 将拦截后的业务放行逻辑（`manager.releaseInterceptAndSend()`）以及 Toast 提示彻底移出 Vue 组件。UI 只负责响应 `pendingEntries` 的变化而自动切换 Tab。
3.  **UI 净化：** 重构后，`GlobalStatusBar.vue` 将只包含 `resize` 等纯粹用于处理物理外观位移与尺寸形变的监听器。