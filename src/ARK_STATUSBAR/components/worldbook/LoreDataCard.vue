<template>
  <div class="border border-outline-variant bg-surface flex flex-col hover:border-outline transition-colors group box-border w-full min-w-0">
    
    <!-- Top Row: Checkbox & Texts -->
    <div class="flex flex-col min-w-0 w-full p-2 gap-1.5">
      <div class="flex flex-wrap items-center gap-2 min-w-0 w-full">
        <!-- Select Checkbox (only in batch mode) -->
        <div v-if="batchMode" class="cursor-pointer flex-shrink-0" @click="$emit('toggle-select')">
          <span class="material-symbols-outlined text-on-surface-variant text-[16px]">
            {{ selected ? 'check_box' : 'check_box_outline_blank' }}
          </span>
        </div>
        
        <!-- Type Indicator (Square Light, Clickable) -->
        <button class="w-2.5 h-2.5 flex-shrink-0 transition-all duration-200 cursor-pointer outline-none hover:opacity-80 border-none p-0 m-0 rounded-none"
             :class="entry.type === 'constant' ? 'bg-[#4ed5ff] shadow-[0_0_6px_#4ed5ff88]' : 'bg-[#afd439] shadow-[0_0_6px_#afd43988]'"
             @click.stop="$emit('toggle-type')"
             :title="entry.type === 'constant' ? '当前：蓝灯(常驻)，点击切换为绿灯' : '当前：绿灯(条件)，点击切换为蓝灯'">
        </button>
        
        <!-- Title -->
        <h3 class="font-display text-[14px] font-bold text-on-surface min-w-0 break-words whitespace-normal leading-tight flex-1">
          {{ entry.name }}
        </h3>
      </div>
      
      <!-- Keys (触发词) with wrapping -->
      <div class="font-mono text-on-surface-variant text-[10px] min-w-0 break-words whitespace-normal leading-tight w-full" v-if="entry.keys && entry.keys.length">
        <span class="text-primary-text/70 mr-1 font-bold">触发词:</span>{{ entry.keys.join(', ') }}
      </div>
      <div class="font-mono text-on-surface-variant text-[10px] min-w-0 break-words whitespace-normal w-full opacity-50" v-else>
        <span class="mr-1">触发词:</span>[无]
      </div>
    </div>
    
    <!-- Bottom Row: Actions -->
    <div class="flex flex-wrap items-center justify-end gap-2 w-full flex-shrink-0 border-t border-outline-variant/30 px-2 py-1.5 bg-surface-container-lowest/50">
      
      <!-- Right: Actions Group -->
      <div class="flex flex-wrap items-center justify-end gap-2 min-w-0">
        
        <!-- Type Switch (Square color block only, no text) -->
        <button 
          class="flex items-center justify-center border px-1.5 py-1 rounded-sm transition-colors outline-none cursor-pointer group/type mr-1"
          :class="entry.type === 'constant' ? 'border-[#4ed5ff]/40 hover:bg-[#4ed5ff]/10' : 'border-[#afd439]/40 hover:bg-[#afd439]/10'"
          @click.stop="$emit('toggle-type')"
          :title="entry.type === 'constant' ? '当前：蓝灯(常驻)，点击切换为绿灯' : '当前：绿灯(条件)，点击切换为蓝灯'"
        >
          <div class="w-2.5 h-2.5 flex-shrink-0 transition-all duration-200 group-hover/type:shadow-[0_0_6px_currentColor]"
               :class="entry.type === 'constant' ? 'bg-[#4ed5ff]' : 'bg-[#afd439]'">
          </div>
        </button>

        <!-- Original Styled Slide Switch -->
        <div class="flex items-center gap-1 mr-1 cursor-pointer group/toggle flex-shrink-0" @click.stop="$emit('toggle-state')">
          <span class="font-display font-bold text-[9px] uppercase tracking-widest transition-colors mr-1"
                :class="entry.enabled ? 'text-secondary' : 'text-on-surface-variant'">
            {{ entry.enabled ? 'ON' : 'OFF' }}
          </span>
          <label class="relative inline-flex items-center cursor-pointer pointer-events-none flex-shrink-0">
            <input type="checkbox" class="sr-only peer" :checked="entry.enabled">
            <div class="w-7 h-3.5 bg-surface border border-outline-variant peer-focus:outline-none peer-checked:border-secondary peer-checked:bg-secondary/20 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-outline-variant after:border-outline-variant after:border after:h-2.5 after:w-2.5 after:transition-all peer-checked:after:translate-x-[14px] peer-checked:after:bg-secondary peer-checked:after:border-secondary"></div>
          </label>
        </div>
        
        <div class="h-4 w-px bg-outline-variant mx-0.5 flex-shrink-0"></div>
        
        <!-- Action Buttons -->
        <button class="text-on-surface-variant hover:text-primary-text transition-colors flex-shrink-0 outline-none flex items-center justify-center w-6 h-6 rounded hover:bg-surface-variant cursor-pointer" title="编辑" @click.stop="$emit('edit')">
          <span class="material-symbols-outlined text-[15px]">edit</span>
        </button>
        <button class="transition-colors flex-shrink-0 outline-none flex items-center justify-center w-6 h-6 rounded hover:bg-surface-variant cursor-pointer" 
                :class="entry.isPinned ? 'text-primary-text' : 'text-on-surface-variant hover:text-primary-text'"
                :title="entry.isPinned ? '取消置顶' : '置顶'" 
                @click.stop="$emit('toggle-pin')">
          <span class="material-symbols-outlined text-[15px]" :style="entry.isPinned ? `font-variation-settings: 'FILL' 1;` : ''">push_pin</span>
        </button>
        <button class="text-on-surface-variant hover:text-error transition-colors flex-shrink-0 outline-none flex items-center justify-center w-6 h-6 rounded hover:bg-error-container/20 cursor-pointer" title="删除" @click.stop="$emit('delete')">
          <span class="material-symbols-outlined text-[15px]">delete</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface LoreEntryData {
  uid: string | number;
  name: string;
  keys: string[];
  type: 'constant' | 'selective'; // constant=蓝灯, selective=绿灯
  enabled: boolean;
  isPinned: boolean;
  [key: string]: any;
}

defineProps<{
  entry: LoreEntryData;
  selected?: boolean;
  batchMode?: boolean;
}>();

defineEmits<{
  (e: 'toggle-select'): void;
  (e: 'toggle-state'): void;
  (e: 'toggle-type'): void;
  (e: 'toggle-pin'): void;
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();
</script>

<style scoped>
</style>
