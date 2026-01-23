# Phase 3: `[mvu_update]变量更新规则.ejs` 详细规划 v1

**日期**: 2026-01-23

**目的**: 本文档旨在对 `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` 文件的内容进行逐字段、逐逻辑的详细规划。此规划将严格遵循所有相关的 Schema 定义和设计文档，作为最终编码实现的唯一依据，以重建信任并确保代码质量。

**核心原则**:
1.  **Schema 驱动**: 所有 `type` 定义必须直接来源于 `src/ARK_STATUSBAR/mvu/schemas/*.ts` 文件。
2.  **设计溯源**: 所有 `check` 规则必须能追溯到 `.kilocode/development_logs/010-014` 系列设计文档中的逻辑。
3.  **无歧义**: 杜绝任何模糊的占位符或不完整的规则。

---

## 1. 总体结构

文件将生成一个 YAML 文本，其根键为 `变量更新规则`。该键下包含四个顶级模块：`global`, `task_queue`, `characters`, `player`, `chronicle`。

---

## 2. 模块详细规划

### 2.1 `global` 模块

| 字段路径 | Schema 定义 (`global.ts`) | 逻辑来源/设计文档 | EJS `type` 定义 | EJS `check` 规则 |
| :--- | :--- | :--- | :--- | :--- |
| `global.time` | `z.string().regex(...)` | `010_GlobalState_Design.md` | `format: "YYYY-MM-DD HH:mm:ss"` | `- "根据剧情的逻辑流逝来更新时间，例如：'几分钟后'、'第二天早上'。"` |
| `global.location` | `z.object({...})` | `010_GlobalState_Design.md` | `type: \|-\n  {\n    region: string; // 国家/大区\n    city: string;   // 城市\n    area: string;   // 区域\n    spot: string;   // 具体位置\n  }` | `- "当角色从一个地点移动到另一个地点时，必须更新此变量的所有四个层级。"` |
| `global.weather` | `z.string()` | 通用世界状态 | (省略) | `- "仅在场景明显变动，场景氛围变化，上下文中明确表示天气转变时（如天黑、下雨、放晴）更新。"` |
| `global.environment_status` | `z.string()` | 通用世界状态 | (省略) | `- "当环境发生显著变化或地点转移，事件对环境产生影响时（如发生爆炸、光线改变），请用客观描述来更新此项。"` |
| `global.presence` | `z.object({...})` | `010_GlobalState_Design.md` (三阶段角色管理) | `type: \|-\n  {\n    active_chars: string[]; // 当前在场并参与交互的角色列表\n    nearby_chars: string[]; // 附近可被感知但未直接交互的角色\n  }` | `- "【LLM 感知】: 根据主 LLM 的回复，分析出所有直接参与互动的角色填入 \`active_chars\`，在附近但未直接互动的角色或在当前场景下可能出现的角色填入 \`nearby_chars\`。"` |
| `global.game_progress` | `z.object({...})` | `010_GlobalState_Design.md` (后端维护) | (省略) | `- "【严禁修改】: 此字段由后端脚本在每轮结束后自动递增。"` |

### 2.2 `task_queue` 模块

| 字段路径 | Schema 定义 (`global.ts`) | 逻辑来源/设计文档 | EJS `type` 定义 | EJS `check` 规则 |
| :--- | :--- | :--- | :--- | :--- |
| `task_queue` | `TaskQueueSchema` | `013_Chronicle_Design.md` (单线程任务队列) | (省略) | `- "【严禁修改】: 此队列由后端脚本全权管理。你只需读取并执行其中的任务，不得修改队列本身。"` |

### 2.3 `characters` 模块

| 字段路径 | Schema 定义 (`character.ts`) | 逻辑来源/设计文档 | EJS `type` 定义 | EJS `check` 规则 |
| :--- | :--- | :--- | :--- | :--- |
| `characters` | `z.record(z.string(), CharacterSchema)` | `011_Character_Design.md` | `type: \|-\n  {\n    [characterName: string]: { ... full schema ... }\n  }` | `- "该对象用于存储所有在场角色的动态信息，键为角色名。"` |
| `...data.profile` | `CharacterFullSchema` | `011_Character_Design.md` (档案修复闭环) | (嵌套在父级type中) | `- "【条件性修改】: 仅在接到 \`init_profile\` 或 \`repair_profile\` 任务时，或剧情发生重大生理变故（如毁容、变异）时，才可修改此部分内容。"` |
| `...data.status.mood` | `z.coerce.number().min(-100).max(100)` | 通用角色状态 | `type: number\nrange: -100~100` | `- "根据剧情互动更新。-100(极度悲愤/恐惧) ~ 0(平静) ~ 100(极度狂喜)。"` |
| `...data.cognition.towards_player.trust` | `z.coerce.number().min(0).max(200)` | `011_Character_Design.md` | `type: number\nrange: 0~200` | `- "0(死敌) ~ 50(中立) ~ 100(信赖) ~ 200(灵魂伴侣)。仅在发生有意义的互动时更新。"` |
| `...data.cognition.towards_player.attitude` | `z.string()` | `011_Character_Design.md` | (省略) | `- "用简练的词语描述对玩家的当前态度（如'警惕', '依赖', '冷漠'）。"` |
| `...data.cognition.towards_player.known_facts` | `z.array(z.string()).max(5)` | `011_Character_Design.md` | (省略) | `- "当角色从剧情中确信了关于玩家的某件事实时，添加条目。"` |
| `...data.cognition.towards_player.unknown_facts` | `z.array(z.string()).max(5)` | `011_Character_Design.md` | (省略) | `- "当角色意识到自己对玩家的某个关键信息不了解时，添加条目。"` |
| `...data.cognition.towards_player.misconceptions` | `z.array(z.string()).max(5)` | `011_Character_Design.md` | (省略) | `- "当角色对玩家产生了错误的认知时，添加条目。"` |
| `...data.cognition.from_player.unlocked_secrets` | `z.array(z.string())` | `011_Character_Design.md` | (省略) | `- "当剧情揭示了该角色的某个秘密或关键过往，且玩家已获知时，添加条目。"` |
| `...data.cognition.from_player.misconceptions` | `z.array(z.string()).max(5)` | `011_Character_Design.md` | (省略) | `- "当上下文出现玩家对于该角色情况的错误判断或误解时，添加条目。"` |
| `...data.memory.short_term_buffer` | `z.array(...).max(12)` | `011_Character_Design.md` (FIFO记忆机制) | (嵌套在父级type中) | `- "【必须写入】: 每轮交互结束时，必须将本轮处于\`active_chars\`的角色相关的核心事件、对话或心理活动，作为一条新的短期记忆追加到此数组中。"` |
| `...data.memory.long_term` | `z.array(...)` | `011_Character_Design.md` | (嵌套在父级type中) | `- "【严禁修改】: 此字段只能由 \`summarize_memory\` 任务进行写入。"` |
| `...data.combat.power_level_desc` | `z.string()` | `011_Character_Design.md` & 战力分级标准.yaml | (省略) | `- "【强制引用】: 评估战力时，必须检索并参考《战力分级标准》世界书条目。输出格式必须严格遵循文档中的层级描述。"` |
| `...data.skills` | `z.record(z.string(), z.string())` | `011_Character_Design.md` | (嵌套在父级type中) | `- "当角色在剧情中通过学习、训练或顿悟获得了新技能时，向该对象中添加新的键值对。"` |
| `..._internal` | `MaintenanceSchema` | `011_Character_Design.md` (后端维护) | (嵌套在父级type中) | `- "【严禁修改】: 系统内部状态。"` |

### 2.4 `player` 模块

| 字段路径 | Schema 定义 (`player.ts`) | 逻辑来源/设计文档 | EJS `type` 定义 | EJS `check` 规则 |
| :--- | :--- | :--- | :--- | :--- |
| `player.profile` | `ProfileSchema` | `012_Player_Design.md` | (嵌套在父级type中) | `- "【条件性修改】: 仅在接到 \`init_player_profile\` 或 \`repair_player_profile\` 任务时才可修改此部分内容。"` |
| `player.attributes.power_level_desc` | `z.string()` | `012_Player_Design.md` | (省略) | `- "【强制引用】: 评估战力时，必须检索并参考《战力分级标准》世界书条目。输出格式必须严格遵循文档中的层级描述。"` |
| `player.status.mood` | `z.number().min(-100).max(100)` | `012_Player_Design.md` | `type: number\nrange: -100~100` | `- "根据玩家的言行和遭遇更新情绪。"` |
| `player.status.physiological_state` | `z.array(z.string())` | `012_Player_Design.md` | (省略) | `- "根据剧情描述更新玩家的生理状态标签 (如: '健康', '轻伤', '疲劳')。"` |
| `player.status.current_action` | `z.string()` | `012_Player_Design.md` | (省略) | `- "必须更新。用简短的动宾短语描述玩家当前正在做什么。"` |
| `player.inventory.items` | `z.record(...)` | `012_Player_Design.md` | (嵌套在父级type中) | `- "获得物品时: 添加新条目或增加 count。"\n- "消耗/丢失物品时: 减少 count。若 count 归零，则移除条目。"` |
| `player.inventory.equipment` | `z.object(...)` | `012_Player_Design.md` | (嵌套在父级type中) | `- "当剧情中明确描述玩家更换装备时，更新对应部位。"` |
| `player.social` | `z.record(...)` | `012_Player_Design.md` | (嵌套在父级type中) | `- "当玩家与角色有实质性互动时，评估关系进展、信任度变化和印象标签。"` |
| `player.skills` | `SkillsSchema` | `012_Player_Design.md` | (嵌套在父级type中) | `- "当玩家在剧情中通过学习、训练或顿悟获得了新技能时，向该对象中添加新的键值对。"` |

### 2.5 `chronicle` 模块

| 字段路径 | Schema 定义 (`chronicle.ts`) | 逻辑来源/设计文档 | EJS `type` 定义 | EJS `check` 规则 |
| :--- | :--- | :--- | :--- | :--- |
| `chronicle.round_buffer` | `z.array(RoundSummarySchema)` | `013_Chronicle_Design.md` | `type: |-
  // This is an array of RoundSummary objects.
  // Add a new object to this array for each round.
  [{
    id: string; // Unique ID for the round
    time: string; // Timestamp, should match global.time
    location: string; // Location string
    summary: string; // A concise summary of the key event
    key_dialogue: string[]; // Important lines of dialogue
    tags: string[]; // Tags like 'Combat', 'Investigation', 'Social'
  }]` | `- "【必须写入】: 每次回复结束时，必须分析并生成一条新的 RoundSummary 记录本轮核心事件、对话和观察。"` |
| `chronicle.*_summary_buffer` | `z.array(...)` | `013_Chronicle_Design.md` | (嵌套在父级type中) | `- "【严禁修改】: 所有 summary_buffer (small, daily, weekly 等) 均由后端脚本通过分派 'summarize_chronicle' 任务进行管理和写入。你只能读取它们，不得直接修改。"` |
| `chronicle.system` | `z.object(...)` | `013_Chronicle_Design.md` | (嵌套在父级type中) | `- "【严禁修改】: 系统内部状态。"` |

