<template>
  <div class="tab-panel flex-col">
    <div class="filters">
      <input type="text" v-model="filterText" placeholder="搜索世界书..." class="search-input" />
      <div style="display: flex; gap: 20px; justify-content: center">
        <button class="icon-btn pill tiny" title="新建世界书" @click="actions.createNewWorldbook">➕ 新建世界书</button>
        <button
          class="icon-btn pill tiny"
          title="批量管理"
          @click="toggleGlobalBatchMode"
          :class="{ active: isGlobalBatchMode }"
        >
          📑 批量管理
        </button>
      </div>
    </div>

    <div v-if="isGlobalBatchMode" class="batch-toolbar compact" style="margin-bottom: 10px">
      <label style="cursor: pointer; display: flex; align-items: center; gap: 4px">
        <input type="checkbox" :checked="isAllWorldbooksSelected" @change="toggleSelectAllWorldbooks" /> 全选
      </label>
      <div style="display: flex; gap: 6px; flex-wrap: wrap">
        <button class="icon-btn pill tiny" @click="actions.batchPinWorldbooks(selectedWorldbooks, true)">📌置顶</button>
        <button class="icon-btn pill tiny" @click="actions.batchPinWorldbooks(selectedWorldbooks, false)">
          📍消顶
        </button>
        <button class="icon-btn pill tiny" @click="actions.batchMountWorldbooks(selectedWorldbooks, true)">
          🔗挂载
        </button>
        <button class="icon-btn pill tiny" @click="actions.batchMountWorldbooks(selectedWorldbooks, false)">
          ⛓️卸载
        </button>
        <button class="icon-btn pill tiny" style="color: #ff6b6b; border-color: #ff6b6b55" @click="handleBatchDelete">
          🗑️删除
        </button>
      </div>
    </div>

    <div class="all-wbs-list">
      <WorldbookItem
        v-for="wb in filteredWorldbooks"
        :key="wb.name"
        :wb="wb"
        :isGlobalBatchMode="isGlobalBatchMode"
        v-model:selectedWorldbooks="selectedWorldbooks"
      />
      <div v-if="filteredWorldbooks.length === 0" class="empty-state">没有找到匹配的世界书。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useArkConfig } from '../../../store/config_store';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookItem from './WorldbookItem.vue';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../../../store/ui_state_store';
// 1. 实例化 Store
const uiStore = useUIStateStore();
// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { 
  allAvailableWorldbooks, 
  charBoundWorldbooks, 
  globalMountedWorldbooks
} = storeToRefs(uiStore);

const currentConfig = useArkConfig();
const actions = useWorldbookActions();

// --- Local UI State for Worldbook Tab ---
const filterText = ref('');
const isGlobalBatchMode = ref(false);
const selectedWorldbooks = ref<string[]>([]);

const toggleGlobalBatchMode = () => {
  isGlobalBatchMode.value = !isGlobalBatchMode.value;
  if (!isGlobalBatchMode.value) selectedWorldbooks.value = [];
};

/**
 * 构建带有分类和排序状态的世界书列表对象
 */
const filteredWorldbooks = computed(() => {
  let result = allAvailableWorldbooks.value.map(name => {
    let type = 'unmounted';
    if (charBoundWorldbooks.value.includes(name)) type = 'char';
    else if (globalMountedWorldbooks.value.includes(name)) type = 'global';

    return {
      name,
      type,
      isPinned: currentConfig.value?.pinnedWorldbooks?.includes(name) || false,
    };
  });

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(wb => wb.name.toLowerCase().includes(q));
  }

  result.sort((a, b) => {
    const getScore = (wb: { type: string; isPinned: boolean }) => {
      if (wb.type === 'char') return 5;
      if (wb.type === 'global' && wb.isPinned) return 4;
      if (wb.type === 'global') return 3;
      if (wb.type === 'unmounted' && wb.isPinned) return 2;
      return 1;
    };
    return getScore(b) - getScore(a);
  });

  return result;
});

const isAllWorldbooksSelected = computed(() => {
  const wbs = filteredWorldbooks.value;
  return wbs.length > 0 && selectedWorldbooks.value.length === wbs.length;
});

const toggleSelectAllWorldbooks = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    selectedWorldbooks.value = filteredWorldbooks.value.map(w => w.name);
  } else {
    selectedWorldbooks.value = [];
  }
};

const handleBatchDelete = async () => {
  const deleted = await actions.batchDeleteWorldbooks(selectedWorldbooks.value);
  if (deleted) selectedWorldbooks.value = [];
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';
@import './worldbook_shared.scss';
</style>
