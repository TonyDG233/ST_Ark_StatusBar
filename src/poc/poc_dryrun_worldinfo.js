/**
 * @name PoC v3.2 - 世界书预演/预检测试 (完整上下文)
 * @description 验证能否在不触发真实生成的情况下，预测出将要被激活的世界书条目。
 * 
 * 测试方法：
 * 1. 在控制台直接执行此代码。
 * 2. 随便在输入框打几个能触发世界书的词，但【不要点发送】。
 * 3. 观察控制台输出，看看能否成功“预言”出即将激活的条目。
 */

(function() {
    const ST_DOC = window.parent?.document || document;
    
    async function testDryRun() {
        const textarea = ST_DOC.querySelector('#send_textarea');
        const text = textarea?.value?.trim() || "";
        
        console.log("[PoC v3.2] 准备进行世界书预检，当前输入框文本:", text);
    
        const st = window.parent?.SillyTavern || window.SillyTavern;
        if (!st || !st.getContext) {
            console.error("[PoC v3.2] 找不到 SillyTavern，请确认在酒馆环境下执行。");
            return;
        }

        const context = st.getContext();
        
        // 【关键修改】把上下文加回去
        const rawChat = context.chat || [];
        const chatStrings = rawChat.map(msg => (msg.mes !== undefined ? msg.mes : String(msg)));
        const mockChat = [...chatStrings, text];
    
        try {
            console.log("[PoC v3.2] 调用 getContext().getWorldInfoPrompt 进行预检(含历史记录)...");
            
            if (!context.getWorldInfoPrompt) {
                console.error("[PoC v3.2] context.getWorldInfoPrompt 不存在！");
                return;
            }

            // 监听 world_info_activated 事件
            let activatedEntries = null;
            const tempListener = (e) => {
                activatedEntries = e.detail || e;
                console.log("[PoC v3.2] 拦截到了预检事件返回的词条:", activatedEntries);
            };
            
            const eventTarget = window.parent?.document || document;
            eventTarget.addEventListener('world_info_activated', tempListener);
            
            const globalEventOn = window.parent?.eventOn || window.eventOn;
            const globalEventOff = window.parent?.eventOff || window.eventOff;
            if (globalEventOn) {
                globalEventOn('world_info_activated', tempListener);
            }
    
            // 把 is_dry_run 设为 false 以触发事件
            const result = await context.getWorldInfoPrompt(
                mockChat, 
                10000, // max_context
                false  // is_dry_run = false
            );
    
            // 清理监听
            eventTarget.removeEventListener('world_info_activated', tempListener);
            if (globalEventOff) {
                globalEventOff('world_info_activated', tempListener);
            }
    
            console.log("[PoC v3.2] 函数返回结果:", result);
            
            // 分析结果
            if (activatedEntries && activatedEntries.length > 0) {
                const names = activatedEntries.map(e => e.comment || "未命名条目").join(", ");
                alert(`[PoC v3.2 预检成功] 预测将激活 ${activatedEntries.length} 个条目！\n分别是: ${names}\n事件已触发，详情请看控制台。`);
            } else if (activatedEntries && activatedEntries.length === 0) {
                alert(`[PoC v3.2 预检结果] 没有任何条目被触发！`);
            } else if (result && result.worldInfoString) {
                alert(`[PoC v3.2 预检结果]\n未触发 activated 事件，但拿到了生成的字符串：\n${result.worldInfoString.substring(0, 100)}...`);
            } else {
                console.warn("[PoC v3.2] 函数执行成功，但未触发 world_info_activated 事件且无文本返回。可能没有命中任何词条。");
            }
        } catch (e) {
            console.error("[PoC v3.2] 调用 getWorldInfoPrompt 失败:", e);
        }
    }
    
    // 注册一个快捷键：Ctrl + Shift + Y 触发预检
    ST_DOC.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'Y') {
            e.preventDefault();
            testDryRun();
        }
    });
    
    console.log("[PoC v3.2] 脚本已独立加载！请在输入框输入触发词后，按 Ctrl + Shift + Y 进行预检 (is_dry_run = false, 含历史记录)。");
    
    window.testDryRun = testDryRun;
})();
