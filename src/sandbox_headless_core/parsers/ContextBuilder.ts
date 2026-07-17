import { 
  UserPersonasConfig, 
  PromptProcessingType,
  v2DataWorldInfoEntry,
  ExportedPresetSchema,
  WorldbookScannerSettings
} from '../types/TavernData';
import { CharacterParser } from './CharacterParser';
import { WorldbookScanner, ScannerEntry } from './WorldbookScanner';
import { PresetAssembler, ChatMessageInput, InjectionPrompt } from './PresetAssembler';
import { PromptPostProcessor } from './PromptPostProcessor';
import { MacroEngine, MacroContext } from './MacroEngine';
import { Context } from '@earendil-works/pi-ai';

export interface SessionConfig {
  characterPngPath?: string;           // 角色卡 PNG 的绝对路径 (可选，Node.js 使用)
  characterData?: any;                 // 预解析的强类型角色卡数据 (可选，浏览器/Vue 使用)
  presetJsonPath?: string;             // 预设 JSON 的绝对路径 (可选，Node.js 使用)
  presetData?: any;                    // 预解析的强类型预设数据 (可选，浏览器/Vue 使用)
  personasConfig?: UserPersonasConfig; // 传入的玩家人设总 JSON 实体 (可选)
  activePersonaAvatar?: string;        // 当前使用的人设头像 Key (如 "1746291893260-.png")
  chatHistory: ChatMessageInput[];     // 历史对话记录数组 (不包含当前最新 userInput)
  userInput: string;                   // 玩家最新键入的消息
  globalWorldbooks?: (v2DataWorldInfoEntry & { world: string })[]; // 外置全局世界书条目数组 (可选)
  postProcessingMode?: PromptProcessingType; // 提示词后处理模式 (若缺省则从预设中读取或默认为 Strict)
}

export interface CompiledContext extends Context {
  activatedWorldbooks?: any[];         // 🟢 真实扫描出并被激活的世界书条目列表
}

export class ContextBuilder {
  /**
   * 物理分离总调度门面：一键执行完整的数据加载、人设双轨分发、世界书扫描、排版拼接与终极洗涤
   */
  public static build(config: SessionConfig): CompiledContext {
    const {
      characterPngPath,
      presetJsonPath,
      personasConfig,
      activePersonaAvatar,
      chatHistory,
      userInput,
      globalWorldbooks = [],
      postProcessingMode
    } = config;

    // =========================================================================
    // 1. 初始化变量与环境 (E2E 共享单一引用)
    // =========================================================================
    const sharedVariables: Record<string, string> = {};
    const macroEngine = new MacroEngine();

    // =========================================================================
    // 2. 加载核心资源 (PNG 脱壳 与 预设反序列化)
    // =========================================================================
    const charData = config.characterData 
      ? config.characterData 
      : (characterPngPath ? CharacterParser.parsePng(characterPngPath) : null);
    if (!charData) {
      throw new Error('ContextBuilder 错误：未提供 characterPngPath 或 characterData！');
    }
    
    let rawPreset: any;
    if (config.presetData) {
      rawPreset = config.presetData;
    } else if (presetJsonPath) {
      const fsNode = eval('require')('fs');
      rawPreset = JSON.parse(fsNode.readFileSync(presetJsonPath, 'utf-8'));
    }
    if (!rawPreset) {
      throw new Error('ContextBuilder 错误：未提供 presetJsonPath 或 presetData！');
    }
    const preset = ExportedPresetSchema.parse(rawPreset);

    // 确定当前对话使用的名称（优先从激活的玩家人设配置文件中提取，100% 同步 {{user}} 宏）
    let userName = 'User';
    if (personasConfig && activePersonaAvatar) {
      const pName = personasConfig.personas[activePersonaAvatar];
      if (pName) {
        userName = pName.trim();
      }
    }
    const charName = charData.name || 'Character';

    const macroCtx: MacroContext = {
      user: userName,
      char: charName,
      localVariables: sharedVariables,
      globalVariables: {},
      description: charData.description,
      personality: charData.personality,
      scenario: charData.scenario,
      creatorNotes: charData.creator_notes,
      mesExamples: charData.mes_example,
      charVersion: charData.character_version,
      lastUserMessage: userInput, // 时序：用户最新发言作为 lastUserMessage
      lastMessage: userInput
    };

    // =========================================================================
    // 3. 玩家人设 (Persona) 双轨/三轨路由分发
    // =========================================================================
    let activePersonaDesc = '';
    let personaInjection: InjectionPrompt | null = null;

    if (personasConfig && activePersonaAvatar && personasConfig.persona_descriptions[activePersonaAvatar]) {
      const pConfig = personasConfig.persona_descriptions[activePersonaAvatar];
      activePersonaDesc = pConfig.description || '';

      if (pConfig.position === 0) {
        // 轨道一: IN_PROMPT (0) -> 写入宏变量，由预设中的 {{persona}} 模板原地展开
        macroCtx.persona = activePersonaDesc;
      } else if (pConfig.position === 4) {
        // 轨道二: AT_DEPTH (4) -> 转为独立深度插队提示词 (IN_CHAT / 1)，在指定 depth 按 role 插入
        personaInjection = {
          identifier: 'PERSONA_DESCRIPTION',
          content: activePersonaDesc,
          injection_depth: pConfig.depth ?? 2,
          role: pConfig.role === 2 ? 'assistant' : (pConfig.role === 1 ? 'user' : 'system'),
          injection_order: 100 // 默认优先级
        };
      } else if (pConfig.position === 2 || pConfig.position === 3) {
        // 轨道三: TOP_AN (2) 或 BOTTOM_AN (3) -> 与作者寄语 AN 粘合 (由后续 ContextBuilder 传入 placeholders 处理)
        macroCtx.persona = activePersonaDesc;
      }
    }

    // =========================================================================
    // 4. 世界书激活扫描 (Worldbook Scanner)
    // =========================================================================
    const scanner = new WorldbookScanner();

    // 4.1 汇聚世界书源数据：角色内嵌书 + 外置全局书
    const entries: ScannerEntry[] = [];
    if (charData.character_book && charData.character_book.entries) {
      charData.character_book.entries.forEach((e: any) => {
        entries.push({ ...e, world: charName });
      });
    }
    globalWorldbooks.forEach(e => {
      entries.push(e);
    });

    // 4.2 构造合流后的聊天历史 (历史记录 + 用户最新发言，确保触发词完美命中！)
    const fullScanHistory = [
      ...chatHistory.map(m => ({ name: m.name, mes: m.content })),
      { name: userName, mes: userInput }
    ];

    const scannerSettings: WorldbookScannerSettings = {
      world_info_include_names: preset.names_behavior === 0,
      world_info_case_sensitive: false,
      world_info_match_whole_words: false,
      world_info_use_group_scoring: false
    };

    const scanInput = {
      entries,
      chatHistory: fullScanHistory,
      timedEffects: { sticky: {}, cooldown: {}, delay: {} },
      settings: scannerSettings,
      globalScanData: {}
    };

    // 运行扫描，传入宏引擎与共享变量实例，在匹配前展开 Keys，且在激活后对其 content 执行清洗
    const scanOutput = scanner.scan(scanInput, macroEngine, macroCtx);

    // =========================================================================
    // 5. 拼装 Placeholders 映射表 (包括 AN 轨道粘合 与 新对话占位符)
    // =========================================================================
    let authorsNote = '';
    if (personasConfig && activePersonaAvatar && personasConfig.persona_descriptions[activePersonaAvatar]) {
      const pConfig = personasConfig.persona_descriptions[activePersonaAvatar];
      if (pConfig.position === 2) { // TOP_AN
        authorsNote = `${activePersonaDesc}\n${authorsNote}`;
      } else if (pConfig.position === 3) { // BOTTOM_AN
        authorsNote = `${authorsNote}\n${activePersonaDesc}`;
      }
    }

    const newChatPrompt = preset.new_chat_prompt || "Let's get started.";

    const placeholders: Record<string, string> = {
      charDescription: charData.description,
      charPersonality: charData.personality || '',
      scenario: charData.scenario || '',
      dialogueExamples: charData.mes_example || '',
      worldInfoBefore: scanOutput.activated.before.map(e => e.content).join('\n'),
      worldInfoAfter: scanOutput.activated.after.map(e => e.content).join('\n'),
      authorsNote: authorsNote,
      newChatPrompt: newChatPrompt
    };

    // =========================================================================
    // 6. 构造插队数组 (世界书 depth 插队 与人设 AT_DEPTH 深度插队)
    // =========================================================================
    const extensionInjections: InjectionPrompt[] = [];

    // 挂载世界书 depth 插队条目
    scanOutput.activated.atDepth.forEach((e: any) => {
      extensionInjections.push({
        identifier: `world_info_depth_${e.id}`,
        content: e.content,
        injection_depth: e.extensions?.depth ?? 2,
        role: e.extensions?.role === 2 ? 'assistant' : (e.extensions?.role === 1 ? 'user' : 'system'),
        injection_order: e.extensions?.display_index
      });
    });

    // 挂载人设 AT_DEPTH 深度插队
    if (personaInjection) {
      extensionInjections.push(personaInjection);
    }

    // 拼入当前 userInput，形成最新完整历史记录，送往线性排版
    const fullChatHistory: ChatMessageInput[] = [
      ...chatHistory,
      { role: 'user', name: userName, content: userInput }
    ];

    // =========================================================================
    // 7. 调用骨架排版 (PresetAssembler 拼装出包含原始角色的骨架序列)
    // =========================================================================
    const rawSkeleton = PresetAssembler.assemble({
      preset,
      chatHistory: fullChatHistory,
      placeholders,
      extensionInjections,
      macroEngine,
      macroCtx
    });

    // =========================================================================
    // 8. 提示词后处理与转译一键闭环 (PromptPostProcessor)
    // =========================================================================
    const processMode = postProcessingMode !== undefined 
      ? postProcessingMode 
      : (preset.squash_system_messages ? PromptProcessingType.Strict : PromptProcessingType.Semi);

    const context = PromptPostProcessor.process(rawSkeleton, processMode, { user_name: userName, char_name: charName });

    // =========================================================================
    // 9. 终极宏清洗 (清洗 SystemPrompt 以及每一个 Message 节点的正文)
    // =========================================================================
    if (context.systemPrompt) {
      context.systemPrompt = macroEngine.evaluate(context.systemPrompt, macroCtx);
    }

    context.messages = context.messages.map(m => {
      if (m.role === 'user') {
        const cleanedContent = macroEngine.evaluate(m.content as string, macroCtx);
        return {
          ...m,
          content: cleanedContent
        };
      } else {
        const textBlock = (m.content as any[]).find(c => c.type === 'text');
        if (textBlock) {
          textBlock.text = macroEngine.evaluate(textBlock.text, macroCtx);
        }
        return m;
      }
    }) as any;

    const compiledContext: CompiledContext = context;
    compiledContext.activatedWorldbooks = [
      ...scanOutput.activated.before,
      ...scanOutput.activated.after,
      ...scanOutput.activated.atDepth
    ];

    return compiledContext;
  }
}
