/**
 * POC: Token Counter v5 (Pure TavernHelper API)
 * 
 * 完全基于酒馆助手的纯正 API 编写。
 * 因为此脚本是作为酒馆助手的“脚本”加载执行的，
 * 所以我们可以直接、安全地使用 @types/iframe/event.d.ts 中定义的宏全局函数。
 */

// 使用酒馆助手提供的单次监听 API
eventOnce(tavern_events.CHAT_COMPLETION_PROMPT_READY, (data) => {
    // 如果不是 dryRun，直接放行
    if (!data.dryRun) return;

    console.log("%c[Token Counter POC v5] 成功拦截到 (Chat 格式) 的 DryRun 数据!", "color: blue; font-weight: bold;");

    const promptPayload = data.chat;
    if (!promptPayload) return;

    // 将负载转换为文本
    const fullText = Array.isArray(promptPayload)
        ? promptPayload.map(msg => msg.content || String(msg)).join("\n")
        : String(promptPayload);

    // 使用原生酒馆的 getTokenCountAsync
    SillyTavern.getTokenCountAsync(fullText).then(count => {
        console.log(`%c[Token Counter POC v5] 官方级 DryRun 估算结果: ${count} Tokens`, 'color: green; font-size: 16px; font-weight: bold;');
        if (typeof SillyTavern.hideLoader === 'function') SillyTavern.hideLoader();
    }).catch(err => console.error("估算失败", err));
});

// 为了兼容不同的 API 模式 (非 Chat 格式，如普通文本补全)
eventOnce(tavern_events.GENERATE_AFTER_COMBINE_PROMPTS, (data) => {
    if (!data.dryRun) return;

    console.log("%c[Token Counter POC v5] 成功拦截到 (普通文本格式) 的 DryRun 数据!", "color: blue; font-weight: bold;");

    const promptPayload = data.prompt;
    if (!promptPayload) return;

    const fullText = String(promptPayload);

    SillyTavern.getTokenCountAsync(fullText).then(count => {
        console.log(`%c[Token Counter POC v5] 官方级 DryRun 估算结果: ${count} Tokens`, 'color: green; font-size: 16px; font-weight: bold;');
        if (typeof SillyTavern.hideLoader === 'function') SillyTavern.hideLoader();
    }).catch(err => console.error("估算失败", err));
});

// 触发虚假生成请求 (Dry Run)
console.log("正在触发酒馆内置的 DryRun 生成流程以获取最真实的 Token 数据...");
try {
    // 使用助手提供的 generate 宏函数进行 dryRun (通过第三个参数传 true)
    // 助手封装的 generate 函数定义: generate(type, option, dryRun)
    generate('normal', {}, true);
} catch (error) {
    console.error("触发 DryRun 失败:", error);
}
