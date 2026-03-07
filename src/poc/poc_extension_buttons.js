/**
 * @name PoC v6 - 全局系统唤醒按钮注入 (Script Button)
 * @description 验证通过 TavernHelper 的 API 在酒馆界面注入一个专属按钮，用于全局开启/关闭/唤醒我们的 UI。
 *
 * 测试方法：
 * 1. 在控制台直接执行此代码。
 * 2. 观察聊天输入框附近（通常是快捷回复区或扩展脚本区）是否出现了一个叫 "📖 状态栏控制" 的按钮。
 * 3. 点击该按钮，观察控制台是否有日志输出。
 */

(function () {
  console.log('[PoC v6] 尝试注入自定义控制按钮...');

  const BTN_NAME = '📖 状态栏控制';

  // 使用 Tavern Helper 提供的全局函数注入按钮
  if (typeof appendInexistentScriptButtons === 'function') {
    try {
      // 1. 添加按钮
      appendInexistentScriptButtons([{ name: BTN_NAME, visible: true }]);
      console.log(`[PoC v6] 成功调用 appendInexistentScriptButtons，按钮名为: ${BTN_NAME}`);

      // 2. 获取该按钮绑定的特殊事件名
      const btnEvent = getButtonEvent(BTN_NAME);

      // 3. 监听该按钮的点击事件
      // 注意：因为使用了全局的 eventOn，卸载时需要自己清理 (如果是在正规脚本文件中，TavernHelper 会自动清理)
      const globalEventOn = window.parent?.eventOn || window.eventOn;

      if (globalEventOn) {
        globalEventOn(btnEvent, () => {
          console.log('[PoC v6] 按钮被点击啦！在这里可以执行：');
          console.log(' -> 显示或隐藏我们的全局 Vue 挂载点');
          console.log(' -> 弹出系统设置菜单');
          alert('[PoC v6]\n您点击了状态栏控制按钮！\n未来这里将用于唤醒或折叠我们的全局状态栏面板。');
        });
        console.log('[PoC v6] 按钮点击事件已绑定，快去点一下试试！');
      } else {
        console.warn('[PoC v6] 未找到 eventOn，无法绑定点击事件。');
      }
    } catch (e) {
      console.error('[PoC v6] 注入按钮时发生错误:', e);
    }
  } else {
    console.error(
      '[PoC v6] 当前环境中不存在 appendInexistentScriptButtons 函数，请确认是否在正确配置的 Tavern Helper 脚本环境下运行。',
    );
    // 作为降级方案，这里未来可以写原生的 DOM 操作：
    // const menu = document.getElementById('extensions_menu');
    // if (menu) { ... }
  }
})();
