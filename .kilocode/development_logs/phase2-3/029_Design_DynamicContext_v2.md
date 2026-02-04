# Phase 3: 动态上下文注入机制设计文档 v2

**日期**: 2026-01-22

**目的**: 详细规划在后端 TS 脚本中实现的动态上下文注入与清理机制。此机制旨在将拥有静态世界书档案的角色的**动态数据**，临时性地、无缝地注入到主 LLM 的上下文中。

---

## 1. 核心职责与逻辑流 (Core Responsibility & Logic Flow)

该机制的核心职责是解决**静态信息**（存储于世界书）与**动态信息**（存储于 MVU 变量）的分离问题，为主 LLM 提供一个统一、连贯的角色视角。

**完整逻辑流**:
1.  **[启动时]**: 脚本启动，注册 `GENERATE_BEFORE_COMBINE_PROMPTS` 和 `GENERATION_ENDED` 两个事件的监听器。
2.  **[缓存构建]**: 检查缓存有效性（基于世界书哈希）。如果失效，遍历所有启用的世界书，构建 `角色名 -> {世界书名, uid}` 映射表，并更新哈希值，持久化存储。
3.  **[生成前 - 注入]**: `GENERATE_BEFORE_COMBINE_PROMPTS` 事件触发。
    a. 脚本获取当前所有 `active_chars`。
    b. **遍历** `active_chars`，执行 `injectContextForCharacter`。
    c. **清理旧数据**: 在注入前，先尝试移除该条目中可能残留的旧动态数据块（幂等性保证）。
    d. **备份**: 记录清理后的原始内容，用于生成后的恢复。
    e. **注入**: 将渲染好的动态数据块（`<-- DYNAMIC_ARK_CONTEXT_START --> ...`）追加到条目末尾。
    f. 调用 `updateWorldbookWith` 保存修改。
4.  **[生成中]**: 主 LLM 基于被“增强”了的世界书条目进行回复生成。
5.  **[生成后 - 清理]**: `GENERATION_ENDED` 事件触发。
    a. 脚本调用 `cleanupInjectedContexts`。
    b. 遍历备份记录，将每个被修改条目的内容**恢复**为注入前的原始状态。
    c. 再次调用 `updateWorldbookWith` 保存清理后的结果。

---

## 2. 参考与依赖 (References & Dependencies)

| 类型 | 文件/链接 | 学习要点 |
|---|---|---|
| **事件 API** | `@types/iframe/event.d.ts` | `GENERATE_BEFORE_COMBINE_PROMPTS`, `GENERATION_ENDED`。 |
| **世界书 API** | `@types/function/worldbook.d.ts` | `updateWorldbookWith`, `getEnabledWorldInfoEntries`。 |
| **参考逻辑** | `src/ARK_STATUSBAR/logic/worldbook_manager.ts` | 世界书状态检查与基线对比逻辑。 |

---

## 3. 模块与函数设计 (Module & Function Design)

**文件路径**: `src/ARK_STATUSBAR/logic/updaters/character.ts` (新增/修改)

### 3.1 状态管理

*   **内存备份**: `const injectedEntriesSet = new Map<string, { worldbookName: string, uid: number, originalContent: string }>();`
    *   *注意*: Key 为 `${worldbookName}-${uid}`，确保唯一性。
*   **持久化缓存**: 
    *   `variables.global._internal.static_char_cache`: 存储 `{ [charName]: { worldbookName, uid } }`
    *   `variables.global._internal.static_char_cache_hash`: 存储缓存构建时的世界书状态哈希。

### 3.2 核心函数伪代码

#### `initializeInjector()`
```typescript
export function initializeInjector() {
    // 1. 智能构建/刷新缓存
    buildStaticCharacterCache();

    // 2. 注册注入事件
    eventOn(tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS, async () => {
        const variables = getVariables(); 
        const activeChars = variables.global.presence.active_chars || [];
        
        await Promise.all(activeChars.map(char => injectContextForCharacter(char.name, variables)));
    });

    // 3. 注册清理事件
    eventOn(tavern_events.GENERATION_ENDED, async () => {
        await cleanupInjectedContexts();
    });
}
```

#### `buildStaticCharacterCache()`
```typescript
async function buildStaticCharacterCache() {
    const variables = getVariables();
    const allEntries = await getEnabledWorldInfoEntries(true, true, true, true);
    
    // 计算当前世界书状态的简单哈希 (例如: 拼接所有启用条目的 worldbookName + uid + enabled)
    // 注意：必须包含 enabled 状态，因为同名异格角色的切换会改变 enabled 状态
    const currentHash = allEntries.map(e => `${e.world}-${e.uid}-${e.enabled}`).join('|');
    const storedHash = variables.global?._internal?.static_char_cache_hash;

    // 如果哈希一致，说明结构未变，缓存有效，跳过
    if (currentHash === storedHash && variables.global?._internal?.static_char_cache) return;

    // --- 重建缓存 ---
    console.info('[Injector] Worldbook structure/state changed. Rebuilding character cache...');
    const cache = {};
    allEntries.forEach(entry => {
        // !!! 关键修正：必须过滤掉禁用的条目
        // 解决同名异格干员问题：只有当前启用的那个形态会被缓存
        if (!entry.enabled) return;

        (entry.key || []).forEach(k => {
            if (typeof k === 'string') {
                // 如果存在多个启用条目使用相同 key（配置错误），后者覆盖前者
                cache[k.toLowerCase()] = { worldbookName: entry.world, uid: entry.uid };
            }
        });
    });

    // 原子更新缓存和哈希
    const newGlobal = { ...variables.global };
    if (!newGlobal._internal) newGlobal._internal = {};
    newGlobal._internal.static_char_cache = cache;
    newGlobal._internal.static_char_cache_hash = currentHash;

    replaceVariables({ ...variables, global: newGlobal }, { type: 'global' });
}
```

#### `injectContextForCharacter(charName, variables)`
```typescript
async function injectContextForCharacter(charName: string, variables: any) {
    const character = variables.characters[charName];
    if (!character || !character.has_static_profile) return;

    const cache = variables.global?._internal?.static_char_cache || {};
    const entryInfo = cache[charName.toLowerCase()];
    if (!entryInfo) return;

    const dynamicData = character.data;
    const renderedText = renderDynamicData(dynamicData);
    const injectionBlock = `\n<-- DYNAMIC_ARK_CONTEXT_START -->\n[实时动态]\n${renderedText}\n<-- DYNAMIC_ARK_CONTEXT_END -->\n`;
    const { worldbookName, uid } = entryInfo;

    await updateWorldbookWith(worldbookName, (entries) => {
        const entryToUpdate = entries.find(e => e.uid === uid);
        if (entryToUpdate) {
            // 1. 先清理可能残留的旧块 (幂等性保障)
            let cleanContent = entryToUpdate.content.replace(/\n<-- DYNAMIC_ARK_CONTEXT_START -->[\s\S]*<-- DYNAMIC_ARK_CONTEXT_END -->\n/g, "");
            
            // 2. 备份清理后的原始内容 (用于恢复)
            const backupKey = `${worldbookName}-${uid}`;
            if (!injectedEntriesSet.has(backupKey)) {
                injectedEntriesSet.set(backupKey, { worldbookName, uid, originalContent: cleanContent });
            }

            // 3. 追加新块
            entryToUpdate.content = cleanContent + injectionBlock;
        }
        return entries;
    });
}
```

#### `cleanupInjectedContexts()`
```typescript
async function cleanupInjectedContexts() {
    if (injectedEntriesSet.size === 0) return;

    for (const backup of injectedEntriesSet.values()) {
        await updateWorldbookWith(backup.worldbookName, (entries) => {
            const entryToRestore = entries.find(e => e.uid === backup.uid);
            if (entryToRestore) {
                // 直接恢复到备份的原始内容
                entryToRestore.content = backup.originalContent;
            }
            return entries;
        });
    }
    injectedEntriesSet.clear();
}
```

---

## 4. 迭代与反馈机制

### 4.1 三阶段上下文管理重构 (采纳用户反馈)

*   **核心问题**: 原 `034` 号规划文档中提出的 `total_turns - last_update_turn` 方案，将维护角色状态的核心逻辑压力不合理地转移给了 EJS 模板和 LLM，且需要后端脚本在每次更新时同步写入最新的 `total_turns`，设计笨重且脆弱。
*   **优化方案 (最终采纳)**:
    1.  **引入新 Schema 字段**: 在 `character.ts` 的 `_internal` 对象中，增加 `turns_since_last_update: z.number().int().default(0)`。该字段用于记录此角色距离上次被 LLM 主动更新，已经过去了多少轮。
    2.  **后端脚本维护**: 在 `src/ARK_STATUSBAR/logic/updaters/global.ts` (或 `character.ts` 亦可) 中，监听 `VARIABLE_UPDATE_ENDED` 事件。
    3.  **核心逻辑**:
        *   获取 `oldVariables` 和 `newVariables` 中的 `characters` 对象。
        *   遍历 `newVariables.characters` 中的所有角色。
        *   如果 `newVariables.characters[charName]` 与 `oldVariables.characters[charName]` **不相等** (意味着本轮被 LLM 更新了)，则将该角色的 `turns_since_last_update` **重置为 0**。
        *   如果**相等** (意味着本轮未被更新)，则将 `turns_since_last_update` 的值 **+1**。
    4.  **EJS 模板简化**: `变量列表.ejs` 中不再需要获取全局 `total_turns`，也不需要做任何减法运算。直接读取 `character._internal.turns_since_last_update` 的值，并根据 `> 5`, `> 10` 的阈值来判断角色属于 `Active`, `Nearby` 还是 `Unloaded` 状态。
*   **优势**: 此方案将状态维护的职责完全收归后端脚本，逻辑清晰、高效，且对 LLM 和 EJS 完全透明。

### 待办问题与讨论缓存区

*   **[P1] 异格干员切换问题**:
    *   **现状**: 仅在脚本启动（刷新页面）时检查哈希。如果在不刷新的情况下启用/禁用了世界书，缓存可能暂时失效。
    *   **对策**: 这是一个可以接受的权衡，因为用户很少在对话中途频繁切换世界书结构。如果确实发生，刷新页面即可解决。未来可考虑监听 `WORLDINFO_UPDATED` 事件来触发增量更新，但目前从简。
*   **[P2] 短期记忆时间戳问题 (新发现)**:
    *   **问题**: 当前 `character.ts` Schema 中，短期记忆 `short_term_buffer` 使用 `turn: z.number().int()` 作为时间戳。这与设计意图不符，无法体现记忆发生的具体游戏内时间，也无法与 `chronicle` 模块对齐。
    *   **策略**: 
        1.  **修改 Schema**: 需将 `character.ts` 中的 `turn: z.number().int()` 字段修改为 `time: z.string()`。
        2.  **修改 `memory` 更新规则**: 在 `[mvu_update]变量更新规则.ejs` 中，必须明确要求 LLM 在生成短期记忆时，填入一个结构为 `{ time: string, content: string }` 的对象，其中 `time` 必须是当前的 `global.time`。
        3.  **修改 `summarize_memory` 任务**: 长期记忆的 `time_span` 将由源短期记忆中的 `time` 字段生成，而不是 `turn`。
