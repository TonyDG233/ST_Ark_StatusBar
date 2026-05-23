<template>
  <div class="flex flex-col bg-surface-container-lowest border-x border-b border-outline-variant w-full box-border">
    
    <!-- Header Tools (Search & Local Batch Toggle) -->
    <div class="flex flex-wrap items-center justify-between gap-2 p-2 border-b border-outline-variant bg-surface-container-low flex-shrink-0">
      <!-- Search Bar -->
      <div class="flex-1 flex items-center bg-surface border border-outline px-2 py-1 min-w-[100px] focus-within:border-primary transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant text-[calc(14em/14)] flex-shrink-0 mr-1">search</span>
        <input 
          class="bg-transparent border-none text-on-surface font-mono focus:outline-none p-0 w-full placeholder-on-surface-variant/50 text-xs min-w-0" 
          placeholder="搜索此书内的条目..." 
          type="text" 
        />
      </div>
      
      <!-- New Entry & Batch Toggle -->
      <div class="flex gap-1 flex-shrink-0">
        <button class="px-2 py-1 bg-surface border border-outline hover:border-primary text-primary-text transition-colors flex items-center justify-center outline-none cursor-pointer" title="新建条目">
          <span class="material-symbols-outlined text-[calc(14em/14)]">add</span>
        </button>
        <button 
          class="px-2 py-1 border transition-colors flex items-center gap-1 font-display text-[calc(10em/14)] font-bold outline-none cursor-pointer"
          :class="isBatchMode ? 'bg-primary-container text-on-primary border-primary-container' : 'bg-surface text-on-surface-variant border-outline hover:text-on-surface hover:border-on-surface-variant'"
          @click="isBatchMode = !isBatchMode"
        >
          <span class="material-symbols-outlined text-[calc(14em/14)]">checklist</span>
          批量
        </button>
      </div>
    </div>

    <!-- Filters Row -->
    <div class="flex flex-wrap gap-2 w-full p-2 border-b border-outline-variant bg-surface-container-low flex-shrink-0">
      <select class="flex-1 min-w-[100px] bg-surface border border-outline-variant px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono outline-none cursor-pointer">
        <option>全部类别</option>
      </select>
      <select class="flex-1 min-w-[100px] bg-surface border border-outline-variant px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary font-mono outline-none cursor-pointer">
        <option>全部类型 (常驻/条件)</option>
      </select>
    </div>
    
    <!-- Local Batch Management Toolbar (Below filters, statically rendered when active to prevent overlap) -->
    <div v-if="isBatchMode" class="bg-surface-container-highest border-b border-outline-variant py-1.5 px-2 flex flex-col sm:flex-row flex-wrap sm:items-center justify-between gap-2 shadow-sm">
      <div class="flex items-center gap-2">
        <label class="flex items-center gap-1 cursor-pointer font-display text-[calc(10em/14)] text-on-surface hover:text-primary-text transition-colors">
          <input type="checkbox" class="accent-primary" /> 全选
        </label>
      </div>
      <!-- Pill Buttons horizontally wrapping -->
      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Pin/Unpin -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)] text-primary-text">push_pin</span> 置顶
        </button>
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)] text-on-surface-variant">push_pin</span> 消顶
        </button>
        <!-- Blue/Green Toggle -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)] text-secondary">change_circle</span> 类型切换
        </button>
        <!-- Enable/Disable -->
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-secondary text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)]">check_circle</span> 开启
        </button>
        <button class="px-1.5 py-0.5 border border-outline bg-surface hover:bg-surface-variant text-on-surface-variant text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)]">block</span> 关闭
        </button>
        <!-- Delete -->
        <button class="px-1.5 py-0.5 border border-error/50 bg-error-container/10 hover:bg-error-container/30 text-error text-[calc(10em/14)] flex items-center gap-0.5 transition-colors outline-none cursor-pointer">
          <span class="material-symbols-outlined text-[calc(12em/14)]">delete</span> 删除
        </button>
      </div>
    </div>
    
    <!-- Data Cards List -->
    <div class="flex flex-col min-w-0">
      <template v-for="entry in entries" :key="entry.uid">
        <LoreDataCard 
          :entry="entry"
          :batchMode="isBatchMode"
          :selected="false"
          @edit="editingUid = editingUid === entry.uid ? null : entry.uid"
        />
        <!-- Inline Editor -->
        <LoreEntryEditor 
          v-if="editingUid === entry.uid" 
          :entry="entry" 
          @cancel="editingUid = null"
          @save="editingUid = null"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import LoreDataCard, { LoreEntryData } from './LoreDataCard.vue';
import LoreEntryEditor from './LoreEntryEditor.vue';

defineProps<{
  entries: LoreEntryData[];
}>();

const editingUid = ref<string | number | null>(null);
const isBatchMode = ref(false);
</script>

<style scoped>
</style>
