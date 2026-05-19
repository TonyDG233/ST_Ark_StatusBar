<template>
  <div class="flex flex-col bg-surface-container-lowest border-x border-b border-outline-variant w-full box-border">
    
    <!-- Header Tools (Search & Local Batch Toggle) -->
    <div class="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-outline-variant bg-surface-container-low flex-shrink-0">
      <!-- Search Bar -->
      <div class="flex-1 flex items-center bg-surface border border-outline px-2 py-1 min-w-[100px] focus-within:border-primary transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant text-[14px] flex-shrink-0 mr-1">search</span>
        <input
          v-model="filterEntryTexts"
          class="bg-transparent border-none text-on-surface font-mono focus:outline-none p-0 w-full placeholder-on-surface-variant/50 text-xs min-w-0"
          placeholder="搜索此书内的条目..."
          type="text"
        />
      </div>
      
      <!-- New Entry & Batch Toggle -->
      <div class="flex gap-1 flex-shrink-0">
        <button class="px-2 py-1 bg-surface border border-outline hover:border-primary text-primary-text transition-colors flex items-center justify-center outline-none cursor-pointer" title="新建条目" @click="createNewEntry">
          <span class="material-symbols-outlined text-[14px]">add</span>
        </button>
        <button 
          class="px-2 py-1 border transition-colors flex items-center gap-1 font-display text-[10px] font-bold outline-none cursor-pointer"
          :class="isEntryBatchMode ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-outline hover:text-on-surface hover:border-on-surface-variant'"
          @click="toggleEntryBatchMode"
        >
          <span class="material-symbols-outlined text-[14px]">checklist</span>
          批量
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div class="flex flex-wrap gap-2 w-full p-2 border-b border-outline-variant bg-surface-container-low flex-shrink-0" v-if="!isEntryBatchMode">
      <select v-model="filterCategory" class="flex-1 min-w-[100px] bg-surface border border-outline-variant px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono outline-none cursor-pointer">
        <option value="">全部类别</option>
        <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
      </select>
      <select v-model="filterType" class="flex-1 min-w-[100px] bg-surface border border-outline-variant px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono outline-none cursor-pointer">
        <option value="">全部类型 (常驻/条件)</option>
        <option value="constant">常驻 (🔵 蓝灯)</option>
        <option value="selective">条件 (🟢 绿灯)</option>
      </select>
    </div>
    
    <!-- Local Batch Management Toolbar (Below filters, statically rendered when active to prevent overlap) -->
    <div v-if="isEntryBatchMode" class="bg-surface-container-highest border-b border-outline-variant py-1.5 px-2 flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-2 shadow-sm">
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1 cursor-pointer font-display text-[10px] text-on-surface hover:text-primary-text transition-colors">
          <input type="checkbox" class="accent-primary" :checked="isAllEntriesSelected" @change="toggleSelectAllEntries" /> 全选
        </label>
      </div>
      <!-- Pill Buttons horizontally wrapping -->
      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Pin/Unpin -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="actions.batchPinEntries(selectedEntries, true)">
          <span class="material-symbols-outlined text-[12px] text-primary-text">push_pin</span> 置顶
        </button>
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="actions.batchPinEntries(selectedEntries, false)">
          <span class="material-symbols-outlined text-[12px] text-on-surface-variant">push_pin</span> 消顶
        </button>
        <!-- Blue/Green Toggle -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="actions.batchToggleEntryType(wbName, selectedEntries)">
          <span class="material-symbols-outlined text-[12px] text-secondary">change_circle</span> 类型切换
        </button>
        <!-- Enable/Disable -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-secondary text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, true)">
          <span class="material-symbols-outlined text-[12px]">check_circle</span> 开启
        </button>
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface-variant text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, false)">
          <span class="material-symbols-outlined text-[12px]">block</span> 关闭
        </button>
        <!-- Delete -->
        <button class="px-1.5 py-0.5 border border-error/50 bg-error-container/10 hover:bg-error-container/30 text-error text-[10px] flex items-center gap-0.5 transition-colors outline-none cursor-pointer" @click="handleBatchDelete">
          <span class="material-symbols-outlined text-[12px]">delete</span> 删除
        </button>
      </div>
    </div>

    <!-- Data Cards List -->
    <div v-if="isLoadingWb === wbName" class="text-on-surface-variant text-xs text-center py-4">加载中...</div>
    <div v-else-if="!worldbookEntriesCache[wbName] || worldbookEntriesCache[wbName].length === 0" class="text-on-surface-variant text-xs text-center py-4">
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
      <div v-if="processedEntries.length === 0" class="text-on-surface-variant text-xs text-center py-4">没有找到匹配的条目。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
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
const { 
  isLoadingWb,
  worldbookEntriesCache
} = storeToRefs(uiStore);


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

// Batch mode controls
const toggleEntryBatchMode = () => {
  isEntryBatchMode.value = !isEntryBatchMode.value;
  if (!isEntryBatchMode.value) selectedEntries.value = [];
};

const isAllEntriesSelected = computed(() => {
  const entries = processedEntries.value;
  return entries.length > 0 && selectedEntries.value.length === entries.length;
});

const toggleSelectAllEntries = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
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
</script>

<style scoped>
/* 移除旧的样式引入 */
</style>
