/**
 * POC: Token Counter v2 (Based on Prompt Manager Logs)
 * 
 * 在 v1 中我们自己拼接了 MockChat，但误差极大。
 * 根据观察到的日志，酒馆内部的组装过程极为复杂（涵盖世界书前后缀、描述、剧情、甚至由于各种注入导致的海量 Token）。
 * 我们不能也不应该自己手搓字符串，因为我们无法还原整个 PromptManager 和各类 Extension 的介入（如 26 万 Token 的体量）。
 *
 * 这次我们测试另一个思路：
 * 能否拦截酒馆真正组装完成即将发往大模型的 Payload？
 *
 * 目标事件: `tavern_events.GENERATE_AFTER_DATA` 或通过 Hook
 */

const globalEventOn = window.eventOn || window.parent?.eventOn;
const globalEventOff = window.eventOff || window.parent?.eventOff;

if (!globalEventOn) {
    console.error("未找到 eventOn 方法。");
} else {
    // 监听：酒馆即将发送数据给大模型的时刻
    // `GENERATE_AFTER_DATA` 包含的是完整组装好的 prompt 数组 (对于 chat 模型，通常是 [{role: 'system', content: ...}, ...])
    const onAfterData = (eventData) => {
        console.log("%c[Token Counter POC v2] 捕获到 GENERATE_AFTER_DATA!", "color: blue; font-weight: bold;", eventData);
        
        const promptsArray = eventData.generate_data?.prompt;
        if (!promptsArray) return;

        // 将最终发送的所有 messages 的 content 提取出来拼接，这是送给模型的最真实的文本
        let fullPayloadText = "";
        promptsArray.forEach(msg => {
            fullPayloadText += msg.content + "\n";
        });

        const st = window.SillyTavern || window.parent?.SillyTavern;
        if (st && typeof st.getTokenCountAsync === 'function') {
            console.log("正在对酒馆最终组装完成的数据进行 Token 估算...");
            st.getTokenCountAsync(fullPayloadText).then(count => {
                console.log(`%c[Token Counter POC v2] 估算结果: ${count} Tokens`, 'color: green; font-size: 14px; font-weight: bold;');
                console.log("这应该非常接近最终发出去的 Token 数了。");
            }).catch(err => console.error("估算失败", err));
        }
    };

    globalEventOn('generate_after_data', onAfterData);
    console.log("已绑定 'generate_after_data' 事件监听。请尝试点击一次实际的【发送】按钮。");
    console.log("注意：这要求在真实发送流程中才能捕获到。对于插件里的【预检/DryRun】，由于没有走完整发送流程，无法拦截这个事件。");
}
