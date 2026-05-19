<template>
  <div class="relative w-full h-full slim-scroll-container overflow-y-auto flex flex-col box-border">
    <!-- Inner content wrapper with padding -->
    <div class="p-2 flex flex-col gap-2 min-h-max box-border">
      
      <!-- Header Area (Now scrollable) -->
      <div class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all">
        <!-- SYS_MODULE Label -->
        <div class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // WBOOK_MGR
        </div>
        
        <!-- Title & Description -->
        <div class="flex flex-col min-w-0 w-full">
          <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase">
            世界书管理面板
          </h1>
          <p class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all">
            管理当前角色、全局挂载的世界书数据源，提供检索、状态切换及批量配置功能。
          </p>
        </div>
        
        <!-- Global Actions -->
        <div class="flex flex-wrap justify-between items-center gap-2 mt-1 w-full">
          <div class="flex flex-wrap items-center gap-2">
            <button class="px-2 py-1 bg-surface-container-highest border border-outline-variant hover:border-primary text-xs font-bold text-primary-text flex items-center gap-1 transition-colors outline-none cursor-pointer font-display" @click="actions.createNewWorldbook">
              <span class="material-symbols-outlined text-sm">create_new_folder</span>
              新建书本
            </button>
            <button
              class="px-2 py-1 border text-xs font-bold flex items-center gap-1 transition-colors outline-none cursor-pointer font-display"
              :class="isGlobalBatchMode ? 'bg-primary-container border-primary-container text-on-primary' : 'bg-surface-container-highest border-outline-variant text-secondary hover:border-secondary'"
              @click="toggleGlobalBatchMode"
            >
              <span class="material-symbols-outlined text-sm">library_add_check</span>
              全局批量
            </button>
          </div>
        </div>
      </div>

      <!-- Global Worldbook Search -->
      <div class="flex items-center bg-surface border border-outline-variant px-2 py-1.5 focus-within:border-primary transition-colors mt-1 w-full min-w-0 box-border">
        <span class="material-symbols-outlined text-on-surface-variant text-[14px] flex-shrink-0 mr-2">search</span>
        <input
          class="bg-transparent border-none text-on-surface font-mono focus:outline-none p-0 w-full placeholder-on-surface-variant/50 text-xs min-w-0"
          placeholder="搜索世界书..."
          type="text"
          v-model="filterText"
        />
      </div>

      <!-- Global Batch Toolbar -->
      <div v-if="isGlobalBatchMode" class="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-outline-variant/50 w-full">
        <label class="flex items-center gap-1 cursor-pointer font-display text-[10px] text-on-surface hover:text-primary-text transition-colors mr-2 flex-shrink-0">
          <input type="checkbox" class="accent-primary" :checked="isAllWorldbooksSelected" @change="toggleSelectAllWorldbooks" /> 全选
        </label>
        
        <div class="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <button class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none" @click="actions.batchPinWorldbooks(selectedWorldbooks, true)">
            <span class="material-symbols-outlined text-[12px] text-primary-text">push_pin</span> 置顶
          </button>
          <button class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none" @click="actions.batchPinWorldbooks(selectedWorldbooks, false)">
            <span class="material-symbols-outlined text-[12px] text-on-surface-variant">push_pin</span> 消顶
          </button>
          <button class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none" @click="actions.batchMountWorldbooks(selectedWorldbooks, true)">
            <span class="material-symbols-outlined text-[12px]">link</span> 挂载
          </button>
          <button class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none" @click="actions.batchMountWorldbooks(selectedWorldbooks, false)">
            <span class="material-symbols-outlined text-[12px]">link_off</span> 卸载
          </button>
          <button class="px-1.5 py-0.5 border border-error/50 bg-error-container/10 hover:bg-error-container/30 text-error text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none" @click="handleBatchDelete">
            <span class="material-symbols-outlined text-[12px]">delete</span> 删除
          </button>
        </div>
      </div>
    </div>

    <!-- Accordion Lists Container -->
    <div class="flex flex-col px-2 pb-2 w-full box-border gap-2">
      <WorldbookItem
        v-for="wb in filteredWorldbooks"
        :key="wb.name"
        :wb="wb"
        :isGlobalBatchMode="isGlobalBatchMode"
        v-model:selectedWorldbooks="selectedWorldbooks"
      />

      <div v-if="filteredWorldbooks.length === 0" class="text-on-surface-variant text-xs text-center py-4">没有找到匹配的世界书。</div>

      <!-- Bottom Spacer to avoid SubNav overlap -->
      <div class="h-14 flex-shrink-0 w-full pointer-events-none"></div>
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
// 2. 解构状态变量
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
/* 响应式高度压缩：当外部注入了 is-compact-height class 时，触发内部元素的视觉收缩 */
:global(.is-compact-height) .tab-desc {
  display: none;
}
:global(.is-compact-height) .tab-header {
  padding-bottom: 2px;
}
</style>
