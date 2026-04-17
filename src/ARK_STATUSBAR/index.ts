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
const GLOBAL_STATUSBAR_CONTAINER_CLASS = 'ark-global-statusbar-mount-point';

let startupApp: ReturnType<typeof createApp> | null = null;
let returnBtnApp: ReturnType<typeof createApp> | null = null;
let mountLoopTimer: number | null = null;
let globalStatusBarApp: ReturnType<typeof createApp> | null = null;
let lastIsArknights: boolean | null = null;

/**
 * 更新全局角色身份状态并广播
 * 这是给 Vue 层 (shared_ui_state) 用的信号，让 UI 立刻知道角色卡切换了。
 */
const updateIdentityAndBroadcast = () => {
  const charName = getCurrentCharacterName() || '';
  const isArknights = charName.includes('明日方舟');

  if (lastIsArknights !== isArknights) {
    lastIsArknights = isArknights;
    document.dispatchEvent(new CustomEvent('ark:identity-updated', { detail: { isArknights } }));
  }
};

/**
 * 主挂载逻辑循环
 */
const startMountingLoop = () => {
  // 如果已经存在定时器，先清理防重入
  if (mountLoopTimer !== null) {
    window.clearInterval(mountLoopTimer);
  }

  mountLoopTimer = window.setInterval(() => {
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

      // 2. 【例外设计：强制同步鉴权】
      // 破坏性的 DOM 操作（清空文本、挂载/卸载 UI）绝不能依赖任何异步或外部事件。
      // 这里每 500ms 强制同步读取一次内存，彻底杜绝切卡瞬间产生的“时序竞态”，
      // 防止错把别人的开局剧情给 empty() 删除了！
      const charName = getCurrentCharacterName() || '';
      const isArknights = charName.includes('明日方舟');

      // 同步广播身份变更（如果在此期间身份才真正被获取到，则通知Vue）
      updateIdentityAndBroadcast();

      if (!isArknights) {
        // 如果不是，强制物理移除（如果已经存在）开局UI和返回按钮，并终止挂载流程
        if ($mesText.find(`.${STARTUP_CONTAINER_CLASS}`).length > 0) {
          if (startupApp) {
            startupApp.unmount();
            startupApp = null;
          }
          $mesText.find(`.${STARTUP_CONTAINER_CLASS}`).remove();
        }
        if ($mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).length > 0) {
          if (returnBtnApp) {
            returnBtnApp.unmount();
            returnBtnApp = null;
          }
          $mesText.find(`.${RETURN_BTN_CONTAINER_CLASS}`).remove();
        }
        return;
      }

      // 3. 检查当前处于哪个 Swipe ID
      // 以 SillyTavern.chat[0] 为真实数据源
      const firstMessage = SillyTavern.chat[0];
      const swipeId = firstMessage.swipe_id || 0;

      // 4. 挂载逻辑
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

function injectTavernControls() {
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

function mountGlobalStatusBar() {
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
}

// -----------------------------------------------------------------------------
// 引导程序 (Bootstrapper)
// -----------------------------------------------------------------------------
/**
 * 引导程序：显式地定义启动序列 (Pipeline)
 * 作用：取代过去的散装初始化，提供一个从上到下、明确的生命周期主干。
 */
async function bootstrap() {
  console.info('[ARK_STATUSBAR] Module Loaded. Bootstrapping...');

  // --- 1. 初始化业务管理器 ---
  // 它内部会处理挂载配置、唤醒拦截器、以及注册专属于世界书业务的环境监听器
  const manager = StatusBarManager.getInstance();
  await manager.init();

  // --- 2. 角色身份鉴定与事件注册 ---
  updateIdentityAndBroadcast();
  // 【例外监听：提升 UI 响应速度】
  // 我们直接监听最底层的原生 CHAT_CHANGED 事件，为了让 Vue 的界面在切卡的瞬间立马就能识别出是否是方舟角色
  // 而不是死板地等待后端把配置都加载完才变装。这大大缓解了 UI 响应卡顿的问题。
  eventOn(tavern_events.CHAT_CHANGED, updateIdentityAndBroadcast);

  // --- 3. 注入外部控制台按钮 ---
  // 这是向宿主环境 (SillyTavern) 注入控制 UI 交互的按钮
  injectTavernControls();

  // --- 4. 准备渲染 UI ---
  // 先应用可能需要的样式传送 (将 iframe 内部的样式注入到外部母网页)
  teleportStyle();

  // --- 5. 挂载 UI 元素 ---
  // 挂载可能一直存在的全局状态栏 (挂载于 document body)
  mountGlobalStatusBar();

  // 启动轮询：用于寻找聊天流中的特定消息气泡 (第0楼) 并在其上动态挂载 开局UI/返回按钮
  // 注意：我们没有干涉原有的轮询挂载 DOM 的逻辑 (`startMountingLoop`)，
  // 只是确保它在核心业务 (manager.init()) 就绪之后才启动，避免了业务没准备好 UI 就跑出来的尴尬。
  startMountingLoop();

  console.info('[ARK_STATUSBAR] Bootstrapping Complete.');
}

// 当脚本加载完成时启动主逻辑
$(() => {
  bootstrap();
});

// -----------------------------------------------------------------------------
// 卸载阶段清理 (Teardown)
// -----------------------------------------------------------------------------
$(window).on('pagehide', () => {
  // 清理挂载轮询死循环定时器
  if (mountLoopTimer !== null) {
    window.clearInterval(mountLoopTimer);
    mountLoopTimer = null;
  }

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
