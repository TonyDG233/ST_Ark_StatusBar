# 规划文档 039: 前置任务重构蓝图 - 时间戳、生命周期与任务清理

**日期**: 2026-01-23

**目的**: 本文档是所有 EJS 编码工作开始前的最终技术规划，旨在解决 Phase 2 遗留的、并在 Phase 3 规划中反复暴露的设计缺陷。本文档将作为后续 **Schema 修改**和**核心后端逻辑重构**的唯一、最终依据。

---

## 1. 重构目标

1.  **统一时间戳**: 彻底解决 `turn` (轮次) 与 `time` (游戏内时间) 在不同模块中混用导致的逻辑混乱。
2.  **重构角色生命周期**: 废弃原有的、脆弱的“最后更新轮次”方案，采用由您提出的、健壮的“未更新轮次计数器”机制来管理角色的三阶段上下文。
3.  **实现任务清理**: 解决技术债，为 `task_queue` 设计并实现一个可靠的、自动化的任务清理机制。

---

## Part 1: 时间戳统一 (`time` vs `turn`)

**最终方案**: 系统中所有与“时间点”相关的记录，都统一使用 `time: string` (`YYYY-MM-DD HH:mm` 格式)。所有与“轮次”相关的概念，仅用于`角色生命周期`的计数器。

### 1.1 Schema 修改清单

*   **`src/ARK_STATUSBAR/mvu/schemas/character.ts`**:
    *   [ ] `MemorySchema.short_term_buffer` 内部对象: `turn: z.number().int()` -> **修改为 `time: z.string()`**。

*   **`src/ARK_STATUSBAR/mvu/schemas/chronicle.ts`**:
    *   [ ] `RoundSummarySchema`: **删除 `turn_id` 字段**。
    *   [ ] `ChronicleSchema.system`: **删除 `last_processed_turn` 字段**。

---

## Part 2: 角色生命周期重构 (三阶段上下文)

**最终方案**: 采用“未更新轮次计数器”机制，由后端脚本全权维护。

### 2.1 Schema 修改清单

*   **`src/ARK_STATUSBAR/mvu/schemas/character.ts`**:
    *   [ ] 在 `CharacterSchema` 的 `_internal` 对象中: **删除 `last_update_turn: z.number().int().default(0)`**。
    *   [ ] 在 `CharacterSchema` 的 `_internal` 对象中: **新增 `turns_since_last_update: z.number().int().default(0)`**。

### 2.2 后端逻辑实现 (伪代码)

*   **位置**: `src/ARK_STATUSBAR/logic/updaters/global.ts` (或新建一个 `lifecycle.ts` 并由 `global` 导入)
*   **触发**: `eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...)`

```typescript
function manageCharacterLifecycle(newVariables, oldVariables) {
    const newChars = get(newVariables, 'stat_data.characters', {});
    const oldChars = get(oldVariables, 'stat_data.characters', {});
    
    // 遍历所有当前角色，以更新他们的计数器
    for (const charName in newChars) {
        const newCharData = newChars[charName];
        const oldCharData = oldChars[charName];

        if (!oldCharData) {
            // 如果是新角色，计数器默认为 0，无需处理
            continue; 
        }

        // 使用 lodash.isEqual 进行深度比较
        if (isEqual(newCharData, oldCharData)) {
            // 数据未变，计数器+1
            const currentTurns = get(newCharData, '_internal.turns_since_last_update', 0);
            set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, currentTurns + 1);
        } else {
            // 数据已更新，重置计数器
            set(newVariables, `stat_data.characters.${charName}._internal.turns_since_last_update`, 0);
        }
    }
}
```

---

## Part 3: 后端逻辑适配 (`chronicle.ts`)

**最终方案**: 使 `chronicle.ts` 的调度器完全适应 `time` 字符串。

### 3.1 核心函数修改 (`checkTimeTriggers`)

*   **文件**: `src/ARK_STATUSBAR/logic/updaters/chronicle.ts`
*   **修改点**: `parseDate` 函数必须被重构，以能精确处理 `YYYY-MM-DD HH:mm` 格式，并仅用于**日期部分**的比较。

```typescript
// 修正后的 parseDate 示例
function parseDate(timeStr: string) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    try {
        // "YYYY-MM-DD HH:mm" -> "YYYY-MM-DD"
        const datePart = timeStr.split(' ')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
        return { year, month, day };
    } catch (e) {
        return null;
    }
}
```

---

## Part 4: 任务队列清理 (回归健robust的后端闭环方案)

**背景**: 之前关于“消费者标记”或依赖“LLM生成remove指令”的方案均被证伪，因其将核心系统逻辑的可靠性错误地建立在了不可控的外部因素之上。我们必须回归 `016` 号架构文档中定义，并由您再次强调的**“生产者-消费者-后处理器”**闭环模式。

**最终方案**:
1.  **生产者 (Producers)**: 各 updater 脚本 (`character.ts` 等) 负责检测状态变化并**生成**任务到 `task_queue`。
2.  **消费者 (Consumer)**: EJS 模板 (`[mvu_update]任务执行器.ejs`) **只负责读取**任务队列，并将其渲染为 LLM 指令。它**不参与**任何队列修改逻辑。
3.  **后处理器 (Post-Processor)**: `logic/updaters/global.ts` 作为唯一的**后处理中心**，在 `VARIABLE_UPDATE_ENDED` 事件中，通过调用各模块专属的“验收函数”，来判断任务是否完成，并执行清理。

### 4.1 后处理器实现 (伪代码)

*   **文件**: `src/ARK_STATUSBAR/logic/updaters/global.ts`

```typescript
// (伪代码)

// 导入来自各个模块的“验收”函数
import { isCharacterTaskCompleted } from './character';
import { isChronicleTaskCompleted } from './chronicle';
import { isPlayerTaskCompleted } from './player';

async function postProcessCompletedTasks(newVariables, oldVariables) {
    let currentQueue = get(newVariables, 'stat_data.task_queue', []);
    if (currentQueue.length === 0) return;

    console.log(`[TaskManager] Post-processing ${currentQueue.length} tasks...`);
    
    const tasksToRemove = [];

    for (const task of currentQueue) {
        let isCompleted = false;
        switch (task.type) {
            case 'init_profile':
            case 'repair_profile':
            case 'summarize_memory':
                isCompleted = await isCharacterTaskCompleted(task, newVariables, oldVariables);
                break;
            case 'ten_round_summary':
            case 'daily_summary':
                // ... etc.
                isCompleted = await isChronicleTaskCompleted(task, newVariables, oldVariables);
                break;
            // ... other task types for player, etc.
        }

        if (isCompleted) {
            tasksToRemove.push(task.id);
        }
    }

    if (tasksToRemove.length > 0) {
        const updatedQueue = currentQueue.filter(task => !tasksToRemove.includes(task.id));
        set(newVariables, 'stat_data.task_queue', updatedQueue);
        console.log(`[TaskManager] Removed ${tasksToRemove.length} completed tasks: ${tasksToRemove.join(', ')}.`);
    }
}
```

### 4.2 “验收函数”实现 (伪代码示例)

*   **文件**: `src/ARK_STATUSBAR/logic/updaters/character.ts`

```typescript
// (伪代码)
export async function isCharacterTaskCompleted(task, newVariables, oldVariables) {
    switch (task.type) {
        case 'init_profile':
            // 验收逻辑: 检查 newVariables 中是否已存在该角色的完整 profile
            return get(newVariables, `stat_data.characters.${task.target_char}.data.profile.name`) === task.target_char;
            
        case 'summarize_memory':
            // 验收逻辑: 检查 newVariables 中该角色的 long_term 记忆数量是否比 oldVariables 多 1
            const oldMemCount = get(oldVariables, `stat_data.characters.${task.target_char}.data.memory.long_term`, []).length;
            const newMemCount = get(newVariables, `stat_data.characters.${task.target_char}.data.memory.long_term`, []).length;
            return newMemCount > oldMemCount;
    }
    return false;
}
```

**优势**:
*   **完全解耦**: 生产者、消费者、后处理器各司其职。
*   **后端闭环**: 任务的生命周期完全由后端脚本控制，不依赖任何 EJS 或 LLM 的“自觉行为”。
*   **高内聚**: 每个模块自己定义自己的任务“完成”标准，权责清晰。

---

## 5. 实施清单

1.  [x] **切换到 `code` 模式**。
2.  [x] **Schema 修改**:
    *   [x] `character.ts`: `short_term_buffer.turn` -> `time`; `last_update_turn` -> `turns_since_last_update`。
    *   [x] `chronicle.ts`: 移除所有 `turn` 相关字段。
3.  [x] **后端逻辑修改 (Parts 1-3)**:
    *   [x] `chronicle.ts`: 重构 `parseDate` 函数。
    *   [x] `global.ts` (或新建 `lifecycle.ts`): 实现 `manageCharacterLifecycle` 函数。
4.  [ ] **后端逻辑修改 (Part 4 - 待所有EJS完成后)**:
    *   [ ] `character.ts`: 创建 `isCharacterTaskCompleted` 验收函数。
    *   [ ] `chronicle.ts`: 创建 `isChronicleTaskCompleted` 验收函数。
    *   [ ] `player.ts`: 创建 `isPlayerTaskCompleted` 验收函数。
    *   [ ] `global.ts`: 实现 `postProcessCompletedTasks` 主调度函数，并导入、调用上述所有验收函数。
5.  [ ] **确认所有修改**。
6.  [ ] **更新 `update_todo_list`**，标记前置任务2完成。
