<template>
  <div class="flex flex-col border border-outline-variant bg-surface-container-low mb-4">
    <!-- Folder Header -->
    <LoreFolderItem
      :title="wb.name"
      :count="worldbookEntriesCache[wb.name]?.length"
      :bindType="wb.type as 'char' | 'global' | 'unmounted'"
      :isPinned="wb.isPinned"
      :expanded="isExpanded"
      :globalBatchMode="isGlobalBatchMode"
      :selected="isSelected"
      @toggle="!isGlobalBatchMode && toggleAccordion()"
      @toggle-select="isSelected = !isSelected"
      @toggle-pin="toggleWorldbookPin"
      @toggle-mount="toggleGlobalMountUI"
      @delete="deleteWorldbookUI"
    />

    <!-- Collapsible Entry List -->
    <WorldbookEntryList v-if="isExpanded" :wbName="wb.name" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import LoreFolderItem from '../../../components/worldbook/LoreFolderItem.vue';
import type { UIWorldbookEntry } from '../../../store/ui_state_store';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryList from './WorldbookEntryList.vue';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../../../store/ui_state_store';

// 1. 实例化 Store
const uiStore = useUIStateStore();
// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { expandedWorldbooks, isLoadingWb, worldbookEntriesCache } = storeToRefs(uiStore);
// 3. 解构方法（不需要 storeToRefs，直接解构即可）
const { CONFIG_ENTRY_PREFIX } = uiStore;

const props = defineProps<{
  wb: { name: string; type: string; isPinned: boolean };
  isGlobalBatchMode: boolean;
  selectedWorldbooks: string[];
}>();

const emit = defineEmits<{
  (e: 'update:selectedWorldbooks', v: string[]): void;
}>();

const actions = useWorldbookActions();

const isSelected = computed({
  get: () => props.selectedWorldbooks.includes(props.wb.name),
  set: val => {
    let newList = [...props.selectedWorldbooks];
    if (val) newList.push(props.wb.name);
    else newList = newList.filter(u => u !== props.wb.name);
    emit('update:selectedWorldbooks', newList);
  },
});

const isExpanded = computed(() => expandedWorldbooks.value.includes(props.wb.name));

const toggleAccordion = async () => {
  const idx = expandedWorldbooks.value.indexOf(props.wb.name);
  if (idx > -1) {
    expandedWorldbooks.value.splice(idx, 1);
  } else {
    expandedWorldbooks.value = [props.wb.name];

    if (!worldbookEntriesCache.value[props.wb.name]) {
      isLoadingWb.value = props.wb.name;
      try {
        const entries = (await getWorldbook(props.wb.name)) as unknown as UIWorldbookEntry[];
        worldbookEntriesCache.value[props.wb.name] = entries.filter(
          (e: UIWorldbookEntry) => !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)),
        );
      } catch (e) {
        console.error(`[ARK_UI] 无法加载世界书 ${props.wb.name}`, e);
        worldbookEntriesCache.value[props.wb.name] = [];
      } finally {
        isLoadingWb.value = null;
      }
    }
  }
};

const toggleWorldbookPin = () => {
  actions.toggleWorldbookPin(props.wb.name);
};

const toggleGlobalMountUI = () => {
  actions.toggleGlobalMount(props.wb.name, props.wb.type !== 'global');
};

const deleteWorldbookUI = () => {
  actions.deleteWorldbookUI(props.wb.name);
};
</script>

<style scoped>
/* 移除旧的样式引入 */
</style>
