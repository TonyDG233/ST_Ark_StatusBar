# Phase 3: `[mvu_update]任务执行器.ejs` 详细设计文档 v2

**日期**: 2026-01-22

**目的**: 本文档是 `[mvu_update]任务执行器.ejs` 文件的详细设计规划。它基于对 `[SYSTEM] 核心指令.md` 的深度分析及 `.kilocode/workflows/✅变量输出格式.md` 的规范，旨在设计一个能够将全局任务队列 (`task_queue`) 转化为 LLM 可理解、可执行的结构化指令的强大 EJS 模板。

---

## 1. 核心职责与定位 (Core Responsibility)

`[mvu_update]任务执行器.ejs` 是连接**后端逻辑（任务的产生）**和**分析师 LLM（任务的消耗）**的核心桥梁。其职责不是分析状态，而是**解析任务**。

*   **任务解析器**: 遍历 `worldState.global.task_queue` 数组，识别每一个待办任务的类型 (`type`) 和目标 (`target_char`, `target_chronicle_level` 等)。
*   **上下文生成器**: 为每个被解析的任务，从 `worldState` 中提取并组织完成该任务所需的最少、最精确的上下文信息。
*   **指令模板分发器**: 为每个任务提供一个明确的、带注释的 `JSON Patch` 指令模板，引导 LLM 输出正确的操作来完成任务并更新变量。

---

## 2. 参考与依赖 (References & Dependencies)

| 类型 | 文件/链接 | 学习要点 |
|---|---|---|
| **核心思想** | `references/参考_旧剧情模块前端项目_学习挂载逻辑/[SYSTEM] 核心指令.md` | **任务驱动**的设计哲学、**上下文情景化**的实现方式。 |
| **输出规范** | `.kilocode/workflows/✅变量输出格式.md` | **JSON Patch** 的标准格式 (`op`, `path`, `value`)。 |
| **API 文档** | `references/doc_ST-Prompt-Template/reference_cn.md` | EJS 标签的正确使用，`_` (lodash) 的可用性。 |
| **核心反馈** | `.kilocode/development_logs/020_User_Feedback_Summary.md` | 必须使用独立 `if` 块处理多任务；必须为复杂任务提供输出模板；必须规避 `last_update_turn` 的逻辑陷阱。 |
| **Schema** | `src/ARK_STATUSBAR/mvu/schemas/*.ts` | `task_queue` 的结构定义，以及所有任务 `payload` 的具体形态。 |

---

## 3. 实现思路与伪代码 (Implementation & Pseudocode)

**文件路径**: `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs`

### 3.1 任务渲染策略 (Render Strategies)

为了优化 Token 使用并提高指令清晰度，我们将任务分为三类：

1.  **`GROUPED` (分组渲染)**: 多个同类任务合并显示。例如 `init_profile`，只需提供一个通用的指令模板和多个待初始化的目标列表。
2.  **`REPEATED` (重复渲染)**: 每个任务都需要独立的、丰富的上下文。例如 `summarize_memory`，每个角色的记忆内容不同，必须为每个任务完整渲染“上下文+指令”。
3.  **`EXCLUSIVE` (独占渲染)**: 每轮只能执行一次的高风险任务。例如 `summarize_chronicle`，避免多重总结导致数据错乱。

### 3.2 详细伪代码

```ejs
<%#
======================================================================
 EJS 模板: [mvu_update]任务执行器.ejs
 职责: 将全局任务队列翻译成 LLM 可执行的指令。
======================================================================
%>

<%# [前置条件]
    本模板假定 `变量列表.ejs` 已经成功执行，并通过 define() 创建了全局可访问的 `worldState` 对象。
%>

<%# [步骤 1: 任务读取与筛选]
    - 从 worldState 中安全地获取任务队列。
    - !! 关联问题记录：此处暂时硬编码每轮最大任务数为 3。未来该值应从 worldState.global.config.max_tasks_per_turn 读取。
%>
<%
    const taskQueue = worldState.global.task_queue || [];
    const MAX_TASKS_PER_TURN = 3; // 临时硬编码
    const tasksToProcess = taskQueue.slice(0, MAX_TASKS_PER_TURN);
    
    // 任务计数器，用于处理 EXCLUSIVE 任务
    let chronicleSummaryCount = 0;
%>

<%-/* [步骤 2: 任务遍历与分发] 
    - 检查是否有待处理任务。
    - 使用 forEach 遍历，并用独立的 if 块处理不同任务类型。
*/-%>
<% if (tasksToProcess.length > 0) { %>
---
### **第三部分：本轮行动指令**
*你必须严格按照以下任务指令行动，并在最终的 `<JSONPatch>` 块中完成所有要求。*
<% tasksToProcess.forEach((task, index) => { %>

<%# === 任务类型: init_profile (策略: GROUPED - 实际上目前后端每个任务是一个对象，暂按单体处理，未来可优化为聚合) === %>
<% if (task.type === 'init_profile') { %>
---
#### **[高优先级任务 <%= index + 1 %>: 新角色档案初始化]**
**任务**: 检测到新角色 **`<%= task.target_char %>`** 首次登场，你必须为其创建完整的、明日方舟风格的档案。
**情景提要**: <%= task.payload.context_summary || '无' %>
**核心要求**: 档案必须信息详实、风格统一、逻辑自洽。特别是外貌、履历和医学报告部分，必须模仿官方档案的口吻。

**你的行动**: 在 `<JSONPatch>` 块中，使用 `add` 操作，将一个完整的角色对象添加到 `characters` 中。
**指令模板 (请填充 "【...】" 中的内容):**
```json
{
  "op": "add",
  "path": "/characters/<%= task.target_char %>",
  "value": {
    "_internal": {
      "last_update_turn": <%= worldState.global.game_progress.total_turns %> // 必须设为当前轮次
    },
    "has_static_profile": false,
    "data": {
      "profile": {
        "name": "<%= task.target_char %>",
        "gender": "【性别】",
        "race": "【种族】",
        "appearance": "【极其详细的外貌描述】",
        "background": "【客观的背景履历】",
        "personality": "【性格特点】",
        "infection_status": "【非感染者/感染者/未公开】"
      },
      "skills": {
        "示例技能": "【一项初始技能的描述】"
      },
      "status": {
        "location": "【当前所在精确位置】",
        "posture": "【姿势】",
        "action": "【正在进行的动作】",
        "mood": 0,
        "attire": "【当前着装】"
      },
      "cognition": { /* ... */ },
      "memory": { /* ... */ },
      "combat": {
        "power_level_desc": "【基于《战力分级标准》的评估】"
      },
      "notes": {}
    }
  }
}
```
<% } %>

<%# === 任务类型: summarize_memory (策略: REPEATED) === %>
<% if (task.type === 'summarize_memory') { 
    const targetChar = worldState.characters[task.target_char];
%>
---
#### **[任务 <%= index + 1 %>: 角色记忆总结]**
**任务**: 角色 **`<%= task.target_char %>`** 的短期记忆已累积，请为他/她总结为一条长期记忆。
**待总结的短期记忆**:
<% (task.payload.memories || []).forEach(mem => { %>
- (T<%- mem.turn %>) <%- mem.content %>
<% }); %>

**你的行动**: 在 `<JSONPatch>` 块中，使用 `add` 操作，将一条新的长期记忆添加到该角色的 `memory.long_term` 数组末尾。
**指令模板 (请填充 "【...】" 中的内容):**
```json
{
  "op": "add",
  "path": "/characters/<%= task.target_char %>/data/memory/long_term/-",
  "value": {
    "title": "【你为该记忆提炼的标题】",
    "summary": "【你总结的记忆内容】",
    "time_span": ["<%= (task.payload.memories[0] || {}).turn %>", "<%= (task.payload.memories.slice(-1)[0] || {}).turn %>"],
    "impact": "【该记忆对角色的影响】"
  }
}
```
<% } %>

<%# === 任务类型: summarize_chronicle (策略: EXCLUSIVE - 每轮限一次) === %>
<% if (task.type === 'summarize_chronicle') { 
    if (chronicleSummaryCount > 0) return; // 跳过后续的总结任务
    chronicleSummaryCount++;
%>
---
#### **[任务 <%= index + 1 %>: 历史回顾总结]**
**任务**: 当前的 <%- task.payload.level %> 已达到总结标准，请根据以下近期轮次记忆，生成一份 <%- task.payload.level %> 总结。
**待总结的近期轮次记忆**:
<% (task.payload.summaries || []).forEach(s => { %>
- <%- JSON.stringify(s) %>
<% }); %>

**你的行动**: 在 `<JSONPatch>` 块中，使用 `add` 操作，将一份新的总结添加到 `chronicle` 对应的缓冲区中。
**指令模板 (请填充 "【...】" 中的内容):**
```json
{
  "op": "add",
  "path": "/chronicle/<%= task.payload.target_buffer %>/-",
  "value": {
    "date": "<%= worldState.global.time.split(' ')[0] %>",
    "time_span": ["<%= task.payload.start_time %>", "<%= task.payload.end_time %>"],
    "headline": "【总结的标题】",
    "major_events_details": [
       { "time": "...", "location": "...", "description": "..." }
    ]
    // ... 其他字段
  }
}
```
<% } %>

<%# --- [可以在此添加其他任务类型的 if 块，注意实际编辑文件时应当补全指令模板避免错误指引] --- %>


<% }); %>
<% } else { %>
---
### **第三部分：本轮行动指令**
[常规任务：状态更新]
*当前无高优先级任务。请根据你的`<Analysis>`分析，在`<JSONPatch>`中更新相关变量。*
<% } %>
```

---

## 4. 已知问题规避 (Known Issues & Mitigation)

1.  **JSON Patch 规范**:
    *   **问题**: 之前的设计使用了非标准的 `_.set` 等函数。
    *   **规避**: 全面采用了 `op`, `path`, `value` 的标准 JSON Patch 格式，并针对每个任务提供了具体的 JSON 对象模板。
2.  **多任务与互斥**:
    *   **问题**: 如何平衡并发处理与数据安全。
    *   **规避**: 使用独立的 `if` 块支持并发处理（如同时初始化多个角色），同时引入计数器 `chronicleSummaryCount` 限制独占任务（如编年史总结）的执行频率。
3.  **`last_update_turn` 陷阱**:
    *   **问题**: `init_profile` 任务若不正确设置 `last_update_turn`，新角色会立即被判定为“已离场”。
    *   **规避**: 在 `init_profile` 任务的指令模板中，明确要求将 `_internal.last_update_turn` 的值设置为当前的 `worldState.global.game_progress.total_turns`。

---

## 5. 迭代与反馈机制 (Iteration & Feedback)

### 待办问题与讨论缓存区

*   **[问题 1] 完整的“每轮任务处理数”逻辑链路**:
    *   **背景**: 目前 EJS 中硬编码 `MAX_TASKS_PER_TURN = 3`。这需要变成一个可配置的系统。
    *   **规划链路**:
        1.  **前端 (UI)**: 提供一个设置界面（如滑块），允许用户调整“每轮处理任务数”。
        2.  **通信**: 前端触发事件 `UPDATE_CONFIG`，携带新的数值。
        3.  **后端 (TS)**: 监听事件，验证数值，并更新 `variables.global.config.max_tasks_per_turn`。
        4.  **EJS**: 渲染时，读取 `worldState.global.config.max_tasks_per_turn`，动态截取 `taskQueue.slice(0, max)`。
        5.  **LLM**: 收到 N 个任务的指令，生成 N 个 `JSONPatch` 操作。
        6.  **后端 (清理)**: 监听 `VARIABLE_UPDATE_ENDED`，对比 `old_queue` 和 `new_queue`（或者检查 LLM 的 patch 结果），确认哪些任务已完成，并从队列中**真正**移除它们。
    *   **下一步**: 此逻辑将在完成 Phase 3 提示词工程后，在 Character/Global 后端重构阶段实现。

---
**此文档即为 `[mvu_update]任务执行器.ejs` 的详细设计规划，请审阅。**
