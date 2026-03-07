/**
 * @name PoC v2 - 世界书拦截与解析测试 (UI物理劫持法)
 * @description 验证物理劫持发送按钮实现拦截，以及探明世界书对象的真实结构。
 *
 * =====================================
 * 测试记录区:
 * - 测试日期: 2026-03-04
 * - 测试 1 (原生事件拦截): 失败。打字不触发扫描，且 confirm 未弹窗，说明酒馆的生成流没有触发/不等待该原生事件。
 * - 测试 2 (物理劫持): 成功！成功通过 `addEventListener(..., true)` 捕获阶段拦截了 `#send_but` 和 `#send_textarea`，
 *   阻断了原生发送，并在用户确认后通过模拟 `click()` 成功放行。
 * - 测试 3 (世界书对象解析): 成功！`world_info_activated` 返回的 entries 数组中，
 *   `e.comment` 字段存储了人类可读的词条名称（如 "凯尔希（本格...）"），`e.uid` 和 `e.world` 分别记录了唯一ID和所属世界书名。
 * =====================================
 */

(function () {
  console.log('[PoC v2] 脚本已加载，正在绑定物理拦截器...');

  // 1. 获取顶层窗口的 DOM (兼容跑在 iframe 中的情况)
  const ST_DOC = window.parent.document || document;
  const sendBtn = ST_DOC.querySelector('#send_but');
  const textarea = ST_DOC.querySelector('#send_textarea');

  if (!sendBtn || !textarea) {
    console.error('[PoC v2] 找不到发送按钮或输入框！');
    return;
  }

  // 2. 核心拦截函数
  function interceptor(e) {
    // 如果按下的不是回车，或者是 Shift+Enter (换行)，则不拦截
    if (e.type === 'keydown' && (e.key !== 'Enter' || e.shiftKey)) return;

    const text = textarea.value.trim();
    if (!text) return; // 没文本本来就发不出，不拦截

    // ★ 核心动作：吃掉原事件，阻止其向下传递给酒馆的绑定函数
    e.preventDefault();
    e.stopImmediatePropagation();

    // ★ 弹出确认框
    if (
      confirm(
        `[PoC v2 拦截成功]\n系统检测到您点击了发送/按下了回车。\n\n是否放行此次发送？\n(点击“确定”放行，点击“取消”中止)`,
      )
    ) {
      // 放行逻辑：临时解绑拦截器，触发真实的点击，再重新绑定
      sendBtn.removeEventListener('click', interceptor, true);
      textarea.removeEventListener('keydown', interceptor, true);

      console.log('[PoC v2] 用户放行，执行原发送逻辑...');
      sendBtn.click(); // 无论如何都触发发送按钮的点击

      // 延迟 500ms 后重新绑定拦截器，准备下一次拦截
      setTimeout(() => {
        sendBtn.addEventListener('click', interceptor, true);
        textarea.addEventListener('keydown', interceptor, true);
        console.log('[PoC v2] 拦截器已重新装填。');
      }, 500);
    } else {
      console.log('[PoC v2] 用户取消了发送。');
      // 不做任何事，消息依然留在输入框里
    }
  }

  // 3. 在捕获阶段 (true) 绑定，优先级最高，确保抢在酒馆代码前执行
  sendBtn.addEventListener('click', interceptor, true);
  textarea.addEventListener('keydown', interceptor, true);
  console.log('[PoC v2] UI 劫持事件已绑定！请尝试发消息。');

  // =========================================================================
  // 测试 3: 解析世界书的真实结构
  // 既然我们知道它发出去后才触发，我们把整个对象打印出来看看里面的结构
  // =========================================================================
  eventOn('world_info_activated', entries => {
    console.log('[PoC v2 详细扫描结果] 本次触发的世界书原始对象：', entries);

    if (entries && entries.length > 0) {
      // 根据推测，世界书的名字字段通常叫 comment，或者记录在 key 数组里
      const names = entries.map(e => e.comment || (e.key ? e.key[0] : '未知词条')).join(', ');

      if (typeof toastr !== 'undefined') {
        toastr.success(`激活世界书:<br><b>${names}</b>`, '条目触发', {
          timeOut: 4000,
          positionClass: 'toast-top-right',
        });
      }
    }
  });
})();
