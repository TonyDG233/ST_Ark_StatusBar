import { checkIsArknights } from '../utils/identity';

const MOUNT_INTERVAL_MS = 500;
export const STARTUP_CONTAINER_CLASS = 'ark-startup-mount-point';
export const RETURN_BTN_CONTAINER_CLASS = 'ark-return-btn-mount-point';

let mountLoopTimer: number | null = null;
let lastIsArknights: boolean | null = null;

export function updateIdentityAndBroadcast() {
  const isArknights = checkIsArknights();

  if (lastIsArknights !== isArknights) {
    lastIsArknights = isArknights;
    document.dispatchEvent(new CustomEvent('ark:identity-updated', { detail: { isArknights } }));
  }
}

export function startChatMonitor() {
  if (mountLoopTimer !== null) {
    window.clearInterval(mountLoopTimer);
  }

  // 立即触发一次
  updateIdentityAndBroadcast();

  // 监听 CHAT_CHANGED 以便切卡瞬间马上识别身份
  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
    eventOn(tavern_events.CHAT_CHANGED, updateIdentityAndBroadcast);
  }

  mountLoopTimer = window.setInterval(() => {
    try {
      if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
        return; // 环境未就绪
      }

      // 1. 定位第 0 楼消息
      const $message0 = $('#chat > .mes[mesid="0"]');
      if ($message0.length === 0) return;

      const isUser = $message0.attr('is_user') === 'true';
      if (isUser) return; // 仅在 AI 消息楼层挂载开局UI或返回按钮

      const $mesText = $message0.find('.mes_text');
      if ($mesText.length === 0) return;

      const containerEl = $mesText[0] as HTMLElement;

      // 2. 强制同步鉴权
      const isArknights = checkIsArknights();
      updateIdentityAndBroadcast();

      if (!isArknights) {
        document.dispatchEvent(new CustomEvent('ark:chat-unmount-all', { detail: { containerEl } }));
        return;
      }

      // 3. 检查当前处于哪个 Swipe ID
      const firstMessage = SillyTavern.chat[0];
      const swipeId = firstMessage.swipe_id || 0;

      // 4. 判断逻辑
      if (swipeId === 0) {
        document.dispatchEvent(new CustomEvent('ark:chat-mount-startup', { detail: { containerEl } }));
      } else {
        document.dispatchEvent(new CustomEvent('ark:chat-mount-return', { detail: { containerEl } }));
      }
    } catch (error) {
      console.error('[ARK_STATUSBAR] Mounting loop error:', error);
    }
  }, MOUNT_INTERVAL_MS);
}

export function stopChatMonitor() {
  if (mountLoopTimer !== null) {
    window.clearInterval(mountLoopTimer);
    mountLoopTimer = null;
  }
}
