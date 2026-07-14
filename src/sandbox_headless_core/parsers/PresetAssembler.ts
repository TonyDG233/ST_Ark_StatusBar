import { ExportedPresetData, PresetPromptData } from '../types/TavernData';
import { Context, Message, UserMessage, AssistantMessage } from '@earendil-works/pi-ai';

export interface ChatMessageInput {
  role: 'user' | 'assistant';
  name?: string;
  content: string;
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
}

  // 中间态消息结构，用于 Phase 1 组装，保留真实的 role
  export interface InternalMessage {
    role: 'system' | 'user' | 'assistant';
    name?: string;
    content: string;
    injected?: boolean;
  }
  
  export class PresetAssembler {
    /**
     * 组装 pi-ai 标准的 Context
     */
    public static assemble(options: AssemblerOptions): Context {
      const { preset, chatHistory, placeholders } = options;
      // 默认开启 Strict 模式 (针对 Gemini/Claude 等现代模型)
      const isStrictModel = true;
  
      // --- Phase 1: 组装期 (Native Assembly) ---
      // 1. 找到全量蓝图 (prompt_order)
      const activeOrderObj = preset.prompt_order.find(o => o.order && o.order.length > 0);
      const orderBlueprint = activeOrderObj ? activeOrderObj.order : [];
  
      // 2. 分类提示词 (Relative vs In-Chat)
      const relativePromptsMap = new Map<string, PresetPromptData>();
      const inChatInjections: PresetPromptData[] = [];
  
      for (const p of preset.prompts) {
        if (!p.enabled) continue;
        if (p.injection_position === 1) {
          inChatInjections.push(p);
        } else {
          relativePromptsMap.set(p.identifier, p);
        }
      }
  
      // 将 In-Chat 插入排序 (深度从浅到深(数字从小到大)，顺序从大到小)
      inChatInjections.sort((a, b) => {
        const depthA = a.injection_depth ?? 0;
        const depthB = b.injection_depth ?? 0;
        if (depthA !== depthB) return depthA - depthB;
        
        const orderA = a.injection_order ?? 0;
        const orderB = b.injection_order ?? 0;
        return orderB - orderA;
      });
  
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
              (hitHistoryBoundary ? postHistoryPrompts : preHistoryPrompts).push({ role: 'system', content: text });
            }
            continue;
          }
  
          const promptDef = relativePromptsMap.get(item.identifier);
          const text = promptDef ? this.resolveContent(promptDef, placeholders) : placeholders[item.identifier];
          const role = promptDef ? (promptDef.role || 'system') : 'system';
  
          if (text) {
            if (hitHistoryBoundary) postHistoryPrompts.push({ role: role as any, content: text });
            else preHistoryPrompts.push({ role: role as any, content: text });
          }
        }
      }
  
      // 4. 格式化传入的历史记录 (Names Behavior & Wrap)
    let internalMessages: InternalMessage[] = chatHistory.map(m => {
      let content = m.content;
      if (preset.names_behavior === 0 && m.name && m.role !== ('system' as any)) {
         content = `${m.name}: ${content}`;
      }
      if (preset.wrap_in_quotes && m.role === 'user') {
         content = `"${content}"`;
      }
      return { role: m.role, name: m.name, content };
    });
  
      // 4.1 处理 In-Chat Injections (深度插队)
      for (const inj of inChatInjections) {
        const text = this.resolveContent(inj, placeholders);
        if (!text) continue;
  
        const depth = inj.injection_depth ?? 0;
        let injectIdx = internalMessages.length - depth;
        if (injectIdx < 0) injectIdx = 0;
        if (injectIdx > internalMessages.length) injectIdx = internalMessages.length;
        
        internalMessages.splice(injectIdx, 0, { role: (inj.role as any) || 'system', content: text, injected: true });
      }
  
      // 4.2 将 postHistory 拼接到历史记录末尾
      internalMessages = [...internalMessages, ...postHistoryPrompts];
  
      // 4.3 处理 Assistant Prefill (伪装成最后一条 model 消息)
      if (preset.continue_prefill && preset.assistant_prefill) {
        internalMessages.push({ role: 'assistant', content: preset.assistant_prefill });
      }
  
  
      // --- Phase 2: 降级期 (Strict Mode Downgrade) ---
      let finalSystemPrompt = '';
  
      // 预设头部的系统提示：如果 use_sysprompt 关闭，降级为 User 消息放入 internalMessages 头部
      if (preset.use_sysprompt === false || preset.claude_use_sysprompt === false) {
        internalMessages = [...preHistoryPrompts.map(p => ({ ...p, role: 'user' as const })), ...internalMessages];
      } else {
        // 如果开启 squash_system_messages，即使是 systemPrompt 也要暴力合并
        if (preset.squash_system_messages) {
           finalSystemPrompt = preHistoryPrompts.map(p => p.content).join('\n\n');
        } else {
           finalSystemPrompt = preHistoryPrompts.map(p => p.content).join('\n');
        }
      }
  
      // 根据 Rust 源码: 如果开启 strict，除首条消息(已放进 finalSystemPrompt)外，把所有 system 降级为 user
      if (isStrictModel) {
        internalMessages = internalMessages.map(m => {
          if (m.role === 'system') return { ...m, role: 'user' as const };
          return m;
        });
      }
  
  
      // --- Phase 3: 合并期 (Merge Consecutive) ---
      const mergedMessages: InternalMessage[] = [];
      for (const msg of internalMessages) {
        const lastMsg = mergedMessages[mergedMessages.length - 1];
        
        // Squash logic: 同角色且有内容，即执行合并
        // 注意：原版逻辑中，开启 squash_system_messages 会合并 system。
        // 但在 Strict 模式降级后，同为 user 的消息会自动命中原生同角色合并逻辑。
        const canMerge = lastMsg && lastMsg.role === msg.role && msg.content.trim() !== '';
        
        if (canMerge) {
          lastMsg.content = `${lastMsg.content}\n\n${msg.content}`;
        } else {
          if (msg.content.trim() !== '') {
            mergedMessages.push({ ...msg });
          }
        }
      }
  
  
      // --- 转译为 pi-ai 格式输出 ---
      const piMessages: Message[] = mergedMessages.map(m => {
        if (m.role === 'user') {
          return { role: 'user', content: m.content, timestamp: Date.now() } as UserMessage;
        } else {
          return { 
            role: 'assistant', 
            content: [{ type: 'text', text: m.content }], 
            api: 'custom' as any, provider: 'custom', model: 'custom', 
            usage: { inputTokens: 0, outputTokens: 0 }, stopReason: 'stop', timestamp: Date.now() 
          } as unknown as AssistantMessage;
        }
      });
  
      return {
        systemPrompt: finalSystemPrompt ? finalSystemPrompt : undefined,
        messages: piMessages
      };
    }

  private static resolveContent(prompt: PresetPromptData, placeholders: Record<string, string>): string {
    if (prompt.marker && placeholders[prompt.identifier] !== undefined) {
      return placeholders[prompt.identifier];
    }
    return prompt.content || '';
  }
}