import { z } from 'zod';

// 基础个人信息
const ProfileSchema = z.object({
  name: z.string().describe('代号/姓名'),
  gender: z.string().describe('性别'),
  age: z.string().describe('年龄/生理年龄'),
  race: z.string().describe('种族'),
  appearance: z.string().describe('外貌特征描述 (发色、瞳色、身高、体型等)'),
  background: z.string().describe('背景故事/身份起源'),
  personality: z.string().describe('性格特征'),
  infection_status: z.enum(['非感染者', '感染者', '未公开']).describe('矿石病感染状况')
});

// 身体与战斗属性 (保留六维作为未来扩展测试，当前主要使用 power_level_desc)
// 六维标准参考: 缺陷, 普通, 标准, 优良, 卓越
const AttributeLevel = z.enum(['缺陷', '普通', '标准', '优良', '卓越', '???', '■■']).describe('属性评级');

const AttributesSchema = z.object({
  physical_strength: AttributeLevel.describe('物理强度'),
  mobility: AttributeLevel.describe('战场机动'),
  physiological_endurance: AttributeLevel.describe('生理耐受'),
  tactical_planning: AttributeLevel.describe('战术规划'),
  combat_skill: AttributeLevel.describe('战斗技巧'),
  originium_arts_adaptability: AttributeLevel.describe('源石技艺适应性'),
  power_level_desc: z.string().default('未评估').describe('基于28级战力标准的文字描述 (如: 层级0-平民, 层级5-上位战场中坚)')
});

// 技能与技艺
const SkillsSchema = z.record(z.string(), z.object({
  type: z.enum(['源石技艺', '武技', '指挥技能', '生活技能', '被动天赋', '特殊能力', '其他']).describe('技能类型'),
  description: z.string().describe('技能效果描述'),
  proficiency: z.string().optional().describe('熟练度')
})).describe('玩家掌握的技能列表').default({});

// 物品与装备
const InventorySchema = z.object({
  items: z.record(z.string(), z.object({
    count: z.number().int().min(0),
    description: z.string().describe('物品描述/用途'),
    status: z.string().optional().describe('状态 (如: 已损坏, 剩余50%)')
  })).describe('背包物品').default({}),
  equipment: z.object({
    main_hand: z.string().optional().describe('主手武器/装备'),
    off_hand: z.string().optional().describe('副手武器/装备'),
    outerwear: z.string().describe('外装/护甲 (如: 战术背心, 防寒大衣)'),
    innerwear: z.string().describe('内装/常服 (如: 罗德岛制服, JK制服)'),
    accessories: z.array(z.string()).describe('饰品/挂件').default([])
  }).describe('当前装备')
});

// 社交关系
const SocialSchema = z.record(z.string(), z.object({
  relation: z.string().describe('关系描述 (如: 盟友, 敌人, 陌生人)'),
  trust: z.coerce.number().min(0).max(200).default(50).describe('玩家对该角色的信任度'),
  impressions: z.array(z.string()).max(5).describe('对该角色的印象标签 (如: 可靠, 危险)'),
  notes: z.string().optional().describe('特殊备注')
})).describe('玩家与其他角色的关系网').default({});

// 玩家状态 (动态)
const StatusSchema = z.object({
  mood: z.number().min(-100).max(100).default(0).describe('情绪值'),
  physiological_state: z.array(z.string()).describe('生理状态标签 (如: 健康, 轻伤, 疲劳, 感染抑制中)'),
  current_action: z.string().describe('当前正在进行的动作')
});

export const PlayerSchema = z.object({
  profile: ProfileSchema,
  attributes: AttributesSchema,
  skills: SkillsSchema,
  inventory: InventorySchema,
  social: SocialSchema,
  status: StatusSchema
});
