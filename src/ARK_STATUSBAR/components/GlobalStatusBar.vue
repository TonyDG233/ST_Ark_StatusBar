<template>
  <!-- [物理外壳层] 完全负责承载物理位移，不参与任何样式形变或渐变过渡 -->
  <div
    v-if="isSystemEnabled"
    v-show="isVisible"
    class="ark-global-statusbar-shell"
    :class="{ 'is-snapping': isSnapping }"
    style="position: fixed; top: 0; z-index: 9999"
    :style="{
      left: currentAnchor === 'left' ? `${transformLeft}px` : 'auto',
      right: currentAnchor === 'right' ? `${transformRight}px` : 'auto',
      transform: `translateY(${transformY}px)`,
    }"
    ref="statusBarEl"
  >
    <!-- [视觉 UI 容器层] 负责所有颜色、尺寸、伸缩渐变。
         根据外壳给定的 currentAnchor 动态调整自己的 transform-origin 
         使得向外展开的动画总是完美的！ -->
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
        'is-dragging': isDraggingState,
      }"
      :style="{
        'transform-origin': currentAnchor === 'left' ? 'left top' : 'right top',
        '--ui-width':
          currentUiMode === UiMode.MINI ? '180px' : (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
        '--ui-font-size': (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
        '--snapped-width': isSnappedToEdge ? `${snappedStretchWidth}px` : '32px',
        '--ui-height-content': currentConfig?.uiHeight ? currentConfig.uiHeight + 'px' : '400px',
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
        <div class="statusbar-header" @mousedown="startDrag" @touchstart="startDrag" title="拖拽移动">
          <div class="title" v-if="currentUiMode === UiMode.FULL"><span class="icon">📖</span> 方舟世界书控制台</div>
          <div class="title mini" v-else><span class="icon">📖</span> 世界书 (预警: {{ pendingEntries.length }})</div>
          <div class="controls">
            <!-- 引入了沙盒版的四角翻转按钮 -->
            <button
              class="icon-btn toggle-btn"
              @click="toggleMinimize"
              title="折叠/展开"
              :class="{ 'is-mini': currentUiMode === UiMode.MINI }"
            >
              <div class="corner top-left"></div>
              <div class="corner top-right"></div>
              <div class="corner bottom-left"></div>
              <div class="corner bottom-right"></div>
            </button>
          </div>
        </div>

        <!-- 高跷防护：使用 Grid 0fr 方案包裹内容 -->
        <div class="statusbar-content-wrapper" :class="{ 'is-full-expanded': currentUiMode === UiMode.FULL }">
          <div class="statusbar-content-inner">
            <div class="statusbar-tabs" v-show="currentUiMode === UiMode.FULL">
              <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">
                拦截预警
              </button>
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
          </div>
        </div>

        <!-- [FEATURE: MINI_SNAPSHOT] -> Compact list shown ONLY in mini mode -->
        <div class="statusbar-mini-content" v-show="currentUiMode === UiMode.MINI">
          <div
            v-if="(pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries).length === 0"
            class="mini-empty"
          >
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
import { configStore, useArkConfig } from '../store/config_store';

// 引入彻底解耦的微型 Domain Tab 组件
import HistoryTab from './global_tabs/history/HistoryTab.vue';
import InterceptorTab from './global_tabs/interceptor/InterceptorTab.vue';
import SettingsTab from './global_tabs/settings/SettingsTab.vue';
import WorldbookTab from './global_tabs/worldbook/WorldbookTab.vue';

// --- 全局单一状态机 & 独立物理引擎钩子 ---
import { UiMode, useDraggablePhysics } from './global_tabs/useDraggablePhysics';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../store/ui_state_store';
// 1. 实例化 Store
const uiStore = useUIStateStore();

// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { 
    currentTokenCount,
    isArknightsCard,
    isTestMode,
    lastTriggeredEntries,
    pendingEntries,
    previewUiFontSize,
    previewUiWidth,
} = storeToRefs(uiStore);

const isVisible = ref(true);
const currentUiMode = ref<UiMode>(UiMode.MINI);
const currentTab = ref('interceptor');
const currentConfig = useArkConfig();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const statusBarEl = ref<HTMLElement | null>(null);

// ==========================================
// 业务视图层 与 纯物理引擎层的切割交接点
// ==========================================
const {
  currentAnchor,
  transformLeft,
  transformRight,
  transformY,
  isDraggingState,
  isSnapping,
  isSnappedToEdge,
  snappedStretchWidth,
  startDrag,
  checkBounds,
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
const { 
  setupGlobalListeners
} = uiStore;

// 保存对事件处理函数的引用以便在 onUnmounted 中移除
let interceptorTriggeredListener: (e: CustomEvent) => void;
let baselineDiffListener: (e: Event) => void;
let systemToggleListener: (e: Event) => void;

onMounted(() => {
  setupGlobalListeners();

  interceptorTriggeredListener = (e: CustomEvent) => {
    const triggered = e.detail.entries || [];
    const isManualTest = !!e.detail.isManualTest;
    isTestMode.value = isManualTest;
    currentTokenCount.value = e.detail.tokenCount ?? 0;

    pendingEntries.value = triggered;
    currentTab.value = 'interceptor';
    currentUiMode.value = UiMode.FULL;

    if (!isSystemEnabled.value) {
      configStore.updateConfig({ isSystemEnabled: true });
    }
    if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
  };
  document.addEventListener('ark-interceptor-triggered', interceptorTriggeredListener);

  baselineDiffListener = () => {
    if (!isArknightsCard.value) return; // 非方舟专属角色卡，忽略基准线检查警告
    if (typeof toastr !== 'undefined') {
      toastr.warning(
        '检测到当前世界书带有开局剧情或手动修改的残余状态。为防止剧情串台，建议在侧边栏或历史记录处重置。',
        'ARK_STATUSBAR 提示',
        { timeOut: 8000, positionClass: 'toast-top-center' },
      );
    }
  };
  document.addEventListener('ark:worldbook-baseline-diff-detected', baselineDiffListener);

  systemToggleListener = () => {
    const newState = !(currentConfig.value?.isSystemEnabled ?? true);
    configStore.updateConfig({ isSystemEnabled: newState });

    if (newState) {
      checkBounds(); // 原 requestAnimationFrame
    }
  };
  document.addEventListener('ark:system-toggle', systemToggleListener);

  const ST_WIN = window.parent || window;
  // 尺寸变化的重新测算工作已交由 useDraggablePhysics 内的 ResizeObserver 接管
  // 这里只保留一个最粗糙的外部兜底触发即可
  const handleWindowResize = () => checkBounds();
  ST_WIN.addEventListener('resize', handleWindowResize);

  // 组件卸载时解绑
  onUnmounted(() => {
    document.removeEventListener('ark-interceptor-triggered', interceptorTriggeredListener);
    document.removeEventListener('ark:worldbook-baseline-diff-detected', baselineDiffListener);
    document.removeEventListener('ark:system-toggle', systemToggleListener);
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
  display: flex;
  flex-direction: column;
  overflow: hidden; /* <--- 修复：强制截断流出的子元素，以配合内部滚动条 */
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
  width: 13em; /* <--- 修复点：抛弃死板的 px 避免移动端过宽，随 font-size (14px-2px) 等比缩小 */
  max-width: 13em;
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
  /* 移除固定的 max-height: 400px，让父级 Flexbox 控制高度。
     如果设置了 uiHeight，我们给它一个显式的最大高度，让其可拉伸 */
  max-height: var(--ui-height-content, 400px);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

/* 响应式：在窄屏幕手机端，忽略用户设置的 ui-height，退化为默认的自适应高度限制 */
@media (max-width: 500px) {
  .statusbar-content {
    max-height: 400px;
  }
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

/* =========================================================================
   新增：物理壳平滑阻尼过渡 (用于处理碰撞墙壁及状态跳转时的瞬间回弹)
   ========================================================================= */
.ark-global-statusbar-shell.is-snapping {
  transition:
    left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    right 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* =========================================================================
   新增：内容防“高跷”拉伸保护淡入 (Grid 0fr 方案)
   ========================================================================= */
.statusbar-content-wrapper {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  width: 100%; /* 防止 Grid 宽度失控 (Grid Blowout) */
  min-height: 0; /* 允许在父级 Flex 容器中被压缩 */
}

.statusbar-content-wrapper.is-full-expanded {
  grid-template-rows: 1fr;
}

.statusbar-content-inner {
  min-height: 0;
  min-width: 0; /* 防止 Grid 内的 Flex 子项撑破父级限制的绝对关键 */
  width: 100%;
  opacity: 0;
  transition: opacity 0.3s ease;
  display: flex;
  flex-direction: column;
}

.statusbar-content-wrapper.is-full-expanded .statusbar-content-inner {
  opacity: 1;
}
</style>
