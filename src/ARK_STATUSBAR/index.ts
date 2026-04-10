import { createApp } from 'vue';
import { deteleportStyle, teleportStyle } from '../util/script';
import GlobalStatusBar from './components/GlobalStatusBar.vue';
import ReturnButton from './components/ReturnButton.vue';
import StartupNavigator from './components/StartupNavigator.vue';
import { StatusBarManager } from './logic/statusbar_manager';

// 导入全局样式
import './components/StartupNavigator.vue';

const MOUNT_INTERVAL_MS = 500;
const STARTUP_CONTAINER_CLASS = 'ark-startup-mount-point';
const RETURN_BTN_CONTAINER_CLASS = 'ark-return-btn-mount-point';

let startupApp: ReturnType<typeof createApp> | null = null;
let returnBtnApp: ReturnType<typeof createApp> | null = null;

/**
 * 主挂载逻辑循环
 */
const startMountingLoop = () => {
  setInterval(() => {
    try {
      if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
        return; // 环境未就绪
      }

      // 1. 定位第 0 楼消息
      // 使用 jQuery 是为了兼容并更方便地读取历史 DOM
      const $message0 = $('#chat > .mes[mesid="0"]');
      if ($message0.length === 0) return;

      const isUser = $message0.attr('is_user') === 'true';
      if (isUser) return; // 仅在 AI 消息楼层挂载开局UI或返回按钮

      const $mesText = $message0.find('.mes_text');
      if ($mesText.length === 0) return;

      // 2. 检查当前处于哪个 Swipe ID
      // 以 SillyTavern.chat[0] 为真实数据源
      const firstMessage = SillyTavern.chat[0];
      const swipeId = firstMessage.swipe_id || 0;

      // 3. 挂载逻辑
      if (swipeId === 0) {
        // --- 开局设定模式 (STARTUP MODE) ---
        // 确保返回按钮已被清理 (一般切换 swipe 时原生 DOM 会被清空，但这里做双保险检查)
        if ($mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).length > 0) {
          if (returnBtnApp) {
            returnBtnApp.unmount();
            returnBtnApp = null;
          }
          $mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).remove();
        }

        // 检查是否已经挂载了开局 UI
        if ($mesText.find(`.${STARTUP_CONTAINER_CLASS}`).length === 0) {
          console.info('[ARK_STATUSBAR] Mounting Startup Navigator...');

          // 挂载前清空当前楼层现有的纯文本内容
          $mesText.empty();

          const mountPoint = document.createElement('div');
          mountPoint.className = STARTUP_CONTAINER_CLASS;
          $mesText.append(mountPoint);
          startupApp = createApp(StartupNavigator);
          startupApp.mount(mountPoint);
        }
      } else {
        // --- 剧情模式 (STORY MODE - 显示返回按钮) ---
        // 确保开局 UI 已被清理
        if ($mesText.find(`.${STARTUP_CONTAINER_CLASS}`).length > 0) {
          // 一般认为切换模式时酒馆后端会刷新消息内容，但如果是热重载导致的错乱则在此处物理清理
          if (startupApp) {
            startupApp.unmount();
            startupApp = null;
          }
          $mesText.find(`.${STARTUP_CONTAINER_CLASS}`).remove();
        }

        // 检查是否已经挂载了返回按钮
        if ($mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).length === 0) {
          console.info('[ARK_STATUSBAR] Mounting Return Button...');

          // 返回按钮应当【追加】到现有剧情内容后，而不是覆盖内容
          // 只有开局设定 UI 才会清空原有文本

          const mountPoint = document.createElement('div');
          mountPoint.className = RETURN_BTN_CONTAINER_CLASS;
          $mesText.append(mountPoint);
          returnBtnApp = createApp(ReturnButton);
          returnBtnApp.mount(mountPoint);
        }
      }
    } catch (error) {
      console.error('[ARK_STATUSBAR] Mounting loop error:', error);
    }
  }, MOUNT_INTERVAL_MS);
};

let globalStatusBarApp: ReturnType<typeof createApp> | null = null;
const GLOBAL_STATUSBAR_CONTAINER_CLASS = 'ark-global-statusbar-mount-point';

// 当脚本加载完成时启动主逻辑
$(() => {
  console.info('[ARK_STATUSBAR] Module Loaded. Initializing...');

  // --- 初始化管理器 ---
  const manager = StatusBarManager.getInstance();
  manager.init();

  // --- 通过 TavernHelper 注入控制台按钮 ---
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
          import('./core/event_bus').then(({ ArkEventBus }) => {
            ArkEventBus.emit('system:toggle');
          });
        });
      }
    } catch (e) {
      console.error('[ARK_STATUSBAR] Failed to inject button:', e);
    }
  }

  // --- 挂载全局状态栏 ---
  const ST_DOC = window.parent?.document || document;
  let globalContainer = ST_DOC.querySelector(`.${GLOBAL_STATUSBAR_CONTAINER_CLASS}`);
  if (!globalContainer) {
    globalContainer = ST_DOC.createElement('div');
    globalContainer.className = GLOBAL_STATUSBAR_CONTAINER_CLASS;
    ST_DOC.body.appendChild(globalContainer);
  } else {
    // 强制清理遗留的 Vue 实例，避免热重载时多次挂载导致冲突
    if (globalStatusBarApp) {
      globalStatusBarApp.unmount();
      globalStatusBarApp = null;
    }
    // 清空容器内容
    globalContainer.innerHTML = '';
  }

  // 注意：我们直接进行挂载，但它的显示与隐藏完全由组件内部的自身状态控制
  globalStatusBarApp = createApp(GlobalStatusBar);
  globalStatusBarApp.mount(globalContainer);

  // --- 前端初始构建 (立即执行) ---
  // 1. 将样式从 iframe 传输/穿透到酒馆主窗口 (Teleport)
  teleportStyle();

  // 2. 启动前端轮询挂载循环
  startMountingLoop();
});

// 卸载阶段清理
$(window).on('pagehide', () => {
  // 清理全局管理器带来的副作用（解绑母窗口上的拦截器，防死锁）
  StatusBarManager.getInstance().destroy();

  deteleportStyle();
  if (globalStatusBarApp) {
    globalStatusBarApp.unmount();
    globalStatusBarApp = null;
  }
  if (startupApp) {
    startupApp.unmount();
    startupApp = null;
  }
  if (returnBtnApp) {
    returnBtnApp.unmount();
    returnBtnApp = null;
  }

  // 物理清理挂载点，确保热更新后新代码能够重新发现并挂载
  const ST_DOC = window.parent?.document || document;
  ST_DOC.querySelectorAll(`.${STARTUP_CONTAINER_CLASS}`).forEach(el => el.remove());
  ST_DOC.querySelectorAll(`.${RETURN_BTN_CONTAINER_CLASS}`).forEach(el => el.remove());
});
