/**
 * POC: Token Counter v4 (Based on Proper Event Listener)
 * 
 * 修改了监听模式，因为酒馆的原生 eventOff 并未暴露给所有上下文，
 * 实际上在酒馆助手 (TavernHelper) 的环境中，应当使用提供的事件系统
 * (或者直接使用原始 EventEmitter 对象的 .on / .off，而不是随意猜测的 globalEventOff)。
 *
 * 这次我们将：
 * 1. 使用 window.SillyTavern.eventSource.on() 和 .off() 绑定和解绑事件。
 * 2. 监听 'chat_completion_prompt_ready' (对于 chat 格式) 或 'generate_after_combine_prompts'。
 * 3. 使用 `context.generate('normal', {}, true)` 触发真实的内部 DryRun。
 */

const st = window.SillyTavern || window.parent?.SillyTavern;

if (!st || !st.eventSource) {
    console.error("未找到 SillyTavern.eventSource 对象。");
} else {
    // 监听回调
    const tempListener = (data) => {
        // data.dryRun 在不同事件中层级可能不同
        // 对于 CHAT_COMPLETION_PROMPT_READY，通常是 eventData.dryRun
        // 对于 GENERATE_AFTER_COMBINE_PROMPTS，通常是 result.dryRun
        if (!data.dryRun) {
            return;
        }

        console.log("%c[Token Counter POC v4] 成功拦截到 DryRun 组装完毕的 Prompt 数据!", "color: blue; font-weight: bold;");
        
        // 尝试提取 prompt 载荷
        let promptPayload = data.chat || data.prompt;
        if (!promptPayload) {
            console.error("未能从事件中提取到 Prompt 负载。事件对象：", data);
            return;
        }

        // 将负载转换为纯文本，用于估算 token
        let fullText = "";
        if (Array.isArray(promptPayload)) {
            fullText = promptPayload.map(msg => msg.content || String(msg)).join("\n");
        } else {
            fullText = String(promptPayload);
        }

        // 进行最终的 Token 计算
        if (typeof st.getTokenCountAsync === 'function') {
            console.log("正在计算最终 Token...");
            st.getTokenCountAsync(fullText).then(count => {
                console.log(`%c[Token Counter POC v4] 官方级 DryRun 估算结果: ${count} Tokens`, 'color: green; font-size: 16px; font-weight: bold;');
                
                // 【特别提醒】在获取成功后，由于我们调用了 generate({}, true)，它可能会停留在加载状态
                // 若出现假加载，尝试关闭它
                if (typeof st.hideLoader === 'function') st.hideLoader();
                
            }).catch(err => console.error("估算失败", err));
        }

        // 用完即焚，解绑监听器
        st.eventSource.removeListener('chat_completion_prompt_ready', tempListener);
        st.eventSource.removeListener('generate_after_combine_prompts', tempListener);
        console.log("[Token Counter POC v4] 事件监听已解绑。");
    };

    // 使用 eventSource.on 绑定事件 (酒馆原生 EventEmitter 的用法)
    st.eventSource.on('chat_completion_prompt_ready', tempListener);
    st.eventSource.on('generate_after_combine_prompts', tempListener);

    // 触发虚假生成请求 (Dry Run)
    console.log("正在触发酒馆内置的 DryRun 生成流程以获取最真实的 Token 数据...");
    try {
        const context = st.getContext?.();
        if (context && typeof context.generate === 'function') {
            // 参数3 = true 告诉底层这是个 DryRun
            context.generate('normal', {}, true);
        } else {
            console.error("无法调用 context.generate。");
        }
    } catch (error) {
        console.error("触发 DryRun 失败:", error);
        st.eventSource.removeListener('chat_completion_prompt_ready', tempListener);
        st.eventSource.removeListener('generate_after_combine_prompts', tempListener);
    }
}
