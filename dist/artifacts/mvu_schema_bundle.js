import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';
"use strict";
var MVUSchemas = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/ARK_STATUSBAR/mvu/index.ts
  var index_exports = {};
  __export(index_exports, {
    Schema: () => Schema
  });
  var import_zod5 = __require("zod");

  // src/ARK_STATUSBAR/mvu/schemas/character.ts
  var import_zod = __require("zod");
  var CognitionSchema = import_zod.z.object({
    towards_player: import_zod.z.object({
      trust: import_zod.z.coerce.number().min(0).max(200).default(50).describe("对玩家的信任度 (0-200)"),
      attitude: import_zod.z.string().default("中立").describe("对玩家的当前态度"),
      known_facts: import_zod.z.array(import_zod.z.string()).max(5).describe("角色确信的关于玩家的事实"),
      unknown_facts: import_zod.z.array(import_zod.z.string()).max(5).describe("角色意识到自己不知道的关于玩家的关键信息"),
      misconceptions: import_zod.z.array(import_zod.z.string()).max(5).describe("角色对玩家的错误认知")
    }).describe("角色视角 -> 玩家"),
    from_player: import_zod.z.object({
      unlocked_secrets: import_zod.z.array(import_zod.z.string()).describe("玩家已获知的该角色的秘密/关键情报 (由LLM判断剧情进展写入)"),
      misconceptions: import_zod.z.array(import_zod.z.string()).max(5).describe("玩家对该角色的错误认知")
    }).describe("玩家视角 -> 角色")
  });
  var MemorySchema = import_zod.z.object({
    short_term_buffer: import_zod.z.array(import_zod.z.object({
      turn: import_zod.z.number().int(),
      content: import_zod.z.string()
    })).max(12).describe("短期记忆缓冲区。当达到12条时，脚本将提取最早的6条生成长期记忆，并保留后6条。"),
    long_term: import_zod.z.array(import_zod.z.object({
      title: import_zod.z.string().describe("长期记忆的标题"),
      summary: import_zod.z.string().describe("对一系列短期记忆的总结"),
      time_span: import_zod.z.tuple([import_zod.z.string(), import_zod.z.string()]).describe("记忆发生的时间范围"),
      impact: import_zod.z.string().describe("该记忆对角色的影响")
    })).describe("长期记忆库")
  });
  var CharacterDynamicSchema = import_zod.z.object({
    status: import_zod.z.object({
      location: import_zod.z.string().describe("当前所在精确位置"),
      posture: import_zod.z.string().describe("姿势"),
      action: import_zod.z.string().describe("正在进行的动作"),
      mood: import_zod.z.coerce.number().min(-100).max(100).describe("情绪值"),
      attire: import_zod.z.string().describe("当前着装")
    }),
    cognition: CognitionSchema,
    memory: MemorySchema,
    combat: import_zod.z.object({
      // 提示词需强调：基于 references/tools/明日方舟/战力分级标准.yaml 判断
      power_level_desc: import_zod.z.string().default("未评估").describe("基于28级战力标准的文字描述 (如: 层级13-上位王牌战力)")
    }),
    notes: import_zod.z.record(import_zod.z.string(), import_zod.z.string()).describe("关于该角色的杂项记录")
  });
  var CharacterFullSchema = CharacterDynamicSchema.extend({
    profile: import_zod.z.object({
      name: import_zod.z.string(),
      gender: import_zod.z.string(),
      race: import_zod.z.string(),
      appearance: import_zod.z.string(),
      background: import_zod.z.string(),
      personality: import_zod.z.string(),
      infection_status: import_zod.z.enum(["非感染者", "感染者", "未公开"])
    }),
    skills: import_zod.z.record(import_zod.z.string(), import_zod.z.string().describe("技能描述"))
  });
  var MaintenanceSchema = import_zod.z.object({
    _internal: import_zod.z.object({
      last_update_turn: import_zod.z.number().int().default(0).describe("最后更新轮次")
    })
  });
  var CharacterSchema = import_zod.z.intersection(
    import_zod.z.discriminatedUnion("has_static_profile", [
      import_zod.z.object({ has_static_profile: import_zod.z.literal(true), data: CharacterDynamicSchema }),
      import_zod.z.object({ has_static_profile: import_zod.z.literal(false), data: CharacterFullSchema })
    ]),
    MaintenanceSchema
  );
  var CharacterTaskQueueSchema = import_zod.z.array(import_zod.z.object({
    id: import_zod.z.string(),
    type: import_zod.z.enum(["init_profile", "repair_profile", "summarize_memory"]),
    priority: import_zod.z.number().int(),
    target_char: import_zod.z.string().describe("任务目标角色名"),
    payload: import_zod.z.any().describe("任务所需的上下文数据")
  })).describe("待处理的全局角色任务队列");

  // src/ARK_STATUSBAR/mvu/schemas/chronicle.ts
  var import_zod2 = __require("zod");
  var RoundSummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("脚本自动生成的唯一ID，用于未来检索 (UUID/Hash)"),
    turn_id: import_zod2.z.number().int().describe("全局轮次ID"),
    time: import_zod2.z.string().describe("本轮结束时的时间戳"),
    location: import_zod2.z.string().describe("本轮发生的地点"),
    summary: import_zod2.z.string().describe("本轮核心事件的简短描述"),
    key_dialogue: import_zod2.z.array(import_zod2.z.string()).max(3).describe("本轮最关键的对话"),
    tags: import_zod2.z.array(import_zod2.z.string()).describe("事件标签 (如: 战斗, 探索, 关系进展)")
  });
  var TenRoundSummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("唯一ID"),
    start_turn: import_zod2.z.number().int(),
    end_turn: import_zod2.z.number().int(),
    time_span: import_zod2.z.tuple([import_zod2.z.string(), import_zod2.z.string()]).describe("起始与结束时间戳"),
    key_events: import_zod2.z.array(import_zod2.z.string()).describe("这十轮内的关键事件列表"),
    character_moments: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string()).describe("各角色的关键行为或转变")
  });
  var DailySummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("唯一ID"),
    date: import_zod2.z.string().describe("日期 (YYYY-MM-DD)"),
    time_span: import_zod2.z.tuple([import_zod2.z.string(), import_zod2.z.string()]),
    headline: import_zod2.z.string().describe("本日头条/最重要事件"),
    included_summaries: import_zod2.z.array(TenRoundSummarySchema).describe("本日包含的所有十轮小结"),
    major_events_details: import_zod2.z.array(import_zod2.z.object({
      time: import_zod2.z.string(),
      location: import_zod2.z.string(),
      description: import_zod2.z.string()
    })).describe("未被小结覆盖的重大事件详情"),
    character_updates: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string().describe("角色在本日的总体变化总结")),
    unresolved_threads: import_zod2.z.array(import_zod2.z.string()).describe("本日结束时仍未解决的线索或问题")
  });
  var WeeklySummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("唯一ID"),
    week_number: import_zod2.z.string().describe("周编号 (如: 1097-W01)"),
    time_span: import_zod2.z.tuple([import_zod2.z.string(), import_zod2.z.string()]),
    weekly_overview: import_zod2.z.string().describe("本周总体概述"),
    included_summaries: import_zod2.z.array(DailySummarySchema).describe("本周包含的所有每日总结"),
    major_trends: import_zod2.z.string().describe("本周出现的主要趋势或变化"),
    key_locations: import_zod2.z.array(import_zod2.z.string()).describe("本周关键活动地点")
  });
  var MonthlySummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("唯一ID"),
    month: import_zod2.z.string().describe("月份 (YYYY-MM)"),
    time_span: import_zod2.z.tuple([import_zod2.z.string(), import_zod2.z.string()]),
    monthly_narrative: import_zod2.z.string().describe("本月的故事线叙述"),
    included_summaries: import_zod2.z.array(WeeklySummarySchema).describe("本月包含的所有每周总结"),
    strategic_changes: import_zod2.z.string().describe("战略或阵营关系的重大变化"),
    new_mysteries: import_zod2.z.array(import_zod2.z.string()).describe("本月新出现的谜团")
  });
  var YearlySummarySchema = import_zod2.z.object({
    id: import_zod2.z.string().describe("唯一ID"),
    year: import_zod2.z.number().int().describe("年份 (YYYY)"),
    time_span: import_zod2.z.tuple([import_zod2.z.string(), import_zod2.z.string()]),
    annual_theme: import_zod2.z.string().describe("本年度的主题或核心冲突"),
    included_summaries: import_zod2.z.array(MonthlySummarySchema).describe("本年包含的所有每月总结"),
    world_impact: import_zod2.z.string().describe("对世界格局产生的深远影响"),
    character_arcs: import_zod2.z.record(import_zod2.z.string(), import_zod2.z.string().describe("主要角色的年度个人成长或变化轨迹"))
  });
  var ChronicleSchema = import_zod2.z.object({
    // 缓冲区
    round_buffer: import_zod2.z.array(RoundSummarySchema).max(30).describe("轮次总结缓冲区，放宽上限以应对积压"),
    small_summary_buffer: import_zod2.z.array(TenRoundSummarySchema).describe("十轮小结缓冲区"),
    daily_summary_buffer: import_zod2.z.array(DailySummarySchema).describe("每日总结缓冲区"),
    weekly_summary_buffer: import_zod2.z.array(WeeklySummarySchema).describe("每周总结缓冲区"),
    monthly_summary_buffer: import_zod2.z.array(MonthlySummarySchema).describe("每月总结缓冲区"),
    yearly_summary_buffer: import_zod2.z.array(YearlySummarySchema).describe("年度总结缓冲区"),
    // 任务队列 (Task Queue) - 核心调度机制
    // 采用优先队列模式，每次只处理头部的一个任务，避免LLM过载
    task_queue: import_zod2.z.array(import_zod2.z.object({
      id: import_zod2.z.string(),
      type: import_zod2.z.enum(["ten_round", "daily", "weekly", "monthly", "yearly", "repair"]),
      priority: import_zod2.z.number().int().describe("优先级：数值越大越高"),
      payload: import_zod2.z.any().describe("任务所需的上下文数据，如时间跨度、源ID列表")
    })).describe("待处理的任务队列"),
    // 系统状态
    system: import_zod2.z.object({
      last_processed_turn: import_zod2.z.number().int().default(0),
      is_processing: import_zod2.z.boolean().default(false).describe("当前是否正在等待LLM处理任务")
    })
  });

  // src/ARK_STATUSBAR/mvu/schemas/global.ts
  var import_zod3 = __require("zod");
  var GlobalStateSchema = import_zod3.z.object({
    // 时间
    time: import_zod3.z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式: YYYY-MM-DD HH:mm:ss").describe("游戏世界的核心时间，由后端脚本根据AI输出自动推进"),
    // 地点
    location: import_zod3.z.object({
      region: import_zod3.z.string().describe("国家/大区"),
      city: import_zod3.z.string().describe("城市"),
      area: import_zod3.z.string().describe("区域"),
      spot: import_zod3.z.string().describe("具体位置")
    }).describe("描述角色当前所在的四维地点"),
    // 环境
    weather: import_zod3.z.string().describe("当前天气状况"),
    environment_status: import_zod3.z.string().describe("对周围环境的感官描述"),
    // 在场实体注册表 (由后端脚本维护)
    presence: import_zod3.z.object({
      active_chars: import_zod3.z.array(import_zod3.z.string()).describe("当前在场并参与交互的角色列表"),
      nearby_chars: import_zod3.z.array(import_zod3.z.string()).describe("附近可被感知但未直接交互的角色")
    }).describe("由后端脚本根据AI输出来维护，用于触发角色初始化和离线更新"),
    // 游戏进程计数器 (由后端脚本维护)
    game_progress: import_zod3.z.object({
      total_turns: import_zod3.z.number().int().default(0).describe("总交互轮次，用于触发周期性事件")
    }).describe("由后端脚本在每轮交互后自动递增")
  });

  // src/ARK_STATUSBAR/mvu/schemas/player.ts
  var import_zod4 = __require("zod");
  var ProfileSchema = import_zod4.z.object({
    name: import_zod4.z.string().describe("代号/姓名"),
    gender: import_zod4.z.string().describe("性别"),
    age: import_zod4.z.string().describe("年龄/生理年龄"),
    race: import_zod4.z.string().describe("种族"),
    appearance: import_zod4.z.string().describe("外貌特征描述 (发色、瞳色、身高、体型等)"),
    background: import_zod4.z.string().describe("背景故事/身份起源"),
    personality: import_zod4.z.string().describe("性格特征"),
    infection_status: import_zod4.z.enum(["非感染者", "感染者", "未公开"]).describe("矿石病感染状况")
  });
  var AttributeLevel = import_zod4.z.enum(["缺陷", "普通", "标准", "优良", "卓越", "???", "■■"]).describe("属性评级");
  var AttributesSchema = import_zod4.z.object({
    physical_strength: AttributeLevel.describe("物理强度"),
    mobility: AttributeLevel.describe("战场机动"),
    physiological_endurance: AttributeLevel.describe("生理耐受"),
    tactical_planning: AttributeLevel.describe("战术规划"),
    combat_skill: AttributeLevel.describe("战斗技巧"),
    originium_arts_adaptability: AttributeLevel.describe("源石技艺适应性"),
    power_level_desc: import_zod4.z.string().default("未评估").describe("基于28级战力标准的文字描述 (如: 层级0-平民, 层级5-上位战场中坚)")
  });
  var SkillsSchema = import_zod4.z.record(import_zod4.z.string(), import_zod4.z.object({
    type: import_zod4.z.enum(["源石技艺", "武技", "指挥技能", "生活技能", "被动天赋", "特殊能力", "其他"]).describe("技能类型"),
    description: import_zod4.z.string().describe("技能效果描述"),
    proficiency: import_zod4.z.string().optional().describe("熟练度")
  })).describe("玩家掌握的技能列表");
  var InventorySchema = import_zod4.z.object({
    items: import_zod4.z.record(import_zod4.z.string(), import_zod4.z.object({
      count: import_zod4.z.number().int().min(0),
      description: import_zod4.z.string().describe("物品描述/用途"),
      status: import_zod4.z.string().optional().describe("状态 (如: 已损坏, 剩余50%)")
    })).describe("背包物品"),
    equipment: import_zod4.z.object({
      main_hand: import_zod4.z.string().optional().describe("主手武器/装备"),
      off_hand: import_zod4.z.string().optional().describe("副手武器/装备"),
      outerwear: import_zod4.z.string().describe("外装/护甲 (如: 战术背心, 防寒大衣)"),
      innerwear: import_zod4.z.string().describe("内装/常服 (如: 罗德岛制服, JK制服)"),
      accessories: import_zod4.z.array(import_zod4.z.string()).describe("饰品/挂件")
    }).describe("当前装备")
  });
  var SocialSchema = import_zod4.z.record(import_zod4.z.string(), import_zod4.z.object({
    relation: import_zod4.z.string().describe("关系描述 (如: 盟友, 敌人, 陌生人)"),
    trust: import_zod4.z.coerce.number().min(0).max(200).default(50).describe("玩家对该角色的信任度"),
    impressions: import_zod4.z.array(import_zod4.z.string()).max(5).describe("对该角色的印象标签 (如: 可靠, 危险)"),
    notes: import_zod4.z.string().optional().describe("特殊备注")
  })).describe("玩家与其他角色的关系网");
  var StatusSchema = import_zod4.z.object({
    mood: import_zod4.z.number().min(-100).max(100).default(0).describe("情绪值"),
    physiological_state: import_zod4.z.array(import_zod4.z.string()).describe("生理状态标签 (如: 健康, 轻伤, 疲劳, 感染抑制中)"),
    current_action: import_zod4.z.string().describe("当前正在进行的动作")
  });
  var PlayerSchema = import_zod4.z.object({
    profile: ProfileSchema,
    attributes: AttributesSchema,
    skills: SkillsSchema,
    inventory: InventorySchema,
    social: SocialSchema,
    status: StatusSchema,
    _internal: import_zod4.z.object({
      last_update_turn: import_zod4.z.number().int().default(0),
      pending_repairs: import_zod4.z.array(import_zod4.z.string()).default([])
    })
  });

  // src/ARK_STATUSBAR/mvu/index.ts
  var Schema = import_zod5.z.object({
    global: GlobalStateSchema,
    characters: import_zod5.z.record(import_zod5.z.string(), CharacterSchema),
    player: PlayerSchema,
    chronicle: ChronicleSchema,
    character_task_queue: CharacterTaskQueueSchema
  });
  return __toCommonJS(index_exports);
})();

// Late registration after document is ready
$(() => {
  if (window.registerMvuSchema && MVUSchemas.Schema) {
    console.log('Registering MVU Schema...');
    registerMvuSchema(MVUSchemas.Schema);
    console.log('✅ MVU Schema registered.');
  } else {
    console.error('❌ Could not register MVU Schema. registerMvuSchema or Schema not found.');
  }
});
      
