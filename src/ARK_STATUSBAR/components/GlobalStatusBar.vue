<template>
  <!-- [物理外壳层] 完全负责承载物理位移，不参与任何样式形变或渐变过渡 -->
  <div
    v-if="isSystemEnabled"
    v-show="isVisible"
    class="ark-global-statusbar-shell"
    style="position: fixed; left: 0; top: 0; z-index: 9999;"
    :style="{
      transform: `translate(${transformX}px, ${transformY}px)`
    }"
    ref="statusBarEl"
  >
    <!-- [视觉 UI 容器层] 负责所有颜色、尺寸、伸缩渐变。被绝对定位死锁在右侧锚点 (right:0) 
         以便配合 transformX（右边缘的绝对像素值）产生完美的左向伸长效果，无任何动画撕裂 -->
    <div
      class="ark-global-statusbar"
      :class="{
        'light-theme': currentConfig?.theme === 'light',
        'dark-theme': currentConfig?.theme === 'dark',
        'transparent-theme': currentConfig?.theme === 'transparent',
        'mini-mode': currentUiMode === UiMode.MINI,
        'edge-snapped': currentUiMode === UiMode.BUBBLE,
        'edge-snapped-left': isSnappedToEdge === 'left',
        'edge-snapped-right': isSnappedToEdge === 'right',
        'is-dragging': isDraggingState
      }"
      style="position: absolute; right: 0; top: 0;"
      :style="{
        '--ui-width': currentUiMode === UiMode.MINI ? 'auto' : (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
        '--ui-font-size': (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
        '--snapped-width': isSnappedToEdge ? `${snappedStretchWidth}px` : '32px'
      }"
    >
      <!-- 气泡窗变身把手，利用原 UI 的极限压缩产生无缝融合效果 -->
      <div 
        v-show="currentUiMode === UiMode.BUBBLE" 
        class="edge-snap-indicator"
        @mousedown="startDrag"
        @touchstart="startDrag"
        title="向屏幕内侧拖动以展开窗口"
      >
        <span class="icon">📖</span>
      </div>

      <!-- 常规完整面板内容 (包含 FULL 和 MINI 模式) -->
      <template v-if="currentUiMode !== UiMode.BUBBLE">
        <div
          class="statusbar-header"
          @mousedown="startDrag"
          @touchstart="startDrag"
          @dblclick="resetPosition"
          title="拖拽移动，双击还原位置"
        >
          <div class="title" v-if="currentUiMode === UiMode.FULL"><span class="icon">📖</span> 方舟世界书控制台</div>
          <div class="title mini" v-else><span class="icon">📖</span> 世界书 (预警: {{ pendingEntries.length }})</div>
          <div class="controls">
            <!-- 引入了沙盒版的四角翻转按钮 -->
            <button class="icon-btn toggle-btn" @click="toggleMinimize" title="折叠/展开" :class="{ 'is-mini': currentUiMode === UiMode.MINI }">
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </button>
          </div>
        </div>

        <div class="statusbar-tabs" v-show="currentUiMode === UiMode.FULL">
          <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">拦截预警</button>
          <button :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部条目</button>
          <button :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">记录(Git)</button>
          <button :class="{ active: currentTab === 'settings' }" @click="currentTab = 'settings'">设置</button>
        </div>

        <div class="statusbar-content" v-show="currentUiMode === UiMode.FULL">
          <InterceptorTab v-show="currentTab === 'interceptor'" @close-panel="currentUiMode = UiMode.MINI" />
          <WorldbookTab v-show="currentTab === 'all'" />
          <HistoryTab v-show="currentTab === 'history'" />
          <SettingsTab v-show="currentTab === 'settings'" />
        </div>

        <!-- [FEATURE: MINI_SNAPSHOT] -> Compact list shown ONLY in mini mode -->
        <div class="statusbar-mini-content" v-show="currentUiMode === UiMode.MINI">
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
      </template>
    </div>
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

// --- 全局单一状态机 & 独立物理引擎钩子 ---
import { UiMode, useDraggablePhysics } from './global_tabs/useDraggablePhysics';

const isVisible = ref(true);
const currentUiMode = ref<UiMode>(UiMode.MINI); // 替换掉脆弱的 isMiniMode
const currentTab = ref('interceptor');
const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const statusBarEl = ref<HTMLElement | null>(null);

// ==========================================
// 业务视图层 与 纯物理引擎层的切割交接点
// ==========================================
const {
  transformX,
  transformY,
  isDraggingState,
  isSnappedToEdge,
  snappedStretchWidth,
  startDrag,
  resetPosition,
  checkBounds
} = useDraggablePhysics(statusBarEl, currentUiMode);

const toggleMinimize = () => {
  if (currentUiMode.value === UiMode.FULL) {
    currentUiMode.value = UiMode.MINI;
  } else if (currentUiMode.value === UiMode.MINI) {
    currentUiMode.value = UiMode.FULL;
    currentTab.value = 'interceptor';
  }
  
  // 给 CSS 的 transition (0.3s) 留出时间后，执行最后一次物理兜底碰撞收口
  setTimeout(() => checkBounds(), 350);
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
  // 激活全局的事件总线，让 shared_ui_state 作为唯一数据源开始监听原生与内部变动
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
      currentUiMode.value = UiMode.FULL; // 原 isMiniMode = false

      if (!isSystemEnabled.value) {
        configStore.updateConfig({ isSystemEnabled: true });
      }
      if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
    } else {
      manager.releaseInterceptAndSend();
    }
  }) as EventListener);

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
      checkBounds(); // 原 requestAnimationFrame
    }
  };
  ArkEventBus.on('system:toggle', toggleSystemHandler);

  const ST_WIN = window.parent || window;
  // 尺寸变化的重新测算工作已交由 useDraggablePhysics 内的 ResizeObserver 接管
  // 这里只保留一个最粗糙的外部兜底触发即可
  const handleWindowResize = () => checkBounds();
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

/* =========================================================================
   🚨 绝对警报 🚨
   不要在这里手动修改、推翻任何关于 `ark-global-statusbar` 本身的 CSS！
   这是遗留下来的原版单壳样式，它保证了你看到的圆角、背景、列表样式原汁原味。
   
   我们要做的仅仅是把外层物理防线与这套样式通过 Vue <template> 层隔开。
   ========================================================================= */

.ark-global-statusbar {
  /* position: fixed; 和 transform 被抽离到了外层物理壳 (shell) 中。
     这里改成了 absolute; right: 0;，为了配合物理壳的右上角锚点。 */
  /* bottom: 60px; (由 transformY 控制) */
  /* right: 20px; (由 transformX 控制) */
  width: var(--ui-width, 400px);
  max-width: 90vw;
  max-height: calc(100dvh - 80px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  /* 
    【重点解耦】：因为不再和物理坐标纠缠，这里的 transition 可以放心大胆地加上宽度变化。
    且它不会像以前那样导致由于右边缘抽搐而被撕裂。
  */
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    opacity 0.3s ease,
    width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

/* =========================================================================
   新增：气泡贴边无缝变身特效 (BUBBLE 模式)
   ========================================================================= */

.ark-global-statusbar.is-dragging {
  /* 拖拽拉伸时禁用任何视觉动画，保证黏性物理手感 0 延迟 */
  transition: none !important;
}

.ark-global-statusbar.edge-snapped {
  width: var(--snapped-width, 32px) !important;
  height: 60px !important;
  min-width: 32px !important;
  opacity: 0.8;
  cursor: grab;
  /* 屏蔽原版所有普通内容的展示 */
  display: flex !important;
  flex-direction: row; /* 水平居中把手图标 */
  align-items: center;
  justify-content: center;
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.2)) !important;
  background: var(--SmartThemeBlurTintColor, rgba(40, 40, 40, 0.85)) !important;
  backdrop-filter: blur(8px);
  /* 无缝压缩的奥秘所在： */
  border-radius: 30px; 
}

/* 根据外壳传进来的靠墙方向，动态切平那一侧的圆角，营造“从墙里长出来”的视觉融合 */
.ark-global-statusbar.edge-snapped-left {
  /* 左侧靠墙，将左边上下两个角切平 (直角 0) */
  border-radius: 0 30px 30px 0 !important;
  border-left: none !important;
}

.ark-global-statusbar.edge-snapped-right {
  /* 右侧靠墙，将右边上下两个角切平 (直角 0) */
  border-radius: 30px 0 0 30px !important;
  border-right: none !important;
}

.edge-snap-indicator {
  /* 充满气泡内部作为拖拽抓手 */
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1em;
  cursor: grab;
}

/* 如果有弹性拉伸，图标应该跟着圆弧部分走，而不是呆在正中央 */
.ark-global-statusbar.edge-snapped-left .edge-snap-indicator {
  justify-content: flex-end;
  padding-right: 8px;
}

.ark-global-statusbar.edge-snapped-right .edge-snap-indicator {
  justify-content: flex-start;
  padding-left: 8px;
}

.edge-snap-indicator .icon {
  display: inline-block;
  line-height: 1;
  pointer-events: none;
}
.edge-snap-indicator:active {
  cursor: grabbing;
}
.ark-global-statusbar.edge-snapped:hover {
  opacity: 1;
  background: rgba(0, 123, 255, 0.2) !important;
}
</style>
