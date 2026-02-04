# 开发日志 044: Phase 3 问题反馈与二次修复计划 (修正版)

**日期**: 2026-01-27
**状态**: **规划中 (Planning)**
**执行者**: Agent (Kilo Code)

---

## 1. 工作追溯 (Work Traceability)

*   **`eventOnce` 方案**:
    *   **目标**: 解决 `swipe` 切换导致的“初始化风暴”性能问题。
    *   **实施**: 在 `index.ts` 中使用 `eventOnce(tavern_events.MESSAGE_SENT, ...)` 来延迟并仅触发一次后端逻辑初始化。
    *   **结果**: **失败**。用户反馈该方案导致了更严重的问题：1) 后端逻辑在每次发送消息时都被触发；2) 变量注入完全失效。此方案已被废弃。

*   **EJS 健壮性修复**:
    *   **目标**: 解决因 MVU 变量注入延迟于 EJS 模板执行，导致的 `Cannot read properties of undefined` 错误，以及因 EJS 模板作用域合并导致的 `Identifier has already been declared` 错误。
    *   **实施**: 为 `变量列表.ejs` 和 `任务执行器.ejs` 增加了防御性代码，对所有顶层变量使用 `typeof variable === 'undefined'` 检查，并将 `const` 声明全部替换为 `var`。
    *   **结果**: **成功**。此问题已解决。

---

## 2. 核心原则修正 (Guiding Principle Correction)

**核心思想**: **“不要用开发标准后端程序的思路来优化我们的小程序”**。必须优先保证逻辑的**简洁、内聚和稳定**，避免引入不必要的复杂性和跨文件依赖。

---

## 3. 新方案 (采纳用户反馈后)

### 问题一：后端逻辑激活时机不精确

*   **现象**:
    1.  `MESSAGE_SENT` 方案导致后端逻辑在每次用户交互时都可能被重复初始化，破坏了数据流。
    2.  变量注入完全失效，LLM 的 `<JSONPatch>` 更新没有被应用。
*   **根源分析**: `MESSAGE_SENT` 方案的失败证明，我们需要一个更稳定、更精确的“一次性初始化”信号。这个信号必须在 MVU 变量就绪后，且仅触发一次。
*   **您的方案**: 监听 `stat_data` 中是否存在 `initialized_lorebooks` 对象，并以此作为后端逻辑激活的信号。
*   **方案评估**: **我完全同意您的方案**。这是一个完美的解决方案。
    *   **可靠性**: `initialized_lorebooks` 是 MVU 插件在完成其核心初始化流程后才会创建的标志性对象。使用它作为信号，可以确保我们的逻辑在正确的时间点运行。
    *   **一次性**: 我们可以设计一个简单的旗标，确保即使 `VARIABLE_UPDATE_ENDED` 多次触发，只要检测到 `initialized_lorebooks` 后，初始化函数也只执行一次。
*   ** proposed 修改方案**:
    1.  **修改 `src/ARK_STATUSBAR/logic/updaters/global.ts`**:
        *   在 `initializeBackendLogic` 函数内部，移除当前的 `eventOn` 逻辑。
        *   创建一个新的、持久的 `eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...)` 监听器。
        *   在这个监听器的回调函数顶部，增加一个检查逻辑：
            ```typescript
            // 在 global.ts 顶部或 initializeBackendLogic 外部定义一个旗标
            let backendInitialized = false;

            // 在 eventOn 回调函数内部
            if (backendInitialized) {
                // 如果已经初始化，直接运行常规的主循环
                await mainLoop(newVariables, oldVariables);
                return;
            }

            // 检查 MVU 是否已就绪
            if (get(newVariables, 'stat_data.initialized_lorebooks')) {
                console.log(`${LOG_PREFIX} MVU initialized. Running one-time setup...`);
                
                // 执行一次性的初始化
                await initializeCharacterInjector();
                
                // 设置旗标，防止重复执行
                backendInitialized = true;
                
                // 首次运行主循环
                await mainLoop(newVariables, oldVariables);
            }
            ```
    2.  **创建 `mainLoop` 函数**: 将 `initializeBackendLogic` 中现有的 `async (newVariables, oldVariables) => { ... }` 回调内容，提取到一个独立的 `async function mainLoop(newVariables, oldVariables)` 中。
    3.  **修改 `src/ARK_STATUSBAR/index.ts`**:
        *   恢复 `$(() => { ... })` 中的内容，直接调用 `initializeBackendLogic()`，移除所有 `MESSAGE_SENT` 相关代码。`initializeCharacterInjector` 的调用将移至 `global.ts` 中。

### 问题二：`buildStaticCharacterCache` 性能与逻辑冗余

*   **现象**: 缓存机制带来了不必要的复杂性、性能开销和潜在的稳定性风险。
*   **解决方案 (采纳您的方案)**:
    1.  **废弃缓存机制**:
        *   从 `character.ts` 中**完全删除** `buildStaticCharacterCache` 函数。
        *   从 `global.ts` 的 `_internal` schema 中**移除** `static_char_cache` 和 `static_char_cache_hash` 字段。
    2.  **强化 `postProcessNewCharacters`**:
        *   **职责**: 此函数将成为唯一负责“识别新角色是否为静态角色”的模块。
        *   **实现**:
            *   在函数执行的开始，检查本次更新是否有新角色出现。如果没有，则直接返回，避免不必要的IO操作。
            *   如果**有**新角色，则在函数内部**直接调用** `getCharWorldbookNames()` 和 `getWorldbook()` 来获取所有启用的世界书条目。
            *   遍历条目，构建一个临时的、仅用于本次函数执行的 `staticCharacterKeys` 集合。
            *   遍历本次出现的新角色，用 `staticCharacterKeys` 集合检查他们是否为静态角色，并相应地设置 `has_static_profile` 旗标。
        *   **伪代码**:
            ```typescript
            // in character.ts
            async function postProcessNewCharacters(newVariables, oldVariables) {
                const newCharNames = ...; // 计算新出现的角色名
                if (newCharNames.length === 0) return;

                // 仅在有新角色时，才执行世界书读取
                const allEntries = await ...; // 读取所有世界书条目
                const staticCharacterKeys = new Set();
                // ... 填充 staticCharacterKeys ...
                
                for (const charName of newCharNames) {
                    if (staticCharacterKeys.has(charName.toLowerCase())) {
                        set(newVariables, `...`, true);
                    }
                }
            }
            ```
    3.  **调整 `processCharacterUpdates`**:
        *   在主循环中，移除对 `buildStaticCharacterCache` 的调用，保留对 `postProcessNewCharacters` 的调用。

---

## 4. 总结与下一步

此修正版方案更加简洁、直接，完全遵循了您的指导思想，将复杂性降至最低，优先保证核心功能的稳定运行。

我将在获得您的批准后，立刻基于此方案更新 `todo` 列表。