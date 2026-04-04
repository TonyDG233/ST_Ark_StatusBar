import { configStore, useArkConfig } from '../../core/config_store';
import { ArkEventBus } from '../../core/event_bus';
import { StatusBarManager } from '../../logic/statusbar_manager';
import {
  allAvailableWorldbooks,
  charBoundWorldbooks,
  currentPrimaryWorldbook,
  currentTokenCount,
  globalMountedWorldbooks,
  isTestMode,
  pendingEntries,
} from './shared_ui_state';

// 工具方法：提取 entry 类型
const getEntryType = (
  entry: Partial<import('../../types/st_worldbook_types').WorldbookEntry> & Partial<SillyTavern.FlattenedWorldInfoEntry>,
) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

// 工具方法：加载所有字典
export const loadWorldbookLists = async () => {
  const manager = StatusBarManager.getInstance();
  try {
    allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
    globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    charBoundWorldbooks.value = await manager.worldbook.getCharBoundWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

// 工具方法：加载主字典名
export const loadPrimaryWorldbookName = async () => {
  try {
    const result = await getCharWorldbookNames('current');
    currentPrimaryWorldbook.value =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
  } catch (e) {
    console.error('Failed to load primary worldbook', e);
  }
};

// 核心初始化与事件挂载：从 Vue 剥离
export function setupUiEventsAutomator(callbacks: {
  onInterceptorTriggered: () => void;
  requestCheckBounds: () => void;
}) {
  const currentConfig = useArkConfig();
  const manager = StatusBarManager.getInstance();

  const handleConfigUpdated = (e: Event) => {
    const customEvent = e as CustomEvent;
    const config = customEvent.detail;
    if (config && config.isSystemEnabled) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
    }
  };
  document.addEventListener('ark-config-updated', handleConfigUpdated);

  if (currentConfig.value && currentConfig.value.isSystemEnabled) {
    loadPrimaryWorldbookName();
    loadWorldbookLists();
  }

  const handleInterceptorTriggered = (e: Event) => {
    const customEvent = e as CustomEvent;
    const triggered = customEvent.detail.entries || [];
    const isManualTest = !!customEvent.detail.isManualTest;
    isTestMode.value = isManualTest;
    currentTokenCount.value = customEvent.detail.tokenCount ?? 0;

    let matchedEntries = triggered.map((raw: any) => {
      raw.enabled = raw.enabled !== false;
      if (!raw.world && currentPrimaryWorldbook.value) {
        raw.world = currentPrimaryWorldbook.value;
      }
      if (!raw.strategy) raw.strategy = {};
      return raw;
    });

    if (!currentConfig.value?.showConstantEntries) {
      matchedEntries = matchedEntries.filter((entry: any) => getEntryType(entry) !== 'constant');
    }

    if (matchedEntries.length > 0 || isManualTest) {
      pendingEntries.value = matchedEntries;
      
      // 通知 UI 切换面板
      callbacks.onInterceptorTriggered();

      if (!(currentConfig.value?.isSystemEnabled ?? true)) {
        configStore.updateConfig({ isSystemEnabled: true });
      }
      if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
    } else {
      manager.releaseInterceptAndSend();
    }
  };
  document.addEventListener('ark-interceptor-triggered', handleInterceptorTriggered);

  // 恢复昨晚被移除的 ResizeObserver 尺寸监听防线
  let resizeObserver: ResizeObserver | null = null;
  const initResizeObserver = () => {
    // 监听状态栏 DOM 内部的高度变化 (如 Tab 切换、预警列表加载)
    // 利用 RequestAnimationFrame 和 ResizeObserver 结合，避免 ResizeObserver Loop Limit Exceeded
    const sbEl = document.querySelector('.ark-global-statusbar');
    if (sbEl) {
      resizeObserver = new ResizeObserver(() => {
        callbacks.requestCheckBounds();
      });
      resizeObserver.observe(sbEl);
    }
  };
  // 延迟一帧等待 DOM 渲染后挂载
  requestAnimationFrame(initResizeObserver);

  const diffHandler = () => {
    if (typeof toastr !== 'undefined') {
      toastr.warning(
        '检测到当前世界书带有开局剧情或手动修改的残余状态。为防止剧情串台，建议在侧边栏重置。',
        'ARK_STATUSBAR 提示',
        { timeOut: 8000, positionClass: 'toast-top-center' },
      );
    }
  };
  ArkEventBus.on('worldbook:baseline_diff_detected', diffHandler);

  const chatChangedHandler = () => {
    if (currentConfig.value?.isSystemEnabled) {
      loadPrimaryWorldbookName();
    }
  };
  ArkEventBus.on('system:chat_changed', chatChangedHandler);

  const toggleSystemHandler = () => {
    const newState = !(currentConfig.value?.isSystemEnabled ?? true);
    configStore.updateConfig({ isSystemEnabled: newState });

    if (newState) {
      loadPrimaryWorldbookName();
      callbacks.requestCheckBounds();
    }
  };
  ArkEventBus.on('system:toggle', toggleSystemHandler);

  const WIN_REF = window.parent || window;
  const handleWindowResize = () => callbacks.requestCheckBounds();
  WIN_REF.addEventListener('resize', handleWindowResize);

  return () => {
    document.removeEventListener('ark-config-updated', handleConfigUpdated);
    document.removeEventListener('ark-interceptor-triggered', handleInterceptorTriggered);
    ArkEventBus.off('worldbook:baseline_diff_detected', diffHandler);
    ArkEventBus.off('system:chat_changed', chatChangedHandler);
    ArkEventBus.off('system:toggle', toggleSystemHandler);
    WIN_REF.removeEventListener('resize', handleWindowResize);
    if (resizeObserver) resizeObserver.disconnect();
  };
}
