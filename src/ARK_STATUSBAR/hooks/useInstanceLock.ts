const LOCK_KEY = '__ARK_STATUSBAR_ACTIVE_LOCK__';

/**
 * 尝试获取全局单例锁
 * @returns {boolean} 是否成功获取锁。如果返回 false，说明已经有实例在运行，当前脚本应该立即终止。
 */
export function acquireInstanceLock(): boolean {
  // Tavern Helper 脚本运行在 iframe 中，真正的宿主是 window.parent
  const ST_WINDOW = window.parent || window;

  if ((ST_WINDOW as any)[LOCK_KEY]) {
    console.error('[ARK_STATUSBAR] Critical Error: Multiple instances detected. Aborting bootstrap.');
    // 尝试在宿主页面抛出红色警告
    if (typeof (ST_WINDOW as any).toastr !== 'undefined') {
      (ST_WINDOW as any).toastr.error(
        '检测到 Ark StatusBar 多开，为防止数据与 UI 损坏，次生实例已强制自我终止！请检查您的插件列表。',
        '严重警告',
        { timeOut: 5000 },
      );
    } else if (typeof toastr !== 'undefined') {
      toastr.error(
        '检测到 Ark StatusBar 多开，为防止数据与 UI 损坏，次生实例已强制自我终止！请检查您的插件列表。',
        '严重警告',
        { timeOut: 5000 },
      );
    }
    return false;
  }

  // 占用锁
  (ST_WINDOW as any)[LOCK_KEY] = true;
  return true;
}

/**
 * 释放全局单例锁
 */
export function releaseInstanceLock() {
  const ST_WINDOW = window.parent || window;
  delete (ST_WINDOW as any)[LOCK_KEY];
}
