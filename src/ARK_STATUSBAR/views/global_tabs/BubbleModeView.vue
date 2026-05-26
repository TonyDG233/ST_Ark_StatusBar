<template>
  <div class="w-full h-full relative pointer-events-auto">
    <!-- 气泡拉拽把手 (覆盖在最上方，截获拖拽与双击事件) -->
    <div
      class="w-full h-full flex items-center text-[1.1em] cursor-grab active:cursor-grabbing absolute inset-0 z-10"
      :class="position === 'left' ? 'justify-end pr-2' : 'justify-start pl-2'"
      @mousedown="(e) => $emit('drag-start', e)"
      @touchstart="(e) => $emit('drag-start', e)"
      @click="handleBubbleClick"
      @dblclick="$emit('open-mini')"
      title="单击展开微型拦截窗，双击恢复迷你悬浮窗，或拖拽展开"
    >
      <!-- 透明占位，实际图标和 Badge 由下方的 BubbleWindow 渲染 -->
    </div>

    <!-- 视觉呈现与 Popover 逻辑层 -->
    <BubbleWindow
      :position="position"
      :width="width"
      :triggerCount="triggerCount"
      :showPopover="showPopover"
      :totalTokens="currentTokenCount"
      :showTypeIndicator="currentConfig?.showConstantEntries"
      :entries="mappedEntries"
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
import { computed, ref, watch } from 'vue';
import BubbleWindow from '../../components/BubbleWindow.vue';
import { StatusBarManager } from '../../services/statusbar_manager';
import { useArkConfig } from '../../store/config_store';
import { useUIStateStore, type UIWorldbookEntry } from '../../store/ui_state_store';

const props = defineProps<{
  position: 'left' | 'right';
  width: number;
}>();

const emit = defineEmits(['drag-start', 'open-full', 'open-mini']);

const uiStore = useUIStateStore();
const { pendingEntries, currentTokenCount, entryTokenCountCache, currentPrimaryWorldbook } = storeToRefs(uiStore);
const manager = StatusBarManager.getInstance();
const currentConfig = useArkConfig();

const showPopover = ref(false);

const triggerCount = computed(() => pendingEntries.value.length);

// 映射给 BubbleWindow 的纯展示数据
const mappedEntries = computed(() => {
  return pendingEntries.value.map((entry: UIWorldbookEntry) => ({
    uid: entry.uid,
    name: entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0].toString() : '未知'),
    enabled: entry.enabled,
    tempDisabled: entry.tempDisabled,
    tokens: entryTokenCountCache.value[uiStore.getEntryKey(entry)] || 0,
    world: entry.world,
    type: (entry.strategy?.type === 'constant' ? 'constant' : 'selective') as 'constant' | 'selective'
  }));
});

// 被动拦截触发时，自动展开小气泡面板
watch(triggerCount, (newVal, oldVal) => {
  if (newVal > 0 && newVal > oldVal) {
    showPopover.value = true;
  }
});

const handleBubbleClick = () => {
  // 用户反馈更新：如果在有拦截数据的情况下，用户误关了小面板，需要有重新打开的方法。
  // 因此恢复单击打开/关闭气泡微型面板的功能。
  if (triggerCount.value > 0) {
    showPopover.value = !showPopover.value;
  }
};

const handleToggleEntry = async (mappedEntry: any, action: 'enable' | 'resume' | 'temp' | 'disable') => {
  const originalEntry = pendingEntries.value.find((e: UIWorldbookEntry) => e.uid === mappedEntry.uid);
  if (!originalEntry) return;

  const targetWorldbook = originalEntry.world || currentPrimaryWorldbook.value;
  if (!targetWorldbook) return;

  if (action === 'enable' || action === 'disable') {
    originalEntry.enabled = (action === 'enable');
    originalEntry.tempDisabled = false;
    manager.interceptor.removeTempDisabledEntry(originalEntry.uid, targetWorldbook);
    await manager.editor.toggleEntryEnabled(originalEntry, targetWorldbook);
  } else if (action === 'temp' || action === 'resume') {
    originalEntry.tempDisabled = (action === 'temp');
    originalEntry.enabled = !originalEntry.tempDisabled;
    if (originalEntry.tempDisabled) {
      manager.interceptor.addTempDisabledEntry(originalEntry.uid, targetWorldbook);
    } else {
      manager.interceptor.removeTempDisabledEntry(originalEntry.uid, targetWorldbook);
    }
    await manager.interceptor.toggleEntrySilent(originalEntry, targetWorldbook);
  }
};

const handleAction = async (actionType: 'send' | 'cancel' | 'open_full') => {
  showPopover.value = false;
  if (actionType === 'send') {
    const currentEntries = [...pendingEntries.value];
    pendingEntries.value = [];
    manager.releaseInterceptAndSend(currentEntries, currentTokenCount.value);
  } else if (actionType === 'cancel') {
    await manager.interceptor.cancelSend();
    pendingEntries.value = [];
  } else if (actionType === 'open_full') {
    emit('open-full');
  }
};
</script>
