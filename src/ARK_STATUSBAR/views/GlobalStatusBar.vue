<template>
  <!-- [物理外壳层] 完全负责承载物理位移，禁止添加任何影响宽高的业务 class -->
  <div
    v-if="isSystemEnabled"
    v-show="isVisible"
    class="ark-global-statusbar-mount-point fixed top-0 z-[9999]"
    :class="{ 
      'transition-[left,right,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]': isSnapping 
    }"
    :style="{
      left: currentAnchor === 'left' ? `${transformLeft}px` : 'auto',
      right: currentAnchor === 'right' ? `${transformRight}px` : 'auto',
      transform: `translateY(${transformY}px)`,
    }"
    ref="statusBarEl"
  >
    <!-- [视觉 UI 容器层] 
         负责：圆角、背景材质、主题色、弹性过渡、响应式宽度控制 
    -->
    <div
      class="ark-transition-shell flex flex-col shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="[
        /* --- 主题映射防线 (必须注入主题类名，以激活 CSS 变量) --- */
        currentConfig?.theme === 'light' ? 'light-theme border-outline-variant bg-surface' : '',
        currentConfig?.theme === 'dark' ? 'dark-theme border-outline-variant bg-surface' : '',
        currentConfig?.theme === 'transparent' ? 'dark-theme bg-surface/40 backdrop-blur-md border-white/10' : '',
        
        /* --- 模式边界与溢出控制 --- */
        currentUiMode === UiMode.BUBBLE
          ? 'overflow-visible !border-none !bg-transparent !shadow-none items-end'
          : 'overflow-hidden border',

        /* --- BUBBLE 物理形态补偿 (向左向右吸附切角) --- */
        currentUiMode === UiMode.BUBBLE
          ? `!flex-row items-center justify-center !w-[var(--snapped-width)] !h-[60px] !min-w-[32px] opacity-80 cursor-grab hover:opacity-100 hover:bg-[#007bff33] border-white/20 bg-[#282828d9] backdrop-blur-md ${isSnappedToEdge === 'left' ? '!rounded-r-[30px] !border-l-0' : '!rounded-l-[30px] !border-r-0'}`
        /* --- MINI 物理形态补偿 --- */
        : currentUiMode === UiMode.MINI
          ? 'w-[13em] max-w-[13em] rounded-2xl opacity-80 hover:opacity-100'
        /* --- FULL 物理形态补偿 --- */
        : 'w-[var(--ui-width)] max-w-[90vw] max-h-[calc(100dvh-80px)] rounded-lg',

        /* --- 拖拽帧率保护 --- */
        isDraggingState ? '!transition-none' : ''
      ]"
      :style="{
        position: 'relative',
        'transform-origin': currentAnchor === 'left' ? 'left top' : 'right top',
        '--ui-width': (previewUiWidth ?? currentConfig?.uiWidth ?? 400) + 'px',
        '--snapped-width': isSnappedToEdge ? `${snappedStretchWidth}px` : '32px',
        fontSize: (previewUiFontSize ?? currentConfig?.uiFontSize ?? 14) + 'px',
      }"
    >
      
      <!-- BUBBLE 气泡态：极度压缩态，由于视觉完全不同，采用独立的渲染树 -->
      <template v-if="currentUiMode === UiMode.BUBBLE">
        <BubbleModeView
          :position="isSnappedToEdge === 'left' ? 'left' : 'right'"
          :width="snappedStretchWidth"
          @drag-start="startDrag"
          @open-full="handleOpenFull"
          @open-mini="handleOpenMini"
        />
      </template>

      <!-- FULL 和 MINI 态：它们必须共享同一个外层结构 (TopBar)，以保障四角按钮的动画和宽度变化能够连贯 -->
      <template v-else>
        <!-- 共享的 TopBar，保证四角按钮的过渡动画不会因为组件销毁而中断 -->
        <TopBar
          :title="currentUiMode === UiMode.FULL ? '方舟世界书控制台' : `拦截记录: ${pendingEntries.length}`"
          :icon="currentUiMode === UiMode.FULL ? 'menu_book' : 'warning'"
          :isMini="currentUiMode === UiMode.MINI"
          @toggle-minimize="toggleMinimize"
          @mousedown="startDrag"
          @touchstart="startDrag"
          class="flex-shrink-0 z-50 cursor-grab active:cursor-grabbing"
          :class="currentUiMode === UiMode.MINI ? '!border-b-0 rounded-t-2xl ' + (currentConfig?.theme === 'transparent' ? '!bg-black/20' : '!bg-surface-container-high') : ''"
        />

        <!-- 内容区域容器：采用绝对定位交叉淡入淡出，摆脱高度互相挤压的问题 -->
        <!-- 1. FULL 常规全展态的内容区 -->
        <!-- 三层嵌套脱壳法：第一层 Grid 0fr 负责提供平滑折叠空间 -->
        <div
          class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full min-h-0"
          :style="{ gridTemplateRows: currentUiMode === UiMode.FULL ? '1fr' : '0fr' }"
        >
          <!-- 第二层：物理挤压垫片。必须仅有 min-h-0 且不能有固定 height，这样在 0fr 时它才会完全被压扁到 0px -->
          <div class="min-h-0 min-w-0 overflow-hidden w-full transition-opacity duration-300"
               :class="currentUiMode === UiMode.FULL ? 'opacity-100' : 'opacity-0'">
               
            <!-- 第三层：恢复业务定高防线以保证 Grid 展开动画平滑，但新增动态 max-height 钳制防止因缩放窗口导致底部被裁切 -->
            <div class="flex flex-col w-full"
                 :style="{
                   height: (previewUiHeight ?? currentConfig?.uiHeight ?? 400) + 'px',
                   maxHeight: 'calc(100dvh - 140px)'
                 }">
            
              <div class="flex-1 overflow-y-auto scrollbar-none flex flex-col relative min-h-0 bg-background global-watermark">
                <DashboardTab
                  v-if="currentTab === 'dashboard'"
                  @navigate="(t, s) => { currentTab = t; currentSubTab = s || ''; }"
                />
                
                <InterceptorTab v-if="currentTab === 'worldbook' && currentSubTab === 'interceptor'" @close-panel="() => {
                  if (preInterceptUiMode === UiMode.MINI) currentUiMode = UiMode.MINI;
                  preInterceptUiMode = null;
                }" />
                
                <WorldbookTab v-if="currentTab === 'worldbook' && currentSubTab === 'lore'" />
                
                <HistoryTab v-if="currentTab === 'worldbook' && currentSubTab === 'history'" />
                
                <SettingsTab v-if="currentTab === 'settings'" />

                <ToolsTab v-if="currentTab === 'misc'" />
              </div>

              <!-- 底部导航区 (SubNav + BottomNav) -->
              <div class="relative flex-shrink-0 z-50 flex flex-col w-full text-[var(--color-on-surface)]">
                <!-- 二级悬浮导航 (SubNav) 绝对定位于底部 -->
                <div class="absolute bottom-full left-0 right-0 z-40 flex justify-center mb-2 pointer-events-none px-2 box-border">
                  <SubNav
                    class="pointer-events-auto"
                    v-if="currentTab === 'worldbook'"
                    :activeSubTab="currentSubTab"
                    :tabs="worldbookSubTabs"
                    @change-sub-tab="(val: string) => currentSubTab = val"
                  />
                </div>
                <BottomNav :activeTab="currentTab" @change-tab="(val: string) => currentTab = val" />
              </div>
              
            </div>
          </div>
        </div>

        <!-- FULL 态专属底角拉伸把手 -->
        <template v-if="currentUiMode === UiMode.FULL">
          <div
            class="absolute bottom-0 left-0 w-6 h-6 cursor-sw-resize z-[100]"
            @mousedown.stop.prevent="e => startResize(e, 'sw')"
            @touchstart.stop.prevent="e => startResize(e, 'sw')"
            title="拖拽缩放UI尺寸"
          ></div>
          <div
            class="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize z-[100]"
            @mousedown.stop.prevent="e => startResize(e, 'se')"
            @touchstart.stop.prevent="e => startResize(e, 'se')"
            title="拖拽缩放UI尺寸"
          ></div>
          
          <!-- 视觉提示三角 (可选，如果影响美观可忽略，仅提供功能) -->
          <svg class="absolute bottom-1 right-1 w-3 h-3 opacity-30 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v6h-6M21 21l-7-7" /></svg>
          <svg class="absolute bottom-1 left-1 w-3 h-3 opacity-30 pointer-events-none transform scale-x-[-1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v6h-6M21 21l-7-7" /></svg>
        </template>

        <!-- 2. MINI 悬浮窗态的内容区 (仅包含列表本身) -->
        <div class="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden w-full min-h-0"
             :style="{ gridTemplateRows: currentUiMode === UiMode.MINI ? '1fr' : '0fr' }">
          <div class="min-h-0 min-w-0 overflow-hidden w-full transition-opacity duration-300"
               :class="currentUiMode === UiMode.MINI ? 'opacity-100' : 'opacity-0'">
            <div class="w-full flex flex-col">
              <!-- TODO: [Phase 2] 平常状态下此处应展示基于 DashboardTab 2.3 的“触发记录概览”，而不是目前这样特定条目细节的堆砌 -->
              <MiniWindow
                :entries="displayEntries"
                class="rounded-b-2xl shadow-sm !border-t-0"
              />
            </div>
          </div>
        </div>

      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { UiMode, useDraggablePhysics } from '../hooks/useDraggablePhysics';
import { configStore, useArkConfig } from '../store/config_store';

// 手动导入组件防 Webpack 幽灵丢件
import BottomNav from '../components/BottomNav.vue';
import MiniWindow from '../components/MiniWindow.vue';
import SubNav from '../components/SubNav.vue';
import TopBar from '../components/TopBar.vue';

// 引入解耦后的独立 View
import BubbleModeView from './global_tabs/BubbleModeView.vue';

// 业务 Tabs
import DashboardTab from './global_tabs/dashboard/DashboardTab.vue';
import HistoryTab from './global_tabs/history/HistoryTab.vue';
import InterceptorTab from './global_tabs/interceptor/InterceptorTab.vue';
import SettingsTab from './global_tabs/settings/SettingsTab.vue';
import ToolsTab from './global_tabs/tools/ToolsTab.vue';
import WorldbookTab from './global_tabs/worldbook/WorldbookTab.vue';

// Pinia化前端数据中心
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../store/ui_state_store';

const uiStore = useUIStateStore();
const {
    currentTokenCount,
    isArknightsCard,
    isTestMode,
    pendingEntries,
    recentTriggerLogs,
    previewUiFontSize,
    previewUiWidth,
    previewUiHeight,
} = storeToRefs(uiStore);

const displayEntries = computed(() => {
  return pendingEntries.value.length > 0 ? pendingEntries.value : (recentTriggerLogs.value[0]?.entries || []);
});

const isVisible = ref(true);
const currentUiMode = ref<UiMode>(UiMode.MINI);
const preInterceptUiMode = ref<UiMode | null>(null);

// 双层路由状态
const currentTab = ref('worldbook');
const currentSubTab = ref('interceptor');

// 定义世界书模式下的二级导航栏
const worldbookSubTabs = [
  { id: 'interceptor', label: '预警', icon: 'security' },
  { id: 'lore', label: '条目', icon: 'menu_book' },
  { id: 'history', label: '历史', icon: 'history' }
];

const currentConfig = useArkConfig();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const statusBarEl = ref<HTMLElement | null>(null);

const handleOpenFull = () => {
  currentUiMode.value = UiMode.FULL;
  currentTab.value = 'worldbook';
  currentSubTab.value = 'interceptor';
  setTimeout(() => checkBounds(), 350);
};

const handleOpenMini = () => {
  currentUiMode.value = UiMode.MINI;
  setTimeout(() => checkBounds(), 350);
};

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

// ==========================================
// 缩放把手逻辑 (Resize Handlers)
// ==========================================
let isResizing = false;
let resizeStartX = 0;
let resizeStartY = 0;
let initialWidth = 0;
let initialHeight = 0;
let initialTransformLeft = 0;
let initialTransformRight = 0;
let resizeDirection: 'se' | 'sw' | null = null;

const startResize = (e: MouseEvent | TouchEvent, direction: 'se' | 'sw') => {
  e.preventDefault();
  isResizing = true;
  resizeDirection = direction;
  isDraggingState.value = true;
  
  if (e.type === 'touchstart') {
    resizeStartX = (e as TouchEvent).touches[0].clientX;
    resizeStartY = (e as TouchEvent).touches[0].clientY;
  } else {
    resizeStartX = (e as MouseEvent).clientX;
    resizeStartY = (e as MouseEvent).clientY;
  }
  
  initialWidth = Number(previewUiWidth.value ?? currentConfig.value?.uiWidth ?? 400);
  initialHeight = Number(previewUiHeight.value ?? currentConfig.value?.uiHeight ?? 400);
  
  initialTransformLeft = transformLeft.value;
  initialTransformRight = transformRight.value;

  const ST_DOC = window.parent?.document || document;
  ST_DOC.addEventListener('mousemove', onResizeDrag);
  ST_DOC.addEventListener('touchmove', onResizeDrag, { passive: false });
  ST_DOC.addEventListener('mouseup', stopResize);
  ST_DOC.addEventListener('touchend', stopResize);
};

const onResizeDrag = (e: MouseEvent | TouchEvent) => {
  if (!isResizing) return;
  e.preventDefault();
  
  let currentX = 0;
  let currentY = 0;
  if (e.type === 'touchmove') {
    currentX = (e as TouchEvent).touches[0].clientX;
    currentY = (e as TouchEvent).touches[0].clientY;
  } else {
    currentX = (e as MouseEvent).clientX;
    currentY = (e as MouseEvent).clientY;
  }
  
  const dx = currentX - resizeStartX;
  const dy = currentY - resizeStartY;
  
  const ST_WIN = window.parent || window;
  
  let newHeight = initialHeight + dy;
  // 高度最大值：Settings上限 1200，且不超过 CSS 的 max-h (100dvh - 80px)
  const maxHeight = Math.min(1200, ST_WIN.innerHeight - 80);
  newHeight = Math.max(200, Math.min(newHeight, maxHeight));
  
  let newWidth = initialWidth;
  // 宽度最大值：Settings上限 1000，且不超过 CSS 的 max-w (90vw)
  const maxWidth = Math.min(1000, ST_WIN.innerWidth * 0.9);
  
  if (resizeDirection === 'se') {
    newWidth = initialWidth + dx;
    newWidth = Math.max(200, Math.min(newWidth, maxWidth));
    // 当按右下角且基于 right 锚点时，我们需要向右推 offset 抵消左边缘默认移动
    if (currentAnchor.value === 'right') {
      transformRight.value = initialTransformRight - (newWidth - initialWidth);
    }
  } else if (resizeDirection === 'sw') {
    newWidth = initialWidth - dx;
    newWidth = Math.max(200, Math.min(newWidth, maxWidth));
    // 当按左下角且基于 left 锚点时，我们需要向左推 offset 抵消右边缘默认移动
    if (currentAnchor.value === 'left') {
      transformLeft.value = initialTransformLeft - (newWidth - initialWidth);
    }
  }
  
  previewUiWidth.value = newWidth;
  previewUiHeight.value = newHeight;
};

const stopResize = () => {
  isResizing = false;
  isDraggingState.value = false;
  
  const ST_DOC = window.parent?.document || document;
  ST_DOC.removeEventListener('mousemove', onResizeDrag);
  ST_DOC.removeEventListener('touchmove', onResizeDrag);
  ST_DOC.removeEventListener('mouseup', stopResize);
  ST_DOC.removeEventListener('touchend', stopResize);
  
  if (previewUiWidth.value !== null || previewUiHeight.value !== null) {
    configStore.updateConfig({
      uiWidth: previewUiWidth.value ?? currentConfig.value?.uiWidth,
      uiHeight: previewUiHeight.value ?? currentConfig.value?.uiHeight
    });
    setTimeout(() => {
      previewUiWidth.value = null;
      previewUiHeight.value = null;
      checkBounds(true);
    }, 100);
  }
};

const toggleMinimize = () => {
  if (currentUiMode.value === UiMode.FULL) {
    currentUiMode.value = UiMode.MINI;
  } else if (currentUiMode.value === UiMode.MINI) {
    currentUiMode.value = UiMode.FULL;
    // 根据用户要求，取消强制跳转到拦截界面的逻辑，默认保持或返回主页 (Dashboard)
    // currentTab.value = 'worldbook';
    // currentSubTab.value = 'interceptor';
  }
  // 给 CSS 的 transition 留出时间后，执行最后一次物理兜底碰撞收口
  setTimeout(() => checkBounds(), 350);
};

// --- 环境联动与事件总线挂载 (精简版) ---
const { setupGlobalListeners } = uiStore;
let interceptorTriggeredListener: (e: CustomEvent) => void;
let systemToggleListener: (e: Event) => void;

onMounted(() => {
  setupGlobalListeners();

  interceptorTriggeredListener = (e: CustomEvent) => {
    const triggered = e.detail.entries || [];
    const isManualTest = !!e.detail.isManualTest;
    
    isTestMode.value = isManualTest;
    currentTokenCount.value = e.detail.tokenCount ?? 0;

    pendingEntries.value = triggered;
    
    currentTab.value = 'worldbook';
    currentSubTab.value = 'interceptor';

    // 如果处于 MINI 态（悬浮窗），或者因为某些原因被折叠，强制弹出完整拦截页。
    // 气泡态下 (BUBBLE)，不强制弹出版面，气泡窗自身会展示微型拦截面板。
    if (currentUiMode.value !== UiMode.BUBBLE) {
      preInterceptUiMode.value = currentUiMode.value;
      currentUiMode.value = UiMode.FULL;
    } else {
      preInterceptUiMode.value = null; // 气泡态不做记忆切换
    }

    if (!isSystemEnabled.value) {
      configStore.updateConfig({ isSystemEnabled: true });
    }
    
    if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
  };
  document.addEventListener('ark-interceptor-triggered', interceptorTriggeredListener);

  let baselineDiffListener: (e: Event) => void;
  baselineDiffListener = () => {
    if (!isArknightsCard.value) return; 
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
    if (newState) checkBounds();
  };
  document.addEventListener('ark:system-toggle', systemToggleListener);
  
  const ST_WIN = window.parent || window;
  const handleWindowResize = () => checkBounds();
  ST_WIN.addEventListener('resize', handleWindowResize);

  onUnmounted(() => {
    document.removeEventListener('ark-interceptor-triggered', interceptorTriggeredListener);
    document.removeEventListener('ark:worldbook-baseline-diff-detected', baselineDiffListener);
    document.removeEventListener('ark:system-toggle', systemToggleListener);
    ST_WIN.removeEventListener('resize', handleWindowResize);
  });
});
</script>

<style scoped>
/* 引入全局最新的主题 Token 与 Scoped Preflight */
@import '../styles/theme.scss';

/* 保留对原始样式的防线。由于我们改用了 Tailwind 动态渲染类名，这里清空了以前手写的恶心 Grid 0fr 魔法。
   Tailwind 的 JIT 编译器会自动生成我们写在 class 里的工具类。
*/
</style>
