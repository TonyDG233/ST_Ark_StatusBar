# Stage 3: 提示词工程最终执行蓝图 (Final Execution Blueprint) V2

**日期**: 2026-01-22
**状态**: 规划中 (V2)

## 前言 (Preamble)

本规划是在对所有历史文档 (`005`, `006`, `011`, `013`, `014`, `017`, `018`)、参考代码 (`chronicle.ts`)、API定义 (`event.d.ts`)、EJS文档及您的全部反馈进行系统性学习和反思后，制定的**最终版、唯一的** Stage 3 执行蓝图。

**本文档将取代所有早期规划，作为后续所有提示词工程相关开发的绝对依据。** 我将严格按照此蓝图执行，不再引入任何未在此处明确的逻辑。

---

## 1. Schema 重构方案: `CharacterSchema`

**目标**: 提高数据内聚性，将所有元数据（metadata）统一管理。

**方案**:
1.  废弃 `discriminatedUnion`。
2.  将 `has_static_profile` 移动到 `_internal` 对象中。
3.  `CharacterSchema` 将始终包含 `profile` 和 `skills` 字段，但对于静态角色，这些字段将是可选的或在运行时被忽略。后端逻辑将依赖 `_internal.has_static_profile` 来决定注入哪些内容。

**重构后的 Schema (`src/ARK_STATUSBAR/mvu/schemas/character.ts`):**
```typescript
// ... (CognitionSchema, MemorySchema, etc. remain unchanged)

// 角色的动态数据 (Unchanged)
const CharacterDynamicSchema = z.object({
  status: z.object({ /* ... */ }),
  cognition: CognitionSchema,
  memory: MemorySchema,
  combat: z.object({ /* ... */ }),
  notes: z.record(z.string(), z.string()).default({})
});

// 角色的静态档案 (Unchanged)
const CharacterProfileSchema = z.object({
  name: z.string(),
  gender: z.string(),
  race: z.string(),
  appearance: z.string(),
  background: z.string(),
  personality: z.string(),
  infection_status: z.enum(['非感染者', '感染者', '未公开'])
});

const SkillsSchema = z.record(z.string(), z.string().describe('技能描述')).default({});

// 新的、统一的内部元数据
const InternalMetaSchema = z.object({
  has_static_profile: z.boolean().describe('是否存在静态世界书档案'),
  static_profile_uid: z.number().optional().describe('关联的静态世界书条目UID (缓存)'),
  last_update_turn: z.number().int().default(0).describe('最后更新轮次')
});

// 最终的、统一的 CharacterSchema
export const CharacterSchema = z.object({
  _internal: InternalMetaSchema,
  data: CharacterDynamicSchema.extend({
    // profile 和 skills 对于静态角色来说是冗余的，但为了结构统一而保留
    // 提示词生成逻辑将基于 _internal.has_static_profile 来忽略它们
    profile: CharacterProfileSchema.optional(),
    skills: SkillsSchema.optional()
  })
});

// 在运行时，一个动态角色的结构会是:
// { _internal: { has_static_profile: false, ... }, data: { profile: {...}, skills: {...}, ... } }
// 一个静态角色的结构会是:
// { _internal: { has_static_profile: true, ... }, data: { profile: undefined, skills: undefined, ... } }
```

---

## 2. 核心 EJS 文件实现详述

### 2.1 `变量列表.ejs`
**目标**: 为分析LLM提供最全面的上下文。
**实现逻辑**:
1.  **不过滤历史**: 完整展示 `chronicle` 下的所有缓冲区 (`round_buffer`, `daily_summary_buffer`等)。
2.  **过滤模板**: 明确排除 `characters._TEMPLATE_STATIC_` 和 `characters._TEMPLATE_DYNAMIC_`。
3.  **添加维护注释**: 在文件顶部添加注释，指导未来如何扩展。

```ejs
<%# 
  [维护指引]
  本文件负责为分析LLM提供世界状态快照。
  - 新增变量模块时，请在此处添加新的渲染区块。
  - 确保过滤掉对LLM无用的运行时变量 (如 _TEMPLATE_*)。
  - 历史记录(Chronicle)应完整展示，不作删减。
-%>

# 世界状态
...

# 角色状态
<% 
  const chars = _.omit(stat_data.characters, ['_TEMPLATE_STATIC_', '_TEMPLATE_DYNAMIC_']); 
  // ... (其余三阶段渲染逻辑不变)
%>
...

# 历史提要 (Chronicle)
- **轮次总结**:
  <%- JSON.stringify(stat_data.chronicle.round_buffer, null, 2) %>
- **十轮小结**:
  <%- JSON.stringify(stat_data.chronicle.small_summary_buffer, null, 2) %>
<%# ... (渲染所有其他层级的总结) %>
```

### 2.2 `[mvu_update]任务执行器.ejs`
**目标**: 为LLM提供清晰、无歧义的任务指令和输出格式参考。
**实现逻辑**:
1.  对于需要生成大型对象的任务 (如 `init_profile`)，**硬编码一个完整的、带注释的YAML模板**作为输出格式指导。
2.  在文件顶部添加注释，指导如何为新任务类型添加渲染逻辑。

```ejs
<%# 
  [维护指引]
  本文件负责将 task_queue 中的任务翻译成LLM指令。
  - 新增任务类型时，请在下方的 if/else if 逻辑链中为其添加一个新的渲染块。
  - 对于需要生成复杂对象的任务，必须提供一个完整的、带注释的结构模板，以确保输出格式的正确性。
-%>

<% if (stat_data.task_queue && stat_data.task_queue.length > 0) { %>
[SYSTEM]
...

<% stat_data.task_queue.forEach(task => { %>
---
## 任务: <%= task.type %>

**指令**:
<% if (task.type === 'init_profile') { %>
  检测到新角色「<%= task.target_char %>」首次登场，请为其创建完整的明日方舟风格档案。
  **你的行动**: 在`<UpdateVariable>`块中，使用 `_.assign` 指令，并严格遵循以下YAML结构模板来填充内容。
  
  **输出格式模板**:
  ```yaml
  # 角色名，必须与任务目标一致
  '<%= task.target_char %>':
    _internal:
      has_static_profile: false # 因为这是动态创建的角色
      last_update_turn: <%= stat_data.global.game_progress.total_turns %>
    data:
      profile:
        name: '<%= task.target_char %>'
        # 性别: 字符串
        gender: "..."
        # ... (其他 profile 字段的注释和占位符)
      skills:
        # 技能名: 技能描述
        "示例技能": "..."
      status:
        # ... (status 字段的注释和占位符)
      # ... (cognition, memory, combat, notes 的注释和占位符)
  ```
<% } else if (task.type === 'summarize_memory') { %>
  ...
<% } %>
<% }); %>
<% } %>
```

---

## 3. 动态上下文注入机制详述

**目标**: 在生成前，为主剧情LLM临时提供静态角色的动态信息。

**实现逻辑**:
1.  **事件钩子**: 使用 `tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS` 作为注入时机，`tavern_events.GENERATION_ENDED` 作为清理时机。
2.  **注入内容**: `injectContextForPlotLLM` 函数将遍历所有 `active_chars`。对于 `_internal.has_static_profile === true` 的角色，它将读取该角色的**整个 `data` 对象 (即 `CharacterDynamicSchema` 的所有内容)**，将其渲染成一段通顺的自然语言描述。
3.  **注入方式 (Plan A)**: 使用 `updateWorldEntry` 和正则表达式，将上述自然语言描述插入到对应 `uid` 的世界书条目的特定锚点（如 `人际关系:` 之前）。
4.  **清理方式**: `cleanupInjectedContext` 负责将世界书条目恢复到注入前的原始内容。

**伪代码 (`global.ts` & `character.ts`):**
```typescript
// in global.ts
eventOn(tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS, async () => {
  await characterUpdater.injectContextForPlotLLM(Mvu.getMvuData().stat_data);
});

eventOn(tavern_events.GENERATION_ENDED, async () => {
  await characterUpdater.cleanupInjectedContext();
});

// in character.ts
const originalContents = new Map<number, string>(); // 临时存储原始内容

async function injectContextForPlotLLM(stat_data) {
  originalContents.clear(); // 清空旧的缓存
  for (const charName of stat_data.global.presence.active_chars) {
    const character = stat_data.characters[charName];
    if (character?._internal?.has_static_profile && character._internal.static_profile_uid) {
      const uid = character._internal.static_profile_uid;
      const entry = await getWorldEntry(uid);
      originalContents.set(uid, entry.content); // 缓存原始内容

      // 将整个 data 对象渲染成自然语言
      const dynamicContext = `
## 实时动态 (${charName})
- **当前状态**: ${character.data.status.action} at ${character.data.status.location}. Mood: ${character.data.status.mood}.
- **对玩家态度**: ${character.data.cognition.towards_player.attitude}.
- **近期记忆**: ${character.data.memory.short_term_buffer.slice(-3).map(m => m.content).join('; ') || '无'}
- **战力评估**: ${character.data.combat.power_level_desc}
`;
      
      const newContent = entry.content.replace(/(人际关系:)/, `${dynamicContext}\n$1`);
      await updateWorldEntry(uid, { content: newContent });
    }
  }
}

async function cleanupInjectedContext() {
  for (const [uid, originalContent] of originalContents.entries()) {
    await updateWorldEntry(uid, { content: originalContent });
  }
  originalContents.clear();
}
```

---

## 4. 最终实现步骤

1.  [ ] **Schema 重构**: 按照 **第1节** 的方案修改 `src/ARK_STATUSBAR/mvu/schemas/character.ts`。
2.  [ ] **提示词工程 (EJS)**:
    *   [ ] 修改 `变量列表.ejs`，实现 **2.1** 中的逻辑 (完整历史 + 过滤模板)。
    *   [ ] 实现 `[mvu_update]任务执行器.ejs`，为 `init_profile` 和 `repair_profile` 任务硬编码YAML结构模板 (如 **2.2** 所示)。
    *   [ ] 为所有其他任务类型在 `任务执行器.ejs` 中添加渲染逻辑。
    *   [ ] 创建基础的 `[mvu_update]变量更新规则.ejs` 和 `[mvu_update]变量输出格式.ejs`，并添加维护指引注释。
3.  [ ] **动态注入 (后端)**:
    *   [ ] 在 `character.ts` 中实现 **第3节** 中的 UID 缓存、注入、清理逻辑。
    *   [ ] 在 `global.ts` 中实现 **第3节** 中的事件监听与调度逻辑。
4.  [ ] **后端逻辑闭环**: 在 `global.ts` 的 `postProcessCompletedTasks` 中补全所有任务的清理逻辑。
5.  [ ] **测试**: 对 Plan A 进行严格的稳定性测试。
