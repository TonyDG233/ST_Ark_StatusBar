<template>
  <div class="relative w-full h-full slim-scroll-container overflow-y-auto flex flex-col box-border">
    <!-- Inner content wrapper with padding -->
    <div class="p-2 flex flex-col gap-2 min-h-max box-border">
      <!-- Header Area (Now scrollable) -->
      <div
        class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all"
      >
        <!-- SYS_MODULE Label -->
        <div
          class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider"
        >
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // WBOOK_MGR
        </div>

        <!-- Title & Description -->
        <div class="flex flex-col min-w-0 w-full">
          <h1
            class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase"
          >
            世界书管理面板
          </h1>
          <p
            class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all"
          >
            管理当前角色、全局挂载的世界书数据源，提供检索、状态切换及批量配置功能。
          </p>
        </div>

        <!-- Global Actions -->
        <div class="flex flex-wrap justify-between items-center gap-2 mt-1 w-full">
          <div class="flex flex-wrap items-center gap-2">
            <button
              class="px-2 py-1 bg-surface-container-highest border border-outline-variant hover:border-primary text-xs font-bold text-primary-text flex items-center gap-1 transition-colors outline-none cursor-pointer font-display"
            >
              <span class="material-symbols-outlined text-sm">create_new_folder</span>
              新建书本
            </button>
            <button
              class="px-2 py-1 border text-xs font-bold flex items-center gap-1 transition-colors outline-none cursor-pointer font-display"
              :class="
                isGlobalBatchMode
                  ? 'bg-primary-container border-primary-container text-on-primary'
                  : 'bg-surface-container-highest border-outline-variant text-secondary hover:border-secondary'
              "
              @click="isGlobalBatchMode = !isGlobalBatchMode"
            >
              <span class="material-symbols-outlined text-sm">library_add_check</span>
              全局批量
            </button>
          </div>
        </div>
      </div>

      <!-- Global Worldbook Search (Restored) -->
      <div
        class="flex items-center bg-surface border border-outline-variant px-2 py-1.5 focus-within:border-primary transition-colors mt-1 w-full min-w-0 box-border"
      >
        <span class="material-symbols-outlined text-on-surface-variant text-[14px] flex-shrink-0 mr-2">search</span>
        <input
          class="bg-transparent border-none text-on-surface font-mono focus:outline-none p-0 w-full placeholder-on-surface-variant/50 text-xs min-w-0"
          placeholder="搜索世界书..."
          type="text"
        />
      </div>

      <!-- Global Batch Toolbar (Slides down when active) -->
      <div
        v-if="isGlobalBatchMode"
        class="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-outline-variant/50 w-full"
      >
        <label
          class="flex items-center gap-1 cursor-pointer font-display text-[10px] text-on-surface hover:text-primary-text transition-colors mr-2 flex-shrink-0"
        >
          <input type="checkbox" class="accent-primary" /> 全选
        </label>

        <div class="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <button
            class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none"
          >
            <span class="material-symbols-outlined text-[12px] text-primary-text">push_pin</span> 置顶
          </button>
          <button
            class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none"
          >
            <span class="material-symbols-outlined text-[12px] text-on-surface-variant">push_pin</span> 消顶
          </button>
          <button
            class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none"
          >
            <span class="material-symbols-outlined text-[12px]">link</span> 挂载
          </button>
          <button
            class="px-1.5 py-0.5 border border-outline-variant bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none"
          >
            <span class="material-symbols-outlined text-[12px]">link_off</span> 卸载
          </button>
          <button
            class="px-1.5 py-0.5 border border-error/50 bg-error-container/10 hover:bg-error-container/30 text-error text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none"
          >
            <span class="material-symbols-outlined text-[12px]">delete</span> 删除
          </button>
        </div>
      </div>
    </div>

    <!-- Accordion Lists Container (Now part of the main scroll flow) -->
    <div class="flex flex-col px-2 pb-2 w-full box-border gap-2">
      <LoreWorldbookItemDesign
        v-for="wb in mockWorldbooks"
        :key="wb.id"
        :worldbook="wb"
        :globalBatchMode="isGlobalBatchMode"
      />

      <!-- Bottom Spacer to avoid SubNav overlap -->
      <div class="h-14 flex-shrink-0 w-full pointer-events-none"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { LoreEntryData } from '../../../ARK_STATUSBAR/components/worldbook/LoreDataCard.vue';
import LoreWorldbookItemDesign from './LoreWorldbookItem_Design.vue';

const isGlobalBatchMode = ref(false);

const mockEntriesRhodes: LoreEntryData[] = [
  {
    uid: 'RHO-001',
    name: '阿米娅 (Amiya)',
    keys: ['魔王', '黑冠', '文明的存续'],
    type: 'selective',
    enabled: true,
    isPinned: true,
  },
  {
    uid: 'RHO-002',
    name: "凯尔希医生详细行动记录 (Kal'tsit Operational History & Medical Logs)",
    keys: ['凯尔希', 'Mon3tr'],
    type: 'constant',
    enabled: false,
    isPinned: false,
  },
  {
    uid: 'RHO-003',
    name: '博士 (Doctor)',
    keys: ['战术大脑', '巴别塔的恶灵'],
    type: 'selective',
    enabled: true,
    isPinned: true,
  },
];

const mockEntriesReunion: LoreEntryData[] = [
  {
    uid: 'REU-001',
    name: '塔露拉 (Talulah)',
    keys: ['不死的黑蛇', '科西切'],
    type: 'selective',
    enabled: true,
    isPinned: false,
  },
];

const mockWorldbooks: any[] = [
  {
    id: 'rhodes',
    title: '罗德岛核心机密',
    bindType: 'char',
    isPinned: true,
    entries: mockEntriesRhodes,
  },
  {
    id: 'reunion',
    title: '整合运动档案',
    bindType: 'unmounted',
    isPinned: false,
    entries: mockEntriesReunion,
  },
];
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
