# Phase 3: EJS 模板规划 - `Player` 模块

**日期**: 2026-01-23

**目的**: 本文档旨在横向规划 `Player` 数据域所涉及的所有 EJS 模板内容，确保其在不同模板中的表现、规则和任务逻辑是统一且符合设计意图的。

---

## 1. 涉及文件与核心逻辑

*   **Schema 定义**: `src/ARK_STATUSBAR/mvu/schemas/player.ts` (数据结构的唯一真理)
*   **设计文档**: [`.kilocode/development_logs/012_Phase_Player_Design.md`](.kilocode/development_logs/012_Phase2.2_Player_Design.md) (核心设计思想)
*   **EJS 模板**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs` (负责展示)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` (负责定义通用规则)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` (负责处理特定任务)

---

## 2. 在 `变量列表.ejs` 中的表现

**职责**: 向 LLM 全面展示玩家的档案、状态和所有物，作为其决策和行动的核心依据。

### 伪代码实现

```ejs
<%
    const player = worldState.player;
%>
[玩家档案: <%- player.profile.name %>]
<%-
    // 使用 lodash 的 omit 来过滤掉不需要展示给 LLM 的内部字段(如果有的话)
    // 并且将所有对象展开，使其更易读
    const cleanedPlayer = _.omit(player, ['_internal']); 
    print(JSON.stringify(cleanedPlayer, null, 2));
%>
```

---

## 3. 在 `[mvu_update]变量更新规则.ejs` 中的规则

**职责**: 为 LLM 提供玩家档案的常态化更新规则，使其能自主根据剧情发展更新玩家状态。

| 字段路径 | `type` 定义 | `check` 规则 |
| :--- | :--- | :--- |
| `player.profile` | *(由任务管理)* | `- "【条件性修改】: 仅在接到 \`init_player_profile\` 或 \`repair_player_profile\` 任务时才可修改此部分内容。"` |
| `player.attributes` | `(省略)` | `- "【自主评估】: 根据玩家在剧情中的行为表现（如战斗胜利、策略成功、极限生存），适当调整六维属性和战力描述。"` |
| `player.attributes.power_level_desc` | `(string, 省略)` | `- "【强制引用】: 评估战力时，必须检索并参考《战力分级标准》世界书条目。"` |
| `player.status.mood` | `type: number` <br> `range: -100~100` | `- "根据玩家的言行和遭遇更新情绪。"` |
| `player.status.physiological_state` | `(省略)` | `- "根据剧情描述更新玩家的生理状态标签 (如: '健康', '轻伤', '疲劳')。"` |
| `player.status.current_action` | `(string, 省略)` | `- "【必须更新】: 用简短的动宾短语描述玩家当前正在做什么。"` |
| `player.inventory.items` | `type: \|-\n  {\n    [itemName: string]: { count: number; description: string; status?: string }\n  }` | `- "获得物品时: 添加新条目或增加 count。"\n- "消耗/丢失物品时: 减少 count。若 count 归零，则移除条目。"` |
| `player.inventory.equipment` | `(省略)` | `- "当剧情中明确描述玩家更换装备时，更新对应部位。"` |
| `player.social` | `type: \|-\n  {\n    [charName: string]: { relation: string; trust: number; impressions: string[] }\n  }` | `- "当玩家与角色有实质性互动时，评估关系进展、信任度变化和印象标签。"` |
| `player.skills` | `(省略)` | `- "当玩家在剧情中通过学习、训练或顿悟获得了新技能时，向该对象中添加新的键值对。"` |

---

## 4. 在 `[mvu_update]任务执行器.ejs` 中的逻辑

**职责**: 处理 `init_player_profile` 和 `repair_player_profile` 任务。

### 伪代码实现

```ejs
<%# (此代码块位于任务处理循环的独立 if 块中) %>

<%# === 任务类型: init_player_profile === %>
<% if (task.type === 'init_player_profile') { %>
---
#### **[高优先级任务: 玩家档案初始化]**
**任务**: 系统检测到玩家档案为空，请根据开场白和用户的初始输入，创建玩家档案。
**核心要求**: 档案必须信息详实、逻辑自洽。
**指令模板 (必须严格按照此结构填充所有字段):**
```json
{
  "op": "replace", 
  "path": "/player",
  "value": {
    "profile": { "name": "【代号/姓名】", "gender": "【性别】", "age": "【年龄】", "race": "【种族】", "appearance": "【外貌】", "background": "【背景】", "personality": "【性格】", "infection_status": "【非感染者/感染者/未公开】" },
    "attributes": { "physical_strength": "标准", "mobility": "标准", "physiological_endurance": "标准", "tactical_planning": "标准", "combat_skill": "标准", "originium_arts_adaptability": "标准", "power_level_desc": "未评估" },
    "skills": {},
    "inventory": { "items": {}, "equipment": { "main_hand": "无", "off_hand": "无", "outerwear": "无", "innerwear": "日常便服", "accessories": [] } },
    "social": {},
    "status": { "mood": 0, "physiological_state": ["健康"], "current_action": "开始行动" }
  }
}
```
<% } %>

<%# === 任务类型: repair_player_profile === %>
<% if (task.type === 'repair_player_profile') { %>
---
#### **[维护任务: 玩家档案修复]**
**任务**: 系统检测到玩家档案数据不完整或格式错误。
**缺失或错误的字段**: <%= task.payload.fields.join(', ') %>
**你的行动**: 请根据上下文，为上述字段提供正确的值，并通过 `replace` 或 `add` 操作进行修复。
<% } %>
```

---

## 5. 分期完成计划

1.  **第一阶段**: 实现 `变量列表.ejs` 中的完整渲染。
2.  **第二阶段**: 实现 `[mvu_update]变量更新规则.ejs` 中的所有常态化更新规则。
3.  **第三阶段**: 实现 `[mvu_update]任务执行器.ejs` 中的 `init_player_profile` 和 `repair_player_profile` 任务逻辑。

---

## 6. 已知问题与规避

*   **问题**: 玩家档案的更新高度依赖 LLM 的自主性，可能出现更新不及时或遗漏的情况。
    *   **规避**: `check` 规则需要写得尽可能明确和强制（如 `【必须更新】`）。此外，后端的 `repair_player_profile` 任务是最终的兜底机制。
*   **警告**: **规划与实现的区别**
    *   **强制要求**: 本规划文档中的所有伪代码为了可读性可能包含简写。在最终的 `.ejs` 文件实现中，所有部分都必须被替换为 `player.ts` Schema 中定义的完整、具体的字段结构，严禁在生产代码中保留任何形式的省略或占位符。
