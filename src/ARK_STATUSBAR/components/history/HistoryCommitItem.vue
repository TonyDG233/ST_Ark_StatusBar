<template>
  <div class="relative flex flex-col mb-6">
    <!-- Node dot intersecting the dashed line -->
    <div class="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full border-2 bg-background box-border"
         :class="isSnapshot ? 'border-secondary' : 'border-primary'"></div>
    
    <div class="flex flex-col border border-outline-variant bg-surface-container-lowest p-3 group transition-colors min-w-0"
         :class="[isSnapshot ? 'hover:border-secondary/50' : 'hover:border-primary/50', isBatchMode ? 'cursor-pointer hover:bg-surface-variant' : '']"
         @click="isBatchMode && emit('toggleSelection')">
      
      <!-- Header -->
      <div class="flex justify-between items-start gap-2 mb-1">
        <!-- Checkbox for batch mode -->
        <div v-if="isBatchMode" class="shrink-0 pt-0.5">
          <input type="checkbox" :checked="isSelected" class="accent-primary" @click.stop="emit('toggleSelection')" />
        </div>

        <div class="flex flex-col min-w-0 flex-1">
          <div class="text-[10px] font-mono text-on-surface-variant opacity-80 flex items-center gap-2 flex-wrap">
            <span class="font-bold" :class="isSnapshot ? 'text-secondary' : 'text-primary-text'">#{{ commitId }}</span>
            <span>{{ time }}</span>
          </div>
          <!-- Title -->
          <div class="text-sm font-display font-bold text-on-surface tracking-wide mt-1 break-words whitespace-normal leading-tight">
            {{ title }}
          </div>
        </div>
        
        <!-- Pin icon -->
        <button v-if="!isSnapshot && !isBatchMode"
                class="shrink-0 outline-none transition-colors"
                :class="isPinned ? 'text-secondary' : 'text-on-surface-variant hover:text-secondary'"
                title="保护记录"
                @click.stop="emit('togglePin')">
          <span class="material-symbols-outlined text-[16px]">keep</span>
        </button>
      </div>
      
      <!-- Source -->
      <div v-if="source" class="text-[10px] text-primary-text/80 mb-2 truncate max-w-full">
        📁 来源: {{ source }}
        <span v-if="isHeavy" class="text-[#ffc107] ml-1">(重度修改)</span>
      </div>
      
      <div v-if="description" class="text-[11px] text-on-surface-variant leading-relaxed mb-3 break-words min-w-0">
        {{ description }}
      </div>

      <!-- Changes List Details -->
      <div v-if="changes && changes.length" class="flex flex-col gap-1.5 bg-surface-variant/20 p-2 border border-outline-variant/30 mb-3 rounded-sm min-w-0">
        <div v-for="(change, idx) in changes" :key="idx" class="text-[10px] text-on-surface flex flex-wrap gap-x-1 gap-y-0.5 items-center break-all">
          <span class="text-on-surface-variant shrink-0">{{ change.label }}</span>
          <span class="text-primary-text shrink-0" v-if="change.path">[{{ change.path }}]</span>
          <span v-if="change.path">:</span>
          <span class="text-error line-through shrink-0">{{ change.from }}</span>
          <span class="text-on-surface-variant shrink-0">-></span>
          <span class="text-[#28a745] shrink-0">{{ change.to }}</span>
        </div>
      </div>
      
      <!-- Action Buttons -->
      <div v-if="!isBatchMode" class="flex gap-4 pt-2 border-t border-outline-variant/50 justify-end flex-wrap">
        <ActionToggle type="restore" @click.stop="emit('restore')" />
        <ActionToggle type="delete" @click.stop="emit('delete')" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToggle from '../ActionToggle.vue';

const props = withDefaults(defineProps<{
  commitId: string;
  time: string;
  title: string;
  source?: string;
  description?: string;
  isHeavy?: boolean;
  isPinned?: boolean;
  isSnapshot?: boolean;
  changes?: Array<{ label: string, path?: string, from: string, to: string }>;
  isBatchMode?: boolean;
  isSelected?: boolean;
}>(), {
  isPinned: false,
  isSnapshot: false,
  isHeavy: false,
  isBatchMode: false,
  isSelected: false
});

const emit = defineEmits<{
  (e: 'togglePin'): void;
  (e: 'restore'): void;
  (e: 'delete'): void;
  (e: 'toggleSelection'): void;
}>();
</script>

<style scoped>
</style>
