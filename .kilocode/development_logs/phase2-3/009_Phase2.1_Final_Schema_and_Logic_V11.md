# Phase 2.1: 最终变量结构与逻辑定义 (Final Schema & Logic)

**日期**: 2026-01-18
**状态**: 最终版 (V11)
**目标**: 定义最终的 Zod Schema，并阐明其背后的脚本处理逻辑。

---

## 1. 顶层结构 (Root Schema)

```typescript
import { z } from 'zod';
import { GlobalStateSchema } from './schemas/global';
import { PlayerSchema } from './schemas/player';
import { CharacterSchema } from './schemas/character';
import { ChronicleSchema } from './schemas/chronicle';

export const RootSchema = z.object({
  global: GlobalStateSchema,
  player: PlayerSchema,
  characters: z.record(z.string().describe('角色唯一名称'), CharacterSchema),
  chronicle: ChronicleSchema
});
```

---

## 2. 全局状态 (`schemas/global.ts`)

```typescript
import { z } from 'zod';

export const GlobalStateSchema = z.object({
  // 时间 (兼容万年)
  time: z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式: YYYY-MM-DD HH:mm:ss"),
  
  // 地点 (四维)
  location: z.object({
    region: z.string().describe('国家/大区'),
    city: z.string().describe('城市'),
    area: z.string().describe('区域'),
    spot: z.string().describe('具体位置')
  }),
  
  // 环境
  weather: z.string(),
  environment_status: z.string(),

  // 实体注册表 (由脚本维护)
  presence: z.object({
    active_chars: z.array(z.string()).describe('当前在场角色列表'),
    nearby_chars: z.array(z.string()).describe('附近可感知角色')
  }),

  // 游戏进程计数器 (由脚本维护)
  game_progress: z.object({
    total_turns: z.number().int().default(0)
  })
});
```

---

## 3. 角色数据 (`schemas/character.ts`)

### 3.1 核心定义
```typescript
import { z } from 'zod';

const CognitionSchema = z.object({
  towards_player: z.object({
    trust: z.number().min(0).max(200).default(50),
    attitude: z.string().default('中立'),
    known_facts: z.array(z.string()).max(5),
    unknown_secrets: z.array(z.string()).max(5),
    misconceptions: z.array(z.string()).max(5)
  }),
  from_player: z.object({
    unlocked_records: z.array(z.string()),
    misconceptions: z.array(z.string()).max(5)
  })
});

const MemorySchema = z.object({
  short_term_buffer: z.array(z.object({ time: z.string(), content: z.string() })).max(12),
  long_term: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    time_span: z.tuple([z.string(), z.string()]),
    impact: z.string()
  }))
});

const CharacterDynamicSchema = z.object({
  status: z.object({
    location: z.string(),
    posture: z.string(),
    action: z.string(),
    mood: z.number().min(-100).max(100),
    attire: z.string()
  }),
  cognition: CognitionSchema,
  memory: MemorySchema,
  combat: z.object({ power_level: z.string().default('未评估') }),
  notes: z.record(z.string(), z.string())
});

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
  skills: z.array(z.object({ name: z.string(), type: z.string(), description: z.string() }))
});

export const CharacterSchema = z.discriminatedUnion('has_static_profile', [
  z.object({ has_static_profile: z.literal(true), data: CharacterDynamicSchema }),
  z.object({ has_static_profile: z.literal(false), data: CharacterFullSchema })
]);
```

### 3.2 脚本处理逻辑 (伪代码)
```typescript
// in: onVariableUpdateEnded(variables)
function handleCharacterInitialization(variables) {
  const newCharNames = findNewCharactersIn(variables.global.presence.active_chars);
  if (newCharNames.length > 0) {
    // 1. 推送初始化任务
    pushTaskToQueue('char_init', { names: newCharNames }); 
  }

  // 2. 接收 AI 生成的完整数据
  const generatedData = getGeneratedDataFor('char_init');
  if (generatedData) {
    for (const charData of generatedData) {
      // 3. 搜索静态档案
      const hasStaticFile = await worldbook.exists(charData.profile.name);
      
      if (hasStaticFile) {
        // 4a. 剥离动态数据并存储
        const dynamicData = extractDynamicData(charData);
        variables.characters[charData.profile.name] = {
          has_static_profile: true,
          data: dynamicData
        };
      } else {
        // 4b. 存储完整数据
        variables.characters[charData.profile.name] = {
          has_static_profile: false,
          data: charData
        };
      }
    }
  }
}
```

---

## 4. 编年史系统 (`schemas/chronicle.ts`)

### 4.1 核心定义
```typescript
import { z } from 'zod';

const RoundSummarySchema = z.object({
  id: z.string(), time: z.string(), location: z.string(),
  summary: z.string(), key_dialogue: z.array(z.string()), tags: z.array(z.string())
});

const TenRoundSummarySchema = z.object({
  time_span: z.tuple([z.string(), z.string()]),
  key_events: z.array(z.string()),
  character_moments: z.record(z.string(), z.string())
});

const DailySummarySchema = z.object({
  date: z.string(),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string(),
  included_summaries: z.array(TenRoundSummarySchema), // 包含的小总结
  major_events_details: z.array(z.object({ time: z.string(), location: z.string(), description: z.string() })),
  character_updates: z.record(z.string(), z.string()),
  unresolved_threads: z.array(z.string())
});

export const ChronicleSchema = z.object({
  round_buffer: z.array(RoundSummarySchema).max(12),
  small_summary_buffer: z.array(TenRoundSummarySchema),
  last_daily: DailySummarySchema.optional(),
  tasks: z.object({
    needs_ten_round_summary: z.boolean().default(false),
    needs_daily_summary: z.boolean().default(false)
  })
});
```

### 4.2 脚本处理逻辑 (伪代码)
```typescript
// in: onVariableUpdateEnded(variables)
function handleChronicleTasks(variables) {
  const chronicle = variables.chronicle;
  const oldTime = getOldTime();
  const newTime = variables.global.time;

  // 1. 检查 10 轮小总结
  if (chronicle.round_buffer.length >= 10 && !chronicle.tasks.needs_ten_round_summary) {
    chronicle.tasks.needs_ten_round_summary = true;
    console.log("Triggered: 10-Round Summary Task");
  }

  // 2. 检查日报
  if (getDate(oldTime) !== getDate(newTime) && !chronicle.tasks.needs_daily_summary) {
    chronicle.tasks.needs_daily_summary = true;
    console.log("Triggered: Daily Summary Task");
  }

  // 更高层级的检查逻辑...
}
```

---

## 5. 玩家档案 (`schemas/player.ts`)

```typescript
import { z } from 'zod';

export const PlayerSchema = z.object({
  // Profile (字段分离)
  profile: z.object({
    name: z.string(),
    gender: z.string(),
    age: z.string(),
    race: z.string(),
    appearance: z.string(),
    background: z.string(),
    attire: z.string()
  }),
  
  // 战力 (统一标准)
  combat: z.object({
      power_level: z.string().default('未评估').describe('28级战力评级')
  }),
  
  // 技能
  skills: z.record(z.string(), z.object({
    type: z.string(),
    effect: z.string()
  })),
  
  // 物品
  inventory: z.record(z.string(), z.object({
    quantity: z.number().int(),
    description: z.string(),
    notes: z.string().optional()
  })),
  
  // 社交 (混合模式)
  social: z.record(z.string(), z.object({
      relation: z.string(),
      trust: z.number().min(0).max(200).default(50)
  })),
  
  // 备注
  notes: z.record(z.string(), z.string())
});