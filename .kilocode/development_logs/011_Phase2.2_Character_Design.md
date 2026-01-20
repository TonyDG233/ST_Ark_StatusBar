# Phase 2.2: 角色档案设计 (Character Design)

**目标**: 围绕 `Character` 变量区块，完成从结构定义到提示词设计的完整工作流规划。

---

## 1. 变量结构 (Zod Schema)
* **文件**: `src/ARK_STATUSBAR/mvu/schemas/character.ts`
* **描述**: 定义了游戏中所有角色的数据结构。采用混合数据流模式，将不变的静态数据（如背景）与动态变化的数据（如当前状态、记忆）分离。

```typescript
import { z } from 'zod';

// 认知模块：角色对玩家的看法，以及玩家掌握的角色情报
const CognitionSchema = z.object({
  towards_player: z.object({
    trust: z.coerce.number().min(0).max(200).default(50).describe('对玩家的信任度 (0-200)'),
    attitude: z.string().default('中立').describe('对玩家的当前态度'),
    known_facts: z.array(z.string()).max(5).describe('角色确信的关于玩家的事实'),
    unknown_facts: z.array(z.string()).max(5).describe('角色意识到自己不知道的关于玩家的关键信息'),
    misconceptions: z.array(z.string()).max(5).describe('角色对玩家的错误认知')
  }).describe('角色视角 -> 玩家'),
  
  from_player: z.object({
    unlocked_secrets: z.array(z.string()).describe('玩家已获知的该角色的秘密/关键情报 (由LLM判断剧情进展写入)'),
    misconceptions: z.array(z.string()).max(5).describe('玩家对该角色的错误认知')
  }).describe('玩家视角 -> 角色')
});

// 记忆模块：FIFO 队列逻辑
const MemorySchema = z.object({
  short_term_buffer: z.array(z.object({ 
      turn: z.number().int(), 
      content: z.string() 
  })).max(12).describe('短期记忆缓冲区。当达到12条时，脚本将提取最早的6条生成长期记忆，并保留后6条。'),
  long_term: z.array(z.object({
    title: z.string().describe('长期记忆的标题'),
    summary: z.string().describe('对一系列短期记忆的总结'),
    time_span: z.tuple([z.string(), z.string()]).describe('记忆发生的时间范围'),
    impact: z.string().describe('该记忆对角色的影响')
  })).describe('长期记忆库')
});

// 角色的动态数据
const CharacterDynamicSchema = z.object({
  status: z.object({
    location: z.string().describe('当前所在精确位置'),
    posture: z.string().describe('姿势'),
    action: z.string().describe('正在进行的动作'),
    mood: z.coerce.number().min(-100).max(100).describe('情绪值'),
    attire: z.string().describe('当前着装')
  }),
  cognition: CognitionSchema,
  memory: MemorySchema,
  combat: z.object({ 
    // 提示词需强调：基于 references/tools/明日方舟/战力分级标准.yaml 判断
    power_level_desc: z.string().default('未评估').describe('基于28级战力标准的文字描述 (如: 层级13-上位王牌战力)') 
  }),
  notes: z.record(z.string(), z.string()).describe('关于该角色的杂项记录')
});

// 角色的完整数据结构
const CharacterFullSchema = CharacterDynamicSchema.extend({
  profile: z.object({
    name: z.string(),
    gender: z.string(),
    race: z.string(),
    appearance: z.string(),
    background: z.string(),
    personality: z.string(),
    infection_status: z.enum(['非感染者', '感染者', '未公开'])
  }),
  skills: z.record(z.string(), z.string().describe('技能描述'))
});

// 维护任务队列 (存储在每个角色的变量空间内，或全局维护)
const MaintenanceSchema = z.object({
  _internal: z.object({
    last_update_turn: z.number().int().default(0).describe('最后更新轮次'),
    pending_repairs: z.array(z.string()).describe('待修复的缺失字段路径列表，如 ["status.mood", "profile.race"]')
  })
});

export const CharacterSchema = z.intersection(
  z.discriminatedUnion('has_static_profile', [
    z.object({ has_static_profile: z.literal(true), data: CharacterDynamicSchema }),
    z.object({ has_static_profile: z.literal(false), data: CharacterFullSchema })
  ]),
  MaintenanceSchema
);
```

---

## 2. 初始设置 (InitVar)
* **文件**: 世界书条目 `[initvar]变量初始化勿开`
* **描述**: 提供通用模板而非具体角色数据。Values 作为 Prompt 指引。

```yaml
characters:
  _TEMPLATE_STATIC_:
    has_static_profile: true
    data:
      status:
        location: "根据上下文判断当前位置"
        posture: "根据上下文判断姿势"
        action: "根据上下文判断当前动作"
        mood: 0
        attire: "根据上下文判断着装"
      cognition:
        towards_player:
          trust: 50
          attitude: "中立"
          known_facts: []
          unknown_facts: []
          misconceptions: []
        from_player:
          unlocked_secrets: []
          misconceptions: []
      memory:
        short_term_buffer: []
        long_term: []
      combat:
        power_level_desc: "未评估"
      notes: {}
    _internal:
      last_update_turn: 0
      pending_repairs: []

  _TEMPLATE_DYNAMIC_:
    has_static_profile: false
    data:
      profile:
        name: "角色名"
        gender: "未知"
        race: "未知"
        appearance: "根据上下文描述"
        background: "根据上下文提取"
        personality: "根据上下文分析"
        infection_status: "未公开"
      skills: {}
      status: # ...同上
      # ...其余同上
```

---

## 3. 更新规则 (Update Rules)
* **文件**: 世界书条目 `[mvu_update]变量更新规则`
* **策略**: 利用 `EJS` 模板能力，不列举所有字段，而是提供核心逻辑，并强调参考外部文档。

```yaml
---
变量更新规则:
  characters:
    type: |-
      { [name: string]: CharacterSchema }
    check:
      - "战力评估必须严格参考《战力分级标准》文档。输出格式应为描述性文本（如'层级5-上位战场中坚'），而非仅输出数字。"
      - "认知更新：'unlocked_secrets' 仅在玩家通过剧情明确获知角色的核心秘密或过往经历时添加条目。"
      - "记忆管理：仅记录本轮交互中的关键信息。不要重复记录已有的短期记忆。"
      - "完整性检查：如果是新角色初始化，必须填写所有 profile 字段。"
```

---

## 4. 后端处理逻辑 (Backend Logic)
* **模块**: `src/ARK_STATUSBAR/logic/updaters/character.ts`

### 4.1 强制初始化 (Mandatory Initialization)
* **触发条件**: 监听 `render` 或 `generation_after` 阶段。检测 `SillyTavern.getContext().chat.length <= 2`。
* **逻辑**: 
  1. 无论当前 `presence.active_chars` 状态如何，强制向 LLM 推送一个高优先级的 **Inject Prompt**。
  2. 要求 LLM 为所有在场角色生成**完整档案 (`CharacterFullSchema`)**。
  3. 此时不区分是否有静态档案，先全部作为动态档案存入变量。

### 4.2 档案存储与修复机制 (Storage & Repair Loop)
* **触发条件**: 接收到 LLM 返回的 JSON Patch 或完整变量对象。
* **逻辑**:
  1. **Zod 校验**: 使用 `CharacterFullSchema.safeParse(data)`。
  2. **缺漏检测**: 如果校验失败，分析 `error.issues`，识别缺失的字段（例如 `profile.race` 缺失）。
  3. **空值填充**: 后端脚本先用默认值（如 `"UNKNOWN"` 或 `null`）填充缺失字段，确保 MVU 变量能成功写入，防止崩溃。
  4. **任务生成**: 将缺失字段的路径（`path`）推入该角色的 `_internal.pending_repairs` 数组。
  5. **推送修复任务**: 在下一轮生成前，通过 `injectPrompt` 插入系统指令：
     > "系统检测到角色 [Name] 的档案存在缺失数据：[List of Missing Fields]。请根据当前上下文或设定进行补全。"
  6. **循环**: 重复上述步骤，直到 `pending_repairs` 清空。

### 4.3 三阶段上下文管理 (Context Lifecycle)
* **状态定义**:
  * **Active**: 在 `global.presence.active_chars` 中。注入**完整动态状态 + 记忆**。
  * **Nearby**: 在 `global.presence.nearby_chars` 中。仅注入**基础状态 (Location/Action)**，不注入记忆和深度认知。
  * **Unload**: 不在任何列表中。变量保留，但**完全不注入**提示词。
* **转移逻辑**:
  * `Active -> Nearby`: `total_turns - last_update_turn > 5`。
  * `Nearby -> Unload`: `total_turns - last_update_turn > 10`。

### 4.4 静态/动态分离 (Static/Dynamic Split)
* **执行时机**: 仅在构建提示词上下文（Context Injection）时执行，而非存储时。
* **逻辑**: 
  1. 脚本遍历 `active_chars`。
  2. 检查世界书是否有名为 `[角色名]` 的条目。
  3. **若有**: 视为有静态档案。提示词只注入 `CharacterDynamicSchema` 的内容的自然语言描述，并尝试插入到该世界书条目的特定锚点（如 `[DYNAMIC_INSERT]`）或使用 `@INJECT` 紧跟在该条目后。
  4. **若无**: 视为纯动态角色。提示词注入 `CharacterFullSchema` 的完整内容的自然语言描述。

---

## 5. 提示词设计 (Prompt Design)
利用 **EJS Prompt Template** 插件的特性。

* **初始化/修复 Prompt (Dynamic Inject)**:
```javascript
<%
const pending = variables.characters[name]._internal.pending_repairs;
if (pending && pending.length > 0) {
    injectPrompt("repair_task", 
        `[系统指令] 角色 ${name} 的档案数据不完整，缺少以下字段：${pending.join(', ')}。请立即根据设定补全这些信息。`,
        0 // High priority
    );
}
%>
```

* **记忆压缩 (Memory Consolidation)**:
```javascript
<%
const mem = variables.characters[name].memory;
if (mem.short_term_buffer.length >= 12) {
    const to_summarize = mem.short_term_buffer.slice(0, 6);
    injectPrompt("memory_task",
        `[系统指令] 角色 ${name} 的短期记忆已满。请将以下 6 条近期记忆概括为一条长期记忆，重点保留关键事件和对角色的影响：\n${JSON.stringify(to_summarize)}`,
        10
    );
    // 后端脚本会在下一次 update 时清理这 6 条
}
%>
```

* **战力评估**:
> [系统指令] 在评估角色战力时，**必须**检索并参考《战力分级标准》世界书条目。输出 `combat.power_level_desc` 时，请直接使用文档中的层级描述（如“层级13-上位王牌战力”），并确保该描述与角色的表现相符。
