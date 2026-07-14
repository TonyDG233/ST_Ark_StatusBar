import { z } from 'zod';

// --- 基础插件与正则 ---

export const RegexScriptSchema = z.object({
  id: z.string().optional(),
  scriptName: z.string().optional(),
  findRegex: z.string().optional(),
  replaceString: z.string().optional(),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(z.number()).optional(),
  disabled: z.boolean().optional(),
  markdownOnly: z.boolean().optional(),
  promptOnly: z.boolean().optional(),
  runOnEdit: z.boolean().optional(),
  substituteRegex: z.number().optional(),
  minDepth: z.number().nullable().optional(),
  maxDepth: z.number().nullable().optional(),
}).passthrough();
export type RegexScriptData = z.infer<typeof RegexScriptSchema>;

// --- 预设 (Preset) 相关 ---

export const PresetPromptSchema = z.object({
  identifier: z.string(),
  name: z.string().optional(),
  enabled: z.boolean().default(true),
  
  injection_position: z.number().optional(),
  injection_depth: z.number().optional(),
  injection_order: z.number().optional(),
  
  role: z.enum(['system', 'user', 'assistant']).optional(),
  content: z.string().optional(),
  
  system_prompt: z.boolean().default(false),
  marker: z.boolean().default(false),
  forbid_overrides: z.boolean().default(false),
  injection_trigger: z.array(z.any()).default([]),
}).passthrough();
export type PresetPromptData = z.infer<typeof PresetPromptSchema>;

/**
 * 对应 `prompt_order` 数组中的核心蓝图骨架
 */
export const PresetPromptOrderItemSchema = z.object({
  identifier: z.string(),
  enabled: z.boolean()
}).passthrough();

export const PresetPromptOrderSchema = z.object({
  character_id: z.number(),
  order: z.array(PresetPromptOrderItemSchema).default([]),
  xiaobai_ext: z.any().optional(), // 兼容第三方插件数据
}).passthrough();
export type PresetPromptOrder = z.infer<typeof PresetPromptOrderSchema>;

/**
 * 对应完整的导出的预设 (Preset) 契约
 * 已通过抽取数十种不同流派真实 JSON 的全量字段进行去重与防腐。
 */
export const ExportedPresetSchema = z.object({
  // 核心大模型参数
  temperature: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  top_a: z.number().optional(),
  min_p: z.number().optional(),
  repetition_penalty: z.number().optional(),
  openai_max_context: z.number().optional(),
  openai_max_tokens: z.number().optional(),
  seed: z.number().optional(),
  n: z.number().optional(),
  
  // 核心功能开关
  wrap_in_quotes: z.boolean().optional(),
  stream_openai: z.boolean().optional(),
  squash_system_messages: z.boolean().optional(),
  function_calling: z.boolean().optional(),
  enable_web_search: z.boolean().optional(),
  show_thoughts: z.boolean().optional(),
  reasoning_effort: z.string().optional(),
  
  // 图片与视频设定
  image_inlining: z.boolean().optional(),
  inline_image_quality: z.string().optional(),
  video_inlining: z.boolean().optional(),
  media_inlining: z.boolean().optional(),
  request_images: z.boolean().optional(),
  request_image_aspect_ratio: z.string().optional(),
  request_image_resolution: z.string().optional(),
  
  // 特殊提示词模板 (格式化字符串)
  names_behavior: z.number().optional(),
  send_if_empty: z.string().optional(),
  impersonation_prompt: z.string().optional(),
  new_chat_prompt: z.string().optional(),
  new_example_chat_prompt: z.string().optional(),
  new_group_chat_prompt: z.string().optional(),
  continue_nudge_prompt: z.string().optional(),
  group_nudge_prompt: z.string().optional(),
  wi_format: z.string().optional(),
  scenario_format: z.string().optional(),
  personality_format: z.string().optional(),
  assistant_prefill: z.string().optional(),
  assistant_impersonation: z.string().optional(),
  continue_prefill: z.boolean().optional(),
  continue_postfix: z.string().optional(),
  
  // 其它平台兼容标记
  claude_use_sysprompt: z.boolean().optional(),
  use_makersuite_sysprompt: z.boolean().optional(),
  use_sysprompt: z.boolean().optional(),
  bias_preset_selected: z.string().optional(),
  max_context_unlocked: z.boolean().optional(),
  verbosity: z.union([z.number(), z.string()]).optional(),

  // 【核心数据集合】
  prompts: z.array(PresetPromptSchema).default([]),
  prompt_order: z.array(PresetPromptOrderSchema).default([]), // 最重要的线性蓝图
  
  extensions: z.object({
    regex_scripts: z.array(RegexScriptSchema).optional(),
  }).passthrough().optional()
}).passthrough();
export type ExportedPresetData = z.infer<typeof ExportedPresetSchema>;


// --- 以下为世界书 (Worldbook) 的解析契约 ---

export const v2DataWorldInfoEntryExtensionInfosSchema = z.object({
  position: z.number(),
  exclude_recursion: z.boolean(),
  probability: z.number(),
  useProbability: z.boolean(),
  depth: z.number(),
  selectiveLogic: z.number(),
  group: z.string(),
  group_override: z.boolean(),
  group_weight: z.number(),
  prevent_recursion: z.boolean(),
  delay_until_recursion: z.boolean(),
  scan_depth: z.number(),
  match_whole_words: z.boolean(),
  use_group_scoring: z.boolean(),
  case_sensitive: z.boolean(),
  automation_id: z.string(),
  role: z.number(),
  vectorized: z.boolean(),
  display_index: z.number(),
  match_persona_description: z.boolean(),
  match_character_description: z.boolean(),
  match_character_personality: z.boolean(),
  match_character_depth_prompt: z.boolean(),
  match_scenario: z.boolean(),
  match_creator_notes: z.boolean(),
}).passthrough();
export type v2DataWorldInfoEntryExtensionInfos = z.infer<typeof v2DataWorldInfoEntryExtensionInfosSchema>;

export const v2DataWorldInfoEntrySchema = z.object({
  keys: z.array(z.string()),
  secondary_keys: z.array(z.string()).default([]),
  comment: z.string(),
  content: z.string(),
  constant: z.boolean(),
  selective: z.boolean(),
  insertion_order: z.number(),
  enabled: z.boolean().default(true),
  position: z.string(),
  extensions: v2DataWorldInfoEntryExtensionInfosSchema,
  id: z.number(),
}).passthrough();
export type v2DataWorldInfoEntry = z.infer<typeof v2DataWorldInfoEntrySchema>;

export const v2WorldInfoBookSchema = z.object({
  name: z.string(),
  entries: z.record(z.string(), v2DataWorldInfoEntrySchema),
}).passthrough();
export type v2WorldInfoBook = z.infer<typeof v2WorldInfoBookSchema>;


// --- 以下为 V2 角色卡 (Character Card) 的解析契约 ---

export const v2CharDataExtensionInfosSchema = z.object({
  talkativeness: z.number(),
  fav: z.boolean(),
  world: z.string(),
  depth_prompt: z.object({
    depth: z.number(),
    prompt: z.string(),
    role: z.enum(['system', 'user', 'assistant']),
  }).passthrough().optional(),
  regex_scripts: z.array(RegexScriptSchema).optional(),
  pygmalion_id: z.string().optional(),
  github_repo: z.string().optional(),
  source_url: z.string().optional(),
  chub: z.object({ full_path: z.string() }).passthrough().optional(),
  risuai: z.object({ source: z.array(z.string()) }).passthrough().optional(),
  sd_character_prompt: z.object({ positive: z.string(), negative: z.string() }).passthrough().optional(),
}).passthrough();
export type v2CharDataExtensionInfos = z.infer<typeof v2CharDataExtensionInfosSchema>;

export const v2CharDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  character_version: z.string().optional(),
  personality: z.string(),
  scenario: z.string(),
  first_mes: z.string(),
  mes_example: z.string(),
  creator_notes: z.string(),
  tags: z.array(z.string()),
  system_prompt: z.string(),
  post_history_instructions: z.string(),
  creator: z.string(),
  alternate_greetings: z.array(z.string()).default([]),
  character_book: v2WorldInfoBookSchema.optional().nullable(),
  extensions: v2CharDataExtensionInfosSchema,
}).passthrough();
export type v2CharData = z.infer<typeof v2CharDataSchema>;
