import { checkIsArknights } from '../utils/identity';

// 触发合并防抖：事件/Observer 突发时只执行一次完整校验
const RECONCILE_DEBOUNCE_MS = 150;
// 兜底轮询间隔：仅作为未知异常路径的最后防线，空闲时签名未变即短路
const FALLBACK_POLL_MS = 5000;
export const STARTUP_CONTAINER_CLASS = 'ark-startup-mount-point';
export const RETURN_BTN_CONTAINER_CLASS = 'ark-return-btn-mount-point';

interface MountSignature {
  containerEl: HTMLElement;
  swipeId: number;
  isArknights: boolean;
  hasMount: boolean;
}

let running = false;
let fallbackPollTimer: number | null = null;
let reconcileTimer: number | null = null;
let lastIsArknights: boolean | null = null;
let lastSignature: MountSignature | null = null;

// --- 三种被动触发源 (替代原 500ms 常驻轮询) ---
let chatObserver: MutationObserver | null = null; // 观察 #chat 子列表（楼层增删/整体重渲染）
let mesObserver: MutationObserver | null = null; // 观察 .mes[mesid="0"] 子列表（mes_text 整体替换 / is_user 变化）
let textObserver: MutationObserver | null = null; // 观察 .mes_text 子列表（内容被酒馆重渲染）
let observedMesEl: HTMLElement | null = null;
let observedTextEl: HTMLElement | null = null;
const eventStops: EventOnReturn[] = [];

function broadcastIdentity(isArknights: boolean) {
  if (lastIsArknights !== isArknights) {
    lastIsArknights = isArknights;
    document.dispatchEvent(new CustomEvent('ark:identity-updated', { detail: { isArknights } }));
  }
}

export function updateIdentityAndBroadcast() {
  broadcastIdentity(checkIsArknights());
}

function scheduleReconcile() {
  if (reconcileTimer !== null) return;
  reconcileTimer = window.setTimeout(() => {
    reconcileTimer = null;
    reconcileChatMount();
  }, RECONCILE_DEBOUNCE_MS);
}

function signaturesEqual(a: MountSignature | null, b: MountSignature) {
  return (
    a !== null &&
    a.containerEl === b.containerEl &&
    a.swipeId === b.swipeId &&
    a.isArknights === b.isArknights &&
    a.hasMount === b.hasMount
  );
}

function attachChatObserver() {
  if (chatObserver) return;
  const ST_DOC = window.parent?.document || document;
  const chatEl = ST_DOC.getElementById('chat');
  if (!chatEl) return;
  chatObserver = new MutationObserver(() => scheduleReconcile());
  chatObserver.observe(chatEl, { childList: true });
}

// 每次校验后按最新 DOM 重定向二级观察目标（楼层/mes_text 被整体替换时自动换绑）
function retargetObservers(mesEl: HTMLElement | null, mesTextEl: HTMLElement | null) {
  if (mesObserver === null && mesEl !== null) mesObserver = new MutationObserver(() => scheduleReconcile());
  if (textObserver === null && mesTextEl !== null) textObserver = new MutationObserver(() => scheduleReconcile());

  if (mesObserver) {
    if (observedMesEl !== mesEl) {
      mesObserver.disconnect();
      observedMesEl = mesEl;
      if (mesEl) mesObserver.observe(mesEl, { childList: true, attributes: true, attributeFilter: ['is_user'] });
    }
  }
  if (textObserver) {
    if (observedTextEl !== mesTextEl) {
      textObserver.disconnect();
      observedTextEl = mesTextEl;
      if (mesTextEl) textObserver.observe(mesTextEl, { childList: true });
    }
  }
}

function reconcileChatMount() {
  try {
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
      return; // 环境未就绪
    }

    // 1. 定位第 0 楼消息
    const $message0 = $('#chat > .mes[mesid="0"]');
    if ($message0.length === 0) return;

    const mesEl = $message0[0] as HTMLElement;

    const isUser = $message0.attr('is_user') === 'true';
    if (isUser) return; // 仅在 AI 消息楼层挂载开局UI或返回按钮

    const $mesText = $message0.find('.mes_text');
    if ($mesText.length === 0) return;

    const containerEl = $mesText[0] as HTMLElement;
    attachChatObserver();
    retargetObservers(mesEl, containerEl);

    // 2. 强制同步鉴权
    const isArknights = checkIsArknights();
    broadcastIdentity(isArknights);

    // 3. 检查当前处于哪个 Swipe ID
    const firstMessage = SillyTavern.chat[0];
    const swipeId = firstMessage.swipe_id || 0;

    // 4. 楼层是否仍保有我们的挂载点（酒馆重渲染会静默移除它，此时必须重新派发）
    const hasMount = containerEl.querySelector(`.${STARTUP_CONTAINER_CLASS}, .${RETURN_BTN_CONTAINER_CLASS}`) !== null;

    const nextSignature: MountSignature = { containerEl, swipeId, isArknights, hasMount };
    if (signaturesEqual(lastSignature, nextSignature)) return;

    lastSignature = nextSignature;

    // 5. 判断逻辑（仅在签名变化时派发，消费端幂等）
    if (!isArknights) {
      document.dispatchEvent(new CustomEvent('ark:chat-unmount-all', { detail: { containerEl } }));
      return;
    }
    document.dispatchEvent(
      new CustomEvent(swipeId === 0 ? 'ark:chat-mount-startup' : 'ark:chat-mount-return', {
        detail: { containerEl },
      }),
    );
  } catch (error) {
    console.error('[ARK_STATUSBAR] Mounting loop error:', error);
  }
}

export function startChatMonitor() {
  // 防重入（bootstrap 只调用一次；即使重调也不应产生重复订阅/观察）
  if (running) return;
  running = true;

  // 立即触发一次
  updateIdentityAndBroadcast();
  attachChatObserver();

  // 事件驱动：切卡/切楼层/swipe/生成结束即可唤醒，无需轮询
  if (typeof eventOn === 'function' && typeof tavern_events !== 'undefined') {
    eventStops.push(
      eventOn(tavern_events.CHAT_CHANGED, () => {
        updateIdentityAndBroadcast();
        scheduleReconcile();
      }),
      eventOn(tavern_events.MESSAGE_UPDATED, () => scheduleReconcile()),
      eventOn(tavern_events.MESSAGE_SWIPED, () => scheduleReconcile()),
      eventOn(tavern_events.MESSAGE_RECEIVED, () => scheduleReconcile()),
      eventOn(tavern_events.GENERATION_ENDED, () => scheduleReconcile()),
    );
  }

  reconcileChatMount();

  // 最后防线：低频兜底（防一切事件/观察器都漏掉的未知渲染路径）
  fallbackPollTimer = window.setInterval(() => scheduleReconcile(), FALLBACK_POLL_MS);
}

export function stopChatMonitor() {
  running = false;
  if (fallbackPollTimer !== null) {
    window.clearInterval(fallbackPollTimer);
    fallbackPollTimer = null;
  }
  if (reconcileTimer !== null) {
    window.clearTimeout(reconcileTimer);
    reconcileTimer = null;
  }
  chatObserver?.disconnect();
  chatObserver = null;
  mesObserver?.disconnect();
  mesObserver = null;
  textObserver?.disconnect();
  textObserver = null;
  observedMesEl = null;
  observedTextEl = null;
  eventStops.forEach(stop => stop.stop());
  eventStops.length = 0;
  lastSignature = null;
}
