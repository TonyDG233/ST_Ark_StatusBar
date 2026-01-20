# Phase 2.1: 最终变量结构定义提案 V10 (Final Schema Proposal V10)

**日期**: 2026-01-18
**状态**: 最终提案 (基于 V10 思路)
**目标**: 创建一份完整、无省略、可直接转换为 Zod 代码的变量结构定义。

---

## 1. 顶层结构 (Root Schema)

```typescript
import { z } from 'zod';

// 引入所有子模块的 Schema 定义
import { GlobalStateSchema } from './schemas/global';
import { PlayerSchema } from './schemas/player';
import { CharacterSchema } from './schemas/character';
import { ChronicleSchema } from './schemas/chronicle';

export const RootSchema = z.object({
  // 全局世界状态
  global: GlobalStateSchema,

  // 玩家档案
  player: PlayerSchema,
  
  // 角色目录 (Map<CharacterName, CharacterData>)
  characters: z.record(z.string().describe('角色唯一名称'), CharacterSchema),

  // 编年史系统
  chronicle: ChronicleSchema
});
```

---

## 2. 全局状态 (`schemas/global.ts`)

```typescript
import { z } from 'zod';

export const GlobalStateSchema = z.object({
  // 绝对时空 (兼容万年)
  time: z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式必须是 YYYY-MM-DD HH:mm:ss"),
  
  // 地点四维
  location: z.object({
    region: z.string().describe('国家/大区 (如 "维多利亚")'),
    city: z.string().describe('城市 (如 "伦蒂尼姆")'),
    area: z.string().describe('区域 (如 "白金汉宫")'),
    spot: z.string().describe('具体位置 (如 "王座厅")')
  }),
  
  // 环境
  weather: z.string().describe('天气状况 (如 "阴云密布")'),
  environment_status: z.string().describe('环境状态 (如 "源石粉尘弥漫", "静谧")'),

  // 实体注册表 (由脚本维护)
  presence: z.object({
    active_chars: z.array(z.string()).describe('当前在场角色列表 (包含玩家、NPC、敌方)'),
    nearby_chars: z.array(z.string()).describe('附近可感知但未直接在场的角色')
  }),

  // 游戏进程计数器 (由脚本维护)
  game_progress: z.object({
    total_turns: z.number().int().default(0).describe('总对话轮次计数')
  })
});
```

---

## 3. 角色数据 (`schemas/character.ts`)

```typescript
import { z } from 'zod';

// --- 认知模块 ---
const CognitionSchema = z.object({
  // NPC 对 玩家 的认知
  towards_player: z.object({
    trust: z.number().min(0).max(200).default(50).describe('信赖度'),
    attitude: z.string().default('中立').describe('当前态度短语'),
    known_facts: z.array(z.string()).max(5).describe('确信已知的玩家情报'),
    unknown_secrets: z.array(z.string()).max(5).describe('想知道的玩家秘密 (盲区)'),
    misconceptions: z.array(z.string()).max(5).describe('对玩家的错误判断 (误区)')
  }),
  // 玩家 对 NPC 的认知
  from_player: z.object({
    unlocked_records: z.array(z.string()).describe('玩家已解锁的该角色档案条目'),
    misconceptions: z.array(z.string()).max(5).describe('玩家可能存在的误解')
  })
});

// --- 记忆模块 ---
const MemorySchema = z.object({
  short_term_buffer: z.array(z.object({
    time: z.string(),
    content: z.string(),
  })).max(12).describe('短期记忆流 (FIFO 队列, size=12)'),
  
  long_term: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    time_span: z.tuple([z.string(), z.string()]).describe('[开始时间戳, 结束时间戳]'),
    impact: z.string().describe('对角色的深远影响')
  }))
});

// --- 基础动态 (所有角色都拥有) ---
const CharacterDynamicSchema = z.object({
  status: z.object({
    location: z.string(),
    posture: z.string(),
    action: z.string(),
    mood: z.number().min(-100).max(100),
    attire: z.string().describe('当前着装')
  }),
  cognition: CognitionSchema,
  memory: MemorySchema,
  combat: z.object({
    power_level: z.string().default('未评估').describe('28级战力评级')
  }),
  notes: z.record(z.string(), z.string()).describe('Key: 备注标题, Value: 备注内容')
});

// --- 完整档案 (仅用于无静态 Worldbook 的角色) ---
const CharacterFullSchema = CharacterDynamicSchema.extend({
  profile: z.object({
    name: z.string(),
    gender: z.string(),
    race: z.string(),
    appearance: z.string(),
    background: z.string(),
    personality: z.string(),
    infection_status: z.enum(['非感染者', '感染者', '未公开']).describe('矿石病社会身份')
  }),
  skills: z.array(z.object({
    name: z.string(),
    type: z.string(),
    description: z.string()
  }))
});

// --- 最终角色 Schema ---
// 脚本将根据 has_static_profile 决定存储策略
export const CharacterSchema = z.discriminatedUnion('has_static_profile', [
  z.object({
    has_static_profile: z.literal(true),
    data: CharacterDynamicSchema
  }),
  z.object({
    has_static_profile: z.literal(false),
    data: CharacterFullSchema
  })
]);
```

---

## 4. 编年史系统 (`schemas/chronicle.ts`)

```typescript
import { z } from 'zod';

// --- 单轮总结 (Buffer 元素) ---
const RoundSummarySchema = z.object({
  id: z.string().describe('唯一ID, 格式 AMXX'),
  time: z.string().describe('绝对时间戳'),
  location: z.string().describe('发生地点 (四维)'),
  summary: z.string().describe('本轮纪要'),
  key_dialogue: z.array(z.string()).describe('关键对话摘录'),
  tags: z.array(z.string()).describe('涉及人物/事件标签')
});

// --- 日报结构 ---
const DailySummarySchema = z.object({
  date: z.string().describe('日期, 格式 YYYY-MM-DD'),
  time_span: z.tuple([z.string(), z.string()]).describe('[开始时间戳, 结束时间戳]'),
  headline: z.string().describe('本日头条/核心事件'),
  major_events: z.array(z.object({
    time: z.string(),
    location: z.string(),
    description: z.string()
  })).describe('主要事件列表'),
  character_updates: z.record(z.string(), z.string()).describe('Key: 角色名, Value: 该角色的关键变化'),
  unresolved_threads: z.array(z.string()).describe('遗留的悬念或问题')
});

// 更高层级的可以类似定义...
const WeeklySummarySchema = DailySummarySchema.extend({ /* ... more fields ... */ });

export const ChronicleSchema = z.object({
  // Buffer - 存放最近 12 轮的详细记录
  round_buffer: z.array(RoundSummarySchema).max(12),
  
  // 各层级总结 (只存最新的一条，旧的由脚本归档到 Worldbook)
  last_daily: DailySummarySchema.optional(),
  last_weekly: WeeklySummarySchema.optional(),
  
  // 任务触发器 (由脚本维护)
  tasks: z.object({
    needs_ten_round_summary: z.boolean().default(false),
    needs_daily_summary: z.boolean().default(false),
    needs_weekly_summary: z.boolean().default(false)
  })
});
```

---

## 5. 玩家档案 (`schemas/player.ts`)

```typescript
import { z } from 'zod';

export const PlayerSchema = z.object({
  // 核心身份 (Profile)
  profile: z.object({
    name: z.string().describe('玩家设定的角色名'),
    gender: z.string(),
    age: z.string(),
    race: z.string(),
    appearance: z.string().describe('外貌特征'),
    background: z.string().describe('背景故事'),
    attire: z.string().describe('当前衣着')
  }),
  
  // 战力 (统一采用28级战力表)
  combat: z.object({
      power_level: z.string().default('未评估').describe('28级战力评级')
  }),
  
  // 技能 (Key = 技能名)
  skills: z.record(z.string(), z.object({
    type: z.string().describe('如: "源石技艺/治疗"'),
    effect: z.string().describe('技能效果描述')
  })),
  
  // 物品 (Key = 物品名)
  inventory: z.record(z.string(), z.object({
    quantity: z.number().int(),
    description: z.string(),
    notes: z.string().optional()
  })),
  
  // 社交 (Key = 角色名, 混合模式)
  social: z.record(z.string(), z.object({
      relation: z.string().describe('关系定义, 如 "可靠的战友"'),
      trust: z.number().min(0).max(200).default(50).describe('信赖度 (可用于脚本判断)')
  })),
  
  // 备注 (Key = 备注标题)
  notes: z.record(z.string(), z.string())
});