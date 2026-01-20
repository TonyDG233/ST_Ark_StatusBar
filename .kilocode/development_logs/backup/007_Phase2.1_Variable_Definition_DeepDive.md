# Phase 2.1: 变量定义深度复盘 (Variable Definition Deep Dive)

**日期**: 2026-01-18
**状态**: 深度设计 - 响应用户质疑
**目标**: 彻底解决“哪些内容要留下，哪些内容要删去”的平衡问题，形成最终的 Zod Schema。

---

## 1. 全局状态 (Global State) - 补全缺漏

**用户质疑**: 有什么关于世界基本状态的缺漏？

**设计修正**:
除了基础的时间/地点/天气，我们需要补充 **“实体注册表 (Entity Registry)”** 和 **“时间增量 (Time Delta)”**。
*   **Entity Registry**: 解决“在场人员不实时同步”的旧痛点。我们需要一个轻量级的 Set 来记录谁在场，而不是每次去遍历巨大的 Character Map。
*   **Time Delta**: 记录“距离上次更新过了多久”，方便脚本计算体力/心情的自然衰减。

```typescript
const GlobalState = z.object({
  // ... (原有时间/地点/天气)
  time: z.string(), // 绝对时间
  
  // [新增] 增量追踪
  delta: z.object({
    time_passed: z.string().describe('本轮经过的时间 (如 "15m")'),
    turn_count: z.number().int().default(0).describe('总轮次')
  }),

  // [新增] 场景注册表 (轻量级索引)
  scene: z.object({
    active_characters: z.array(z.string()).describe('当前在场的所有角色名 (含NPC与敌方)'),
    player_alias: z.string().default('博士').describe('玩家当前在剧情中的称呼')
  }),

  // 任务队列 (保持原案，用于触发脚本)
  tasks: z.object({
    // ...
  })
});
```

---

## 2. 角色数据 (Character Data) - 彻底重构

**用户质疑**:
*   忽略了无静态档案的情况。
*   记忆缺乏时间标签。
*   认知三维方向不明。
*   矿石病分级错误。

**设计修正**:
我们将角色数据拆分为 **`DynamicBase` (所有角色都有)** 和 **`StaticFull` (仅无卡角色有)**。

### 2.1 基础动态 (DynamicBase)
所有在场角色（无论是否有 Worldbook）都必须维护的部分。

```typescript
const CharacterDynamic = z.object({
  // [修正] 状态与感染
  status: z.object({
    physical: z.enum(['健康', '轻伤', '重伤', '濒死', '已死亡']),
    // 感染关注的是“社会待遇”而非病毒学
    infection_monitor: z.enum(['未公开', '非感染者', '体表结晶可见', '重度感染', '危殆']).describe('矿石病监视器读数/社会可视状态'),
    mood: z.number().min(-100).max(100),
    posture: z.string(),
    action: z.string()
  }),

  // [修正] 记忆系统 (带时间戳)
  memory: z.object({
    // 短期记忆流 (FIFO 队列, size=10)
    short_term: z.array(z.object({
      timestamp: z.string().describe('记录时间'),
      content: z.string().describe('记忆内容'),
      related_event_id: z.string().optional()
    })),
    // 长期记忆 (关键节点)
    long_term: z.array(z.object({
      title: z.string(),
      content: z.string(),
      date: z.string()
    }))
  }),

  // [修正] 认知三维 (双向映射)
  // Key = 对象名 (如 "Doctor", "Amiya", "Kal'tsit")
  cognition: z.record(z.string(), z.object({
    known: z.array(z.string()).describe('确信已知的情报'),
    unknown: z.array(z.string()).describe('意识到的盲区'),
    misconception: z.array(z.string()).describe('持有的误判'),
    trust: z.number().min(0).max(200).describe('对此人的信赖度')
  })),

  // [新增] 物品与战斗 (轻量化)
  inventory: z.record(z.string(), z.number()).describe('关键道具及其数量 (如 "源石爆破物": 1)'),
  combat: z.object({
    is_active: z.boolean(),
    style: z.string().describe('战斗风格简述'),
    power_level: z.string().describe('战力评级 (如 "精英/普通")')
  }).optional()
});
```

### 2.2 完整档案 (StaticFull) - 仅用于“无卡”角色
当检测到角色不在 Worldbook 中时，必须生成此结构并注入 Context。

```typescript
const CharacterFull = CharacterDynamic.extend({
  profile: z.object({
    name: z.string(),
    gender: z.string(),
    race: z.string(),
    appearance: z.string(), // 详细外貌
    background: z.string(), // 简要背景
    personality: z.string(),
    birthday: z.string(),
    origin: z.string() // 出身地
  }),
  // 技能与源石技艺
  skills: z.array(z.object({
    name: z.string(),
    type: z.enum(['源石技艺', '武技', '被动']),
    description: z.string()
  }))
});
```

---

## 3. 玩家档案 (Player Profile) - 交互核心

**用户质疑**: 完全没设计。

**设计修正**:
玩家档案必须是 **可交互** 的。去掉“势力”等虚的内容，聚焦于“我看得到、用得上”的数据。

```typescript
const PlayerData = z.object({
  // 基础显示
  profile: z.object({
    name: z.string().default('Doctor'),
    codename: z.string().default('Doctor'),
    race: z.string().default('未知'),
    appearance: z.string().optional()
  }),

  // 资源与背包 (强交互)
  inventory: z.record(z.string(), z.object({
    count: z.number(),
    description: z.string(),
    type: z.enum(['消耗品', '装备', '任务物品'])
  })),

  // 社交网络 (核心)
  social: z.record(z.string(), z.object({
    relation: z.string().describe('关系定义 (如 "盟友", "前下属")'),
    impression: z.string().describe('玩家对该角色的当前印象')
  })),

  // 技能/权能 (影响选项)
  skills: z.array(z.object({
    name: z.string(),
    cooldown: z.number().describe('剩余冷却轮数'),
    effect: z.string()
  })),
  
  // 状态
  sanity: z.number().min(0).max(135).describe('理智值'),
  command_points: z.number().min(0).max(99).describe('指挥点数 (Cost)')
});
```

---

## 4. 编年史系统 (Chronicle) - 变量化存储

**用户质疑**: 编年史只在工作流提到，没在变量里。

**设计修正**:
必须在变量里有一个缓冲区。我们不能每次都读写 Worldbook，那太慢了。MVU 变量作为“草稿箱”。

```typescript
const Chronicle = z.object({
  // 当前轮次的总结 (每轮覆盖)
  last_round_summary: z.string().describe('上一轮的剧情摘要'),
  
  // 待归档的日志缓冲区
  buffer: z.array(z.object({
    id: z.string(), // AMXX
    time_range: z.string(),
    location: z.string(),
    content: z.string(), // 纪要
    dialogue: z.array(z.string()), // 关键对话
    tags: z.array(z.string()) // 标签 (涉及人物/势力)
  })).describe('存储最近 10~20 轮的详细日志，满额后触发归档脚本写入 Worldbook'),

  // 当前大纲 (长期持有，用于 Context 注入)
  current_arc_outline: z.string().describe('当前剧情篇章的宏观大纲')
});
```

---

## 5. Token 经济性平衡 (Token Economy)

| 模块 | 存储策略 | 注入策略 | 经济性分析 |
| :--- | :--- | :--- | :--- |
| **Global** | 常驻 MVU | 始终注入 | 极低 (约 100 tokens) |
| **Known Char** | 仅存 Dynamic | 追加到 Worldbook | 低 (每个在场角色约 150 tokens) |
| **New Char** | Full Profile | 完整注入 | 高 (每个约 500 tokens) -> 需尽快转化为 Worldbook 条目 |
| **Chronicle** | Buffer + Outline | 仅注入 Outline + Last Summary | 中 (约 300 tokens) -> 避免了注入整个历史列表 |
| **Player** | 常驻 MVU | 始终注入 | 中 (约 300 tokens) -> 取决于背包大小 |

---

## 6. 下一步行动 (Immediate Actions)

1.  **创建 Schema 文件**: 将上述 TypeScript 定义写入 `src/ARK_STATUSBAR/schema.ts`。
2.  **设计 Prompt**: 基于上述结构，设计“破限预设”，教导额外 LLM 如何从文本中提取这些特定的 JSON 结构。
