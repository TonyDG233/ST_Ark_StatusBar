export function setupTavernControls() {
  const BTN_NAME = '📖 控制台开关';
  if (
    typeof appendInexistentScriptButtons === 'function' ||
    typeof (window.parent as any).appendInexistentScriptButtons === 'function'
  ) {
    const appendFn =
      typeof appendInexistentScriptButtons === 'function'
        ? appendInexistentScriptButtons
        : (window.parent as any).appendInexistentScriptButtons;
    const getEventFn = typeof getButtonEvent === 'function' ? getButtonEvent : (window.parent as any).getButtonEvent;
    const globalEventOn = typeof eventOn === 'function' ? eventOn : (window.parent as any).eventOn;

    try {
      appendFn([{ name: BTN_NAME, visible: true }]);
      const btnEvent = getEventFn(BTN_NAME);
      if (globalEventOn) {
        globalEventOn(btnEvent, () => {
          // 派发事件以切换全局 UI 的显示状态
          document.dispatchEvent(new CustomEvent('ark:system-toggle'));
        });
      }
    } catch (e) {
      console.error('[ARK_STATUSBAR] Failed to inject button:', e);
    }
  }
}
