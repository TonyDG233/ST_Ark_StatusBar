# Phase 2.2: 编年史设计 (Chronicle Design)

**目标**: 围绕 `Chronicle` 变量区块，设计一个既能保证信息丰富度，又具备严谨逐级归档逻辑的上下文总结系统。

---

## 1. 变量结构 (Zod Schema)
* **文件**: `src/ARK_STATUSBAR/mvu/schemas/chronicle.ts`
* **描述**: 定义了从“轮次”到“年度”的多层级总结结构。MVU变量中只保留近期数据（缓冲区），历史数据由后端脚本处理并触发LLM总结。

```typescript
import { z } from 'zod';

// 最低层级：每轮总结 (由LLM在每次回复时生成)
const RoundSummarySchema = z.object({
  id: z.string().describe('脚本自动生成的唯一ID，用于未来检索 (UUID/Hash)'),
  turn_id: z.number().int().describe('全局轮次ID'),
  time: z.string().describe('本轮结束时的时间戳'),
  location: z.string().describe('本轮发生的地点'),
  summary: z.string().describe('本轮核心事件的简短描述'),
  key_dialogue: z.array(z.string()).max(3).describe('本轮最关键的对话'),
  tags: z.array(z.string()).describe('事件标签 (如: 战斗, 探索, 关系进展)')
});

// 第二层级：十轮小结 (由后端脚本在满足条件时触发LLM生成)
const TenRoundSummarySchema = z.object({
  id: z.string().describe('唯一ID'),
  start_turn: z.number().int(),
  end_turn: z.number().int(),
  time_span: z.tuple([z.string(), z.string()]).describe('起始与结束时间戳'),
  key_events: z.array(z.string()).describe('这十轮内的关键事件列表'),
  character_moments: z.record(z.string(), z.string()).describe('各角色的关键行为或转变')
});

// 第三层级：每日总结
const DailySummarySchema = z.object({
  id: z.string().describe('唯一ID'),
  date: z.string().describe('日期 (YYYY-MM-DD)'),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe('本日头条/最重要事件'),
  included_summaries: z.array(TenRoundSummarySchema).describe('本日包含的所有十轮小结'),
  major_events_details: z.array(z.object({ 
    time: z.string(), 
    location: z.string(), 
    description: z.string() 
  })).describe('未被小结覆盖的重大事件详情'),
  character_updates: z.record(z.string(), z.string().describe('角色在本日的总体变化总结')),
  unresolved_threads: z.array(z.string()).describe('本日结束时仍未解决的线索或问题')
});

// 更高层级 (结构类似，此处省略以保持清晰)
// const WeeklySummarySchema = ...
// const MonthlySummarySchema = ...

// 编年史在MVU变量中的最终结构
export const ChronicleSchema = z.object({
  // 缓冲区
  round_buffer: z.array(RoundSummarySchema).max(30).describe('轮次总结缓冲区，放宽上限以应对积压'),
  small_summary_buffer: z.array(TenRoundSummarySchema).describe('十轮小结缓冲区'),
  daily_summary_buffer: z.array(DailySummarySchema).describe('每日总结缓冲区'),
  
  // 任务队列 (Task Queue) - 已移至 global.ts
  
  // 系统状态
  system: z.object({
    last_processed_turn: z.number().int().default(0),
    is_processing: z.boolean().default(false).describe('当前是否正在等待LLM处理任务')
  })
});
```

---

## 2. 初始设置 (InitVar)
```yaml
chronicle:
  round_buffer: []
  small_summary_buffer: []
  daily_summary_buffer: []
  system:
    last_processed_turn: 0
    is_processing: false
```

---

## 3. 更新规则 (Update Rules)
* **文件**: `[mvu_update]变量更新规则`

```yaml
---
变量更新规则:
  chronicle:
    round_buffer:
      check:
        - "在每次回复结束时，必须生成一条新的 RoundSummary。"
  task_queue:
    check:
      - "任务队列由后端脚本全权管理，LLM仅负责读取当前激活的任务并生成结果，不得自行修改队列。"
```

---

## 4. 后端处理逻辑 (Backend Logic)
* **模块**: `src/ARK_STATUSBAR/logic/updaters/chronicle.ts`
* **核心策略**: **单线程处理 + 优先级调度 + 递归检查**

### 4.1 调度器 (The Scheduler)
```typescript
function scheduleTasks(variables) {
    const chronicle = variables.chronicle;
    const task_queue = variables.task_queue || [];
    
    // 1. 如果已有编年史任务正在处理中，跳过调度
    if (task_queue.some(task => task.target_char === 'chronicle')) return;

    // 2. 自底向上检查触发条件 (Check Triggers)
    
    // [检查A] 日变更 (高优先级)
    const { hasDayChange, pastRounds } = checkDayChange(chronicle.round_buffer);
    if (hasDayChange) {
        pushTask({
            type: 'daily_summary',
            priority: 20,
            payload: { source_rounds: pastRounds }
        });
        return; 
    }

    // [检查B] 10轮小结 (中优先级)
    if (chronicle.round_buffer.length >= 10) {
        pushTask({
            type: 'ten_round_summary',
            priority: 10,
            payload: { source_rounds: chronicle.round_buffer.slice(0, 10) }
        });
        return;
    }

    // ... (更高层级的周/月/年检查逻辑)
}
```

### 4.2 任务执行与递归 (Execution & Recursion)
* **时机**: 在 `onVariableUpdateEnded` 中，如果发现 `task_queue` 中有 `target_char === 'chronicle'` 的任务。
* **流程**:
    1.  **取任务**: EJS 从 `task_queue` 获取队首的编年史任务 (Task A)。
    2.  **注入提示词**: 将 Task A 的要求和数据注入 Prompt。
    3.  **等待生成**: LLM 生成 Task A 的结果 (如 DailySummary)。
    4.  **后处理**: (由另一个专门监听LLM输出的脚本或模块处理)
        -   将结果存入 `daily_summary_buffer`。
        -   从 `round_buffer` 中**移除**已被总结的源数据。
        -   从 `task_queue` 中**移除** Task A。
    5.  **递归检查**: 在 `VARIABLE_UPDATE_ENDED` 事件中，脚本会再次调用 `scheduleTasks()`，检查是否需要生成新的更高层级任务。

---

## 5. 提示词设计 (Prompt Design)

```javascript
<%
const all_tasks = variables.task_queue || [];
const chronicle_task = all_tasks.find(t => t.target_char === 'chronicle'); // 假设每轮只处理一个

if (chronicle_task) {
    if (chronicle_task.type === 'daily_summary') {
        const data = chronicle_task.payload;
        injectPrompt("chronicle_task",
            `[系统指令 - 优先级: ${chronicle_task.priority}]\n` +
            `检测到日期变更，需要生成“每日总结”。\n` +
            `请处理以下 ${data.source_rounds.length} 条轮次记录...\n` + 
            `...`, 
            0
        );
    }
    // ... 其他类型任务
}
%>
```

---

## 6. 上下文注入策略 (Context Injection Strategy)
* **目的**: 避免一次性将整个编年史数据库（可能包含数百轮）全部发送给主LLM，导致Token爆炸和注意力分散。
* **规则**:
    1.  **轮次总结 (RoundSummaries)**: 默认仅注入 `round_buffer` 中的最后 **20条** 记录。这是为了保持最紧密的短期连续性。
    2.  **十轮小结 (SmallSummaries)**: 仅注入属于当前“天”的、尚未被合并为日总结的小结。
    3.  **日/周总结**: 仅注入当前层级缓冲区中的最后 1-2 条，作为中长期背景。
    4.  **按需检索 (未来接口)**: 利用 `id` 字段，配合未来的向量数据库或关键词检索脚本，动态提取相关的历史条目注入到上下文中。当前阶段，此部分作为接口预留。
