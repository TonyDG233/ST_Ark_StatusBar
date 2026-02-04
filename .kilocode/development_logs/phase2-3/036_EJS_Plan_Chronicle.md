# Phase 3: EJS 模板规划 - `Chronicle` 模块

**日期**: 2026-01-23

**目的**: 本文档旨在横向规划 `Chronicle` 数据域所涉及的所有 EJS 模板内容，这是整个动态上下文系统的核心与最复杂部分。

---

## 1. 涉及文件与核心逻辑

*   **Schema 定义**: `src/ARK_STATUSBAR/mvu/schemas/chronicle.ts`
*   **设计文档**: [`.kilocode/development_logs/013_Phase2.2_Chronicle_Design.md`](.kilocode/development_logs/013_Phase2.2_Chronicle_Design.md)
*   **EJS 模板**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs`
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs`
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs`

---

## 2. 在 `变量列表.ejs` 中的表现

**职责**: 实现选择性的上下文注入策略，向 LLM 展示最相关、最具时效性的历史回顾，避免 Token 爆炸。

### 伪代码实现

```ejs
<%
    const chronicle = worldState.chronicle;
%>
[历史回顾 (Chronicle)]

<%# 1. 完整注入所有缓冲区内容 (当前阶段策略) %>
轮次记忆:
<%- 
    (chronicle.round_buffer || []).map(r => 
        `- [${r.time}] 在 ${r.location}: ${r.summary}`
    ).join('\n') || '无'
%>

十轮总结:
<%-
    (chronicle.small_summary_buffer || []).map(s =>
        `- [${s.time_span.join(' to ')}] 关键事件: ${s.key_events.join(', ')}`
    ).join('\n') || '无'
%>

每日总结:
<%-
    (chronicle.daily_summary_buffer || []).map(d =>
        `- [每日总结 ${d.date}] ${d.headline}`
    ).join('\n') || '无'
%>
<%# (此处省略 weekly, monthly 等，实现逻辑均为完整显示) %>
```

---

## 3. 在 `[mvu_update]变量更新规则.ejs` 中的规则

**职责**: 强制 LLM 在每轮结束后，必须生成一条轮次总结 (`RoundSummary`)。

| 字段路径 | `type` 定义 | `check` 规则 |
| :--- | :--- | :--- |
| `chronicle.round_buffer` | `type: \|-\n  Array<{\n    id: string;\n    turn_id: number;\n    time: string;\n    location: string;\n    summary: string;\n    key_dialogue: string[];\n    tags: string[];\n  }>` | `- "【核心职责 - 必须写入】: 在每次回复结束时，你必须分析本轮交互的核心内容，生成一条新的 RoundSummary 对象，并将其添加到此数组的末尾。这是整个记忆系统的基础，不可遗漏。"` |
| `chronicle.*_summary_buffer` | *(由任务管理)* | `- "【严禁修改】: 所有更高层级的总结缓冲区 (small, daily 等) 均由后端脚本通过分派 'summarize_chronicle' 任务进行管理和写入。你只能读取它们，不得直接修改。"` |

---

## 4. 在 `[mvu_update]任务执行器.ejs` 中的逻辑

**职责**: 处理由后端调度器生成的 `summarize_chronicle` 任务。

### 伪代码实现

```ejs
<%# (此代码块位于任务处理循环的独立 if 块中, 且为 EXCLUSIVE 类型，每轮只处理一个) %>
<%
    const chronicleTask = tasksToProcess.find(t => t.type === 'summarize_chronicle');
%>
<% if (chronicleTask) { %>
---
#### **[高优先级任务: 历史回顾总结]**
**任务**: 系统检测到历史进程已达到 <%- chronicleTask.payload.level %> 的总结标准。
**你的行动**: 请根据以下源数据，生成一份结构完整的 <%- chronicleTask.payload.level %> 总结，并使用 `add` 操作将其添加到 `chronicle.<%- chronicleTask.payload.target_buffer %>` 数组中。

**待总结的源数据**:
```json
<%- JSON.stringify(chronicleTask.payload.summaries, null, 2) %>
```

**指令模板 (必须严格按照此结构填充所有字段):**
```json
{
  "op": "add",
  "path": "/chronicle/<%= chronicleTask.payload.target_buffer %>/-",
  "value": {
    "id": "【生成一个唯一ID】",
    "date": "<%= worldState.global.time.split(' ')[0] %>",
    "time_span": ["<%= chronicleTask.payload.start_time %>", "<%= chronicleTask.payload.end_time %>"],
    "headline": "【总结的标题】",
    "major_events_details": [
       { "time": "...", "location": "...", "description": "..." }
    ],
    "character_updates": {
        "角色A": "【该角色在此期间的总体变化】"
    },
    "unresolved_threads": ["【仍未解决的线索或问题】"]
  }
}
```
<% } %>
```

---

## 5. 分期完成计划

1.  **第一阶段**: 实现 `变量更新规则.ejs` 中关于 `round_buffer` 的强制写入规则。这是系统的源头。
2.  **第二阶段**: 实现 `变量列表.ejs` 中的选择性上下文注入逻辑。
3.  **第三阶段**: 实现 `任务执行器.ejs` 中对 `summarize_chronicle` 任务的完整处理，包括提供源数据和输出模板。

---

## 6. 已知问题与规避

*   **问题**: `time` 与 `turn` 字段在不同模块中可能存在不统一。
    *   **规避**: 在最终的总括规划和实现阶段，**必须**进行全局搜索和替换，确保所有与时间相关的字段（包括 Character Memory 和 Chronicle）都统一使用 `time: string` 格式，并废弃 `turn` ID，或仅将其作为辅助索引。
*   **问题**: 总结任务的指令模板是固定的，但不同层级的总结（Daily, Weekly）其 Schema 略有不同。
    *   **规避**: 在 `任务执行器.ejs` 的实现中，可以使用 `<% if (chronicleTask.payload.level === 'Daily') { ... } else if (chronicleTask.payload.level === 'Weekly') { ... } %>` 的逻辑，为不同层级的总结任务提供略有不同的 `value` 模板，以确保输出与目标 Schema 精确匹配。
*   **警告**: **规划与实现的区别**
    *   **强制要求**: 本规划中的指令模板为 `DailySummary` 的示例。在最终实现时，必须为所有可能出现的总结层级提供完整、无省略的模板。
*   **[未来规划] 总结的永久化与索引**:
    *   **问题**: 当前策略是完整显示所有缓冲区，并在总结后清理源数据。这会导致历史信息丢失。
    *   **未来方向**: 在后续版本中，需要设计一套将已完成的总结（如 `DailySummary`）永久化存储（可能存入一个独立的世界书条目或外部数据库）的机制，并开发 LLM 可用的精准索引/检索功能，以在需要时调取特定历史记忆。
*   **[待办] Schema 结构统一性重构**:
    *   **问题**: 当前 `chronicle.ts` 中，不同层级的总结 Schema 结构不统一（例如 `TenRoundSummarySchema` 包含 `character_moments`，而 `DailySummarySchema` 包含 `character_updates` 和 `major_events_details` 等），存在“小巧思”，缺乏一致性。
    *   **要求**: 在进入编码实现阶段前，**必须**重构 `chronicle.ts` 和相关的后端逻辑 (`chronicle.ts`)。目标是统一所有层级（TenRound, Daily, Weekly...）的总结结构，确保它们都包含地点、人物变化、势力变化、遗留问题等核心字段，仅在细节和聚合程度上有所不同。
