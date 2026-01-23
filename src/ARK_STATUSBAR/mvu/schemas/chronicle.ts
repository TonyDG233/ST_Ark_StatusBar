import { z } from 'zod';

// ============================================================================
// 1. 基础组件定义 (Base Components)
// ============================================================================

// 状态更新记录 (统一用于各层级，追踪人物、势力、任务的变化)
const StatusUpdateSchema = z.object({
  characters: z.record(z.string(), z.string().describe('角色名 -> 状态/关系/认知的变化')).optional(),
  factions: z.record(z.string(), z.string().describe('势力名 -> 状态/外交的变化')).optional(),
  quests: z.record(z.string(), z.string().describe('任务名 -> 进度/结果')).optional(),
  unresolved: z.array(z.string()).describe('在此期间产生或遗留的谜团/问题').optional(),
});

// 通用事件节点 (用于各层级的 key_events)
const EventNodeSchema = z.object({
  time: z.string().describe('事件发生的时间'),
  location: z.string().optional().describe('事件发生的地点'),
  description: z.string().describe('事件描述'),
});

// ============================================================================
// 2. 各层级总结定义 (Hierarchical Summaries)
// ============================================================================

// [L1] 轮次总结 (Round Summary) - 最基础的原子单位
const RoundSummarySchema = z.object({
  id: z.string().describe('UUID'),
  time: z.string().describe('YYYY-MM-DD HH:mm'),
  location: z.string(),
  headline: z.string().describe('本轮核心事件的简短标题'),
  content: z.string().describe('详细的事件描述'),
  key_dialogue: z.array(z.string()).max(3).describe('关键对话摘录'),
  tags: z.array(z.string()).describe('事件标签 (e.g., Combat, Exploration, Social)'),
});

// [L2] 十轮小结 (Ten-Round Summary)
const TenRoundSummarySchema = z.object({
  id: z.string().describe('UUID'),
  time_span: z.tuple([z.string(), z.string()]).describe('[Start, End]'),
  headline: z.string().describe('这十轮的阶段性标题'),
  content: z.string().describe('这十轮的剧情综述'),
  key_events: z.array(EventNodeSchema).describe('关键节点列表'),
  updates: StatusUpdateSchema.describe('这十轮内的状态变化'),
  source_rounds: z.array(z.string()).describe('包含的Round ID列表 (仅存ID引用)'),
});

// [L3] 每日总结 (Daily Summary)
const DailySummarySchema = z.object({
  id: z.string().describe('UUID'),
  date: z.string().describe('YYYY-MM-DD'),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe('本日头条'),
  content: z.string().describe('本日剧情综述'),
  key_events: z.array(EventNodeSchema).describe('本日关键事件详情'),
  updates: StatusUpdateSchema.describe('本日产生的状态变化'),
  source_summaries: z.array(z.string()).describe('包含的TenRoundSummary ID列表'),
});

// [L4] 每周总结 (Weekly Summary)
const WeeklySummarySchema = z.object({
  id: z.string().describe('UUID'),
  week: z.string().describe('YYYY-Www'),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe('本周主题'),
  content: z.string().describe('本周剧情综述'),
  key_events: z.array(EventNodeSchema).describe('本周发生的关键事件节点'),
  updates: StatusUpdateSchema.describe('本周产生的长远影响'),
  source_summaries: z.array(z.string()).describe('包含的DailySummary ID列表'),
});

// [L5] 每月总结 (Monthly Summary)
const MonthlySummarySchema = z.object({
  id: z.string().describe('UUID'),
  month: z.string().describe('YYYY-MM'),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe('本月主题'),
  content: z.string().describe('本月剧情综述'),
  key_events: z.array(EventNodeSchema).describe('本月发生的战略级事件节点'),
  updates: StatusUpdateSchema.describe('本月产生的战略影响'),
  source_summaries: z.array(z.string()).describe('包含的WeeklySummary ID列表'),
});

// [L6] 年度总结 (Yearly Summary)
const YearlySummarySchema = z.object({
  id: z.string().describe('UUID'),
  year: z.string().describe('YYYY'),
  time_span: z.tuple([z.string(), z.string()]),
  headline: z.string().describe('年度史诗主题'),
  content: z.string().describe('年度剧情综述'),
  key_events: z.array(EventNodeSchema).describe('年度里程碑事件列表'),
  updates: StatusUpdateSchema.describe('年度世界格局变化'),
  source_summaries: z.array(z.string()).describe('包含的MonthlySummary ID列表'),
});

// ============================================================================
// 3. 最终导出 (Export)
// ============================================================================

export const ChronicleSchema = z.object({
  // 缓冲区 (Buffers)
  round_buffer: z.array(RoundSummarySchema).max(50).describe('轮次总结缓冲区'),
  small_summary_buffer: z.array(TenRoundSummarySchema).describe('十轮小结缓冲区'),
  daily_summary_buffer: z.array(DailySummarySchema).describe('每日总结缓冲区'),
  weekly_summary_buffer: z.array(WeeklySummarySchema).describe('每周总结缓冲区'),
  monthly_summary_buffer: z.array(MonthlySummarySchema).describe('每月总结缓冲区'),
  yearly_summary_buffer: z.array(YearlySummarySchema).describe('年度总结缓冲区'),

  // 系统状态
  system: z.object({
    is_processing: z.boolean().default(false),
  }),
});
