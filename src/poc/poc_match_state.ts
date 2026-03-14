import { eventOnce, tavern_events } from '../../../@types/iframe/event';

/**
 * POC: Return Data Match Local State (Req 1)
 *
 * 测试目标：
 * 验证通过事件截获的回传数据 (如 CHAT_COMPLETION_PROMPT_READY 无法获取具体世界书条目)
 * 根据先前的分析和日志，原生 `WORLD_INFO_ACTIVATED` 事件或拦截 Dry Run 的回调会返回被激活的 entries 数组。
 * 此测试旨在直接通过酒馆上下文进行一次 DryRun 触发世界书扫描，并比对返回的条目状态 (disable) 与本地状态 (enabled)。
 */

async function testMatchLocalState() {
  console.log('准备测试：拦截 DryRun 的世界书回传数据并与本地状态比对。');

  // 1. 获取当前绑定的世界书
  const result = await getCharWorldbookNames('current');
  const targetWorldbook =
    result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);

  if (!targetWorldbook) {
    console.error('[Match POC] 当前角色没有绑定世界书，无法测试。');
    return;
  }

  // 2. 加载本地实际的世界书内容
  const localEntries = await getWorldbook(targetWorldbook);
  console.log(`[Match POC] 已加载本地世界书 [${targetWorldbook}] 共 ${localEntries.length} 条条目。`);

  // 3. 监听世界书激活事件 (原生的 world_info_activated 或助手封装的)
  // 酒馆原生在每次生成前扫描世界书后都会触发此事件
  eventOnce(tavern_events.WORLD_INFO_ACTIVATED, entries => {
    console.log('%c[Match POC] 捕获到 WORLD_INFO_ACTIVATED', 'color: blue; font-weight: bold;');

    let mismatchCount = 0;

    // 4. 遍历返回的条目并与本地比对
    entries.forEach((returnedEntry: any) => {
      // 如果返回的条目不属于我们绑定的当前主要世界书，跳过测试 (这也是我们想要过滤的效果)
      if (returnedEntry.world !== targetWorldbook) {
        console.log(
          `[Match POC] 跳过外部世界书条目: [${returnedEntry.world}] ${returnedEntry.comment || returnedEntry.uid}`,
        );
        return;
      }

      // 在本地世界书中寻找对应 UID 的条目
      const localEntry = localEntries.find((e: any) => e.uid === returnedEntry.uid);

      if (!localEntry) {
        console.warn(`[Match POC] 警告：回传数据中包含本地不存在的 UID [${returnedEntry.uid}]!`);
        mismatchCount++;
        return;
      }

      // 核心比对：返回的 disable 应该是本地的 !enabled
      // 但是注意：既然它被触发了，它在回传数据里通常 disable === false
      const isLocalEnabled = localEntry.enabled;
      const isReturnedEnabled = !returnedEntry.disable;

      const matchStatus = isLocalEnabled === isReturnedEnabled;

      if (matchStatus) {
        console.log(
          `%c[Match POC] 状态吻合 - UID [${returnedEntry.uid}] [${returnedEntry.comment}] Local_Enabled: ${isLocalEnabled}, Returned_Disable: ${returnedEntry.disable}`,
          'color: green;',
        );
      } else {
        console.log(
          `%c[Match POC] 状态冲突 - UID [${returnedEntry.uid}] [${returnedEntry.comment}] Local_Enabled: ${isLocalEnabled}, Returned_Disable: ${returnedEntry.disable}`,
          'color: red;',
        );
        mismatchCount++;
      }
    });

    if (mismatchCount === 0) {
      console.log(
        '%c[Match POC] 结论: 回传数据的 disable 状态与本地 enabled 状态完全一致！',
        'font-size: 14px; font-weight:bold; color: green;',
      );
    } else {
      console.log(
        `%c[Match POC] 结论: 发现 ${mismatchCount} 处状态不一致！必须以本地状态为准进行校验。`,
        'font-size: 14px; font-weight:bold; color: red;',
      );
    }
  });

  // 发起一次 DryRun
  try {
    const st = typeof window.SillyTavern !== 'undefined' ? window.SillyTavern : (window.parent as any)?.SillyTavern;
    const context = st?.getContext?.();
    if (context && typeof context.generate === 'function') {
      await context.generate('normal', {}, true);
    } else {
      console.error('[Match POC] 无法调用 context.generate。');
    }
  } catch (e) {
    console.log('[Match POC] 触发 DryRun 完成 (预期内部可能抛出中断错误)');
  }
}

$(() => {
  const btn = $(
    '<button style="position:fixed;top:110px;left:10px;z-index:9999;padding:10px;background:lightblue;color:black;">测试数据吻合度</button>',
  );
  btn.on('click', testMatchLocalState);
  $('body').append(btn);
  console.log('【数据吻合度测试按钮】已添加到页面左上角，点击以开始流程。');
});
