# 详细规划 2: 生命周期的收束与防竞态状态机

**日期：** 2026-04-13
**所属主规划：** `SYSTEM_REFACTOR_MASTER_PLAN.md` -> 阶段 2

---

## 1. 核心目标与问题溯源

当前项目生命周期极其散乱，并且存在致命的严重 Bug。经过对全局 `eventOn`, `addEventListener`, `setInterval`, `setTimeout`, `onMounted` 等关键字的深度检索，发现系统泄漏点远比表面看起来的多。目前需要被生命周期系统强制接管的“资产”分为四大类：

1. **原生酒馆事件 (`eventOn`)**：散落在 `shared_ui_state.ts`, `statusbar_manager.ts`, `worldbook_automator.ts` 中。包含 `CHAT_CHANGED`, `GENERATION_ENDED`, `WORLDINFO_UPDATED`, `WORLDINFO_ENTRIES_LOADED`。每次代码热重载或重跑脚本时，由于缺乏 `pagehide` 解绑，这些监听器会疯狂叠加（Memory Leak）。
2. **DOM 原生监听器 (`addEventListener`)**：拦截器在 `document` 上的 `keydown/click`；物理引擎 `useDraggablePhysics.ts` 在 `document` 上的 `mousemove/touchmove`；UI 容器上的 `window.resize`。
3. **游离的定时器 (Timers)**：
   - `index.ts` 中存在一个致命的 **`setInterval` 轮询挂载死循环**（每次热重载都会新生一个且从未被清理）。
   - `useDraggablePhysics.ts` 中的 `heartbeatTimer` 和 `snappingTimeout`（已做清理，需保持）。
   - `logger.ts` 中的 `flushTimeout`。
4. **Vue 实例树 (`createApp`)**：`globalStatusBarApp`, `startupApp`, `returnBtnApp`。

此外，系统还存在两个竞态逻辑缺陷：
1. **异步 Promise 遗漏引发的永久旧数据问题**：在 `StatusBarManager` 的 `setupEvents` 中，传递给 `Automator` 的 `getTargetWorldbook` 闭包直接同步访问了异步函数 `getCharWorldbookNames('current')`。由于没有 `await`，切换聊天时永远拿不到新绑定的世界书。
2. **开局首发不拦的根因（竞态漏网）**：玩家点击“发送”时，初始化过程可能还在进行中。拦截器没有“挂起/等待”的概念，导致在数据没准备好的瞬间被直接静默放行。

---

## 2. 状态机设计与架构归属

对照项目现有的五层平级架构（`.kilocode/state/ARCH.md`），这套生命周期系统的安放位置与状态机设计如下：

### 2.1 系统状态机流转 (System Lifecycle State Machine)
打造一个单向闭环且防冲撞的结构，包含以下状态：
*   **`PENDING` (挂起待命)**：脚本刚被加载。正在等待酒馆环境发出 `APP_READY`，或等待 `SillyTavern.chat` 实体出现。
*   **`BOOTING` (启动/重置中)**：
    *   **触发条件**：从 `PENDING` 进入，或接收到 `CHAT_CHANGED` 事件。
    *   **行为**：加设防竞态锁。异步拉取当前角色绑定的 Worldbook，执行数据迁移，覆盖 `configStore`。
    *   **防线**：在此状态下，拦截器必须拒绝工作（阻断放行并提示“系统就绪中”），UI 层挂起响应。
*   **`READY` (完全就绪)**：
    *   **触发条件**：配置与世界书加载完毕。
    *   **行为**：唤醒并挂载拦截器，允许 UI 读取真实数据流。
*   **`TEARDOWN` (销毁熔断)**：
    *   **触发条件**：监听到 `window` 的 `pagehide` 事件。
    *   **行为**：一键切断并清空上述 4 大类“资产”（卸载 Vue、`eventOff` 所有酒馆事件、`removeEventListener` 所有 DOM 事件、`clearInterval` 所有定时器）。

### 2.2 架构归属映射
1.  **基础设施归属 `Module_Core` (核心基建层)**：
    新增 `TavernEventsRegistry.ts` (事件托管中心) 与 `LifecycleState.ts` (状态机)。Core 层负责提供底层的纯技术组件，为平级的 Logic 和 Components 层提供安全的资源注册和状态查询服务。
2.  **控制流中枢归属 `Facades` (第一层门面)**：
    `StatusBarManager.ts` 继续作为唯一的生命周期“指挥官”。它读取 Core 中的状态，指挥 Biz_Logic (如 `worldbook_automator`) 去 Core.Registry 注册监听，并在 TEARDOWN 阶段向全系统下达销毁指令。
3.  **UI 防线归属 `Module_Components` (UI 渲染层)**：
    `shared_ui_state.ts` 必须遵循“禁止直接操作宿主环境”的原则，将它内部原本直接调用 `eventOn` 的逻辑，**移交**给底层的 `Automator` 或者强制通过 Core 的 Registry 来代理，并在自身组件 `onUnmounted` 时释放资源。

---

## 3. 工作内容与修改规模评估

**工作内容：**
1. **建立全局生命周期状态机**：引入 `SystemState`，并强制子模块在关键操作时检查系统状态。
2. **重写 `StatusBarManager` 的核心启动链路**：将启动过程严密化为：获取角色世界书 (await) -> 加载配置文件 (await) -> 唤醒挂载拦截器 (await) -> 状态变更为 `READY`。
3. **打造 Tavern 外部事件托管中心 (ArkTavernEventsRegistry)**：封装 `eventOn` 和 `eventOff`，内部保存引用数组，在 `pagehide` 触发 `destroy()` 时一键全量清理。
4. **彻底清查并修复所有泄漏源**：
   - 修复 `CHAT_CHANGED` 闭包为正确的异步调用。
   - 排查 `GlobalStatusBar.vue` 与 `shared_ui_state.ts`，提供 `teardownGlobalListeners()` 以防范原生事件监听器无限增殖。
   - 修复 `index.ts` 中的 `setInterval`，必须在 `pagehide` 时 `clearInterval`。

**涉及的文件：**
- 🆕 `src/ARK_STATUSBAR/core/tavern_events_registry.ts` (新增事件托管中心)
- 🆕 `src/ARK_STATUSBAR/core/lifecycle_state.ts` (新增状态机)
- `src/ARK_STATUSBAR/logic/statusbar_manager.ts` (引入状态机，迁移原生事件注册，修复 Bug)
- `src/ARK_STATUSBAR/index.ts` (调用清理中心，清除挂载轮询的 Interval)
- `src/ARK_STATUSBAR/logic/worldbook/worldbook_automator.ts` (改用 Registry，适配异步调用)
- `src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts` (补充清理逻辑)

**修改规模评估：** 核心枢纽级修改。涉及文件约 6 个，控制流将发生质的改变。

---

## 4. 风险评估与防范措施

### ⚠️ 风险 1: `eventOff` 函数可能在某些酒馆版本中缺失
**防范措施**：安全探测 `typeof eventOff === 'function'`。如果不存在，我们需要在事件闭包内加入一个 `isDestroyed` 的布尔值判断，被标记销毁后直接 `return` 跳过后续逻辑。

### ⚠️ 风险 2: 状态锁死 (Deadlock in Booting)
由于网络卡顿或 API 失效导致 `Booting` 无限期挂起，系统将永远无法到达 `READY`，玩家永远无法发送消息。
**防范措施**：在 `StatusBarManager.init()` 中增加 `Promise.race` 或设置最长超时（如 3000ms）。超时后强制进入 `READY` 并使用降级默认配置，弹出醒目警告。