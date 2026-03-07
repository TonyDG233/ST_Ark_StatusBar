/**
 * @name PoC v5 - 聊天切换状态追踪与基准线恢复 (Chat Changed Diff & Reset)
 * @description 测试监听 chat_id_changed 事件，比对世界书差异并弹窗提示恢复。
 *
 * 测试方法：
 * 1. 在控制台执行此代码。
 * 2. 随意在 UI 里开/关几个当前世界书的条目，或者发送几条消息。
 * 3. 切换到另一个聊天记录，或者新建一个聊天。
 * 4. 观察是否成功弹出“检测到差异，是否还原”的 Confirm 框，且在“切换角色卡”时不报错。
 */

(function () {
  console.log('[PoC v5] 正在初始化 chat_id_changed 监听...');

  const st = window.parent?.SillyTavern || window.SillyTavern;
  if (!st) {
    console.error('[PoC v5] 找不到 SillyTavern 环境！');
    return;
  }

  let isUnloading = false;

  const handleChatChanged = async () => {
    if (isUnloading) return;

    console.log('[PoC v5] 触发了 chat_id_changed 事件！正在执行 Diff 检查...');

    try {
      // 1. 获取当前绑定的世界书
      const result = await getCharWorldbookNames('current');
      const targetBook = result.primary || (result.additional && result.additional[0]);

      if (!targetBook) {
        console.log('[PoC v5] 当前聊天未绑定世界书，跳过 Diff。');
        return;
      }

      // 2. 获取当前世界书的实际状态
      const entries = await getWorldbook(targetBook);

      // 3. 计算 Diff
      const configEntry = entries.find(e => e.name === '[ARK_SYS_CONFIG]');
      let hasDiff = false;

      if (configEntry && configEntry.content) {
        try {
          const cfg = JSON.parse(configEntry.content);
          if (cfg.hiddenEntries && cfg.hiddenEntries.length > 0) {
            hasDiff = true;
          }
        } catch (e) {}
      }

      const disabledCount = entries.filter(e => !e.enabled && e.name !== '[ARK_SYS_CONFIG]').length;
      if (disabledCount > 0) {
        hasDiff = true;
      }

      if (hasDiff) {
        const restore = confirm(
          `[ARK_STATUSBAR 拦截提示]\n\n检测到当前世界书带有特定开局或手动修改的残余状态。\n为了防止污染新剧情，是否一键还原至初始 Baseline？`,
        );
        if (restore) {
          console.log('[PoC v5] 用户选择恢复 Baseline。开始执行恢复...');
          await updateWorldbookWith(targetBook, wbEntries => {
            wbEntries.forEach(e => {
              if (e.name === '[ARK_SYS_CONFIG]') {
                e.content = '{}'; // 清空 commit
              }
              // 假装全部恢复开启
              e.enabled = true;
            });
            return wbEntries;
          });
          console.log('[PoC v5] 恢复完成！');
        }
      } else {
        console.log('[PoC v5] 检查完毕，未发现与 Baseline 存在差异，静默放行。');
      }
    } catch (e) {
      console.error('[PoC v5] chat_changed 处理函数发生错误:', e);
    }
  };

  // 【关键修复】酒馆中事件名为 'chat_id_changed'
  const globalEventOn = window.parent?.eventOn || window.eventOn;
  const globalEventOff = window.parent?.eventOff || window.eventOff;

  if (globalEventOn) {
    globalEventOn('chat_id_changed', handleChatChanged);
    console.log('[PoC v5] chat_id_changed 事件已绑定！请去切换聊天测试。');
  }

  // 监听当前 iframe (或窗口) 的卸载事件，清理外部绑定的 listener 防止内存泄漏和重复触发
  window.addEventListener('unload', () => {
    isUnloading = true;
    if (globalEventOff) {
      globalEventOff('chat_id_changed', handleChatChanged);
      console.log('[PoC v5] iframe 卸载，已清理父窗口的事件监听器。');
    }
  });
})();
