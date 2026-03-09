/**
 * POC: Token Counter v4 (Based on TavernHelper eventOnce API)
 * 
 * 修正了事件监听的使用方法。既然我们是在酒馆助手的环境中运行，
 * 我们应当使用酒馆助手提供的全局生命周期安全的 `eventOnce` 或 `eventOn` 方法。
 * 
 * 监听 `tavern_events.CHAT_COMPLETION_PROMPT_READY` 或 `tavern_events.GENERATE_AFTER_COMBINE_PROMPTS`
 */

// 因为这是要贴到控制台运行的代码，我们需要确认在控制台中 eventOnce 是否可直接调用。
// 如果直接在扩展（前端界面/脚本）中，是有 `eventOnce` 可以直接使用的。
const st = window.SillyTavern || window.parent?.SillyTavern;
// 获取全局对象上的 eventOnce（如果在真实的脚本环境中，它可以被直接调用）
const safeEventOnce = typeof eventOnce === 'function' ? eventOnce : (window.parent?.eventOnce || window.eventOnce);

if (!safeEventOnce) {
    console.error("未找到酒馆助手的 eventOnce 方法。此脚本可能需要在助手的真实脚本环境内运行，而非纯净的浏览器 Console。");
} else {
    // 监听：对于 OpenAI Chat 格式的拦截
    safeEventOnce('chat_completion_prompt_ready', (data) => {
        if (!data.dryRun) return; // 只有在假发送时才拦截计算

        console.log("%c[Token Counter POC v4] 成功拦截到 (Chat 格式) 的 DryRun 数据!", "color: blue; font-weight: bold;");
        
        let promptPayload = data.chat;
        if (!promptPayload) return;

        let fullText = Array.isArray(promptPayload) 
            ? promptPayload.map(msg => msg.content || String(msg)).join("\n")
            : String(promptPayload);

        if (st && typeof st.getTokenCountAsync === 'function') {
            console.log("正在计算最终 Token...");
            st.getTokenCountAsync(fullText).then(count => {
                console.log(`%c[Token Counter POC v4] 官方级 DryRun 估算结果: ${count} Tokens`, 'color: green; font-size: 16px; font-weight: bold;');
                if (typeof st.hideLoader === 'function') st.hideLoader();
            }).catch(err => console.error("估算失败", err));
        }
    });

    // 监听：对于原生文本格式的拦截
    safeEventOnce('generate_after_combine_prompts', (data) => {
        if (!data.dryRun) return; 

        console.log("%c[Token Counter POC v4] 成功拦截到 (普通文本格式) 的 DryRun 数据!", "color: blue; font-weight: bold;");
        
        let promptPayload = data.prompt;
        if (!promptPayload) return;

        let fullText = String(promptPayload);

        if (st && typeof st.getTokenCountAsync === 'function') {
            console.log("正在计算最终 Token...");
            st.getTokenCountAsync(fullText).then(count => {
                console.log(`%c[Token Counter POC v4] 官方级 DryRun 估算结果: ${count} Tokens`, 'color: green; font-size: 16px; font-weight: bold;');
                if (typeof st.hideLoader === 'function') st.hideLoader();
            }).catch(err => console.error("估算失败", err));
        }
    });

    // 触发虚假生成请求 (Dry Run)
    console.log("正在触发酒馆内置的 DryRun 生成流程以获取最真实的 Token 数据...");
    try {
        const context = st?.getContext?.();
        if (context && typeof context.generate === 'function') {
            // 参数3 = true 告诉底层这是个 DryRun
            context.generate('normal', {}, true);
        } else {
            console.error("无法调用 context.generate。");
        }
    } catch (error) {
        console.error("触发 DryRun 失败:", error);
    }
}
