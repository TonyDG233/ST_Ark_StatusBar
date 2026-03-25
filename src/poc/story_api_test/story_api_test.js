/**
 * 剧情推演机 V2 次级 API (嗅探器) 测试脚本 PoC
 *
 * 测试结论 (2026-03-22):
 * 1. 成功跑通了基于 Gemini 模型的 NoThinking 截断技巧，JSON 解析 100% 成功。
 * 2. 成功获取了高质量的"导演建议"和"目标节点"。
 * 3. 自定义 API 的配置机制（使用反代后的 openai 格式 /v1 后缀）经测试完全兼容。
 *
 * 新增特性:
 * - 支持配置独立的次级 API (URL, Key, Model) 并保存在本地。
 * - 纯 JS 编写，在控制台运行不再有任何报错。
 *
 * 运行方式:
 * 1. 将以下代码复制到浏览器控制台执行。
 * 2. 若要配置您的专属次级 API (如 Gemini Flash)，运行 `window.configStorySniffer()`
 * 3. 运行 `window.testStorySniffer()` 开始嗅探测试。
 */

// 1. 配置管理模块 (模拟 MVU 对次级 API 的管理与存储)
function configStorySniffer() {
  let savedConfigStr = localStorage.getItem('ark_story_poc_config');
  let config = savedConfigStr
    ? JSON.parse(savedConfigStr)
    : {
        enabled: false,
        apiurl: 'https://generativelanguage.googleapis.com/v1beta',
        key: '',
        model: 'gemini-1.5-flash',
        temperature: 0.5,
      };

  const useCustom = confirm(
    `当前是否为嗅探器使用独立的【自定义次级 API】？\n(如果点取消，将默认使用酒馆当前的主 API 设定)\n\n当前状态: ${config.enabled ? '已启用自定义' : '未启用，跟随主API'}`,
  );
  config.enabled = useCustom;

  if (useCustom) {
    config.apiurl = prompt('请输入次级 API URL (注意不要带 /chat/completions 尾巴):', config.apiurl) || config.apiurl;
    config.key = prompt('请输入次级 API Key:', config.key) || config.key;
    config.model = prompt('请输入次级 模型名称 (强烈建议使用小尺寸高逻辑模型):', config.model) || config.model;

    let tempInput = prompt('请输入 Temperature (0-2，建议 0.5):', config.temperature);
    if (tempInput !== null && !isNaN(parseFloat(tempInput))) {
      config.temperature = parseFloat(tempInput);
    }
  }

  localStorage.setItem('ark_story_poc_config', JSON.stringify(config));
  console.log('[ARK_StoryPoC] 次级 API 配置已保存:', config);
  alert('次级 API 配置已更新！\\n马上运行 window.testStorySniffer() 来测试您的专属大模型吧！');
}

// 2. 核心嗅探测试模块
async function testStorySniffer() {
  console.log('[ARK_StoryPoC] 开始构建次级 API 请求...');

  // 获取配置
  let savedConfigStr = localStorage.getItem('ark_story_poc_config');
  let customApiConfig = savedConfigStr ? JSON.parse(savedConfigStr) : { enabled: false };

  // 获取对话历史
  let recentMessages = '没有获取到聊天历史。';
  try {
    if (typeof getChatMessages === 'function') {
      const messages = getChatMessages('0-{{lastMessageId}}');
      if (Array.isArray(messages)) {
        recentMessages = messages
          .slice(-3)
          .map(m => m.name + ': ' + m.mes)
          .join('\n\n');
      }
    } else {
      const chat = window.SillyTavern ? window.SillyTavern.chat : [];
      recentMessages = chat
        .slice(-3)
        .map(m => m.name + ': ' + m.mes)
        .join('\n\n');
    }
  } catch (e) {
    console.warn('[ARK_StoryPoC] 获取聊天历史失败', e);
  }

  // 模拟剧情节点
  const fakeCurrentNode = {
    id: 'RI1',
    summary:
      '切尔诺伯格核心城石棺旁。博士刚刚苏醒，失去了记忆。阿米娅和医疗干员非常焦急。整合运动的小队攻入了废弃设施，阿米娅请求博士指挥罗德岛进行战斗。',
    nextNodes: ['RI2 (发生条件：战斗结束，击退整合运动或成功逃离石棺区)'],
  };

  // 系统提示词构建
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

  const noThinkingTail = `---
<think>
- I am a strict JSON parser and GM. I will only output JSON based on the user's action and the node logic.
- Okay, I think I have finished thinking.
</thi`;

  try {
    if (typeof toastr !== 'undefined') toastr.info('正在请求次级剧情 API...', 'ARK Story PoC');

    const config = {
      user_input: '遵循<must>指令输出纯净 JSON，不要带 markdown 代码块。',
      max_chat_history: 0,
      should_stream: false,
      ordered_prompts: [
        { role: 'system', content: systemPromptHead },
        { role: 'system', content: '<past_observe>\n' + recentMessages + '\n</past_observe>' },
        { role: 'system', content: taskPrompt },
        { role: 'system', content: noThinkingTail },
      ],
    };

    // 挂载自定义 API 设定 (兼容 MVU 的 custom_api 字段)
    if (customApiConfig.enabled && customApiConfig.key) {
      config.custom_api = {
        apiurl: customApiConfig.apiurl,
        key: customApiConfig.key,
        model: customApiConfig.model,
        temperature: customApiConfig.temperature,
      };
      console.log('[ARK_StoryPoC] 即将使用自定义次级 API:', customApiConfig.model);
    } else {
      console.log('[ARK_StoryPoC] 即将使用酒馆主 API 设定');
    }

    const result = await window.generateRaw(config);

    console.log('[ARK_StoryPoC] 收到次级 API 回复原文:\n', result);
    if (typeof toastr !== 'undefined') toastr.success('次级 API 请求成功，请查看控制台', 'ARK Story PoC');

    try {
      const jsonStrMatch = result.match(/\{[\s\S]*\}/);
      if (jsonStrMatch) {
        const parsed = JSON.parse(jsonStrMatch[0]);
        console.log('[ARK_StoryPoC] 成功解析导演 JSON:', parsed);
        alert(`剧情判定成功！\n目标节点: ${parsed.targetNode}\n导演建议: ${parsed.directorAdvice}`);
      } else {
        console.warn('[ARK_StoryPoC] 无法从输出中提取 JSON');
        alert('未找到 JSON 结构，输出请看控制台。');
      }
    } catch (e) {
      console.error('[ARK_StoryPoC] JSON 解析失败:', e);
      alert('JSON 解析失败，可能是模型输出了乱码，请查看控制台。');
    }
  } catch (e) {
    console.error('[ARK_StoryPoC] API 请求失败:', e);
    if (typeof toastr !== 'undefined') toastr.error('API 请求失败', 'ARK Story PoC');
  }
}

// 导出到全局 (兼容 iframe 注入环境和顶级控制台环境)
if (typeof window !== 'undefined') {
  window.configStorySniffer = configStorySniffer;
  window.testStorySniffer = testStorySniffer;
  if (window.parent) {
    window.parent.configStorySniffer = configStorySniffer;
    window.parent.testStorySniffer = testStorySniffer;
  }
}

console.log(
  '[ARK_StoryPoC] 脚本加载完成！\\n如果在控制台找不到函数，请确保控制台(Console)顶部的执行上下文(Context)选为了 top。\\n或者直接点击页面右上角的两个测试按钮。',
);

// 为了彻底避免控制台上下文找不到函数的问题，直接在页面右上角挂载两个测试按钮：
try {
  const doc = window.parent ? window.parent.document : document;

  // 清理旧按钮
  const oldBtns = doc.querySelectorAll('.ark-poc-btn');
  oldBtns.forEach(b => b.remove());

  const btn1 = doc.createElement('button');
  btn1.className = 'ark-poc-btn';
  btn1.innerText = '⚙️ 配置次级大模型';
  btn1.style.cssText =
    'position:fixed; top:20px; right:20px; z-index:999999; padding:8px 12px; background:#e74c3c; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
  btn1.onclick = configStorySniffer;
  doc.body.appendChild(btn1);

  const btn2 = doc.createElement('button');
  btn2.className = 'ark-poc-btn';
  btn2.innerText = '🚀 测试剧情嗅探 (RI1)';
  btn2.style.cssText =
    'position:fixed; top:65px; right:20px; z-index:999999; padding:8px 12px; background:#2ecc71; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
  btn2.onclick = testStorySniffer;
  doc.body.appendChild(btn2);
} catch (e) {
  console.error('按钮挂载失败', e);
}
