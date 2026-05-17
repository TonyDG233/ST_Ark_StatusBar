<template>
  <div class="w-full h-full relative pointer-events-auto">
    <!-- 气泡拉拽把手 (覆盖在最上方，截获拖拽事件) -->
    <div
      class="w-full h-full flex items-center text-[1.1em] cursor-grab active:cursor-grabbing absolute inset-0 z-10"
      :class="position === 'left' ? 'justify-end pr-2' : 'justify-start pl-2'"
      @mousedown="(e) => $emit('drag-start', e)"
      @touchstart="(e) => $emit('drag-start', e)"
      title="向屏幕内侧拖动以展开窗口"
    >
      <!-- 透明占位，实际图标和 Badge 由下方的 BubbleWindow 渲染 -->
    </div>

    <!-- 视觉呈现与 Popover 逻辑层 -->
    <BubbleWindow
      :position="position"
      :width="width"
      :triggerCount="triggerCount"
      :showPopover="showPopover"
      :entries="pendingEntries"
      @click-bubble="handleBubbleClick"
      @close-popover="showPopover = false"
      @action="handleAction"
      @toggle-entry="handleToggleEntry"
      class="absolute inset-0 z-0"
    />
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import BubbleWindow from '../../components/BubbleWindow.vue';
import { useUIStateStore } from '../../store/ui_state_store';

const props = defineProps<{
  position: 'left' | 'right';
  width: number;
}>();

const emit = defineEmits(['drag-start', 'open-full']);

const uiStore = useUIStateStore();
const { pendingEntries } = storeToRefs(uiStore);

const showPopover = ref(false);

const triggerCount = computed(() => pendingEntries.value.length);

// TODO: [Phase 2] 行为逻辑分离
// - 当该气泡由被动拦截触发时，点击面板应触发事件展开为全屏拦截页。
// - 当处于主动点击气泡窗状态时，在此展开小拦截面板，且点击“发送”按钮后应自动收缩回气泡形态。
const handleBubbleClick = () => {
  showPopover.value = !showPopover.value;
};

// TODO: [Phase 2] 接入真正的 send_interceptor 拦截状态切换逻辑
const handleToggleEntry = (entry: any, action: 'enable' | 'resume' | 'temp' | 'disable') => {
  console.log('[Phase 2 TODO] toggle-entry triggered:', entry.name, action);
};

const handleAction = (actionName: string) => {
  showPopover.value = false;
  if (actionName === 'open_full') {
    emit('open-full');
  }
};

// TODO: [Phase 2] 接入真实的总 Token 算力数据 (需与全局大拦截面板逻辑保持一致)
</script>
