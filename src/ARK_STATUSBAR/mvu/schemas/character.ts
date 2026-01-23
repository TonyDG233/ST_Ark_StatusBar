import { z } from 'zod';

// 认知模块：角色对玩家的看法，以及玩家掌握的角色情报
const CognitionSchema = z.object({
  towards_player: z
    .object({
      trust: z.coerce.number().min(0).max(200).default(50).describe('对玩家的信任度 (0-200)'),
      attitude: z.string().default('中立').describe('对玩家的当前态度'),
      known_facts: z.array(z.string()).max(5).default([]).describe('角色确信的关于玩家的事实'),
      unknown_facts: z.array(z.string()).max(5).default([]).describe('角色意识到自己不知道的关于玩家的关键信息'),
      misconceptions: z.array(z.string()).max(5).default([]).describe('角色对玩家的错误认知'),
    })
    .describe('角色视角 -> 玩家'),

  from_player: z
    .object({
      unlocked_secrets: z
        .array(z.string())
        .default([])
        .describe('玩家已获知的该角色的秘密/关键情报 (由LLM判断剧情进展写入)'),
      misconceptions: z.array(z.string()).max(5).default([]).describe('玩家对该角色的错误认知'),
    })
    .describe('玩家视角 -> 角色'),
});

// 记忆模块：FIFO 队列逻辑
const MemorySchema = z.object({
  short_term_buffer: z
    .array(
      z.object({
        time: z.string().describe('记忆发生的时间'),
        content: z.string(),
      }),
    )
    .max(12)
    .default([])
    .describe('短期记忆缓冲区。当达到12条时，脚本将提取最早的6条生成长期记忆，并保留后6条。'),
  long_term: z
    .array(
      z.object({
        title: z.string().describe('长期记忆的标题'),
        summary: z.string().describe('对一系列短期记忆的总结'),
        time_span: z.tuple([z.string(), z.string()]).describe('记忆发生的时间范围'),
        impact: z.string().describe('该记忆对角色的影响'),
      }),
    )
    .default([])
    .describe('长期记忆库'),
});

// 角色的动态数据
const CharacterDynamicSchema = z.object({
  status: z.object({
    location: z.string().describe('当前所在精确位置'),
    posture: z.string().describe('姿势'),
    action: z.string().describe('正在进行的动作'),
    mood: z.coerce.number().min(-100).max(100).describe('情绪值'),
    attire: z.string().describe('当前着装'),
  }),
  cognition: CognitionSchema,
  memory: MemorySchema,
  combat: z.object({
    // 提示词需强调：基于 references/tools/明日方舟/战力分级标准.yaml 判断
    power_level_desc: z.string().default('未评估').describe('基于28级战力标准的文字描述 (如: 层级13-上位王牌战力)'),
  }),
  notes: z.record(z.string(), z.string()).default({}).describe('关于该角色的杂项记录'),
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
    infection_status: z.enum(['非感染者', '感染者', '未公开']),
  }),
  skills: z.record(z.string(), z.string().describe('技能描述')).default({}),
});

// 维护任务队列 (全局维护，不再存储于角色内部)
const MaintenanceSchema = z.object({
  _internal: z.object({
    turns_since_last_update: z.number().int().default(0).describe('距离上次被LLM主动更新的轮次'),
  }),
});

export const CharacterSchema = z.intersection(
  z.discriminatedUnion('has_static_profile', [
    z.object({ has_static_profile: z.literal(true), data: CharacterDynamicSchema }),
    z.object({ has_static_profile: z.literal(false), data: CharacterFullSchema }),
  ]),
  MaintenanceSchema,
);

// Task Queue has been moved to global.ts
