# 开发日志 042: Phase 3 Character 模块逻辑修复与实现计划

**日期**: 2026-01-25
**状态**: **规划中 (Planning)**
**作者**: Agent (Kilo Code)

---

## 1. 背景与目标 (Context & Objective)

**背景**: 在 Phase 3 的集成测试中，暴露了 `character` 模块在“角色档案注入”、“开局初始化”和“动静态角色管理”方面的严重逻辑缺陷与实现缺失。同时，Agent 在先前的修复方案中，因未能完全理解用户设计意图、遗漏核心功能、擅自修改关键设计（`turn <= 2` 机制）而导致方案被否决。

**核心目标**: 本文档旨在纠正此前的所有错误，基于对 `029`、`041` 号设计文档及现有代码的全面、深入的再学习，制定一份**完整的、统一的、严格遵循用户设计意图的** `character` 模块后端逻辑修复与实现计划。

**本文档将是后续所有 `character.ts` 相关代码修改的唯一依据。**

---

## 2. 设计原则与核心机制复盘 (Principles & Core Mechanics)

1.  **`total_turns <= 2` 机制**:
    *   **复盘**: 此机制是**强制性**的健壮设计，其目的是给予 LLM **两轮**的机会来完成所有在场角色的档案初始化，以应对单轮生成内容不完整或被截断的潜在风险。**严禁**用任何形式的“一次性旗标” (`initialization_completed`) 将其取代。
    *   **实现**: 后端逻辑必须严格根据 `global.game_progress.total_turns` 的值来判断是否处于开局初始化阶段。

2.  **统一后端入口与总开关**:
    *   **复盘**: 所有的后端逻辑，包括即将实现的“动态上下文注入”，都**必须**通过 `global.ts` 中的 `initializeBackendLogic` 函数进行初始化，并受 `global._internal.backend_logic_enabled` 总开关的统一控制。
    *   **实现**: 不得创建任何独立的 `eventOn` 监听器。所有功能模块都应导出函数，由 `global.ts` 的主事件循环统一调用。

3.  **文件结构与逻辑归属**:
    *   **复盘**: “动态上下文注入”是 `character` 模块的核心功能之一，用于管理角色的静态与动态数据呈现。
    *   **实现**: 所有与角色相关的逻辑（缓存、初始化、生命周期管理、上下文注入与清理）都**必须**实现在 `src/ARK_STATUSBAR/logic/updaters/character.ts` 文件内。

---

## 3. 完整实现方案 (Holistic Implementation Plan)

### 3.1 `character.ts` 内部结构总览 (Proposed Structure)

为了保证逻辑清晰，`character.ts` 将划分为以下几个功能区：

1.  **Area 1: 缓存管理 (Cache Management)**
    *   `staticCharacterCache` (内存变量)
    *   `buildStaticCharacterCache()` (核心函数)
2.  **Area 2: 动态上下文注入 (Dynamic Context Injection)**
    *   `injectedEntriesSet` (内存变量)
    *   `injectContextForCharacter()`
    *   `cleanupInjectedContexts()`
    *   `initializeInjector()` (事件注册)
3.  **Area 3: 角色生命周期与初始化 (Lifecycle & Initialization)**
    *   `initializeNewCharacters()` (改造后的函数)
    *   `manageCharacterLifecycle()` (现有函数，保持不变)
    *   `postProcessNewCharacters()` (新函数，用于设置`has_static_profile`)
4.  **Area 4: 任务推送与检查 (Task & Validation)**
    *   `pushTask()` (现有辅助函数)
    *   `validateAndRepairCharacter()` (现有函数，保持不变)
    *   `checkMemoryAndPushTask()` (现有函数，保持不变)
5.  **Area 5: 主循环与导出 (Main Loop & Exports)**
    *   `processCharacterUpdates()` (主处理函数，将集成所有逻辑)
    *   `isCharacterTaskCompleted()` (导出函数，保持不变)

---

### 3.2 详细实现步骤

#### 步骤 1: 实现缓存管理 (Area 1)

*   **目标**: 建立一个可靠的、能实时反映世界书启用状态的静态角色缓存。
*   **文件**: `src/ARK_STATUSBAR/logic/updaters/character.ts`
*   **操作**:
    1.  在文件顶部定义模块级变量: `let staticCharacterCache = {};`
    2.  新增 `async function buildStaticCharacterCache()`:
        *   **API 调用**: 使用 `await getEnabledWorldInfoEntries(true, true, true, true);` 获取所有已启用的世界书条目。这将确保我们只处理当前有效的角色（解决了异格干员问题）。
        *   **逻辑**: 与 `029` 号文档伪代码一致，计算当前启用条目的哈希值，与存储在 `global._internal` 中的旧哈希对比。
        *   **更新**: 如果哈希不一致，则遍历条目，用 `entry.key` 作为角色名，构建一个新的 `{ [charName]: { worldbookName: entry.world, uid: entry.uid } }` 映射。
        *   **持久化**: 将新构建的 `cache` 和 `hash` 通过 `Mvu.replaceMvuData` 写回到 `global._internal.static_char_cache` 和 `global._internal.static_char_cache_hash` 中。
        *   **内存同步**: 将新 `cache` 赋值给模块内的 `staticCharacterCache` 变量。

#### 步骤 2: 实现角色生命周期与初始化 (Area 3)

*   **目标**: 修复开局初始化逻辑，并确保新角色的 `has_static_profile` 标志能被正确设置。
*   **文件**: `src/ARK_STATUSBAR/logic/updaters/character.ts`
*   **操作**:
    1.  **新增 `postProcessNewCharacters(newVariables, oldVariables)`**:
        *   **职责**: 此函数专门处理“角色首次出现”的事件。
        *   **逻辑**: 遍历 `newVariables.characters`，找到所有在 `oldVariables.characters` 中不存在的角色。
        *   对于每一个新角色，使用内存中的 `staticCharacterCache` 检查其是否存在于缓存中。
        *   如果存在，则将其 `has_static_profile` 标志设置为 `true`。
    2.  **改造 `initializeNewCharacters(variables)`**:
        *   **保留命名**: 保持函数名不变。
        *   **保留 `turn <= 2` 逻辑**: 严格使用 `if (get(variables, 'stat_data.global.game_progress.total_turns', 0) <= 2)` 作为触发条件。
        *   **逻辑**: 如果条件满足，则遍历所有在场角色 (`active_chars` 和 `nearby_chars`)。对于其中**档案尚不存在** (`!variables.stat_data.characters[charName]`) 的角色，推送 `init_profile` 任务。
        *   **合并新角色检测**: 在 `turn > 2` 的 `else` 块中，执行**仅针对新出现角色**的初始化逻辑 (即 `difference(allPresentChars, existingCharNames)`)。这确保了在游戏进行中途出现的新角色也能被正确初始化。
        *   **健壮性**: 在函数内部对所有待推送任务的角色列表进行最终去重，防止重复推送。

#### 步骤 3: 实现动态上下文注入 (Area 2)

*   **目标**: 完全实现 `029` 号文档中定义的核心功能，让静态角色的动态信息能临时注入主LLM上下文。
*   **文件**: `src/ARK_STATUSBAR/logic/updaters/character.ts`
*   **操作**:
    1.  在文件顶部定义模块级变量: `const injectedEntriesSet = new Map();`
    2.  新增 `async function injectContextForCharacter(charName, variables)`:
        *   **触发条件**: 检查 `variables.characters[charName].has_static_profile` 是否为 `true`。
        *   **逻辑**: 完全遵循 `029` 号文档伪代码。从 `staticCharacterCache` 获取世界书信息，渲染动态数据，构建注入块，清理旧块，备份原始内容，然后使用 `updateWorldbookWith` 追加新块。
    3.  新增 `async function cleanupInjectedContexts()`:
        *   **逻辑**: 完全遵循 `029` 号文档伪代码。遍历 `injectedEntriesSet`，使用 `updateWorldbookWith` 和备份的原始内容恢复所有被修改的条目。
    4.  新增 `export function initializeCharacterInjector()`:
        *   **职责**: 注册事件监听。
        *   **逻辑**: 在此函数内，注册 `GENERATE_BEFORE_COMBINE_PROMPTS` 事件，其回调 `async` 调用 `injectContextForCharacter`。注册 `GENERATION_ENDED` 事件，其回调 `async` 调用 `cleanupInjectedContexts`。

#### 步骤 4: 集成所有逻辑到主循环 (Area 5)

*   **目标**: 将所有新旧逻辑按照正确的顺序和依赖关系，整合到由 `global.ts` 调用的主函数中。
*   **文件**: `src/ARK_STATUSBAR/logic/updaters/character.ts` & `src/ARK_STATUSBAR/index.ts`
*   **操作**:
    1.  **改造 `processCharacterUpdates(newVariables, oldVariables)`**:
        ```typescript
        export async function processCharacterUpdates(newVariables, oldVariables) {
            // 1. 缓存必须最先执行，为所有后续逻辑提供基础
            await buildStaticCharacterCache(newVariables);

            // 2. 处理新角色的后处理，特别是设置 has_static_profile 标志
            await postProcessNewCharacters(newVariables, oldVariables);

            // 3. 执行初始化任务推送逻辑 (依赖 turn 和角色存在性检查)
            initializeNewCharacters(newVariables);

            // 4. 管理现有角色的生命周期计数器 (依赖新旧变量对比)
            manageCharacterLifecycle(newVariables, oldVariables);

            // 5. 对已存在且数据有变化的角色进行验证和内存检查 (保持现有逻辑)
            // ... for loop with validateAndRepairCharacter and checkMemoryAndPushTask ...
        }
        ```
    2.  **改造 `src/ARK_STATUSBAR/index.ts`**:
        *   导入 `initializeCharacterInjector`。
        *   在 `$(() => { ... })` 的 `initializeBackendLogic()` 调用之后，增加一行 `initializeCharacterInjector()`。这将确保注入逻辑也受到后端总开关的控制，因为 `initializeBackendLogic` 是被总开关包裹的。 *修正：注入器需要独立于主循环的`VARIABLE_UPDATE_ENDED`事件，因此其初始化应与`initializeBackendLogic`并列，但其内部逻辑应检查总开关状态。*
        
        **最终 `index.ts` 改造方案:**
        ```typescript
        // in index.ts
        import { initializeBackendLogic } from './logic/updaters/global';
        import { initializeCharacterInjector } from './logic/updaters/character';
        
        $(() => {
          // ...
          // 1. 初始化后端主循环
          initializeBackendLogic();
          // 2. 初始化角色动态上下文注入器
          initializeCharacterInjector(); 
          // ...
        });
        
        // in character.ts - initializeCharacterInjector
        export function initializeCharacterInjector() {
            eventOn(..., async () => {
                // 在执行注入前，检查总开关
                const variables = Mvu.getMvuData();
                if (!get(variables, 'stat_data.global._internal.backend_logic_enabled', true)) return;
                // ... 注入逻辑 ...
            });
            // ... 清理逻辑同样需要检查 ...
        }
        ```

---

## 4. 待确认的风险点与关联任务 (Risks & Associated Tasks)

**本章节记录由用户反馈的、需要在实施过程中高度关注的补充要求。**

1.  **EJS 模板特殊处理**:
    *   **关联文件**: `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs`
    *   **要求**: 在实现 EJS 修复时，必须为 `init_profile` 任务增加一个特殊条件块。当 `turn <= 2` 时，其渲染出的提示词指令，必须明确要求 LLM **“根据当前所有在场角色（user备注：此时变量内不可能有角色名称，必须让llm自行决断上下文存在哪些角色然后注入） (`global.presence.active_chars`) 的情况，为所有需要初始化的角色撰写档案”**，而不是仅针对 `task.target_char`。

2.  **动态上下文注入方案**:
    *   **风险**: `initializeInjector` 所依赖的 `GENERATE_BEFORE_COMBINE_PROMPTS` 事件监听方案具有**测试性质**。如果实际测试中发现此事件不稳定或有副作用，必须立刻启动 **Plan B**。
    *   **Plan B**: 放弃事件监听，改为在 `变量列表.ejs` （user补充：或另一个类似的变量入口，但单独排列静态角色的动态信息。）中直接渲染角色的动态数据。这虽然会增加 Token 消耗，但是是更稳定可靠的备选方案。

3.  **缓存与注入内容过滤**:
    *   **关联函数**: `buildStaticCharacterCache()` 和 `injectContextForCharacter()`
    *   **要求**:
        *   `buildStaticCharacterCache()` 在构建缓存时，必须显式地**过滤**掉 key 中包含 `_TEMPLATE_` 的世界书条目。
        *   `injectContextForCharacter()` 在执行注入前，也应增加一道保险检查，确保不会为模板角色执行注入操作。

4.  **配置文件同步**:
    *   **关联文件**: `src/ARK_STATUSBAR/prompts/static/[initvar]变量初始化.yaml`
    *   **要求**: 在本次所有后端逻辑和 EJS 模板修复完成后，必须将此文件的内容与最新的、扁平化的 `CharacterSchema` 结构进行**完全同步**，移除 `data` 嵌套层级，并调整相应字段。


## 5. 后续步骤

1.  **审查**: 等待您对这份**已补充了最新反馈**的 `042` 号规划文件的最终审查与批准。
2.  **更新 Todo**: 在您批准后，我将基于此文档更新 `todo` 列表。
3.  **编码**: 严格按照 `todo` 列表和本规划文档，逐一实现功能。

我已尽我所能，将所有分散的信息、您的设计意图和我的反思，全部整合到了这份规划中。我等待您的审查。
