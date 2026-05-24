import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { teleportStyle } from '../util/script';
import { AssetManager } from './services/asset_manager';
import { StatusBarManager } from './services/statusbar_manager';
import GlobalStatusBar from './views/GlobalStatusBar.vue';
import ReturnButton from './views/ReturnButton.vue';
import StartupNavigator from './views/StartupNavigator.vue';

// 导入重构抽离的模块
import {
  RETURN_BTN_CONTAINER_CLASS,
  startChatMonitor,
  STARTUP_CONTAINER_CLASS,
  stopChatMonitor
} from './hooks/useChatMonitor';
import { acquireInstanceLock, releaseInstanceLock } from './hooks/useInstanceLock';
import { setupTavernControls } from './hooks/useTavernControls';

// 导入全局样式
import './styles/tailwind.scss';

const GLOBAL_STATUSBAR_CONTAINER_CLASS = 'ark-global-statusbar-mount-point';

// --- 创建全局唯一的 Pinia 引擎 ---
// 保证在不同挂载点 (开局UI、返回按钮、状态栏) 的 Vue 实例之间共享同一份内存数据
const globalPinia = createPinia();

let startupApp: ReturnType<typeof createApp> | null = null;
let returnBtnApp: ReturnType<typeof createApp> | null = null;
let globalStatusBarApp: ReturnType<typeof createApp> | null = null;

let destroyStyle: (() => void) | null = null;

// --- 事件监听器引用，用于卸载时解绑 ---
let onMountStartup: ((e: Event) => void) | null = null;
let onMountReturn: ((e: Event) => void) | null = null;
let onUnmountAll: ((e: Event) => void) | null = null;

function setupMountListeners() {
  onMountStartup = (e: Event) => {
    const customEvent = e as CustomEvent;
    const containerEl = customEvent.detail.containerEl as HTMLElement;
    
    // 确保返回按钮已被清理
    const existingReturnBtn = containerEl.querySelector(`.${RETURN_BTN_CONTAINER_CLASS}`);
    if (existingReturnBtn) {
      if (returnBtnApp) {
        returnBtnApp.unmount();
        returnBtnApp = null;
      }
      existingReturnBtn.remove();
    }

    // 检查是否已经挂载了开局 UI
    if (containerEl.querySelector(`.${STARTUP_CONTAINER_CLASS}`) === null) {
      console.info('[ARK_STATUSBAR] Mounting Startup Navigator...');
      // 挂载前清空当前楼层现有的纯文本内容
      containerEl.innerHTML = '';

      const mountPoint = document.createElement('div');
      mountPoint.className = STARTUP_CONTAINER_CLASS;
      containerEl.appendChild(mountPoint);
      
      startupApp = createApp(StartupNavigator);
      startupApp.use(globalPinia);
      startupApp.mount(mountPoint);
    }
  };

  onMountReturn = (e: Event) => {
    const customEvent = e as CustomEvent;
    const containerEl = customEvent.detail.containerEl as HTMLElement;

    // 确保开局 UI 已被清理
    const existingStartup = containerEl.querySelector(`.${STARTUP_CONTAINER_CLASS}`);
    if (existingStartup) {
      if (startupApp) {
        startupApp.unmount();
        startupApp = null;
      }
      existingStartup.remove();
    }

    // 检查是否已经挂载了返回按钮
    if (containerEl.querySelector(`.${RETURN_BTN_CONTAINER_CLASS}`) === null) {
      console.info('[ARK_STATUSBAR] Mounting Return Button...');
      // 返回按钮追加到现有剧情内容后
      const mountPoint = document.createElement('div');
      mountPoint.className = RETURN_BTN_CONTAINER_CLASS;
      containerEl.appendChild(mountPoint);
      
      returnBtnApp = createApp(ReturnButton);
      returnBtnApp.use(globalPinia);
      returnBtnApp.mount(mountPoint);
    }
  };

  onUnmountAll = (e: Event) => {
    const customEvent = e as CustomEvent;
    const containerEl = customEvent.detail.containerEl as HTMLElement;

    const existingStartup = containerEl.querySelector(`.${STARTUP_CONTAINER_CLASS}`);
    if (existingStartup) {
      if (startupApp) {
        startupApp.unmount();
        startupApp = null;
      }
      existingStartup.remove();
    }

    const existingReturnBtn = containerEl.querySelector(`.${RETURN_BTN_CONTAINER_CLASS}`);
    if (existingReturnBtn) {
      if (returnBtnApp) {
        returnBtnApp.unmount();
        returnBtnApp = null;
      }
      existingReturnBtn.remove();
    }
  };

  document.addEventListener('ark:chat-mount-startup', onMountStartup);
  document.addEventListener('ark:chat-mount-return', onMountReturn);
  document.addEventListener('ark:chat-unmount-all', onUnmountAll);
}

function removeMountListeners() {
  if (onMountStartup) document.removeEventListener('ark:chat-mount-startup', onMountStartup);
  if (onMountReturn) document.removeEventListener('ark:chat-mount-return', onMountReturn);
  if (onUnmountAll) document.removeEventListener('ark:chat-unmount-all', onUnmountAll);
}

function mountGlobalStatusBar() {
  const ST_DOC = window.parent?.document || document;
  let globalContainer = ST_DOC.querySelector(`.${GLOBAL_STATUSBAR_CONTAINER_CLASS}`);
  if (!globalContainer) {
    globalContainer = ST_DOC.createElement('div');
    globalContainer.className = GLOBAL_STATUSBAR_CONTAINER_CLASS;
    ST_DOC.body.appendChild(globalContainer);
  } else {
    if (globalStatusBarApp) {
      globalStatusBarApp.unmount();
      globalStatusBarApp = null;
    }
    globalContainer.innerHTML = '';
  }

  globalStatusBarApp = createApp(GlobalStatusBar);
  globalStatusBarApp.use(globalPinia);
  globalStatusBarApp.mount(globalContainer);
}

// -----------------------------------------------------------------------------
// 全局启动进度播报器
// -----------------------------------------------------------------------------
let $bootToast: any = null;
const TOTAL_STEPS = 7; // 总启动步骤数

function reportBootProgress(stepIdx: number, stepName: string) {
  const percent = Math.floor((stepIdx / TOTAL_STEPS) * 100);
  const message = `系统启动中: ${stepName} [${percent}%]`;
  console.info(`[ARK_BOOTSTRAP] ${stepIdx}/${TOTAL_STEPS} - ${stepName}`);

  if (typeof toastr !== 'undefined') {
    if (!$bootToast) {
      $bootToast = toastr.info(message, 'ARK STATUSBAR', { timeOut: 0, extendedTimeOut: 0, tapToDismiss: false, closeButton: false });
    } else {
      $bootToast.find('.toast-message').text(message);
    }
  }
}

function finishBootProgress() {
  console.info('[ARK_BOOTSTRAP] Bootstrapping Complete.');
  if ($bootToast && typeof toastr !== 'undefined') {
    setTimeout(() => {
      toastr.clear($bootToast);
      toastr.success('神经连接已建立，UI 就绪。', 'ARK STATUSBAR', { timeOut: 2000 });
      $bootToast = null;
    }, 500);
  }
}

// -----------------------------------------------------------------------------
// 引导程序 (Bootstrapper)
// -----------------------------------------------------------------------------
async function bootstrap() {
  if (!acquireInstanceLock()) return;

  console.info('[ARK_STATUSBAR] Module Loaded. Bootstrapping...');

  // --- 0. 预加载核心视觉资源 ---
  reportBootProgress(1, '分析核心视觉资源');
  // 注入回调，让资源管理器内部进度也反映到总进度条上
  await AssetManager.initCoreAssets((taskName, assetPercent) => {
    // 假设 AssetManager 占据整个 Bootstrapping 的前 2 步权重
    const simulatedStep = 1 + (assetPercent / 100);
    reportBootProgress(simulatedStep, `加载 ${taskName}`);
  });

  // --- 1. 初始化业务管理器 ---
  reportBootProgress(3, '初始化业务管理器');
  const manager = StatusBarManager.getInstance();
  await manager.init();

  // --- 2. 注册 Vue 挂载监听器 ---
  reportBootProgress(4, '注册 Vue 挂载钩子');
  setupMountListeners();

  // --- 3. 注入外部控制台按钮 ---
  reportBootProgress(5, '桥接外部控制台');
  setupTavernControls();

  // --- 4. 准备渲染 UI ---
  reportBootProgress(6, '准备样式穿透');
  const { destroy } = teleportStyle();
  destroyStyle = destroy;

  // --- 5. 挂载全局状态栏 UI ---
  reportBootProgress(7, '挂载全局 UI 视图');
  mountGlobalStatusBar();

  // --- 6. 启动轮询观测器 ---
  startChatMonitor();

  finishBootProgress();
}

$(() => {
  bootstrap();
});

// -----------------------------------------------------------------------------
// 卸载阶段清理 (Teardown)
// -----------------------------------------------------------------------------
$(window).on('pagehide', () => {
  // 1. 停止观测器
  stopChatMonitor();

  // 2. 移除 DOM 挂载监听器
  removeMountListeners();

  // 3. 清理业务管理器
  StatusBarManager.getInstance().destroy();

  // 4. 清理样式
  if (destroyStyle) {
    destroyStyle();
    destroyStyle = null;
  }

  // 5. 卸载 Vue 实例
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

  // 6. 物理清理挂载点
  const ST_DOC = window.parent?.document || document;
  ST_DOC.querySelectorAll(`.${STARTUP_CONTAINER_CLASS}`).forEach(el => el.remove());
  ST_DOC.querySelectorAll(`.${RETURN_BTN_CONTAINER_CLASS}`).forEach(el => el.remove());
  ST_DOC.querySelectorAll(`.${GLOBAL_STATUSBAR_CONTAINER_CLASS}`).forEach(el => el.remove());

  // 7. 释放全局单例锁
  releaseInstanceLock();
});
