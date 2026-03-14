import { eventOnce, SillyTavern, tavern_events } from '../../../@types/iframe/event'; // Note: In actual TS it's imported correctly via tsconfig, using any imports just for types or assuming globals depending on context. But the user said they are putting this in "角色脚本" which executes as an iframe extension.

/**
 * POC: Token Counter v6 (TypeScript / TavernHelper script environment)
 *
 * 此版本假设你在酒馆助手中直接新建了一个 "角色脚本"，代码将被 webpack 打包并在 iframe 运行。
 * 因此：
 * 1. 我们可以直接调用全局方法 `eventOnce` 和 `generate`
 * 2. 可以使用正确的 tavern_events 枚举
 */

async function main() {
  console.log('正在准备执行 DryRun 测试...');

  let testCompleted = false;

  // 1. 设置事件监听
  // 监听 OpenAI 格式的 prompt 构建完成事件
  eventOnce(tavern_events.CHAT_COMPLETION_PROMPT_READY, async data => {
    if (!data.dryRun) return;
    testCompleted = true;
    console.log('%c[Token Counter POC] 拦截到 (Chat 格式) 的 DryRun 数据!', 'color: blue; font-weight: bold;');

    const promptPayload = data.chat;
    if (!promptPayload) return;

    const fullText = Array.isArray(promptPayload)
      ? promptPayload.map(msg => msg.content || String(msg)).join('\n')
      : String(promptPayload);

    try {
      const count = await SillyTavern.getTokenCountAsync(fullText);
      console.log(
        `%c[Token Counter POC] 计算完成: ${count} Tokens`,
        'color: green; font-size: 16px; font-weight: bold;',
      );
    } catch (err) {
      console.error('估算失败', err);
    }
  });

  // 监听普通文本格式的 prompt 构建完成事件
  eventOnce(tavern_events.GENERATE_AFTER_COMBINE_PROMPTS, async data => {
    if (!data.dryRun) return;
    testCompleted = true;
    console.log('%c[Token Counter POC] 拦截到 (普通文本格式) 的 DryRun 数据!', 'color: blue; font-weight: bold;');

    const promptPayload = data.prompt;
    if (!promptPayload) return;

    const fullText = String(promptPayload);

    try {
      const count = await SillyTavern.getTokenCountAsync(fullText);
      console.log(
        `%c[Token Counter POC] 计算完成: ${count} Tokens`,
        'color: green; font-size: 16px; font-weight: bold;',
      );
    } catch (err) {
      console.error('估算失败', err);
    }
  });

  // 2. 发起 DryRun 请求
  console.log('调用 generate() 方法...');

  try {
    // 使用助手全局注入的 generate 函数，它的第三个配置项参数可能包含 dryRun，
    // 或者调用 SillyTavern 原生的 generate

    // 方案A：调用 SillyTavern.generate
    const context = typeof window.SillyTavern !== 'undefined' ? window.SillyTavern.getContext?.() : null;

    if (context && typeof context.generate === 'function') {
      // 酒馆原生的 generate(type, overrides, is_dry_run)
      await context.generate('normal', {}, true);
    } else {
      console.error('未能找到 context.generate');
    }
  } catch (e) {
    // 预期的行为：由于是 dryRun，最后内部的 send 可能会抛出或者被跳过
    // 但如果报错 AbortError 可以忽略
    console.log('DryRun generate 返回:', e);
  }
}

// 通过点击页面任意地方触发测试，或者直接调用
$(() => {
  // 增加一个测试按钮方便点击，或者你可以直接控制台调用
  const btn = $('<button style="position:fixed;top:10px;left:10px;z-index:9999;padding:10px;">测试Token计算</button>');
  btn.on('click', main);
  $('body').append(btn);
  console.log('Token测试按钮已添加到页面左上角，请点击测试。');
});
