# Phase 2.2: 玩家档案设计 (Player Design)

**目标**: 围绕 `Player` 变量区块，完成从结构定义到提示词设计的完整工作流规划。

---

## 1. 变量结构 (Zod Schema)
* **文件**: `src/ARK_STATUSBAR/mvu/schemas/player.ts`
* **描述**: 定义了玩家的数据结构。该结构旨在建立一个高度通用的主角画像，不预设任何特定身份，完全支持玩家自定义。

```typescript
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
})).describe('玩家掌握的技能列表');

// 物品与装备
const InventorySchema = z.object({
  items: z.record(z.string(), z.object({
    count: z.number().int().min(0),
    description: z.string().describe('物品描述/用途'),
    status: z.string().optional().describe('状态 (如: 已损坏, 剩余50%)')
  })).describe('背包物品'),
  equipment: z.object({
    main_hand: z.string().optional().describe('主手武器/装备'),
    off_hand: z.string().optional().describe('副手武器/装备'),
    outerwear: z.string().describe('外装/护甲 (如: 战术背心, 防寒大衣)'),
    innerwear: z.string().describe('内装/常服 (如: 罗德岛制服, JK制服)'),
    accessories: z.array(z.string()).describe('饰品/挂件')
  }).describe('当前装备')
});

// 社交关系
const SocialSchema = z.record(z.string(), z.object({
  relation: z.string().describe('关系描述 (如: 盟友, 敌人, 陌生人)'),
  trust: z.coerce.number().min(0).max(200).default(50).describe('玩家对该角色的信任度'),
  impressions: z.array(z.string()).max(5).describe('对该角色的印象标签 (如: 可靠, 危险)'),
  notes: z.string().optional().describe('特殊备注')
})).describe('玩家与其他角色的关系网');

// 玩家状态 (动态)
const StatusSchema = z.object({
  mood: z.number().min(-100).max(100).default(0).describe('情绪值'),
  physiological_state: z.array(z.string()).describe('生理状态标签 (如: 健康, 轻伤, 疲劳, 感染抑制中)'),
  current_action: z.string().describe('当前正在进行的动作')
});

export const PlayerSchema = z.object({
  profile: ProfileSchema,
  attributes: AttributesSchema,
  skills: SkillsSchema.default({}),
  inventory: InventorySchema,
  social: SocialSchema.default({}),
  status: StatusSchema
  // _internal has been removed in favor of a global task queue.
});
```

---

## 2. 初始设置 (initvar)
* **文件**: 世界书条目 `[initvar]变量初始化勿开`
* **描述**: 提供全空的玩家档案模板，等待用户输入或LLM初始化。

```yaml
player:
  profile:
    name: "待定"
    gender: "待定"
    age: "待定"
    race: "待定"
    appearance: "待定"
    background: "待定"
    personality: "待定"
    infection_status: "未公开"
  attributes:
    physical_strength: "标准"
    mobility: "标准"
    physiological_endurance: "标准"
    tactical_planning: "标准"
    combat_skill: "标准"
    originium_arts_adaptability: "标准"
    power_level_desc: "未评估"
  skills: {}
  inventory:
    items: {}
    equipment:
      main_hand: "无"
      off_hand: "无"
      outerwear: "无"
      innerwear: "日常便服"
      accessories: []
  social: {}
  status:
    mood: 0
    physiological_state: ["健康"]
    current_action: "等待开始"
```

---

## 3. 更新规则 (Update Rules)
* **文件**: 世界书条目 `[mvu_update]变量更新规则`
* **策略**: 移除不稳定的 EJS 条件注入，改为常态化检查规则，依靠额外解析 LLM 自主判断。

```yaml
---
变量更新规则:
  player:
    status:
      physiological_state:
        check:
          - "根据剧情更新玩家的生理状态。如受伤添加'轻伤'/'重伤'，休息后移除'疲劳'。"
      # ... (mood规则同前)
    
    inventory:
      items:
        type: |-
          { [itemName: string]: { count: number; description: string; status?: string } }
        check:
          - "自主检测物品变动：当剧情涉及获得、购买、消耗、丢失物品时触发。"
          - "数量管理：获得增加 count，消耗减少 count。归零时必须移除条目。"
          - "装备联动：若物品被装备，需同步更新 equipment。"
    
    social:
      type: |-
        { [charName: string]: { relation: string; trust: number; impressions: string[] } }
      check:
        - "交互判定：当玩家与角色有实质性互动时，评估关系进展和信任度变化。"
        - "印象更新：根据对话内容提取新的印象标签。"
    
    attributes:
      # 六维属性暂作为参考记录，主要依据 power_level_desc
      power_level_desc:
        check:
          - "必须参考《战力分级标准》。根据玩家在战斗中的实际表现动态调整。"
    
    # 强制每轮检查
    status:
      current_action:
        check:
          - "必须更新。用简短的动宾短语描述玩家当前正在做什么（如'正在瞄准敌人', '正在思考对策'）。"
```

---

## 4. 后端处理逻辑 (Backend Logic)
* **模块**: `src/ARK_STATUSBAR/logic/upadapters/player.ts`
* **核心架构**: 与 `Character` 模块完全一致，采用**全局任务队列**模式。

### 4.1 智能初始化 (Smart Initialization)
* **目的**: 确保玩家档案至少存在，并且在开局时能根据上下文进行初步填充。
* **逻辑**:
  1. **存在性检查**: 监听 `VARIABLE_UPDATE_ENDED` 事件。检查 `stat_data.player` 是否存在。
  2. **任务生成**: 如果 `player` 对象不存在，立即向全局的 `task_queue` 推送一个高优先级的 `init_player_profile` 任务。
  3. **后续处理**: EJS 模板 (`任务执行器.ejs`) 将捕获此任务，并指示 LLM 根据开场白和用户第一句话来创建玩家的基础档案。

### 4.2 档案修复机制 (Repair Loop)
* **逻辑**: 与 `Character` 模块的机制统一。
  1. **触发**: 监听 `VARIABLE_UPDATE_ENDED` 事件，当 `oldVariables.player` 和 `newVariables.player` 不相等时触发。
  2. **Zod 校验**: 使用 `PlayerSchema.safeParse(data)` 对新的玩家数据进行校验。
  3. **空值/可选字段处理**: Zod Schema 已通过 `.default({})` 等方式明确区分哪些字段（如 `skills`, `inventory.items`）是允许为空的。因此，只有当**必填字段缺失**或**数据类型错误**时，校验才会失败。
  4. **任务生成**: 如果校验失败，分析 `error.issues`，识别出真正损坏的字段路径。将这些路径打包，作为 `repair_player_profile` 任务推送到**全局 `task_queue`**。

---

## 5. 提示词设计 (Prompt Design)

* **Prompt 完整性要求**:
> **注意**: 在实际实施时，必须根据上述“变量更新规则”编写完整、详细的 System Prompt，明确指导 LLM 如何捕捉物品变动、判定社交关系、更新六维属性等细节，不能仅依赖简单的 check 列表。

* **通用状态注入**:
```javascript
<%
// 在生成前注入玩家状态
const p = variables.player;
const phys_tags = p.status.physiological_state.join(', ') || '健康';
// 仅当状态有意义时注入
if (p.status.current_action && p.status.current_action !== "等待开始") {
    injectPrompt("player_status", 
        `[系统监测] 玩家状态: 情绪${p.status.mood} | 生理: [${phys_tags}] | 正在: ${p.status.current_action}。`,
        1 
    );
}
%>
