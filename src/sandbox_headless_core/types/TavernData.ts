import { z } from 'zod';

/**
 * 对应 `regex_scripts` 的解析契约
 * 参考 @types/iframe/exported.sillytavern.d.ts 的 RegexScriptData
 */
export const RegexScriptSchema = z.object({
  id: z.string(),
  scriptName: z.string(),
  findRegex: z.string(),
  replaceString: z.string(),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(z.number()),
  disabled: z.boolean(),
  markdownOnly: z.boolean(),
  promptOnly: z.boolean(),
  runOnEdit: z.boolean(),
  substituteRegex: z.number(),
  minDepth: z.number().nullable().optional(),
  maxDepth: z.number().nullable().optional(),
});
export type RegexScriptData = z.infer<typeof RegexScriptSchema>;

/**
 * 对应实际 Preset 文件中的 Prompt 契约
 * 
 * 在真实数据中，`position: { type: 'in_chat', depth: 4, order: 100 }` 等现代结构
 * 被扁平化拆分成了 `injection_position`, `injection_depth`, `injection_order`。
 * 部分特殊的占位符提示词（如 chatHistory 和 dialogueExamples）甚至完全缺少 depth 和 order 字段。
 */
export const PresetPromptSchema = z.object({
  identifier: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  
  injection_position: z.number().optional(),
  injection_depth: z.number().optional(),
  injection_order: z.number().optional(),
  
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().optional(),
  
  system_prompt: z.boolean().default(false),
  marker: z.boolean().default(false),
  forbid_overrides: z.boolean().default(false),
  injection_trigger: z.array(z.any()).default([]),
});
export type PresetPromptData = z.infer<typeof PresetPromptSchema>;

/**
 * 对应完整的导出的预设 (Preset) 契约
 * 将实际文件外层大量关于大模型请求的参数进行容错捕获。
 */
export const ExportedPresetSchema = z.object({
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
  wrap_in_quotes: z.boolean().optional(),
  stream_openai: z.boolean().optional(),
  squash_system_messages: z.boolean().optional(),
  reasoning_effort: z.string().optional(),
  enable_web_search: z.boolean().optional(),
  request_images: z.boolean().optional(),
  seed: z.number().optional(),
  
  prompts: z.array(PresetPromptSchema).default([]),
  
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
  enabled: z.boolean(),
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
