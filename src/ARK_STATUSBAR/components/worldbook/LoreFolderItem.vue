<template>
  <div class="p-2 flex flex-wrap justify-between items-center bg-surface hover:bg-surface-container-highest transition-colors cursor-pointer border-b border-outline-variant group w-full box-border gap-2 relative"
       @click="$emit('toggle')">
    
    <!-- 主题色高亮顶条 -->
    <div class="absolute top-0 left-0 w-full h-[2px] transition-colors" :class="bindType === 'char' ? 'bg-primary' : bindType === 'global' ? 'bg-secondary' : 'bg-outline-variant/50'"></div>

    <!-- Left: Folder Info (Wrappable) -->
    <div class="flex flex-wrap items-center gap-2 min-w-[120px] flex-1">
      <!-- Select Checkbox (only in global batch mode) -->
      <div v-if="globalBatchMode" class="cursor-pointer flex-shrink-0" @click.stop="$emit('toggle-select')">
        <span class="material-symbols-outlined text-on-surface-variant text-[calc(18em/14)]">
          {{ selected ? 'check_box' : 'check_box_outline_blank' }}
        </span>
      </div>

      <!-- Bind Type Badge -->
      <span class="font-display text-[calc(10em/14)] px-1.5 py-0.5 rounded-sm flex-shrink-0 font-bold whitespace-nowrap"
            :class="bindType === 'char' ? 'bg-primary text-on-primary' : bindType === 'global' ? 'bg-secondary text-on-secondary' : 'bg-surface-variant text-on-surface-variant'">
        {{ bindType === 'char' ? '角色绑定' : bindType === 'global' ? '已挂载' : '未挂载' }}
      </span>

      <!-- Folder Title -->
      <h2 class="font-display text-[calc(13em/14)] font-bold transition-colors break-words whitespace-normal leading-tight"
          :class="expanded ? 'text-on-surface' : 'text-on-surface-variant group-hover:text-on-surface'">
        {{ title }}
      </h2>
      
      <!-- Count Badge -->
      <span class="bg-surface-container-highest border border-outline-variant text-on-surface-variant font-mono text-[calc(9em/14)] px-1.5 py-0.5 flex-shrink-0 whitespace-nowrap">
        {{ count !== undefined ? `${count} 条` : '...' }}
      </span>
    </div>

    <!-- Right: Actions & Expand -->
    <div class="flex items-center gap-2 flex-shrink-0">
      <!-- Pin Button -->
      <button class="text-on-surface-variant hover:text-primary-text transition-colors flex items-center justify-center outline-none w-6 h-6 rounded hover:bg-surface-variant cursor-pointer" title="置顶" @click.stop="$emit('toggle-pin')">
        <span class="material-symbols-outlined text-[calc(16em/14)]" :class="{ 'text-primary-text': isPinned }" :style="isPinned ? `font-variation-settings: 'FILL' 1;` : ''">push_pin</span>
      </button>
      
      <!-- Mount/Unmount Button (Not applicable for char bound) -->
      <button v-if="bindType !== 'char'" class="text-on-surface-variant transition-colors flex items-center justify-center outline-none w-6 h-6 rounded hover:bg-surface-variant cursor-pointer" 
              :class="bindType === 'global' ? 'hover:text-error' : 'hover:text-secondary'"
              :title="bindType === 'global' ? '卸载' : '挂载'" 
              @click.stop="$emit('toggle-mount')">
        <span class="material-symbols-outlined text-[calc(16em/14)]">{{ bindType === 'global' ? 'link_off' : 'link' }}</span>
      </button>
      
      <!-- Delete Button -->
      <button class="text-on-surface-variant hover:text-error transition-colors flex items-center justify-center outline-none w-6 h-6 rounded hover:bg-error-container/20 cursor-pointer" title="删除" @click.stop="$emit('delete')">
        <span class="material-symbols-outlined text-[calc(16em/14)]">delete</span>
      </button>

      <!-- Expand Arrow -->
      <span class="material-symbols-outlined text-on-surface-variant transition-transform duration-200 text-[calc(20em/14)] flex-shrink-0 ml-1"
            :class="{ 'rotate-180': expanded }">
        expand_more
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  count?: number;
  expanded: boolean;
  bindType: 'char' | 'global' | 'unmounted';
  isPinned: boolean;
  globalBatchMode?: boolean;
  selected?: boolean;
}>();

defineEmits<{
  (e: 'toggle'): void;
  (e: 'toggle-select'): void;
  (e: 'toggle-pin'): void;
  (e: 'toggle-mount'): void;
  (e: 'delete'): void;
}>();
</script>

<style scoped>
</style>
