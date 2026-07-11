import { LLMClientBase, LLMRequestOptions } from './LLMClientBase';

/**
 * Anthropic Claude 格式适配器
 * 负责解析 Claude Messages API 的特有结构 (System prompt 抽离等)
 * 
 * TODO: 当前仅为极简版占位实现。
 * 后续需严格参考最新官方 API 文档或 TauriTavern 的转换逻辑，
 * 补充关于 multi-modal (图片输入) 以及 tool_choice (函数调用) 的复杂结构映射。
 */
export class ClaudeAdapter extends LLMClientBase {
    protected buildRequestInit(options: LLMRequestOptions): RequestInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'x-api-key': options.apiKey || '',
        };

        // Claude 的 Messages API 要求 system prompt 不能放在 messages 数组里，必须提取为顶层参数
        let systemPrompt = '';
        const filteredMessages = options.messages.filter(msg => {
            if (msg.role === 'system') {
                systemPrompt += msg.content + '\n';
                return false;
            }
            return true;
        });

        const payload = {
            model: options.model || 'claude-3-haiku-20240307',
            max_tokens: options.max_tokens || 4096, // Claude 必须传 max_tokens
            system: systemPrompt.trim(),
            messages: filteredMessages,
            temperature: options.temperature ?? 0.8,
            stream: options.stream ?? true,
        };

        return {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        };
    }

    protected parseStreamChunk(chunk: string): string | null {
        if (!chunk.startsWith('data: ')) return null;
        const dataStr = chunk.slice(6).trim();
        
        try {
            const data = JSON.parse(dataStr);
            // Claude 的流式内容块
            if (data.type === 'content_block_delta' && data.delta && data.delta.text) {
                return data.delta.text;
            }
        } catch (e) {
            // 忽略非 JSON 行
        }
        return null;
    }

    protected parseNonStreamResponse(data: any): string {
        if (data.content && data.content.length > 0) {
            return data.content[0].text || '';
        }
        return '';
    }
}
