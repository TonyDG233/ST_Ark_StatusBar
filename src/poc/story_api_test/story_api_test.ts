/**
 * 剧情推演机 V2 次级 API (嗅探器) 测试脚本 PoC
 * 
 * 核心目标：
 * 1. 验证借助 `generateRaw` 调用次级小模型的可行性。
 * 2. 验证“抑制思维链 (NoThinking Trick)”的 System Prompt 在 Gemini 上的效果。
 * 3. 验证结构化输出 (JSON) 的稳定性，为后续 UI 编辑窗做准备。
 * 
 * 运行方式: 构建后将脚本导入酒馆, 打开浏览器控制台运行 `window.testStorySniffer()`
 */

export async function testStorySniffer() {
    console.log('[ARK_StoryPoC] 开始构建次级 API 请求...');

    // 1. 获取最新 3 条对话历史
    let recentMessages = "没有获取到聊天历史。";
    try {
        if (typeof getChatMessages === 'function') {
            // 通过获取所有的消息，然后取最后三个
            const messages = getChatMessages('0-{{lastMessageId}}');
            if (Array.isArray(messages)) {
                recentMessages = messages.slice(-3).map((m: any) => `${m.name}: ${m.mes}`).join('\n\n');
            }
        } else {
            // 如果不存在，使用 SillyTavern.chat 降级
            const chat = (window as any).SillyTavern?.chat || [];
            recentMessages = chat.slice(-3).map((m: any) => `${m.name}: ${m.mes}`).join('\n\n');
        }
    } catch (e) {
        console.warn('[ARK_StoryPoC] 获取聊天历史失败', e);
    }

    // 2. 模拟当前的剧情节点状态 (基于主线 1-5 黎明前奏第一幕)
    const fakeCurrentNode = {
        id: "RI1",
        summary: "切尔诺伯格核心城石棺旁。博士刚刚苏醒，失去了记忆。阿米娅和医疗干员非常焦急。整合运动的小队攻入了废弃设施，阿米娅请求博士指挥罗德岛进行战斗。",
        nextNodes: ["RI2 (发生条件：战斗结束，击退整合运动或成功逃离石棺区)"]
    };

    // 3. 构建 System Prompt (大量借鉴了 MVU 的防瞎聊与身份定义经验)
    const systemPromptHead = `[system reset]
<system_instructions>
identity: You are a professional Story GM (Game Master) and Plot Director. Your ONLY role is to analyze the recent chat history, determine if the plot conditions to advance have been met, and output a strict JSON string.
core principles:
- You do not roleplay. You only analyze.
- You must output valid JSON.
- You must strictly observe the plot offset. If the user's action meets the next node's condition, you approve the transition.
</system_instructions>`;

    const taskPrompt = `<must>
紧急剧情判定任务:
当前节点: [${fakeCurrentNode.id}] ${fakeCurrentNode.summary}
可选的下一节点: ${fakeCurrentNode.nextNodes.join(', ')}

请阅读 <past_observe> 中的最新对话。
判定任务：如果最新对话中表现出博士已经完全清醒并做出战术指挥，或者成功击退敌人，则推进至 RI2。否则停留在 RI1。

请按以下格式严格输出 JSON：
{
  "targetNode": "RI1 或 RI2",
  "directorAdvice": "给扮演AI的导演建议，以旁白视角指导下一步演绎方向。例如：'条件已满足，请引导剧情走向逃脱阶段，不可生硬强制玩家服从，给予玩家动作反应的空间'。绝对不可包含具体的角色台词。"
}
</must>`;

    // 借鉴 MVU 的 NoThinking Trick，强制截断模型的思考过程，极大加快响应速度并强制输出结果
    const noThinkingTail = `---
<think>
- I am a strict JSON parser and GM. I will only output JSON based on the user's action and the node logic.
- Okay, I think I have finished thinking.
</thi`;

    // 4. 发起请求
    try {
        if (typeof toastr !== 'undefined') toastr.info('正在请求次级剧情 API...', 'ARK Story PoC');
        
        // 组装最终配置
        const config: any = {
            user_input: '遵循<must>指令输出纯净 JSON，不要带 markdown 代码块。',
            max_chat_history: 0, // 我们自己注入了历史，不需要自带
            should_stream: false,
            ordered_prompts: [
                { role: 'system', content: systemPromptHead },
                { role: 'system', content: '<past_observe>\n' + recentMessages + '\n</past_observe>' },
                { role: 'system', content: taskPrompt },
                { role: 'system', content: noThinkingTail }
            ]
        };

        // 调用原生 generateRaw
        const result = await (window as any).generateRaw(config);

        console.log('[ARK_StoryPoC] 收到次级 API 回复原文:\n', result);
        if (typeof toastr !== 'undefined') toastr.success('次级 API 请求成功，请查看控制台', 'ARK Story PoC');
        
        // 5. 尝试解析与防崩
        try {
            // 用正则提取被截断思考框后的首个 JSON 块
            const jsonStrMatch = result.match(/\{[\s\S]*\}/);
            if (jsonStrMatch) {
                const parsed = JSON.parse(jsonStrMatch[0]);
                console.log('[ARK_StoryPoC] 成功解析导演 JSON:', parsed);
                alert(`剧情判定成功！\n目标节点: ${parsed.targetNode}\n导演建议: ${parsed.directorAdvice}`);
            } else {
                console.warn('[ARK_StoryPoC] 无法从输出中提取 JSON');
                alert("未找到 JSON 结构，输出请看控制台。");
            }
        } catch (e) {
            console.error('[ARK_StoryPoC] JSON 解析失败:', e);
        }

    } catch (e) {
        console.error('[ARK_StoryPoC] API 请求失败:', e);
        if (typeof toastr !== 'undefined') toastr.error('API 请求失败', 'ARK Story PoC');
    }
}

// 挂载到 window 供控制台手动测试
(window as any).testStorySniffer = testStorySniffer;
