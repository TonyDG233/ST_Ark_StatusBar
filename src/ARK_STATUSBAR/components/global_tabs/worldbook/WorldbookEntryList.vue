<template>
  <div class="wb-entries-wrapper">
    <div class="filters" style="margin-bottom: 5px">
      <input
        type="text"
        v-model="filterEntryTexts"
        placeholder="搜索此书内的条目..."
        class="search-input"
      />

      <div v-if="isEntryBatchMode" class="batch-toolbar compact">
        <label style="cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" :checked="isAllEntriesSelected" @change="toggleSelectAllEntries" /> 全选
        </label>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="icon-btn pill tiny" @click="actions.batchPinEntries(selectedEntries, true)">📌置顶</button>
          <button class="icon-btn pill tiny" @click="actions.batchPinEntries(selectedEntries, false)">📍消顶</button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryType(wbName, selectedEntries)">🔵/🟢切换</button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, true)">✅开启</button>
          <button class="icon-btn pill tiny" @click="actions.batchToggleEntryEnabled(wbName, selectedEntries, false)">🚫关闭</button>
          <button class="icon-btn pill tiny" style="color: #ff6b6b; border-color: #ff6b6b55" @click="handleBatchDelete">🗑️删除</button>
        </div>
      </div>

      <div class="filter-row" v-if="!isEntryBatchMode">
        <select v-model="filterCategory" class="filter-select">
          <option value="">全部类别</option>
          <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
        <select v-model="filterType" class="filter-select">
          <option value="">全部类型(蓝/绿灯)</option>
          <option value="constant">常驻 (🔵 蓝灯)</option>
          <option value="selective">条件 (🟢 绿灯)</option>
        </select>
      </div>
    </div>

    <div style="display: flex; gap: 20px; justify-content: center;">
      <button class="icon-btn pill tiny" title="新建条目" @click="createNewEntry">➕ 新建条目</button>
      <button class="icon-btn pill tiny" title="批量管理条目" @click="toggleEntryBatchMode" :class="{ active: isEntryBatchMode }">📑 批量管理</button>
    </div>
    
    <div v-if="isLoadingWb === wbName" class="empty-state" style="padding: 10px">加载中...</div>
    <div v-else-if="!worldbookEntriesCache[wbName] || worldbookEntriesCache[wbName].length === 0" class="empty-state" style="padding: 10px">
      此世界书没有包含有效条目。
    </div>
    <div v-else class="wb-entries-container">
      <WorldbookEntryItem 
        v-for="entry in visibleEntries" 
        :key="entry.uid" 
        :entry="entry"
        :wbName="wbName"
        :isBatchMode="isEntryBatchMode"
        v-model:selectedEntries="selectedEntries"
      />
      
      <!-- 渐进式加载 -->
      <div v-if="hasMoreEntries" class="load-more-container" style="text-align: center; padding: 10px 0">
        <button
          class="btn-primary"
          style="padding: 4px 12px; font-size: 0.9em; border-radius: 4px; background: rgba(0, 123, 255, 0.2); cursor: pointer;"
          @click="loadMoreEntries"
        >
          往下加载更多... (当前显示 {{ visibleEntries.length }} / {{ processedEntries.length }})
        </button>
      </div>

      <div v-if="processedEntries.length === 0" class="empty-state" style="padding: 5px">
        没有找到匹配的条目。
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useArkConfig } from '../../../core/config_store';
import {
  isLoadingWb,
  UIWorldbookEntry,
  worldbookEntriesCache,
} from '../shared_ui_state';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryItem from './WorldbookEntryItem.vue';

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
  entries.forEach(e => {
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
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';
@import './worldbook_shared.scss';
</style>
