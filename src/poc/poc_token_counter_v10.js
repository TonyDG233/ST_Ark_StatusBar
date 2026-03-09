/**
 * POC: Token Counter v10 (最纯净双轨验证版)
 * 
 * 核心认知：
 * 1. 绝对不要使用任何 import 语句来导入 SillyTavern！在酒馆助手环境中，
 *    SillyTavern、eventOnce、tavern_events 这些接口是作为【宿主全局变量】直接注入的，
 *    原生的 window.SillyTavern 并不包含助手特供的方法。
 * 2. 验证“双轨机制”：在同一拦截周期内，能否先后安全地调用 getWorldInfoPrompt 和 generate 干跑。
 */

async function main() {
    console.log("%c[Token Counter POC v10] 准备执行纯净双轨测试...", "color: orange; font-weight: bold;");

    let tokensFound = 0;

    // ==========================================
    // 轨道 1: Token 计算拦截 (干跑 generate 触发)
    // ==========================================
    // 直接使用全局注入的 eventOnce
    eventOnce(tavern_events.CHAT_COMPLETION_PROMPT_READY, async (data) => {
        const payload = data.detail || data;
        if (!payload.dryRun) return;

        console.log("%c[Token Counter POC v10] 成功捕获 Prompt Ready 载荷", "color: green; font-weight: bold;");

        const chatStrings = payload.chat || payload.prompt || [];
        let fullText = '';
        if (Array.isArray(chatStrings)) {
            if (chatStrings.length > 0 && typeof chatStrings[0] === 'object') {
                fullText = chatStrings.map(m => m.content || `${m.name}: ${m.mes}`).join('\n');
            } else {
                fullText = chatStrings.join('\n');
            }
        } else {
            fullText = String(chatStrings);
        }

        try {
            // 【核心修正】：直接使用全局变量 SillyTavern，绝不从 window 上裸取
            if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getTokenCountAsync === 'function') {
                tokensFound = await SillyTavern.getTokenCountAsync(fullText);
                console.log(`%c[Token Counter POC v10] Token计算完成: ${tokensFound}`, "color: blue; font-size: 14px; font-weight: bold;");
            } else {
                console.error("[Token Counter POC v10] 环境中直接访问的 SillyTavern.getTokenCountAsync 依然不存在！");
            }
        } catch (err) {
            console.error("[Token Counter POC v10] Token 估算失败", err);
        }
    });

    // ==========================================
    // 轨道 2: 世界书拦截测试
    // ==========================================
    try {
        console.log("[Token Counter POC v10] 轨道1: 尝试调用 getWorldInfoPrompt...");
        // 此处为了模拟酒馆获取，需要构建一个 mockChat。
        // 因为测试环境不方便构造完整对象，我们只是看看函数存不存在。
        const context = typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function' ? SillyTavern.getContext() : (typeof window !== 'undefined' && window.SillyTavern ? window.SillyTavern.getContext?.() : null);
        if (context && typeof context.getWorldInfoPrompt === 'function') {
            console.log("%c[Token Counter POC v10] 轨道1检查通过: getWorldInfoPrompt 存在且可调用。", "color: green");
            // 这里不做完整调用以免缺少参数报错
        }
    } catch (e) {
        console.error("世界书轨道检查失败", e);
    }

    // 执行干跑以触发 Token
    try {
        console.log("[Token Counter POC v10] 轨道2: 调用 generate 进行干跑...");
        const context = typeof SillyTavern !== 'undefined' && typeof SillyTavern.getContext === 'function' ? SillyTavern.getContext() : (typeof window !== 'undefined' && window.SillyTavern ? window.SillyTavern.getContext?.() : null);
        if (context && typeof context.generate === 'function') {
            await context.generate('normal', {}, true);
        } else {
            console.error("[Token Counter POC v10] 找不到可用的 generate 方法！");
        }
    } catch (e) {
        // 这是预期的，因为干跑会中断正常的网络请求
        console.log("[Token Counter POC v10] generate 抛出异常 (符合干跑预期):", e);
    }
}

// 绑定测试按钮
$(() => {
    const btn = $('<button style="position:fixed;bottom:50px;left:10px;z-index:9999;padding:10px;background:#5bc0de;color:white;border:none;border-radius:4px;cursor:pointer;">执行 v10 测试</button>');
    btn.on('click', main);
    $('body').append(btn);
    console.log("[Token Counter POC v10] 测试按钮已添加，请点击执行。");
});
