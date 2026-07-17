import { ExportedPresetData, PresetPromptData } from '../types/TavernData';
import { MacroEngine, MacroContext } from './MacroEngine';

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  name?: string;
  content: string;
}

export interface InjectionPrompt {
  identifier: string;
  content: string;
  injection_depth: number;
  role: 'system' | 'user' | 'assistant';
  injection_order?: number;
}

export interface AssemblerOptions {
  preset: ExportedPresetData;
  chatHistory: ChatMessageInput[];
  /**
   * 对应各种系统占位符的具体文本，例如：
   * charDescription: "阿米娅是罗德岛的领袖...",
   * worldInfoBefore: "泰拉世界存在源石...",
   * 这样Assembler只需负责拼接，把解析角色卡和世界书的工作剥离。
   */
  placeholders: Record<string, string>;
  
  // 运行时深度插队扩展提示词 (如人设 PERSONA_DESCRIPTION, 深度世界书等)
  extensionInjections?: InjectionPrompt[];

  // 注入宏引擎和统一变量上下文，以达到 100% 完美的宏洗涤
  macroEngine?: MacroEngine;
  macroCtx?: MacroContext;
}

// 中间态消息结构，用于 Phase 1 组装，保留真实的 role
export interface InternalMessage {
  id?: string;                        // 用于生命周期、调试和占位符追踪的内部 ID (如 UUID, nsfw, worldInfoBefore)
  role: 'system' | 'user' | 'assistant' | 'tool';
  name?: string;                      // 纯粹的故事内物理说话人名称 (如 Amiya, User)，其它块必须保持 undefined
  content: string;
  injected?: boolean;
}

export class PresetAssembler {
  /**
   * 组装原始的、未进行角色降级和合并的线性消息骨架
   */
  public static assemble(options: AssemblerOptions): InternalMessage[] {
    const { preset, chatHistory, placeholders, extensionInjections = [] } = options;

    // --- Phase 1: 组装期 (Native Assembly) ---
    // 1. 找到全量蓝图 (prompt_order)
    const activeOrderObj = preset.prompt_order.find(o => o.order && o.order.length > 0);
    const orderBlueprint = activeOrderObj ? activeOrderObj.order : [];

    // 2. 分类提示词 (Relative vs In-Chat)
    const relativePromptsMap = new Map<string, PresetPromptData>();
    const presetInChatInjections: PresetPromptData[] = [];

    for (const p of preset.prompts) {
      // 🚨 对齐 TauriTavern：忽略静态 prompts 列表中的 p.enabled 属性！
      // 这里的 prompts 只是静态条目池，真正的启用开关由 prompt_order 判定
      if (p.injection_position === 1) { // in-chat
        presetInChatInjections.push(p);
      } else {
        relativePromptsMap.set(p.identifier, p);
      }
    }

    // 3. 线性遍历组装 (Base Linear Structure)
    const preHistoryPrompts: InternalMessage[] = [];
    const postHistoryPrompts: InternalMessage[] = [];
    let hitHistoryBoundary = false;

    if (orderBlueprint.length === 0) {
      // 如果没有配置 prompt_order，作为容错退化为简单堆叠
      for (const p of relativePromptsMap.values()) {
        const text = this.resolveContent(p, placeholders);
        if (text) preHistoryPrompts.push({ role: p.role as any || 'system', content: text });
      }
    } else {
      for (const item of orderBlueprint) {
        if (!item.enabled) continue;

        if (item.identifier === 'chatHistory') {
          hitHistoryBoundary = true;
          continue;
        }

        // 暂时将 dialogueExamples 也作为普通文本块占位符处理
        if (item.identifier === 'dialogueExamples') {
          const text = placeholders['dialogueExamples'];
          if (text) {
            const expandedText = (options.macroEngine && options.macroCtx) ? options.macroEngine.evaluate(text, options.macroCtx) : text;
            (hitHistoryBoundary ? postHistoryPrompts : preHistoryPrompts).push({ id: 'dialogueExamples', role: 'system', name: undefined, content: expandedText });
          }
          continue;
        }

        const promptDef = relativePromptsMap.get(item.identifier);
        
        let text = '';
        if (promptDef) {
          if (promptDef.marker) {
            text = placeholders[item.identifier] !== undefined ? placeholders[item.identifier] : (promptDef.content || '');
          } else {
            // 最关键历史重拾：如果是常驻指令块/UUID块，必须直接提取并保留其原始 content！绝不走 placeholders 覆盖！
            text = promptDef.content || '';
          }
        } else {
          text = placeholders[item.identifier] || '';
        }

        const role = promptDef ? (promptDef.role || 'system') : 'system';

        if (text) {
          // 进行一次宏清洗
          if (options.macroEngine && options.macroCtx) {
            text = options.macroEngine.evaluate(text, options.macroCtx);
          }
          const msg: InternalMessage = { id: item.identifier, role: role as any, name: undefined, content: text };
          if (hitHistoryBoundary) postHistoryPrompts.push(msg);
          else preHistoryPrompts.push(msg);
        }
      }
    }

    // 4. 格式化传入的历史记录 (Names Behavior & Wrap)
    let internalMessages: InternalMessage[] = chatHistory.map((m, idx) => {
      let content = m.content;
      if (preset.names_behavior === 0 && m.name && m.role !== ('system' as any)) {
         content = `${m.name}: ${content}`;
      }
      if (preset.wrap_in_quotes && m.role === 'user') {
         content = `"${content}"`;
      }
      return { id: `chat_history_${idx}`, role: m.role, name: m.name, content };
    });

    // --- 5. 深度插队多重循环算法 (Replicating populationInjectionPrompts) ---
    // 合并来自预设的 In-Chat 和运行时的 ExtensionInjections 为统一格式
    const allInjections: InjectionPrompt[] = [
      ...presetInChatInjections.map(p => ({
        identifier: p.identifier,
        content: this.resolveContent(p, placeholders),
        injection_depth: p.injection_depth ?? 0,
        role: (p.role as any) || 'system',
        injection_order: p.injection_order
      })),
      ...extensionInjections
    ];

    // 过滤掉无内容项
    const validInjections = allInjections.filter(inj => inj.content && inj.content.trim() !== '');

    // 100% 还原 TauriTavern 算法：使用 reversed 数组并在其上进行精准 index 递增插入
    const reversedMessages = [...internalMessages].reverse();
    let totalInsertedMessages = 0;

    // 获取最大注入深度
    const maxDepth = validInjections.reduce((max, inj) => Math.max(max, inj.injection_depth), 0);

    for (let d = 0; d <= maxDepth; d++) {
      // 找出当前深度的所有注入
      const depthPrompts = validInjections.filter(inj => inj.injection_depth === d);
      if (depthPrompts.length === 0) continue;

      // 按 injection_order 进行分组 (默认为 100)
      const orderGroups: Record<number, InjectionPrompt[]> = {};
      for (const p of depthPrompts) {
        const order = p.injection_order ?? 100;
        if (!orderGroups[order]) {
          orderGroups[order] = [];
        }
        orderGroups[order].push(p);
      }

      // 优先级从高到低排序 (b - a)
      const sortedOrders = Object.keys(orderGroups).map(Number).sort((a, b) => b - a);

      for (const order of sortedOrders) {
        const promptsInOrder = orderGroups[order];
        
        // 按 roles 顺序插入：['system', 'user', 'assistant']
        const roles: ('system' | 'user' | 'assistant')[] = ['system', 'user', 'assistant'];
        for (const r of roles) {
          let jointContent = promptsInOrder
            .filter(p => p.role === r)
            .map(p => p.content)
            .join('\n');

          if (jointContent && jointContent.trim() !== '') {
            if (options.macroEngine && options.macroCtx) {
              jointContent = options.macroEngine.evaluate(jointContent, options.macroCtx);
            }
            
            const injectIdx = d + totalInsertedMessages;
            const safeIdx = Math.min(Math.max(0, injectIdx), reversedMessages.length);
            
            reversedMessages.splice(safeIdx, 0, {
              id: jointContent.substring(0, 30), // 内部追踪，不污染 name
              role: r,
              content: jointContent,
              injected: true
            });
            totalInsertedMessages++;
          }
        }
      }
    }

    // 还原消息历史顺序
    internalMessages = reversedMessages.reverse();

    // 4.2 将 postHistory 拼接到历史记录末尾
    internalMessages = [...internalMessages, ...postHistoryPrompts];

    // 4.3 处理 Assistant Prefill (伪装成最后一条 model 消息)
    if (preset.continue_prefill && preset.assistant_prefill) {
      let prefill = preset.assistant_prefill;
      if (options.macroEngine && options.macroCtx) {
        prefill = options.macroEngine.evaluate(prefill, options.macroCtx);
      }
      internalMessages.push({ id: 'assistant_prefill', role: 'assistant', name: undefined, content: prefill });
    }

    // 拼入 preHistoryPrompts 头部，输出完整、原汁原味消息序列
    return [...preHistoryPrompts, ...internalMessages];
  }

  private static resolveContent(prompt: PresetPromptData, placeholders: Record<string, string>): string {
    if (prompt.marker && placeholders[prompt.identifier] !== undefined) {
      return placeholders[prompt.identifier];
    }
    return prompt.content || '';
  }
}