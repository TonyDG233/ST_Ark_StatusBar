import { z } from 'zod';

// 统一的全局任务队列
export const TaskQueueSchema = z.array(z.object({
  id: z.string(),
  type: z.enum([
    // Character tasks
    'init_profile', 
    'repair_profile', 
    'summarize_memory',
    // Player tasks
    'init_player_profile',
    'repair_player_profile',
    // Chronicle tasks
    'ten_round_summary', 
    'daily_summary', 
    'weekly_summary', 
    'monthly_summary', 
    'yearly_summary', 
    'repair_chronicle'
  ]),
  priority: z.number().int(),
  target_char: z.string().describe('任务目标，可以是角色名、"player"或"chronicle"').optional(),
  payload: z.any().describe('任务所需的上下文数据')
})).describe('待处理的全局统一任务队列');

export const GlobalStateSchema = z.object({
  // 时间
  time: z.string().regex(/^\d{1,5}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, "时间格式: YYYY-MM-DD HH:mm:ss")
    .describe('游戏世界的核心时间，由后端脚本根据AI输出自动推进'),
  
  // 地点
  location: z.object({
    region: z.string().describe('国家/大区'),
    city: z.string().describe('城市'),
    area: z.string().describe('区域'),
    spot: z.string().describe('具体位置')
  }).describe('描述角色当前所在的四维地点'),
  
  // 环境
  weather: z.string().describe('当前天气状况'),
  environment_status: z.string().describe('对周围环境的感官描述'),

  // 在场实体注册表 (由后端脚本维护)
  presence: z.object({
    active_chars: z.array(z.string()).describe('当前在场并参与交互的角色列表'),
    nearby_chars: z.array(z.string()).describe('附近可被感知但未直接交互的角色')
  }).describe('由后端脚本根据AI输出来维护，用于触发角色初始化和离线更新'),

  // 游戏进程计数器 (由后端脚本维护)
  game_progress: z.object({
    total_turns: z.number().int().default(0).describe('总交互轮次，用于触发周期性事件')
  }).describe('由后端脚本在每轮交互后自动递增')
});
