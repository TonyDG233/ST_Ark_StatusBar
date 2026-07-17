import { createProvider } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

export class AgentEngine {
  private models = builtinModels();

  constructor() {}

  /**
   * Generates a streaming response using pre-compiled Context message list directly
   */
  public async generateStreamDirect(
    providerId: string,
    modelId: string,
    apiKey: string,
    endpoint: string,
    formattedMessages: { role: 'system' | 'user' | 'assistant'; content: string; thinking?: string }[],
    signal: AbortSignal,
    callbacks: {
      onTextDelta: (text: string) => void;
      onThinkingDelta: (text: string) => void;
      onComplete: (fullMessage: any) => void;
      onError: (err: Error) => void;
    }
  ) {
    try {
      if (endpoint && endpoint !== 'default') {
        const customProxy = createProvider({
          id: 'custom-proxy',
          name: 'Custom Proxy',
          baseUrl: endpoint,
          auth: { apiKey: { name: 'Custom', resolve: async () => ({ auth: { apiKey } }) } },
          models: [
            {
              id: modelId,
              name: modelId,
              api: 'openai-completions',
              provider: 'custom-proxy',
              baseUrl: endpoint,
              reasoning: true,
              input: ['text', 'image'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 8192
            }
          ],
          api: openAICompletionsApi(),
        });
        this.models.setProvider(customProxy);
        providerId = 'custom-proxy';
      }

      const model = this.models.getModel(providerId, modelId);
      if (!model) {
        throw new Error(`Model not found: ${providerId}/${modelId}`);
      }

      const systemMsgs = formattedMessages.filter(m => m.role === 'system');
      const otherMsgs = formattedMessages.filter(m => m.role !== 'system');
      
      const finalContext = {
        systemPrompt: systemMsgs.map(m => m.content).join('\n'),
        messages: otherMsgs.map(m => {
          const content = m.role === 'assistant'
            ? (m.thinking 
                ? [ { type: 'thinking', thinking: m.thinking }, { type: 'text', text: m.content } ]
                : [ { type: 'text', text: m.content } ]
              )
            : m.content;
          return {
            role: m.role as 'user' | 'assistant',
            content: content,
            timestamp: Date.now(),
            // 🚨 为 assistant 角色注入 Dummy usage 块以彻底拦截 pi-ai 的 totalTokens / input 评估崩溃！
            ...(m.role === 'assistant' ? {
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
              }
            } : {})
          };
        })
      };

      const stream = this.models.streamSimple(model, finalContext as any, { 
        apiKey: apiKey || undefined,
        signal,
        reasoning: 'medium'
      });

      for await (const event of stream) {
        if (event.type === 'text_delta') {
          callbacks.onTextDelta(event.delta);
        } else if (event.type === 'thinking_delta') {
          callbacks.onThinkingDelta(event.delta);
        } else if (event.type === 'error') {
          throw new Error(event.error.errorMessage || 'Unknown streaming error');
        }
      }

      const result = await stream.result();
      callbacks.onComplete(result);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignore aborts
      } else {
        callbacks.onError(err);
      }
    }
  }

  /**
   * Generates a streaming response using pi-ai
   */
  public async generateStream(
    providerId: string,
    modelId: string,
    apiKey: string,
    endpoint: string,
    messages: { role: 'system' | 'user' | 'assistant'; content: string; thinking?: string }[],
    signal: AbortSignal,
    callbacks: {
      onTextDelta: (text: string) => void;
      onThinkingDelta: (text: string) => void;
      onComplete: (fullMessage: any) => void;
      onError: (err: Error) => void;
    }
  ) {
    try {
      // 动态注册一个自定义 Provider 用于本地反代测试 (如 127.0.0.1:8889)
      if (endpoint && endpoint !== 'default') {
        const customProxy = createProvider({
          id: 'custom-proxy',
          name: 'Custom Proxy',
          baseUrl: endpoint,
          auth: { apiKey: { name: 'Custom', resolve: async () => ({ auth: { apiKey } }) } },
          models: [
            {
              id: modelId,
              name: modelId,
              api: 'openai-completions',
              provider: 'custom-proxy',
              baseUrl: endpoint,
              reasoning: true, // 开启推理支持
              input: ['text', 'image'],
              cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 8192
            }
          ],
          api: openAICompletionsApi(),
        });
        this.models.setProvider(customProxy);
        providerId = 'custom-proxy';
      }

      const model = this.models.getModel(providerId, modelId);
      if (!model) {
        throw new Error(`Model not found: ${providerId}/${modelId}`);
      }

      // 提取 System Prompt 并移除
      const systemMsgs = messages.filter(m => m.role === 'system');
      const otherMsgs = messages.filter(m => m.role !== 'system');
      
      const finalContext = {
        systemPrompt: systemMsgs.map(m => m.content).join('\n'),
        messages: otherMsgs.map(m => {
          const content = m.role === 'assistant' && m.thinking 
            ? [ { type: 'thinking', thinking: m.thinking }, { type: 'text', text: m.content } ]
            : m.content;
          return {
            role: m.role as 'user' | 'assistant',
            content: content,
            timestamp: Date.now(),
            // 🚨 为 assistant 角色注入 Dummy usage 块以彻底拦截 pi-ai 的 totalTokens / input 评估崩溃！
            ...(m.role === 'assistant' ? {
              usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
              }
            } : {})
          };
        })
      };

      // 使用 streamSimple 进行流式响应，自动处理多模态和思考过程
      const stream = this.models.streamSimple(model, finalContext as any, { 
        apiKey: apiKey || undefined,
        signal,
        reasoning: 'medium' // 自动开启中等深度的思维链
      });

      for await (const event of stream) {
        if (event.type === 'text_delta') {
          callbacks.onTextDelta(event.delta);
        } else if (event.type === 'thinking_delta') {
          callbacks.onThinkingDelta(event.delta);
        } else if (event.type === 'error') {
          throw new Error(event.error.errorMessage || 'Unknown streaming error');
        }
      }

      const result = await stream.result();
      callbacks.onComplete(result);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignore aborts
      } else {
        callbacks.onError(err);
      }
    }
  }
}