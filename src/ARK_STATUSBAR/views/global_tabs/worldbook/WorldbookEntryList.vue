<template>
  <LoreEntryList
    v-model:search="filterEntryTexts"
    v-model:category="filterCategory"
    v-model:type="filterType"
    v-model:isBatchMode="isEntryBatchMode"
    :availableCategories="availableCategories"
    :isAllSelected="isAllEntriesSelected"
    @toggleSelectAll="toggleSelectAllEntries"
    @createNewEntry="createNewEntry"
    @batchPin="isPin => actions.batchPinEntries(selectedEntries, isPin)"
    @batchToggleType="actions.batchToggleEntryType(wbName, selectedEntries)"
    @batchToggleEnabled="enabled => actions.batchToggleEntryEnabled(wbName, selectedEntries, enabled)"
    @batchDelete="handleBatchDelete"
  >
    <!-- Data Cards List -->
    <div v-if="isLoadingWb === wbName" class="text-on-surface-variant text-xs text-center py-4">加载中...</div>
    <div
      v-else-if="!worldbookEntriesCache[wbName] || worldbookEntriesCache[wbName].length === 0"
      class="text-on-surface-variant text-xs text-center py-4"
    >
      此世界书没有包含有效条目。
    </div>
    <div v-else class="flex flex-col min-w-0">
      <WorldbookEntryItem
        v-for="entry in visibleEntries"
        :key="entry.uid"
        :entry="entry"
        :wbName="wbName"
        :isBatchMode="isEntryBatchMode"
        v-model:selectedEntries="selectedEntries"
      />

      <!-- 渐进式加载 -->
      <div v-if="hasMoreEntries" class="flex justify-center p-2 border-t border-outline-variant">
        <button
          class="px-3 py-1 bg-surface border border-outline hover:border-primary hover:bg-surface-variant text-xs text-primary-text rounded-sm transition-colors cursor-pointer outline-none"
          @click="loadMoreEntries"
        >
          加载更多... ({{ visibleEntries.length }} / {{ processedEntries.length }})
        </button>
      </div>
      <div v-if="processedEntries.length === 0" class="text-on-surface-variant text-xs text-center py-4">
        没有找到匹配的条目。
      </div>
    </div>
  </LoreEntryList>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import LoreEntryList from '../../../components/worldbook/LoreEntryList.vue';
import { useArkConfig } from '../../../store/config_store';
import { UIWorldbookEntry } from '../../../store/ui_state_store';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryItem from './WorldbookEntryItem.vue';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../../../store/ui_state_store';
// 1. 实例化 Store
const uiStore = useUIStateStore();
// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { isLoadingWb, worldbookEntriesCache } = storeToRefs(uiStore);

const props = defineProps<{
  wbName: string;
}>();

const currentConfig = useArkConfig();
const actions = useWorldbookActions();

// Local UI State
const filterEntryTexts = ref('');
const filterCategory = ref('');
const filterType = ref('');

const isEntryBatchMode = ref(false);
const selectedEntries = ref<number[]>([]);

const PAGE_SIZE = 50;
const displayLimit = ref(PAGE_SIZE);

// Compute available categories for the dropdown
const availableCategories = computed(() => {
  const entries = worldbookEntriesCache.value[props.wbName] || [];
  const cats = new Set<string>();
  entries.forEach((e: any) => {
    const name = e.name || '';
    const match = name.match(/^\[(.*?)\]/);
    if (match) cats.add(match[1]);
    else cats.add('未分类');
  });
  const sorted = Array.from(cats).sort();
  const uncatIndex = sorted.indexOf('未分类');
  if (uncatIndex !== -1) {
    sorted.splice(uncatIndex, 1);
    sorted.push('未分类');
  }
  return sorted;
});

// Process and filter entries
const processedEntries = computed(() => {
  const entries = worldbookEntriesCache.value[props.wbName] || [];
  if (!entries.length) return [];

  let mapped = entries.map((entry: any) => ({
    ...entry,
    _isPinned: currentConfig.value?.pinnedEntries?.includes(entry.uid) || false,
    _computedType: actions.getEntryType(entry as UIWorldbookEntry),
  })) as UIWorldbookEntry[];

  const searchText = filterEntryTexts.value;
  if (searchText) {
    const query = searchText.toLowerCase();
    mapped = mapped.filter(entry => {
      const name = (entry.name || '').toLowerCase();
      const keys = (entry.strategy?.keys || []).join(' ').toLowerCase();
      return name.includes(query) || keys.includes(query);
    });
  }

  if (filterCategory.value) {
    mapped = mapped.filter(entry => {
      const name = entry.name || '';
      const match = name.match(/^\[(.*?)\]/);
      const cat = match ? match[1] : '未分类';
      return cat === filterCategory.value;
    });
  }

  if (filterType.value) {
    mapped = mapped.filter(entry => entry._computedType === filterType.value);
  }

  mapped.sort((a, b) => (b._isPinned ? 1 : 0) - (a._isPinned ? 1 : 0));
  return mapped;
});

const visibleEntries = computed(() => processedEntries.value.slice(0, displayLimit.value));
const hasMoreEntries = computed(() => displayLimit.value < processedEntries.value.length);

const loadMoreEntries = () => {
  displayLimit.value += PAGE_SIZE;
};

const isAllEntriesSelected = computed(() => {
  const entries = processedEntries.value;
  return entries.length > 0 && selectedEntries.value.length === entries.length;
});

const toggleSelectAllEntries = (checked: boolean) => {
  if (checked) {
    selectedEntries.value = processedEntries.value.map(en => en.uid);
  } else {
    selectedEntries.value = [];
  }
};

const handleBatchDelete = async () => {
  const deleted = await actions.batchDeleteEntries(props.wbName, selectedEntries.value);
  if (deleted) selectedEntries.value = []; // Clear selection if user clicked yes
};

const createNewEntry = () => {
  actions.createNewEntry(props.wbName);
};

// Auto close batch mode if filter results in 0 selected somehow
watch(selectedEntries, () => {
  // If list is emptied, we don't automatically close batch mode, but it's optional.
});
watch(isEntryBatchMode, val => {
  if (!val) selectedEntries.value = [];
});
</script>

<style scoped></style>
