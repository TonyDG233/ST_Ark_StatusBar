import { LLMClientBase, LLMRequestOptions } from './LLMClientBase';

/**
 * Google Gemini 格式适配器
 * 负责解析 Google Generative Language API 的结构 (contents, parts)
 * 
 * TODO: 当前仅为极简版占位实现。
 * 后续需严格参考最新官方 API 文档或 TauriTavern (`src/tauri/main/routes/ai-routes.js` 等) 的处理逻辑，
 * 补充关于 safetySettings、tools (函数调用) 以及 system_instruction 的结构映射。
 */
export class GeminiAdapter extends LLMClientBase {
    protected buildRequestInit(options: LLMRequestOptions): RequestInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // 将通用 roles 转换为 Gemini 的 'user' | 'model'
        const contents = options.messages.map(msg => {
            let role = msg.role === 'assistant' ? 'model' : 'user';
            return {
                role: role,
                parts: [{ text: msg.content }]
            };
        });

        // 注意：如果你直接调用官方端点，通常是 https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={apiKey}
        // 如果是通过反代，URL和参数组合由你的反代决定。这里假设终点已经是完整的 URL，或者通过 headers 传 key。
        if (options.apiKey) {
            headers['Authorization'] = `Bearer ${options.apiKey}`;
            // 兼容某些反代的 x-goog-api-key
            headers['x-goog-api-key'] = options.apiKey;
        }

        const payload = {
            contents: contents,
            generationConfig: {
                temperature: options.temperature ?? 0.8,
                maxOutputTokens: options.max_tokens,
            }
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
            if (data.candidates && data.candidates.length > 0) {
                const parts = data.candidates[0].content?.parts;
                if (parts && parts.length > 0) {
                    return parts[0].text || null;
                }
            }
        } catch (e) {
            // 忽略报错
        }
        return null;
    }

    protected parseNonStreamResponse(data: any): string {
        if (data.candidates && data.candidates.length > 0) {
            return data.candidates[0].content?.parts?.[0]?.text || '';
        }
        return '';
    }
}
