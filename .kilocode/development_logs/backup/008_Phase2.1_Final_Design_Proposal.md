# Phase 2.1: 独立架构设计提案 (Independent Design Proposal)

**日期**: 2026-01-18
**状态**: 最终提案 - 响应“生死状”
**基石**: 深度结合 `[SYSTEM] 核心指令.md` (旧项目逻辑) 与 `粥粥数据库` (数据深度)。

---

## 1. 核心架构图景 (The Big Picture)

本设计旨在解决 **Token 经济性** 与 **信息完整性** 的矛盾。
我们不再维护一个巨大的全局变量树，而是建立一套 **“分层存储、按需注入”** 的系统。

### 1.1 数据流策略
1.  **静态层 (Worldbook)**: 存储不变的设定（种族/出身/背景）。由人工维护。
2.  **动态层 (MVU Variables)**: 存储实时变动的状态（情绪/位置/短期记忆）。由 AI 维护。
3.  **归档层 (Log Entries)**: 存储沉淀的历史（编年史/长期总结）。由脚本写入 Worldbook，**不再占用 MVU 变量空间**。

---

## 2. 角色数据架构 (Character Architecture)

每个角色拥有一个 **独立** 的变量实例。这对应于旧项目的 `Character_Directory`，但结构升级为“粥粥”式的深度模型。

### 2.1 变量定义 (Zod Schema)

```typescript
// 单个角色的独立变量结构
export const CharacterSchema = z.object({
  // --- 基础动态 ---
  status: z.object({
    location: z.string().describe('当前地点 (如 "罗德岛-医疗部")'),
    posture: z.string().describe('姿势 (如 "靠在墙边")'),
    action: z.string().describe('正在进行的动作'),
    mood: z.number().min(-100).max(100).describe('情绪值'),
    // 感染监控 (关注社会待遇)
    infection_monitor: z.enum(['未公开', '体表不可见', '体表可见', '需防护', '危殆']).describe('矿石病社会可视状态')
  }),

  // --- 认知系统 (双向映射 - 致敬粥粥数据库) ---
  cognition: z.object({
    // NPC 对 玩家 的认知
    towards_player: z.object({
      trust: z.number().min(0).max(200).describe('信赖度'),
      attitude: z.string().describe('当前态度短语'),
      known_facts: z.array(z.string()).describe('确信已知的玩家情报'),
      unknown_secrets: z.array(z.string()).describe('想知道的玩家秘密 (盲区)'),
      misconceptions: z.array(z.string()).describe('对玩家的错误判断 (误区)')
    }),
    // 玩家 对 NPC 的认知 (用于UI显示“档案解锁度”)
    from_player: z.object({
      unlocked_records: z.array(z.string()).describe('玩家已解锁的该角色档案条目'),
      misconceptions: z.array(z.string()).describe('玩家可能存在的误解')
    })
  }),

  // --- 记忆系统 (复刻旧项目 + 粥粥深度) ---
  memory: z.object({
    // 短期记忆流 (FIFO Buffer)
    // 作用: 给 AI 提供最近 10 轮的“语境感”
    short_term_buffer: z.array(z.object({
      time: z.string(), // 绝对时间
      content: z.string(), // 想法/经历
      related_chars: z.array(z.string()) // 关联人物
    })).max(10),
    
    // 长期记忆 (Key Memories)
    // 作用: 塑造角色的长期性格改变
    long_term: z.array(z.object({
      title: z.string(), // 记忆标题
      summary: z.string(), // 凝练后的记忆
      impact: z.string().describe('对角色的深远影响')
    }))
  })
});
```

---

## 3. 编年史系统 (Chronicle System)

**核心修正**: 放弃简单的 Buffer，回归旧项目的 **“层级总结 (Tiered Summary)”** 逻辑，但将 **存储介质** 改为 Worldbook。

### 3.1 变量定义 (仅存储指针与状态)

```typescript
export const ChronicleState = z.object({
  // 当前轮次的微观记录
  current_round: z.object({
    summary: z.string().describe('本轮交互的一句话总结'),
    dialogue_snippet: z.array(z.string()).describe('本轮关键对话摘录 (用于高保真总结)')
  }),

  // 待处理队列 (Pending Tasks)
  // 当累计满 N 轮或时间跨度达标时，flag 变 true，触发额外 LLM 进行总结
  pending_tasks: z.object({
    daily_summary: z.boolean().describe('是否需要生成日报'),
    weekly_summary: z.boolean().describe('是否需要生成周报')
  }),

  // 时间锚点 (用于计算跨度)
  last_daily_summary_time: z.string(),
  last_weekly_summary_time: z.string()
});
```

### 3.2 运作流 (The Workflow)
1.  **Round (每轮)**: AI 生成 `current_round.summary`。
2.  **Daily Trigger (日结)**: 当 `WorldState.time` 跨越 00:00。
    *   触发 **Daily Summary Task**。
    *   额外 LLM 读取过去 24 小时的 `Round Summaries`。
    *   生成一份 **Daily Chronicle** (包含：时间/地点/核心事件/重要对话/氛围)。
    *   **写入 Worldbook**: 追加到 `[Log] Chronicle_Daily` 条目中。
    *   **清空**: 清空 MVU 里的 Round 记录。
3.  **Weekly Trigger (周结)**: 同理，读取 `[Log] Chronicle_Daily` 的内容，生成周报，写入 `[Log] Chronicle_Weekly`。

---

## 4. 玩家档案 (Player Profile)

**核心修正**: 聚焦“交互性”。

```typescript
export const PlayerSchema = z.object({
  // 基础身份 (可变，适应不同 Roleplay)
  identity: z.object({
    name: z.string(),
    codename: z.string(),
    race: z.string(),
    current_persona: z.string().describe('当前扮演的公开身份 (如 "罗德岛博士" 或 "过路商人")')
  }),

  // 资源 (Game-like stats)
  resources: z.object({
    sanity: z.number().min(0).max(135).describe('理智 (行动力)'),
    originium_shards: z.number().describe('源石碎片 (货币/制作材料)'),
    command_exp: z.number().describe('指挥经验 (用于解锁技能)')
  }),

  // 物品 (Inventory)
  inventory: z.record(z.string(), z.object({
    count: z.number(),
    desc: z.string(),
    effect: z.string().describe('使用效果 (Prompt 提示)')
  })),

  // 社交网络 (Social Graph)
  // 仅记录玩家视角的关键关系
  social_network: z.record(z.string(), z.object({
    relation_type: z.string().describe('关系类型 (盟友/中立/敌对)'),
    impression_level: z.number().describe('印象分')
  }))
});
```

---

## 5. 全局世界状态 (World State)

**核心修正**: 补全实体注册与时间增量。

```typescript
export const GlobalSchema = z.object({
  // 绝对时空
  time: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
  location: z.object({
    region: z.string(), // 国家
    node: z.string(),   // 城市/据点
    spot: z.string()    // 具体场所
  }),
  
  // 环境
  weather: z.string(),
  environment_status: z.string().describe('环境状态 (如 "源石粉尘弥漫", "静谧")'),

  // 实体注册表 (Entity Registry)
  // 解决 "Who is here?" 的查询问题，无需遍历所有角色变量
  presence: z.object({
    active_chars: z.array(z.string()).describe('当前在场角色列表'),
    nearby_chars: z.array(z.string()).describe('附近可感知的角色列表')
  }),

  // 时间流逝追踪
  time_flow: z.object({
    last_delta: z.string().describe('上一轮经过的时间'),
    total_turns: z.number()
  })
});
```

---

## 6. 总结 (Conclusion)

本设计完全抛弃了“大而全”的单一变量结构，转为：
1.  **独立的角色实例**: 支撑复杂的双向认知与记忆。
2.  **变量化的编年史状态**: 仅存指针，内容沉淀入 Worldbook，完美解决 Token 膨胀。
3.  **游戏化的玩家档案**: 聚焦于理智、资源与物品交互。

这是我对“旧项目逻辑”与“粥粥数据库深度”的最终融合理解。
