<template>
  <div class="relative flex flex-col w-full h-full p-2 gap-2 overflow-hidden box-border bg-background slim-scroll-container">
    <!-- Header Area -->
    <div class="flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent">
      <!-- Title & Global Actions -->
      <div class="flex flex-wrap justify-between items-start min-w-0 w-full gap-2">
        <div class="min-w-[120px] flex-1">
          <h1 class="font-display text-xl font-bold text-on-surface break-words whitespace-normal leading-tight">世界书管理面板</h1>
          <p class="font-mono text-on-surface-variant text-[10px] break-words whitespace-normal mt-0.5">SYS_DIR: /LORE/ENTRIES</p>
        </div>
        
        <div class="flex flex-wrap items-center gap-2 mt-1">
          <button class="px-2 py-1 bg-surface-container-highest border border-outline hover:border-primary text-[10px] font-bold text-primary flex items-center gap-1 transition-colors outline-none cursor-pointer">
            <span class="material-symbols-outlined text-[14px]">create_new_folder</span>
            新建书本
          </button>
          <button 
            class="px-2 py-1 border text-[10px] font-bold flex items-center gap-1 transition-colors outline-none cursor-pointer"
            :class="isGlobalBatchMode ? 'bg-primary-container border-primary-container text-on-primary' : 'bg-surface-container-highest border-outline text-secondary hover:border-secondary'"
            @click="isGlobalBatchMode = !isGlobalBatchMode"
          >
            <span class="material-symbols-outlined text-[14px]">library_add_check</span>
            全局批量
          </button>
        </div>
      </div>

      <!-- Global Worldbook Search (Restored) -->
      <div class="flex items-center bg-surface border border-outline px-2 py-1.5 focus-within:border-primary transition-colors mt-1 w-full min-w-0 box-border">
        <span class="material-symbols-outlined text-on-surface-variant text-[14px] flex-shrink-0 mr-2">search</span>
        <input 
          class="bg-transparent border-none text-on-surface font-mono focus:outline-none p-0 w-full placeholder-on-surface-variant/50 text-xs min-w-0" 
          placeholder="搜索世界书..." 
          type="text" 
        />
      </div>

      <!-- Global Batch Toolbar (Slides down when active) -->
      <div v-if="isGlobalBatchMode" class="flex flex-wrap items-center gap-2 mt-1 pt-2 border-t border-outline-variant/50 w-full">
        <label class="flex items-center gap-1 cursor-pointer font-display text-[10px] text-on-surface hover:text-primary transition-colors mr-2 flex-shrink-0">
          <input type="checkbox" class="accent-primary" /> 全选
        </label>
        
        <div class="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none">
            <span class="material-symbols-outlined text-[12px] text-primary">push_pin</span> 置顶
          </button>
          <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none">
            <span class="material-symbols-outlined text-[12px] text-on-surface-variant">push_pin</span> 消顶
          </button>
          <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none">
            <span class="material-symbols-outlined text-[12px]">link</span> 挂载
          </button>
          <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none">
            <span class="material-symbols-outlined text-[12px]">link_off</span> 卸载
          </button>
          <button class="px-1.5 py-0.5 border border-error/50 bg-error-container/10 hover:bg-error-container/30 text-error text-[10px] flex items-center gap-0.5 transition-colors cursor-pointer outline-none">
            <span class="material-symbols-outlined text-[12px]">delete</span> 删除
          </button>
        </div>
      </div>
    </div>

    <!-- Accordion Lists Container -->
    <!-- 外层留极小边距 p-1 (也就是 4px)，防止内层被疯狂压缩 -->
    <div class="flex-1 min-h-0 overflow-y-auto ark-scrollbar flex flex-col pr-1 w-full box-border">
      <LoreWorldbookItemDesign 
        v-for="wb in mockWorldbooks" 
        :key="wb.id" 
        :worldbook="wb"
        :globalBatchMode="isGlobalBatchMode"
      />

      <!-- Bottom Spacer to avoid SubNav overlap -->
      <div class="h-16 flex-shrink-0 w-full pointer-events-none"></div>
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
    isPinned: true
  },
  {
    uid: 'RHO-002',
    name: '凯尔希医生详细行动记录 (Kal\'tsit Operational History & Medical Logs)',
    keys: ['凯尔希', 'Mon3tr'],
    type: 'constant',
    enabled: false,
    isPinned: false
  },
  {
    uid: 'RHO-003',
    name: '博士 (Doctor)',
    keys: ['战术大脑', '巴别塔的恶灵'],
    type: 'selective',
    enabled: true,
    isPinned: true
  }
];

const mockEntriesReunion: LoreEntryData[] = [
  {
    uid: 'REU-001',
    name: '塔露拉 (Talulah)',
    keys: ['不死的黑蛇', '科西切'],
    type: 'selective',
    enabled: true,
    isPinned: false
  }
];

const mockWorldbooks: any[] = [
  {
    id: 'rhodes',
    title: '罗德岛核心机密',
    bindType: 'char',
    isPinned: true,
    entries: mockEntriesRhodes
  },
  {
    id: 'reunion',
    title: '整合运动档案',
    bindType: 'unmounted',
    isPinned: false,
    entries: mockEntriesReunion
  }
];
</script>

<style scoped>
/* 自定义极细滚动条，覆盖默认 ark-scrollbar 释放极窄屏幕空间 */
.slim-scroll-container :deep(.ark-scrollbar::-webkit-scrollbar) {
  width: 4px;
}
.slim-scroll-container :deep(.ark-scrollbar::-webkit-scrollbar-track) {
  background: transparent;
}
.slim-scroll-container :deep(.ark-scrollbar::-webkit-scrollbar-thumb) {
  background: var(--color-outline-variant, #3c494e);
  border-radius: 2px;
}
.slim-scroll-container :deep(.ark-scrollbar::-webkit-scrollbar-thumb:hover) {
  background: var(--color-primary, #a6e6ff);
}
</style>
