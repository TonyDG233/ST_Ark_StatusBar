/**
 * LLMClientBase
 * 
 * 核心网络通信基类。只负责最基础的：
 * 1. 发起 Fetch 请求
 * 2. 处理 AbortController 中断
 * 3. 处理流式 (Streaming) 响应的 Chunk 解析
 * 
 * 具体如何组装 Payload (例如把 Message[] 转成 OpenAI 格式)，由继承的 Adapter 实现。
 */

export interface LLMMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface LLMRequestOptions {
    endpoint: string;
    apiKey?: string;
    messages: LLMMessage[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    signal?: AbortSignal;
    
    // 预留给其他特定大模型的高级参数
    [key: string]: any;
}

export interface StreamCallbacks {
    onChunk: (text: string) => void;
    onComplete: (fullText: string) => void;
    onError: (error: Error) => void;
}

export abstract class LLMClientBase {
    /**
     * 子类必须实现这个方法，用于将通用配置转换为特定厂商的 HTTP Request Init (headers, body)
     */
    protected abstract buildRequestInit(options: LLMRequestOptions): RequestInit;

    /**
     * 子类必须实现这个方法，用于从特定厂商的流式 Chunk 字符串中提取出纯文本 delta
     */
    protected abstract parseStreamChunk(chunk: string): string | null;

    /**
     * 发起生成请求 (支持流式)
     */
    public async generate(options: LLMRequestOptions, callbacks?: StreamCallbacks): Promise<string> {
        const init = this.buildRequestInit(options);
        if (options.signal) {
            init.signal = options.signal;
        }

        try {
            const response = await fetch(options.endpoint, init);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`[LLMClient] HTTP Error ${response.status}: ${errorText}`);
            }

            // 如果不要求流式，直接返回全部
            if (!options.stream) {
                const data = await response.json();
                const fullText = this.parseNonStreamResponse(data);
                callbacks?.onComplete?.(fullText);
                return fullText;
            }

            // 处理流式返回
            if (!response.body) {
                throw new Error("[LLMClient] Response body is null during streaming.");
            }

            return await this.handleStream(response.body, callbacks);

        } catch (error: any) {
            callbacks?.onError?.(error);
            throw error;
        }
    }

    /**
     * 默认处理流的逻辑 (读取 ReadableStream)
     */
    private async handleStream(body: ReadableStream<Uint8Array>, callbacks?: StreamCallbacks): Promise<string> {
        const reader = body.getReader();
        const decoder = new TextDecoder('utf-8');
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                
                // Server-Sent Events (SSE) 通常以 \n\n 分隔
                const chunks = buffer.split('\n\n');
                buffer = chunks.pop() || ''; // 最后一个可能不完整，留给下一次循环

                for (const chunk of chunks) {
                    const trimmedChunk = chunk.trim();
                    if (!trimmedChunk) continue;

                    const delta = this.parseStreamChunk(trimmedChunk);
                    if (delta) {
                        fullText += delta;
                        callbacks?.onChunk?.(delta);
                    }
                }
            }

            // 流结束
            callbacks?.onComplete?.(fullText);
            return fullText;

        } finally {
            reader.releaseLock();
        }
    }

    /**
     * 子类实现：如何从非流式响应 JSON 中提取完整回复
     */
    protected abstract parseNonStreamResponse(data: any): string;
}
