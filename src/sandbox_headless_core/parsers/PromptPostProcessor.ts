import { PromptProcessingType } from '../types/TavernData';
import { Context, UserMessage, AssistantMessage } from '@earendil-works/pi-ai';

export interface InternalMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  injected?: boolean;
}

export interface PromptNames {
  user_name: string;
  char_name: string;
}

export class PromptPostProcessor {
  /**
   * 运行提示词后处理转换管线，并【在此处闭环】一键转译翻译为 pi-ai 发包 Context
   */
  public static process(
    messages: InternalMessage[],
    type: PromptProcessingType,
    names: PromptNames
  ): Context {
    // 根据模式，匹配底层四个微观参数开关
    const strict = [
        PromptProcessingType.Semi,
        PromptProcessingType.SemiTools,
        PromptProcessingType.Strict,
        PromptProcessingType.StrictTools,
        PromptProcessingType.Single
    ].includes(type);

    const placeholders = [
        PromptProcessingType.Strict,
        PromptProcessingType.StrictTools
    ].includes(type);

    const single = type === PromptProcessingType.Single;

    const tools = [
        PromptProcessingType.MergeTools,
        PromptProcessingType.SemiTools,
        PromptProcessingType.StrictTools
    ].includes(type);

    // 运行合并重排
    const processedMessages = this.mergeMessages(messages, names, { strict, placeholders, single, tools });

    // =========================================================================
    // 👑 转译为 pi-ai 格式输出 (彻底在此处实现业务闭环，不让 ContextBuilder 操心类型)
    // =========================================================================
    const systemPromptNode = processedMessages.find(m => m.role === 'system');
    const systemPrompt = systemPromptNode ? systemPromptNode.content : undefined;

    const otherMessages = processedMessages.filter(m => m.role !== 'system');

    const piMessages = otherMessages.map(m => {
      if (m.role === 'user') {
        return {
          role: 'user',
          content: m.content,
          timestamp: Date.now()
        } as UserMessage;
      } else {
        return {
          role: 'assistant',
          content: [{ type: 'text', text: m.content }],
          api: 'custom' as any,
          provider: 'custom',
          model: 'custom',
          usage: { inputTokens: 0, outputTokens: 0 },
          stopReason: 'stop',
          timestamp: Date.now()
        } as unknown as AssistantMessage;
      }
    });

    return {
      systemPrompt,
      messages: piMessages as any
    };
  }

  private static mergeMessages(
    messages: InternalMessage[],
    names: PromptNames,
    options: { strict: boolean; placeholders: boolean; single: boolean; tools: boolean }
  ): InternalMessage[] {
    const normalized: InternalMessage[] = [];

    // --- Phase 1: 格式清洗与角色限制 (Normalize) ---
    for (const msg of messages) {
        let content = msg.content || '';
        let role = msg.role.trim().toLowerCase();
        let name = msg.name?.trim();

        if (role === 'system' && name === 'example_assistant') {
            if (!content.startsWith(`${names.char_name}:`)) {
                content = `${names.char_name}: ${content}`;
            }
        } else if (role === 'system' && name === 'example_user') {
            if (!content.startsWith(`${names.user_name}:`)) {
                content = `${names.user_name}: ${content}`;
            }
        }

        // 🚨 物理对齐：仅在 role !== system 且带有“真正的物理说话人”时才允许追加前缀！
        // 任何 UUID 或 placeholder 的 msg.name 全在前面被除名了，此处只保护真正的角色对话历史。
        if (role !== 'system' && name) {
            const prefix = `${name}: `;
            if (!content.startsWith(prefix)) {
                content = `${prefix}${content}`;
            }
        }

        if (role === 'tool' && !options.tools) {
            role = 'user';
        }

        if (options.single) {
            if (role === 'assistant') {
                if (!content.startsWith(`${names.char_name}:`)) {
                    content = `${names.char_name}: ${content}`;
                }
            } else if (role === 'user') {
                if (!content.startsWith(`${names.user_name}:`)) {
                    content = `${names.user_name}: ${content}`;
                }
            }
            role = 'user';
        }

        // 🚨 黄金剥离点：一比一移植 Rust 的 message_object.remove("name")！
        // 扔掉 name 和 id，拒绝二次降级、Squash 和递归处理时产生任何垃圾前缀污染。
        normalized.push({
            role: role as any,
            content,
            injected: msg.injected
        });
    }

    // --- Phase 2: 同角色连续物理合并 (Squash) ---
    const merged: InternalMessage[] = [];
    for (const msg of normalized) {
        if (msg.content.trim() === '') continue;

        let canMerge = false;
        const last = merged[merged.length - 1];
        if (last && last.role === msg.role && msg.role !== 'tool') {
            canMerge = true;
        }

        if (canMerge && last) {
            last.content = `${last.content}\n\n${msg.content}`;
        } else {
            merged.push({ ...msg });
        }
    }

    if (merged.length === 0) {
        merged.push({ role: 'user', content: "Let's get started." });
    }

    // --- Phase 3: 严格消息角色交替 (Strict Downgrade & Placeholders) ---
    if (options.strict) {
        for (let i = 1; i < merged.length; i++) {
            if (merged[i].role === 'system') {
                merged[i].role = 'user';
            }
        }

        if (options.placeholders && merged.length > 0) {
            const firstRole = merged[0].role;
            const secondRole = merged[1]?.role;

            if (firstRole === 'system' && secondRole !== 'user') {
                merged.splice(1, 0, { role: 'user', content: "Let's get started." });
            } else if (firstRole !== 'system' && firstRole !== 'user') {
                merged.unshift({ role: 'user', content: "Let's get started." });
            }
        }

        return this.mergeMessages(merged, names, {
            strict: false, 
            placeholders: options.placeholders,
            single: false,
            tools: options.tools
        });
    }

    return merged;
  }
}
