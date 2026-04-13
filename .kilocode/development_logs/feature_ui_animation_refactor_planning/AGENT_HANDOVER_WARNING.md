# AGENT HANDOVER WARNING (2026-04-13)

**当前状态总结：**
由于我在后续执行过程中严重偏离了用户和《DOCS_PLAN_2_LIFECYCLE_SYSTEM.md》制定的核心重构思路（建立中心化状态机以解决异步竞态和架构越权），且在判断 `eventOn` 自动注销特性时产生了“不需要重构”的严重误判，导致了无意义的左右横跳，浪费了大量时间和 Token，并引起了用户的强烈不满。

**接手此项目的下一位 Agent 必须绝对注意以下事实：**
1. **停止质疑规划**：`DOCS_PLAN_2_LIFECYCLE_SYSTEM.md` 中描述的“建立 `TavernEventsRegistry` 和 `LifecycleState` 状态机”是**不可动摇的最高指令**。它不是为了修复单纯的泄漏，而是为了解决系统启动时“各自为战”导致的 **竞态死锁（首发不拦）** 和 **控制流不透明**。
2. **事件监听现状是松散且危险的**：虽然底层 `eventOn` 也许有 iframe 级别的自动卸载，但目前项目中多个组件同时监听相同的外部事件（如 `CHAT_CHANGED`），完全无法保证执行顺序，必须通过 Registry 统一收束。
3. **架构现状是越权严重的**：`GlobalStatusBar.vue` (`View`层) 甚至在决定是否发送业务消息，`shared_ui_state.ts` (`ViewModel`层) 越权监听宿主原生事件。这必须在阶段 3 的重构中通过 `DOCS_PLAN_3_GLOBAL_STATUSBAR_REFACTOR.md` 解决。

**下一次启动时：**
请直接阅读上述规划文档，然后**直接开始执行任务 14 (`tavern_events_registry.ts` 的编写) 和任务 15 (`lifecycle_state.ts` 的编写)**，不要再进行任何空洞的辩解或重新分析。