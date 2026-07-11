import { LLMClientBase, LLMRequestOptions } from './LLMClientBase';

/**
 * OpenAI 格式适配器
 * 负责将通用参数组装为标准的 OpenAI API 格式，并解析其专属的 SSE 数据流。
 * 兼容支持 OpenAI 格式的各类套壳/代理 API (如 Kimi, DeepSeek 等)。
 * 
 * TODO: (高级特性补全)
 * 1. 多媒体支持 (Multimodal): 需要支持 `content` 为数组的格式（如传入 `image_url` 等视觉/音频输入）。
 * 2. 工具调用 (Tool Calling): 需组装 `tools` 和 `tool_choice` 参数，并在流式解析中拦截并拼接 `tool_calls` 的增量块，用于触发游戏内事件。
 * 3. 推理显示 (Reasoning): 需要在流式解析中分离 `reasoning_content` (如 DeepSeek-R1) 或 `thinking` 块，将 NPC 的“内在思考”独立抛给前端 UI 渲染。
 */
export class OpenAIAdapter extends LLMClientBase {
    
    protected buildRequestInit(options: LLMRequestOptions): RequestInit {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (options.apiKey) {
            headers['Authorization'] = `Bearer ${options.apiKey}`;
        }

        const payload = {
            // 提供默认模型名，但通常通过外部 options 覆盖
            model: options.model || 'gpt-3.5-turbo',
            messages: options.messages,
            temperature: options.temperature ?? 0.8,
            max_tokens: options.max_tokens,
            stream: options.stream ?? true,
            // 预留提取其余自定义参数 (比如 top_p 等)
            ...this.extractExtraParams(options)
        };

        return {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        };
    }

    /**
     * 解析 OpenAI 的 SSE chunk
     * 标准格式: data: {"id":"chatcmpl-123","choices":[{"delta":{"content":"Hello"}}]}
     * 结束标志: data: [DONE]
     */
    protected parseStreamChunk(chunk: string): string | null {
        if (!chunk.startsWith('data: ')) {
            return null;
        }

        const dataStr = chunk.slice(6).trim(); // 移除 "data: "

        if (dataStr === '[DONE]') {
            return null; // 流结束
        }

        try {
            const data = JSON.parse(dataStr);
            // 提取 content
            if (data.choices && data.choices.length > 0) {
                const delta = data.choices[0].delta;
                if (delta && delta.content) {
                    return delta.content;
                }
            }
        } catch (e) {
            console.warn("[OpenAIAdapter] Failed to parse stream chunk JSON:", dataStr);
        }

        return null;
    }

    protected parseNonStreamResponse(data: any): string {
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            return data.choices[0].message.content || '';
        }
        return '';
    }

    private extractExtraParams(options: LLMRequestOptions): Record<string, any> {
        const standardKeys = ['endpoint', 'apiKey', 'messages', 'temperature', 'max_tokens', 'stream', 'signal', 'model'];
        const extras: Record<string, any> = {};
        
        for (const [key, value] of Object.entries(options)) {
            if (!standardKeys.includes(key) && value !== undefined) {
                extras[key] = value;
            }
        }
        return extras;
    }
}
