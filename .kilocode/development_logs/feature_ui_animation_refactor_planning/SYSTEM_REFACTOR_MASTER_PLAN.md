# 系统底层重构规划总括 (System Refactor Master Plan)

**日期：** 2026-04-13
**背景：** 
在前期完成了 `GlobalStatusBar.vue` 视觉与物理层解耦（UI Animation Refactor）后，暴露出系统在底层基础设施（事件系统与生命周期）上的严重缺陷。具体表现为“新聊天首次发送不拦截”以及“自动补全触发报错”等老大难问题。本项目在发展过程中，代码堆叠导致生命周期散乱、事件流转无强类型约束，引发了难以排查的竞态条件和内存泄漏。

本阶段工作目标不再是修改核心业务逻辑（如双轨干跑），而是对项目的“地基”进行翻修。

---

## 1. 事件系统的改造倾向 (Event System Transformation)

**现状痛点：**
- 项目中充斥着自制的 `ArkEventBus.on/emit`、原生的 `document.addEventListener`，以及 TavernHelper 提供的 `eventOn`。
- 事件分发没有统一的强类型定义，AI（或未来的开发者）在跨模块通信时，容易随意组合出未注册的事件名或遗漏解绑（如 `GlobalStatusBar.vue` 漏掉 `ark-interceptor-triggered` 的 `removeEventListener`）。
- 盲目引入自定义的 EventBus 违反了 DOM 编程的直觉，不仅徒增依赖，还导致大模型“本能寻路”失败。

**改造规划：**
1. **废弃自研总线**：全面废除 `src/ARK_STATUSBAR/core/event_bus.ts`。
2. **拥抱原生且强类型的 CustomEvent**：
   - 顺应前端 DOM 编程本能，全局使用 `document.dispatchEvent(new CustomEvent(...))` 和 `document.addEventListener` 进行跨模块通信。
   - 在 `@types/` 目录下（或 `global.d.ts`）扩展 `DocumentEventMap`。
   - 强制所有内部事件带上统一命名空间前缀（例如 `ark:*`），并在接口中严格定义 `e.detail` 的结构。一旦拼写错误或类型不匹配，TypeScript 将在编译期直接爆红。

---

## 2. 生命周期系统的重构与规划 (Lifecycle System Refactoring)

**现状痛点：**
- **启动散装化**：`index.ts` 中的 `manager.init()`、异步执行的 `configStore.loadOrInitConfig`、以及由 `CHAT_CHANGED` 偷偷触发的 `worldbookAutomator` 各自为战。
- **竞态死锁**：当玩家进入新聊天室，如果在后台配置和世界书绑定完成前（甚至拦截器还没来得及 `wakeup`）就立刻点击“发送”，拦截器监听器可能还未挂载，造成“首发不拦”的灵异现象。
- **状态不透明**：我们目前无法判断系统处于“已启动”、“配置加载中”还是“遇到冲突被挂起”的状态。

**改造规划：**
1. **收束初始化流程 (SystemBootstrapper)**：建立绝对中心化的系统启动状态机，定义明确的生命周期卡点（`Idle`, `Booting`, `Ready`）。
2. **加锁防竞态**：
   - 在新聊天建立或 `CHAT_CHANGED` 触发时，系统强制进入 `Booting` 挂起状态。
   - 拦截器必须等到 `Ready` 状态后才能开始干跑判定；如果在 `Booting` 期间玩家点击发送，系统应该给出明确反馈（拦截或 Toast 提示“系统就绪中”），而不是因为 API 未就绪导致意外的静默放行。
3. **完善销毁钩子**：确保所有的原生事件监听（特别是 `document` 级别的）都有对应的 `onUnmounted` 或 `destroy` 机制，根绝热重载带来的幽灵叠加监听器。

---

## 3. 文档体系的建设思路 (Documentation System Strategy)

**现状痛点：**
- 之前为了试图让 AI 理解 `theme.scss` 或业务文件，使用详尽的外部 Docs 文档做限定。但外部文档动辄上万字，体量甚至超过阅读代码本身。
- AI 读取长篇 Markdown 容易丢失重点，且维护外部文档和代码同步的成本极高。

**改造规划：**
1. **化整为零，代码即文档**：废弃大篇幅的“操作手册”式外部文档。对于单一文件或高内聚模块，直接在其顶部的 JSDoc/注释块中，用极简的文本交代：
   - 模块职责（干什么的）
   - 数据流转（谁调用它，它改了什么状态）
   - 边界红线（绝对不准改什么）
2. **架构级 Docs 留给复杂协同**：只有当一个业务流跨越了 3 个以上的文件（比如：发送拦截 -> 后台计算 -> UI 挂载展示），才值得在 `.kilocode/` 下单独书写一份微型架构说明文件（如“事件通讯拓扑图”）。
3. **建立技术选型契约表 (`TECH_STACK.md` 或在 `AGENTS.md` 固化)**：明确指引大模型“遇到跨文件通信必须查 `DocumentEventMap`”、“组件状态只许用 `Pinia` 或 Vue `ref` 响应式数据”等强制工具选择，避免 AI 重复造轮子。

---

## 4. 补充优化潜力：Token 计算 API

**现状痛点：**
- 当前的双轨干跑中，第二轨强行调用了 `generateFn('normal', {}, true)` 来统计 Token。
- 根据近期分析，如果由于新版本酒馆改了函数签名导致 `dryRun=true` 没生效，这将会变成一次真实的底层伪生成，极易打断正常的生成管线，甚至引发报错（如 `Generation was aborted`）。

**改造规划（保守探讨）：**
- 既然核心逻辑（双轨干跑）在大量测试后被证明是无奈之下的稳定妥协，我们**坚决不对其核心判定动刀**。
- 但为了避免高危的 `generateFn`，可以尝试调研酒馆原生的 `getTokenCountAsync`（或类似纯计算无副作用的 API）。如果该 API 能够满足预计算所有文本 Token 的需求，可以考虑平滑替换掉产生报错的 `generateFn` 干跑轨，以此提升整体拦截流程的稳定性与执行速度。