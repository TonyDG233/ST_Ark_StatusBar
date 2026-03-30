<template>
  <div
    v-if="isSystemEnabled"
    class="ark-global-statusbar"
    v-show="isVisible"
    :class="{
      'light-theme': currentConfig?.theme === 'light',
      'dark-theme': currentConfig?.theme === 'dark',
      'transparent-theme': currentConfig?.theme === 'transparent',
      'mini-mode': isMiniMode,
    }"
    :style="{
      '--ui-width': isMiniMode ? 'auto' : (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
      '--ui-font-size': (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
      transform: `translate(${transformX}px, ${transformY}px)`,
    }"
    ref="statusBarEl"
  >
    <div
      class="statusbar-header"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @dblclick="resetPosition"
      title="拖拽移动，双击还原位置"
    >
      <div class="title" v-if="!isMiniMode"><span class="icon">📖</span> 方舟世界书控制台</div>
      <div class="title mini" v-else><span class="icon">📖</span> 世界书 (预警: {{ pendingEntries.length }})</div>
      <div class="controls">
        <button class="icon-btn" @click="toggleMinimize" title="折叠/展开">
          {{ isMiniMode ? '↗' : '↙' }}
        </button>
      </div>
    </div>

    <div class="statusbar-tabs" v-show="!isMiniMode">
      <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">拦截预警</button>
      <button :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部条目</button>
      <button :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">记录(Git)</button>
      <button :class="{ active: currentTab === 'settings' }" @click="currentTab = 'settings'">设置</button>
    </div>

    <div class="statusbar-content" v-show="!isMiniMode">
      <InterceptorTab v-show="currentTab === 'interceptor'" @close-panel="isMiniMode = true" />
      <WorldbookTab v-show="currentTab === 'all'" />
      <HistoryTab v-show="currentTab === 'history'" />
      <SettingsTab v-show="currentTab === 'settings'" />
    </div>

    <!-- [FEATURE: MINI_SNAPSHOT] -> Compact list shown ONLY in mini mode -->
    <div class="statusbar-mini-content" v-show="isMiniMode">
      <div v-if="(pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries).length === 0" class="mini-empty">
        无近期触发记录
      </div>
      <ul v-else class="mini-entry-list">
        <li
          v-for="entry in pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries"
          :key="entry.uid || Math.random()"
        >
          <span class="indicator" :class="{ blocked: entry.enabled === false }"></span>
          <span class="text">{{
            entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0] : '未知')
          }}</span>
        </li>
      </ul>
    </div>
    <!-- [FEATURE: MINI_SNAPSHOT] END -->
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { configStore, useArkConfig } from '../core/config_store';
import { ArkEventBus } from '../core/event_bus';
import { StatusBarManager } from '../logic/statusbar_manager';
import {
  allAvailableWorldbooks,
  charBoundWorldbooks,
  currentPrimaryWorldbook,
  currentTokenCount,
  globalMountedWorldbooks,
  isTestMode,
  lastTriggeredEntries,
  pendingEntries,
  previewUiFontSize,
  previewUiWidth,
} from './global_tabs/shared_ui_state';

// 引入彻底解耦的微型 Domain Tab 组件
import HistoryTab from './global_tabs/history/HistoryTab.vue';
import InterceptorTab from './global_tabs/interceptor/InterceptorTab.vue';
import SettingsTab from './global_tabs/settings/SettingsTab.vue';
import WorldbookTab from './global_tabs/worldbook/WorldbookTab.vue';

// --- 外壳退化层：仅保留纯粹的视图控制与拖拽物理逻辑 ---
const isVisible = ref(true);
const isMiniMode = ref(true);
const currentTab = ref('interceptor');
const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const toggleMinimize = () => {
  isMiniMode.value = !isMiniMode.value;
  if (isMiniMode.value) {
    currentTab.value = 'interceptor';
  }
};

// --- DOM 节点与拖拽坐标 ---
const statusBarEl = ref<HTMLElement | null>(null);

const transformX = ref(0);
const transformY = ref(0);
let isDragging = false;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging = true;
  if (e.type === 'touchstart') {
    const touch = (e as TouchEvent).touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  } else {
    startX = (e as MouseEvent).clientX;
    startY = (e as MouseEvent).clientY;
  }

  initialX = transformX.value;
  initialY = transformY.value;

  const ST_DOC = window.parent?.document || document;
  ST_DOC.addEventListener('mousemove', onDrag);
  ST_DOC.addEventListener('touchmove', onDrag, { passive: false });
  ST_DOC.addEventListener('mouseup', stopDrag);
  ST_DOC.addEventListener('touchend', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging || !statusBarEl.value) return;
  e.preventDefault();

  let clientX = 0;
  let clientY = 0;
  if (e.type === 'touchmove') {
    const touch = (e as TouchEvent).touches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = (e as MouseEvent).clientX;
    clientY = (e as MouseEvent).clientY;
  }

  const dx = clientX - startX;
  const dy = clientY - startY;

  transformX.value = initialX + dx;
  transformY.value = initialY + dy;
};

const checkBounds = () => {
  if (!statusBarEl.value) return;
  const rect = statusBarEl.value.getBoundingClientRect();
  const ST_WIN = window.parent || window;

  const viewportWidth = ST_WIN.innerWidth;
  const viewportHeight = ST_WIN.innerHeight;

  let deltaX = 0;
  let deltaY = 0;

  if (rect.right > viewportWidth) deltaX = viewportWidth - rect.right;
  if (rect.left + deltaX < 0) deltaX = 0 - rect.left;
  if (rect.bottom > viewportHeight) deltaY = viewportHeight - rect.bottom;

  const SAFE_TOP = 70;
  if (rect.top + deltaY < SAFE_TOP) deltaY = SAFE_TOP - rect.top;

  if (deltaX !== 0 || deltaY !== 0) {
    transformX.value += deltaX;
    transformY.value += deltaY;
  }
};

const stopDrag = () => {
  isDragging = false;
  const ST_DOC = window.parent?.document || document;
  ST_DOC.removeEventListener('mousemove', onDrag);
  ST_DOC.removeEventListener('touchmove', onDrag);
  ST_DOC.removeEventListener('mouseup', stopDrag);
  ST_DOC.removeEventListener('touchend', stopDrag);

  requestAnimationFrame(() => checkBounds());
};

const resetPosition = () => {
  transformX.value = 0;
  transformY.value = 0;
};

// --- 环境联动与事件总线挂载 ---
import { setupGlobalListeners } from './global_tabs/shared_ui_state';

const getEntryType = (
  entry: Partial<import('../types/st_worldbook_types').WorldbookEntry> & Partial<SillyTavern.FlattenedWorldInfoEntry>,
) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

const loadWorldbookLists = async () => {
  try {
    allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
    globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    charBoundWorldbooks.value = await manager.worldbook.getCharBoundWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

const loadPrimaryWorldbookName = async () => {
  try {
    const result = await getCharWorldbookNames('current');
    currentPrimaryWorldbook.value =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
  } catch (e) {
    console.error('Failed to load primary worldbook', e);
  }
};

onMounted(() => {
  // 第 3 步：激活全局的事件总线，让 shared_ui_state 作为唯一数据源开始监听原生与内部变动
  setupGlobalListeners();

  document.addEventListener('ark-config-updated', ((e: CustomEvent) => {
    const config = e.detail;
    if (config && config.isSystemEnabled) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
    }
  }) as EventListener);

  if (currentConfig.value && currentConfig.value.isSystemEnabled) {
    loadPrimaryWorldbookName();
    loadWorldbookLists();
  }

  // 接管底层的拦截预警推送，分配到 shared_state 给各个微组件使用
  document.addEventListener('ark-interceptor-triggered', ((e: CustomEvent) => {
    const triggered = e.detail.entries || [];
    const isManualTest = !!e.detail.isManualTest;
    isTestMode.value = isManualTest;
    currentTokenCount.value = e.detail.tokenCount ?? 0;

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
      currentTab.value = 'interceptor';
      isMiniMode.value = false;

      if (!isSystemEnabled.value) {
        configStore.updateConfig({ isSystemEnabled: true });
      }
      if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
    } else {
      manager.releaseInterceptAndSend();
    }
  }) as EventListener);

  if (statusBarEl.value) {
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => checkBounds()));
    resizeObserver.observe(statusBarEl.value);
  }
  requestAnimationFrame(() => checkBounds());

  // 替换掉原有的原生 CustomEvent 监听
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

  // 原有的 ark-chat-changed 用于重新拉取 primary 名称，它不属于 diff，可以直接放到 loadWorldbookLists 中，或者这里先保留自定义事件兼容
  // 后续如果 chat-changed 也是核心总线，就继续替换。
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
      requestAnimationFrame(() => checkBounds());
    }
  };
  ArkEventBus.on('system:toggle', toggleSystemHandler);

  const ST_WIN = window.parent || window;
  const handleWindowResize = () => requestAnimationFrame(() => checkBounds());
  ST_WIN.addEventListener('resize', handleWindowResize);

  // 组件卸载时解绑
  onUnmounted(() => {
    ArkEventBus.off('worldbook:baseline_diff_detected', diffHandler);
    ArkEventBus.off('system:chat_changed', chatChangedHandler);
    ArkEventBus.off('system:toggle', toggleSystemHandler);
    ST_WIN.removeEventListener('resize', handleWindowResize);
  });
});
</script>

<style scoped>
@import './styles/theme.scss';
@import './styles/shared_ui.scss';

.ark-global-statusbar {
  position: fixed;
  bottom: 60px;
  right: 20px;
  width: var(--ui-width, 400px);
  max-width: 90vw;
  max-height: calc(100dvh - 80px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    opacity 0.3s ease;
}

.ark-global-statusbar.light-theme {
  background: #fdfdfd;
  border: 1px solid #ccc;
  color: #333;
}

.ark-global-statusbar.dark-theme {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
}

.ark-global-statusbar.transparent-theme {
  background: rgba(44, 47, 51, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #eee;
}

.ark-global-statusbar.mini-mode {
  width: auto;
  max-width: 180px;
  border-radius: 20px;
  opacity: 0.8;
}

.statusbar-mini-content {
  padding: 0 10px 10px 10px;
  max-height: 90px;
  overflow-y: auto;
  font-size: 0.9em;
}

.mini-empty {
  text-align: center;
  opacity: 0.5;
  padding: 5px;
  font-size: 0.9em;
}

.mini-entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.mini-entry-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.3);
}

.mini-entry-list li:last-child {
  border-bottom: none;
}

.mini-entry-list .indicator {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #007bff;
  flex-shrink: 0;
}

.mini-entry-list .indicator.blocked {
  background-color: #dc3545;
}

.mini-entry-list .text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.ark-global-statusbar.mini-mode .tab-header {
  display: none;
}

.ark-global-statusbar.mini-mode .interceptor-actions {
  flex-direction: column;
  gap: 5px;
}

.ark-global-statusbar.mini-mode:hover {
  opacity: 1;
}

.statusbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
  font-weight: bold;
  cursor: grab;
}

.statusbar-header:active {
  cursor: grabbing;
}

.ark-global-statusbar.mini-mode .statusbar-header {
  border-bottom: none;
  padding: 5px 15px;
  border-radius: 20px;
}

.title.mini {
  font-size: 0.85em;
  margin-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.statusbar-header .icon-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.1em;
  cursor: pointer;
  padding: 0 5px;
}

.statusbar-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
}

.statusbar-tabs button {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
}

.statusbar-tabs button.active {
  opacity: 1;
  border-bottom: 2px solid #007bff;
  font-weight: bold;
}

.statusbar-content {
  padding: 15px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
