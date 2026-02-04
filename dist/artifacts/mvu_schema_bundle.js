import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// --- Start of Bundled Schemas ---
// src/ARK_STATUSBAR/mvu/index.ts


// src/ARK_STATUSBAR/mvu/schemas/character.ts

var CognitionSchema = z.object({
  towards_player: z.object({
    trust: z.coerce.number().min(0).max(200).default(50).describe("对玩家的信任度 (0-200)"),
    attitude: z.string().default("中立").describe("对玩家的当前态度"),
    known_facts: z.array(z.string()).max(5).default([]).describe("角色确信的关于玩家的事实"),
    unknown_facts: z.array(z.string()).max(5).default([]).describe("角色意识到自己不知道的关于玩家的关键信息"),
    misconceptions: z.array(z.string()).max(5).default([]).describe("角色对玩家的错误认知")
  }).describe("角色视角 -> 玩家"),
  from_player: z.object({
    unlocked_secrets: z.array(z.string()).default([]).describe("玩家已获知的该角色的秘密/关键情报 (由LLM判断剧情进展写入)"),
    misconceptions: z.array(z.string()).max(5).default([]).describe("玩家对该角色的错误认知")
  }).describe("玩家视角 -> 角色")
});
var MemorySchema = z.object({
  short_term_buffer: z.array(
    z.object({
      time: z.string().describe("记忆发生的时间"),
      content: z.string()
    })
  ).max(12).default([]).describe("短期记忆缓冲区。当达到12条时，脚本将提取最早的6条生成长期记忆，并保留后6条。"),
  long_term: z.array(
    z.object({
      title: z.string().describe("长期记忆的标题"),
      summary: z.string().describe("对一系列短期记忆的总结"),
      time_span: z.tuple([z.string(), z.string()]).describe("记忆发生的时间范围"),
      impact: z.string().describe("该记忆对角色的影响")
    })
  ).default([]).describe("长期记忆库")
});
var MaintenanceSchema = z.object({
  _internal: z.object({
    turns_since_last_update: z.number().int().default(0).describe("距离上次被LLM主动更新的轮次")
  })
});
var CharacterSchema = z.intersection(
  z.object({
    // 静态档案数据 (非 optional，保证动态角色档案完整性)
    profile: z.object({
      name: z.string(),
      gender: z.string(),
      race: z.string(),
      appearance: z.string(),
      background: z.string(),
      personality: z.string(),
      infection_status: z.enum(["非感染者", "感染者", "未公开"])
    }),
    skills: z.record(z.string(), z.string().describe("技能描述")).default({}),
    // 动态数据
    status: z.object({
      location: z.string().describe("当前所在精确位置"),
      posture: z.string().describe("姿势"),
      action: z.string().describe("正在进行的动作"),
      mood: z.coerce.number().min(-100).max(100).describe("情绪值"),
      attire: z.string().describe("当前着装")
    }),
    cognition: CognitionSchema,
    memory: MemorySchema,
    combat: z.object({
      power_level_desc: z.string().default("未评估").describe("基于28级战力标准的文字描述 (如: 层级13-上位王牌战力)")
    }),
    notes: z.record(z.string(), z.string()).default({}).describe("关于该角色的杂项记录"),
    // 类型标志 (由后端脚本维护)
    has_static_profile: z.boolean().default(false).describe("该角色的档案是否存在于世界书中")
  }),
  MaintenanceSchema
);

// src/ARK_STATUSBAR/mvu/schemas/chronicle.ts

var StatusUpdateSchema = z.object({
  characters: z.record(z.string(), z.string().describe("角色名 -> 状态/关系/认知的变化")).optional(),
  factions: z.record(z.string(), z.string().describe("势力名 -> 状态/外交的变化")).optional(),
  quests: z.record(z.string(), z.string().describe("任务名 -> 进度/结果")).optional(),
  unresolved: z.array(z.string()).describe("在此期间产生或遗留的谜团/问题").optional()
});
var EventNodeSchema = z.object({
  time: z.string().describe("事件发生的时间"),
  location: z.string().optional().describe("事件发生的地点"),
  description: z.string().describe("事件描述")
});
var RoundSummarySchema = z.object({
  id: z.string().describe("UUID"),
  time: z.string().describe("YYYY-MM-DD HH:mm"),
  location: z.string(),
  headline: z.string().describe("本轮核心事件的简短标题"),
  content: z.string().describe("详细的事件描述"),
  key_dialogue: z.array(z.string()).max(3).describe("关键对话摘录"),
  tags: z.array(z.string()).describe("事件标签 (e.g., Combat, Exploration, Social)")
});
var TenRoundSummarySchema = z.object({
  id: z.string().describe("UUID"),
  time_span: z.tuple([z.string(), z.string()]).describe("[Start, End]"),
  headline: z.string().describe("这十轮的阶段性标题"),
  content: z.string().describe("这十轮的剧情综述"),
  key_events: z.array(EventNodeSchema).describe("关键节点列表"),
  updates: StatusUpdateSchema.describe("这十轮内的状态变化"),
  source_rounds: z.array(z.string()).describe("包含的Round ID列表 (仅存ID引用)")
});
var DailySummarySchema = z.object({
  id: z.string().describe("UUID"),
  date: z.string().describe("YYYY-MM-DD"),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe("本日头条"),
  content: z.string().describe("本日剧情综述"),
  key_events: z.array(EventNodeSchema).describe("本日关键事件详情"),
  updates: StatusUpdateSchema.describe("本日产生的状态变化"),
  source_summaries: z.array(z.string()).describe("包含的TenRoundSummary ID列表")
});
var WeeklySummarySchema = z.object({
  id: z.string().describe("UUID"),
  week: z.string().describe("YYYY-Www"),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe("本周主题"),
  content: z.string().describe("本周剧情综述"),
  key_events: z.array(EventNodeSchema).describe("本周发生的关键事件节点"),
  updates: StatusUpdateSchema.describe("本周产生的长远影响"),
  source_summaries: z.array(z.string()).describe("包含的DailySummary ID列表")
});
var MonthlySummarySchema = z.object({
  id: z.string().describe("UUID"),
  month: z.string().describe("YYYY-MM"),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe("本月主题"),
  content: z.string().describe("本月剧情综述"),
  key_events: z.array(EventNodeSchema).describe("本月发生的战略级事件节点"),
  updates: StatusUpdateSchema.describe("本月产生的战略影响"),
  source_summaries: z.array(z.string()).describe("包含的WeeklySummary ID列表")
});
var YearlySummarySchema = z.object({
  id: z.string().describe("UUID"),
  year: z.string().describe("YYYY"),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe("年度史诗主题"),
  content: z.string().describe("年度剧情综述"),
  key_events: z.array(EventNodeSchema).describe("年度里程碑事件列表"),
  updates: StatusUpdateSchema.describe("年度世界格局变化"),
  source_summaries: z.array(z.string()).describe("包含的MonthlySummary ID列表")
});
var ChronicleSchema = z.object({
  // 缓冲区 (Buffers)
  round_buffer: z.array(RoundSummarySchema).max(50).describe("轮次总结缓冲区"),
  small_summary_buffer: z.array(TenRoundSummarySchema).describe("十轮小结缓冲区"),
  daily_summary_buffer: z.array(DailySummarySchema).describe("每日总结缓冲区"),
  weekly_summary_buffer: z.array(WeeklySummarySchema).describe("每周总结缓冲区"),
  monthly_summary_buffer: z.array(MonthlySummarySchema).describe("每月总结缓冲区"),
  yearly_summary_buffer: z.array(YearlySummarySchema).describe("年度总结缓冲区"),
  // 系统状态
  system: z.object({
    is_processing: z.boolean().default(false)
  })
});

// src/ARK_STATUSBAR/mvu/schemas/global.ts

var TaskQueueSchema = z.array(
  z.object({
    id: z.string(),
    type: z.enum([
      // Character tasks
      "init_profile",
      "repair_profile",
      "summarize_memory",
      // Player tasks
      "init_player_profile",
      "repair_player_profile",
      // Chronicle tasks
      "ten_round_summary",
      "daily_summary",
      "weekly_summary",
      "monthly_summary",
      "yearly_summary",
      "repair_chronicle"
    ]),
    priority: z.number().int(),
    target_char: z.string().describe('任务目标，可以是角色名、"player"或"chronicle"').optional(),
    payload: z.any().describe("任务所需的上下文数据")
  })
).describe("待处理的全局统一任务队列");
var GlobalStateSchema = z.object({
  // 时间
  time: z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式: YYYY-MM-DD HH:mm:ss").describe("游戏世界的核心时间，由后端脚本根据AI输出自动推进"),
  // 地点
  location: z.object({
    region: z.string().describe("国家/大区"),
    city: z.string().describe("城市"),
    area: z.string().describe("区域"),
    spot: z.string().describe("具体位置")
  }).describe("描述角色当前所在的四维地点"),
  // 环境
  weather: z.string().describe("当前天气状况"),
  environment_status: z.string().describe("对周围环境的感官描述"),
  // 在场实体注册表 (由后端脚本维护)
  presence: z.object({
    active_chars: z.array(z.string()).describe("当前在场并参与交互的角色列表"),
    nearby_chars: z.array(z.string()).describe("附近可被感知但未直接交互的角色")
  }).describe("由后端脚本根据AI输出来维护，用于触发角色初始化和离线更新"),
  // 游戏进程计数器 (由后端脚本维护)
  game_progress: z.object({
    total_turns: z.number().int().default(0).describe("总交互轮次，用于触发周期性事件")
  }).describe("由后端脚本在每轮交互后自动递增"),
  // 内部配置与状态 (新增强制性字段)
  _internal: z.object({
    backend_logic_enabled: z.boolean().default(true).describe("是否启用后端逻辑脚本"),
    session_started: z.boolean().default(false).describe("会话是否已由用户通过发送第一条消息来启动")
  }).describe("供UI使用的持久化设置或内部状态的统一注入路径")
});

// src/ARK_STATUSBAR/mvu/schemas/player.ts

var ProfileSchema = z.object({
  name: z.string().describe("代号/姓名"),
  gender: z.string().describe("性别"),
  age: z.string().describe("年龄/生理年龄"),
  race: z.string().describe("种族"),
  appearance: z.string().describe("外貌特征描述 (发色、瞳色、身高、体型等)"),
  background: z.string().describe("背景故事/身份起源"),
  personality: z.string().describe("性格特征"),
  infection_status: z.enum(["非感染者", "感染者", "未公开"]).describe("矿石病感染状况")
});
var AttributeLevel = z.enum(["缺陷", "普通", "标准", "优良", "卓越", "???", "■■"]).describe("属性评级");
var AttributesSchema = z.object({
  physical_strength: AttributeLevel.describe("物理强度"),
  mobility: AttributeLevel.describe("战场机动"),
  physiological_endurance: AttributeLevel.describe("生理耐受"),
  tactical_planning: AttributeLevel.describe("战术规划"),
  combat_skill: AttributeLevel.describe("战斗技巧"),
  originium_arts_adaptability: AttributeLevel.describe("源石技艺适应性"),
  power_level_desc: z.string().default("未评估").describe("基于28级战力标准的文字描述 (如: 层级0-平民, 层级5-上位战场中坚)")
});
var SkillsSchema = z.record(
  z.string(),
  z.object({
    type: z.enum(["源石技艺", "武技", "指挥技能", "生活技能", "被动天赋", "特殊能力", "其他"]).describe("技能类型"),
    description: z.string().describe("技能效果描述"),
    proficiency: z.string().optional().describe("熟练度")
  })
).describe("玩家掌握的技能列表").default({});
var InventorySchema = z.object({
  items: z.record(
    z.string(),
    z.object({
      count: z.number().int().min(0),
      description: z.string().describe("物品描述/用途"),
      status: z.string().optional().describe("状态 (如: 已损坏, 剩余50%)")
    })
  ).describe("背包物品").default({}),
  equipment: z.object({
    main_hand: z.string().optional().describe("主手武器/装备"),
    off_hand: z.string().optional().describe("副手武器/装备"),
    outerwear: z.string().describe("外装/护甲 (如: 战术背心, 防寒大衣)"),
    innerwear: z.string().describe("内装/常服 (如: 罗德岛制服, JK制服)"),
    accessories: z.array(z.string()).describe("饰品/挂件").default([])
  }).describe("当前装备")
});
var SocialSchema = z.record(
  z.string(),
  z.object({
    relation: z.string().describe("关系描述 (如: 盟友, 敌人, 陌生人)"),
    trust: z.coerce.number().min(0).max(200).default(50).describe("玩家对该角色的信任度"),
    impressions: z.array(z.string()).max(5).describe("对该角色的印象标签 (如: 可靠, 危险)"),
    notes: z.string().optional().describe("特殊备注")
  })
).describe("玩家与其他角色的关系网").default({});
var StatusSchema = z.object({
  mood: z.number().min(-100).max(100).default(0).describe("情绪值"),
  physiological_state: z.array(z.string()).describe("生理状态标签 (如: 健康, 轻伤, 疲劳, 感染抑制中)"),
  current_action: z.string().describe("当前正在进行的动作")
});
var PlayerSchema = z.object({
  profile: ProfileSchema,
  attributes: AttributesSchema,
  skills: SkillsSchema,
  inventory: InventorySchema,
  social: SocialSchema,
  status: StatusSchema
});

// src/ARK_STATUSBAR/mvu/index.ts
var Schema = z.object({
  global: GlobalStateSchema,
  characters: z.record(z.string(), CharacterSchema),
  player: PlayerSchema,
  chronicle: ChronicleSchema,
  task_queue: TaskQueueSchema
});
// --- End of Bundled Schemas ---

$(() => {
  if (typeof Schema !== 'undefined') {
    console.log('Registering MVU Schema...');
    registerMvuSchema(Schema);
    console.log('✅ MVU Schema registered.');
  } else {
    console.error('❌ Schema variable is undefined. Check bundle logic.');
  }
});