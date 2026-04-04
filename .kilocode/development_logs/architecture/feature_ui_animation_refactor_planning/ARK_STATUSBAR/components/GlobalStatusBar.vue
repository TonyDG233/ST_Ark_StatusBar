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
      'edge-snapped': isSnappedToEdge !== false,
      'edge-snapped-left': isSnappedToEdge === 'left',
      'edge-snapped-right': isSnappedToEdge === 'right',
      'is-dragging': isDraggingState
    }"
    :style="{
      '--ui-width': isMiniMode ? 'auto' : (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
      '--ui-font-size': (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
      '--snapped-width': isSnappedToEdge ? `${snappedStretchWidth}px` : '32px',
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
        <button class="icon-btn toggle-btn" @click="toggleMinimize" title="折叠/展开" :class="{ 'is-mini': isMiniMode }">
          <div class="corner top-left"></div>
          <div class="corner top-right"></div>
          <div class="corner bottom-left"></div>
          <div class="corner bottom-right"></div>
        </button>
      </div>
    </div>
    
    <!-- 气泡窗状态，全权交由 startDrag 处理，不再绑定 click (靠拖拽恢复) -->
    <div
      v-show="isSnappedToEdge"
      class="edge-snap-indicator"
      @mousedown="startDrag"
      @touchstart="startDrag"
      title="向屏幕内侧拖动以展开窗口"
    >
      <span class="icon" style="pointer-events: none;">📖</span>
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
import { useArkConfig } from '../core/config_store';
import {
  lastTriggeredEntries,
  pendingEntries,
  previewUiFontSize,
  previewUiWidth
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
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const statusBarEl = ref<HTMLElement | null>(null);

import { useDraggablePhysics } from './global_tabs/useDraggablePhysics';
const {
  transformX,
  transformY,
  isDraggingState,
  isSnappedToEdge,
  snappedStretchWidth,
  startDrag,
  resetPosition,
  checkBounds
} = useDraggablePhysics(statusBarEl, isMiniMode);

const toggleMinimize = () => {
  // 既然气泡窗完全由左右拉扯控制恢复了，这里的 toggleMinimize 仅用于普通按钮上的 展开/折叠
  if (isSnappedToEdge.value) return;

  isMiniMode.value = !isMiniMode.value;
  if (isMiniMode.value) {
    currentTab.value = 'interceptor';
  }
  
  // 切换模式后（等待动画）再做一次越界检查
  setTimeout(() => requestAnimationFrame(() => checkBounds()), 350);
};

// --- 环境联动与事件总线挂载 ---
import { setupGlobalListeners } from './global_tabs/shared_ui_state';
import { setupUiEventsAutomator } from './global_tabs/ui_events_automator';

let cleanupAutomator: () => void;

onMounted(() => {
  // 第 3 步：激活全局的事件总线，让 shared_ui_state 作为唯一数据源开始监听原生与内部变动
  setupGlobalListeners();

  // 初始化默认位置
  resetPosition();

  // 挂载从 Vue 剥离出去的业务事件监听器
  cleanupAutomator = setupUiEventsAutomator({
    onInterceptorTriggered: () => {
      currentTab.value = 'interceptor';
      isMiniMode.value = false;
    },
    requestCheckBounds: () => {
      requestAnimationFrame(() => checkBounds());
    }
  });

  // 移除 ResizeObserver 防止拖拽及动画过程中的高频触发和无限循环卡顿
  requestAnimationFrame(() => checkBounds());
});

onUnmounted(() => {
  if (cleanupAutomator) cleanupAutomator();
});
</script>

<style scoped>
@import './styles/theme.scss';
@import './styles/shared_ui.scss';
@import './styles/global_statusbar.scss';
</style>
