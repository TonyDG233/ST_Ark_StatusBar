# Phase 3: EJS 模板规划 - `Character` 模块

**日期**: 2026-01-23

**目的**: 本文档旨在横向规划 `Character` 数据域所涉及的所有 EJS 模板内容，确保其在不同模板中的表现、规则和任务逻辑是统一且符合设计意图的。

---

## 1. 涉及文件与核心逻辑

*   **Schema 定义**: `src/ARK_STATUSBAR/mvu/schemas/character.ts` (数据结构的唯一真理)
*   **设计文档**: [`.kilocode/development_logs/011_Phase2.2_Character_Design.md`](.kilocode/development_logs/011_Phase2.2_Character_Design.md) (核心设计思想)
*   **EJS 模板**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs` (负责展示)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` (负责定义通用规则)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` (负责处理特定任务)

---

## 2. 在 `变量列表.ejs` 中的表现

**职责**: 实现三阶段角色上下文管理，根据角色活跃度向 LLM 展示不同粒度的信息。

### 伪代码实现

```ejs
<%
    const allCharacters = worldState.characters || {};
    const globalTurn = worldState.global.game_progress.total_turns;
    const activeChars = [];
    const nearbyChars = [];
    const unloadedChars = [];

    // 1. 遍历与分类
    for (const charName in allCharacters) {
        if (charName.startsWith('_TEMPLATE_')) continue;
        const character = allCharacters[charName];
        const turnsSinceUpdate = globalTurn - (character._internal.last_update_turn || 0);
        
        if (turnsSinceUpdate <= 5) activeChars.push(character);
        else if (turnsSinceUpdate <= 10) nearbyChars.push(character);
        else unloadedChars.push(character);
    }
%>

[角色档案]

<%# 2.1. 渲染 Active 角色 (完整动态信息) %>
<% if (activeChars.length > 0) { %>
--- 在场角色 ---
<% activeChars.forEach(char => { %>
角色: <%- char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char) %>
    状态: <%- char.data.status.action %> at <%- char.data.status.location %> | 情绪: <%- char.data.status.mood %>
    战力评估: <%- char.data.combat.power_level_desc %> <%# 指令：此评估基于《战力分级标准》，请结合此描述进行演绎。 %>
    对玩家的信任度: <%- char.data.cognition.towards_player.trust %>/200
    长期记忆:
    <%- (char.data.memory.long_term || []).map(m => `- ${m.title}`).join('\\n    ') || '无' %>
    短期记忆:
    <%- (char.data.memory.short_term_buffer || []).map(m => `- (T${m.turn}) ${m.content}`).join('\\n    ') || '无' %>
<% }); %>
<% } %>

<%# 2.2. 渲染 Nearby 角色 (基础状态) %>
<% if (nearbyChars.length > 0) { %>
--- 附近角色 ---
<% nearbyChars.forEach(char => { %>
角色: <%- char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char) %> | 状态: <%- char.data.status.action %> at <%- char.data.status.location %>
<% }); %>
<% } %>

<%# 2.3. 渲染 Unloaded 角色 (仅列出名字) %>
<% if (unloadedChars.length > 0) { %>
--- 已不在场的角色 ---
<%- unloadedChars.map(char => (char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char))).join(', ') %> <%# 指令：这些角色当前不在场，但可根据剧情需要让他们重新入场。 %>
<% } %>
```

---

## 3. 在 `[mvu_update]变量更新规则.ejs` 中的规则

**职责**: 为 LLM 提供角色动态数据（`mood`, `trust`, `memory` 等）的通用更新规则。

| 字段路径 | `type` 定义 | `check` 规则 |
| :--- | :--- | :--- |
| `characters` | `type: \|-\n  {\n    [characterName: string]: CharacterSchema\n  }` | `- "该对象用于存储所有在场角色的动态信息，键为角色名。"` |
| `...data.profile` | *(由任务管理)* | `- "【条件性修改】: 仅在接到 \`init_profile\` 或 \`repair_profile\` 任务时，或剧情发生重大生理变故时，才可修改此部分内容。"` |
| `...data.status.mood` | `type: number` <br> `range: -100~100` | `- "根据剧情互动更新。-100(极度悲愤/恐惧) ~ 0(平静) ~ 100(极度狂喜)。"` |
| `...data.cognition.towards_player.trust` | `type: number` <br> `range: 0~200` | `- "0(死敌) ~ 50(中立) ~ 100(信赖) ~ 200(灵魂伴侣)。仅在发生有意义的互动时更新。"` |
| `...data.cognition.*` | `(省略)` | `- "认知更新: 根据剧情发展，更新角色对玩家的看法(towards_player)或玩家对角色的了解(from_player)。"` |
| `...data.memory.short_term_buffer` | `type: \|-\n  Array<{\n    turn: number;\n    content: string;\n  }>` | `- "【必须写入】: 每轮交互结束时，必须将本轮处于\`active_chars\`的角色的核心事件、对话或心理活动，作为一条新的短期记忆追加到此数组中。"` |
| `...data.memory.long_term` | *(由任务管理)* | `- "【严禁修改】: 此字段只能由 \`summarize_memory\` 任务进行写入。"` |
| `...data.combat.power_level_desc` | `(string, 省略)` | `- "【强制引用】: 评估战力时，必须检索并参考《战力分级标准》世界书条目。"` |
| `...data.skills` | `(省略)` | `- "当角色在剧情中通过学习、训练或顿悟获得了新技能时，向该对象中添加新的键值对。"` |
| `..._internal` | *(后端管理)* | `- "【严禁修改】: 系统内部状态。"` |

---

## 4. 在 `[mvu_update]任务执行器.ejs` 中的逻辑

**职责**: 处理 `init_profile`, `repair_profile`, `summarize_memory` 三种核心任务，并体现任务的分组渲染策略。

### 伪代码实现

```ejs
<%
    // 注意: 此处的任务并行数 (slice(0, 3)) 仅为示例。
    // 在实际的 `[mvu_update]任务执行器.ejs` 文件中，此数值将由文件头部的统一配置 `MAX_TASKS_PER_TURN` 决定。
    const tasksToProcess = (worldState.global.task_queue || []).slice(0, 3);
    
    // 任务分类
    const initProfileTasks = tasksToProcess.filter(t => t.type === 'init_profile');
    const summarizeMemoryTasks = tasksToProcess.filter(t => t.type === 'summarize_memory');
    const repairProfileTasks = tasksToProcess.filter(t => t.type === 'repair_profile');
%>

<%# === 策略: GROUPED / REPEATED (init_profile & repair_profile) === %>
<% if (initProfileTasks.length > 0 || repairProfileTasks.length > 0) { %>
    <% initProfileTasks.forEach(task => { %>
---
#### **[高优先级任务: 新角色档案初始化 - <%= task.target_char %>]**
**任务**: 检测到新角色 **`<%= task.target_char %>`** 首次登场，你必须为其创建完整的、明日方舟风格的档案。
**核心要求**: 档案必须信息详实、风格统一、逻辑自洽。
**指令模板 (必须严格按照此结构填充所有字段):**
```json
{
  "op": "add",
  "path": "/characters/<%= task.target_char %>",
  "value": {
    "has_static_profile": false,
    "_internal": { "last_update_turn": <%= worldState.global.game_progress.total_turns %> },
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
        "初始技能": { "description": "【一项初始技能的描述】" }
      },
      "status": {
        "location": "【当前所在精确位置】",
        "posture": "【姿势】",
        "action": "【正在进行的动作】",
        "mood": 0,
        "attire": "【当前着装】"
      },
      "cognition": {
        "towards_player": { "trust": 50, "attitude": "中立", "known_facts": [], "unknown_facts": [], "misconceptions": [] },
        "from_player": { "unlocked_secrets": [], "misconceptions": [] }
      },
      "memory": {
        "short_term_buffer": [],
        "long_term": []
      },
      "combat": {
        "power_level_desc": "【基于《战力分级标准》的评估】"
      },
      "notes": {}
    }
  }
}
```
    <% }); %>
    <% repairProfileTasks.forEach(task => { %>
---
#### **[维护任务: 档案修复 - <%= task.target_char %>]**
**任务**: 系统检测到角色 **`<%= task.target_char %>`** 的档案数据不完整。
**缺失或错误的字段**: <%= task.payload.fields.join(', ') %>
**你的行动**: 请根据上下文，为上述字段提供正确的值，并通过 `replace` 或 `add` 操作进行修复。
    <% }); %>
<% } %>

<%# === 策略: REPEATED (summarize_memory) === %>
<% if (summarizeMemoryTasks.length > 0) { %>
    <% summarizeMemoryTasks.forEach(task => { %>
---
#### **[任务: 角色记忆总结 - <%= task.target_char %>]**
**任务**: 角色 **`<%= task.target_char %>`** 的短期记忆已累积，请为他/她总结为一条长期记忆。
**待总结的短期记忆**:
<% (task.payload.memories || []).forEach(mem => { %>
- (T<%- mem.turn %>) <%- mem.content %>
<% }); %>
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
    <% }); %>
<% } %>
```

---

## 5. 分期完成计划

1.  **第一阶段**: 实现 `变量列表.ejs` 中的三阶段渲染逻辑。这是基础，能确保 LLM 看见的上下文是正确的。
2.  **第二阶段**: 实现 `[mvu_update]变量更新规则.ejs` 中除记忆外的所有通用规则。
3.  **第三阶段**: 完整实现 `[mvu_update]任务执行器.ejs` 中的 `init_profile` 和 `repair_profile` 任务逻辑，并实现 `变量更新规则.ejs` 中关于短期记忆写入的规则。
4.  **第四阶段**: 实现 `summarize_memory` 任务逻辑，完成记忆系统的闭环。

---

## 6. 已知问题与规避

*   **问题**: `summarize_memory` 任务中，`time_span` 使用 `turn` 而不是 `time`。
    *   **规避**: 在最终实现时，需要与 `Chronicle` 模块对齐，统一使用 `time` 字符串作为时间戳。此处的伪代码暂时保留 `turn` 以反映当前 Schema，但在总括规划中需标记为待办修改项。
*   **问题**: `init_profile` 任务的模板非常巨大，可能消耗较多 Token。
    *   **规避**: 这是必要成本。一个结构完整、注释清晰的模板是确保 LLM 输出质量的关键，可以有效避免后续更多的 `repair_profile` 任务，从长远看是节省 Token 的。
*   **警告**: **规划与实现的区别**
    *   **强制要求**: 本规划文档中的所有伪代码（特别是 `init_profile` 的 JSON 模板）为了可读性可能包含省略号 (`...`)。在最终的 `.ejs` 文件实现中，**所有省略号都必须被替换为 `character.ts` Schema 中定义的完整、具体的字段结构，严禁在生产代码中保留任何形式的省略或占位符。**
