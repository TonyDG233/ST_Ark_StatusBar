# Phase 3 重构：先行技术调研指南 (Technical Research Guide) v2

**日期**: 2026-01-30
**状态**: 修正版
**背景**: 基于用户反馈，我们已确认“会话指纹”方案不可行，且“直接变量修改”虽解决了持久化问题但带来了安全性风险。本指南将聚焦于**剩余的**核心技术难点。

---

## 1. 核心技术决策 (已确立)

基于先行验证结论，确立以下技术路线，不再进行重复调研：
1.  **防初始化风暴**: 采用 **`message_id > 0` Gate** 策略。即在 `message_id === 0` (开局/刷初始) 阶段，后端逻辑**完全静默**，不执行任何任务推送。
2.  **变量持久化**: 放弃 `cloneDeep`，采用 **In-Place Mutation (原地修改)**。
3.  **日期处理**: 遇到非法日期直接报错回退，不进行复杂兼容测试。

---

## 2. 待攻克的技术难点 (Critical Research Topics)

### RQ-1: 原地修改的安全性隔离 (Safety Sandbox for In-Place Mutation)
*   **痛点**: 用户指出，直接修改 `newVariables` 虽然有效，但一旦脚本报错（如 `undefined` 访问），会导致变量处于“半修改”状态，且无法回滚，甚至污染整个 MVU 状态。
*   **目标**: 寻找一种机制，既能直接修改引用，又能捕获错误并防止脏数据写入。
*   **调研方向**:
    1.  **Try-Catch Scope**: 是否可以将每个 Updater 模块（如 `processCharacterUpdates`）包裹在独立的 try-catch 中？如果报错，能否撤销该模块对 `newVariables` 的修改？
    2.  **Proxy 拦截**: 是否可以使用 `Proxy` 代理 `newVariables`，在 set 操作时记录日志，一旦报错则阻止后续提交？(需验证 MVU 是否接受 Proxy 对象)。
    3.  **事务回滚 (Transaction)**: 手动实现一个简单的事务管理器？
        *   `const backup = shallowClone(target)`
        *   `try { modify(target) } catch { restore(target, backup) }`

### RQ-2: 骨架注入的“丢失”之谜 (The Mystery of Missing Injection)
*   **痛点**: 用户指出，骨架数据注入策略理论上可行，但实际中经常“注入失败”（下一轮 EJS 读不到）。这不仅仅是时序问题，可能是写入操作根本没生效。
*   **假设**:
    *   **假设 A**: `VARIABLE_UPDATE_ENDED` 触发时，MVU 内部锁定了写入？
    *   **假设 B**: 多个 Listener 并发执行，后一个覆盖了前一个的修改？
    *   **假设 C**: 注入的路径（如 `stat_data.characters.Amiya`）在某些情况下被 Zod Schema 校验清洗掉了？
*   **验证方案 (`poc_injection_debug.ts`)**:
    1.  **Schema 验证**: 在写入骨架后，立即调用 `RootSchema.parse(newVariables)`，看骨架数据是否被清洗。
    2.  **并发测试**: 注册两个 Listener，同时修改不同字段，看是否都会保留。
    3.  **日志追踪**: 在 `newVariables` 对象上打上标记，追踪它在 MVU 内部流转的生命周期。

### RQ-3: 补丁原子性与顺序 (Patch Atomicity)
*   **痛点**: `summarize_memory` 涉及 Delete 和 Add。如果 Delete 成功但 Add 失败（如 Token 超限截断），角色记忆就丢失了。（你现在的总结任务不是脚本负责删除吗？？？？？）
*   **调研方向**:
    *   验证 JSON Patch 数组是否是原子执行的？（通常是的，一旦出错全盘拒绝）。
    *   如果不是，我们需要设计“两阶段提交”：先 Add LongTerm，成功后再 Delete ShortTerm。

---

## 3. 执行计划与指南 (Execution Plan & Guide)

### 3.1 PoC 开发顺序
1.  **优先执行 RQ-1**: 编写 `poc_safety_sandbox.ts`，测试 Try-Catch + Shallow Backup 的回滚效果。这是后端稳定性的底线。
2.  **紧跟执行 RQ-2**: 编写 `poc_injection_debug.ts`，重点排查 Schema 清洗和并发覆盖问题。这是解决“初始化延迟”的关键。

### 3.2 注入与运行测试代码 (How to Run)
鉴于 TavernHelper 的脚本加载机制，我们将通过修改入口文件的方式注入 PoC。

1.  **创建文件**: 将 PoC 代码保存为 `src/ARK_STATUSBAR/logic/debug/poc_[name].ts`。
2.  **挂载入口**: 打开 `src/ARK_STATUSBAR/index.ts`，在顶部添加导入语句：
    ```typescript
    // [DEBUG] Uncomment the following line to run PoC
    // import './logic/debug/poc_safety_sandbox';
    ```
3.  **编译与生效**: 运行 `npm run build`，然后在浏览器刷新酒馆页面。
4.  **观测结果**: 打开浏览器控制台 (F12)，过滤 `[ARK_PoC]` 标签查看输出。

---

## 4. 预期产出 (Deliverables)

1.  **PoC 脚本代码**: 包含明确的注释和控制台日志。
2.  **测试报告**: 记录在 `.kilocode/development_logs/phase3-rebuild/reports/` 下，包含日志片段，以及对 RQ 的最终结论 (Pass/Fail)。
