<template>
  <div class="border p-3 flex flex-col relative bg-surface-container-low transition-colors box-border"
       :class="[
         isExpanded ? 'border-primary shadow-sm' : 'border-outline-variant hover:bg-surface-variant cursor-pointer',
         type === 'danger' ? 'border-error/50 bg-error-container/10' : ''
       ]"
       @click="!isExpanded && (isExpanded = true)">
    
    <!-- Top Area (Always visible) -->
    <div class="flex flex-col relative group">
      <div class="text-[10px] font-display font-bold tracking-wider uppercase mb-1"
           :class="type === 'danger' ? 'text-error' : (type === 'primary' ? 'text-primary' : 'text-secondary')">
        {{ label }}
      </div>
      <div class="text-sm font-display font-bold text-on-surface tracking-wide"
           :class="type === 'danger' ? 'text-error' : ''">
        {{ title }}
      </div>
      <div class="text-[11px] mt-1 leading-tight break-words min-w-0 pr-6"
           :class="type === 'danger' ? 'text-error/80' : 'text-on-surface-variant'">
        {{ description }}
      </div>
      
      <span class="material-symbols-outlined absolute top-0 right-0 text-lg opacity-80 group-hover:opacity-100 transition-opacity"
            :class="type === 'danger' ? 'text-error' : (type === 'primary' ? 'text-primary' : 'text-secondary')">
        {{ icon }}
      </span>

      <!-- Close icon when expanded -->
      <button v-if="isExpanded" 
              @click.stop="isExpanded = false"
              class="absolute top-0 right-8 text-on-surface-variant hover:text-on-surface outline-none">
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>

    <!-- Expanded Details Area -->
    <div v-if="isExpanded" class="mt-3 pt-3 border-t border-outline-variant/50 flex flex-col gap-2 min-w-0">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

withDefaults(defineProps<{
  label: string;
  title: string;
  description: string;
  icon: string;
  type?: 'default' | 'primary' | 'danger';
}>(), {
  type: 'default'
});

const isExpanded = ref(false);
</script>

<style scoped>
</style>
