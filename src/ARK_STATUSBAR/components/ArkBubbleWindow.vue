<template>
  <div class="ark-bubble-wrapper relative" :class="[ position === 'left' ? 'flex-row' : 'flex-row-reverse' ]" style="display: flex;">
    
    <!-- 气泡本体 -->
    <div 
      class="ark-bubble-window relative flex items-center justify-center h-[60px] bg-surface-container-high/90 backdrop-blur-md border border-outline-variant cursor-grab active:cursor-grabbing select-none transition-colors hover:bg-primary/20"
      :class="[ position === 'left' ? 'rounded-r-3xl border-l-0' : 'rounded-l-3xl border-r-0' ]"
      :style="{ width: width + 'px' }"
      @click="emit('click-bubble')"
    >
      <div class="flex items-center gap-1.5 px-2 overflow-hidden w-full" :class="position === 'left' ? 'justify-end' : 'justify-start'">
        <!-- 书本图标 -->
        <span class="material-symbols-outlined text-primary text-[20px] flex-shrink-0">menu_book</span>
        <!-- 压缩文案：仅在宽度允许时显示 -->
        <span v-if="width > 60 && triggerCount > 0" class="text-[10px] font-code-data text-primary whitespace-nowrap truncate font-bold">
          拦截: {{ triggerCount }}
        </span>
        <!-- 如果宽度窄，用红点/徽章代替文本 -->
        <div v-else-if="triggerCount > 0" class="absolute top-2 bg-primary rounded-full min-w-[14px] h-[14px] px-[3px] flex items-center justify-center border border-surface shadow-sm" :class="position === 'left' ? 'right-1' : 'left-1'">
          <span class="text-[8px] text-on-primary font-bold leading-none translate-y-[0.5px]">{{ triggerCount > 99 ? '99+' : triggerCount }}</span>
        </div>
      </div>
    </div>

    <!-- 战术引出弹窗 (Popover Sub-menu) -->
    <div 
      v-if="showPopover && triggerCount > 0" 
      class="absolute top-0 w-[200px] bg-surface border-y border-outline-variant shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col p-1.5 gap-1.5 z-50"
      :class="[ 
        position === 'left' ? 'left-[calc(100%+8px)] border-r border-r-primary' : 'right-[calc(100%+8px)] border-l border-l-primary',
        'before:absolute before:top-6 before:w-2 before:h-[1px] before:bg-primary',
        position === 'left' ? 'before:-left-2' : 'before:-right-2'
      ]"
    >
      <div class="flex justify-between items-center border-b border-outline-variant/50 pb-1 px-1">
        <span class="text-[10px] font-display text-primary tracking-widest uppercase">战术拦截面板</span>
        <button class="reset-btn text-on-surface-variant hover:text-on-surface flex items-center justify-center p-0" @click="emit('close-popover')">
          <span class="material-symbols-outlined text-[12px]">close</span>
        </button>
      </div>

      <!-- 最简拦截列表 (集成单次/彻底逻辑) -->
      <ul class="flex flex-col gap-1 max-h-[140px] overflow-y-auto scrollbar-none pl-0 m-0 list-none">
        <li v-for="(entry, idx) in entries" :key="idx" class="flex flex-col gap-1 p-1 bg-surface-container-low rounded-sm">
          <div class="flex justify-between items-center">
            <span class="text-[11px] font-body text-on-surface truncate" :class="{ 'line-through opacity-50': entry.enabled === false && !entry.tempDisabled }">
              {{ entry.name }}
            </span>
          </div>
          <div class="flex justify-end gap-1">
            <!-- 已彻底阻断，仅提供恢复 -->
            <ArkActionToggle
              v-if="entry.enabled === false && !entry.tempDisabled"
              type="enable"
              size="sm"
              @click="emit('toggle-entry', entry, 'enable')"
            />
            <template v-else>
              <!-- 临时阻断恢复 -->
              <ArkActionToggle
                v-if="entry.tempDisabled"
                type="resume"
                size="sm"
                @click="emit('toggle-entry', entry, 'resume')"
              />
              <!-- 单次临时阻断 -->
              <ArkActionToggle
                v-else
                type="temp"
                size="sm"
                @click="emit('toggle-entry', entry, 'temp')"
              />
              <!-- 彻底禁用 -->
              <ArkActionToggle
                type="disable"
                size="sm"
                @click="emit('toggle-entry', entry, 'disable')"
              />
            </template>
          </div>
        </li>
      </ul>

      <!-- 发送/取消 动作区 -->
      <div class="flex gap-1.5 pt-1.5 border-t border-outline-variant/50">
        <button class="reset-btn flex-1 py-1 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface text-[11px] font-display border border-outline-variant transition-colors rounded-sm" @click="emit('action', 'cancel')">取消</button>
        <button class="reset-btn flex-1 py-1 hover:bg-primary/20 text-primary text-[11px] font-display border border-primary/50 transition-colors font-bold rounded-sm bg-primary/10" style="background-color: rgb(var(--color-primary-rgb) / 0.1);" @click="emit('action', 'send')">发送</button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import ArkActionToggle from './ArkActionToggle.vue';

// ArkBubbleWindow: 贴边气泡态及战术副屏
withDefaults(defineProps<{
  position?: 'left' | 'right';
  width?: number;
  triggerCount?: number;
  showPopover?: boolean;
  entries?: { name: string; enabled?: boolean; tempDisabled?: boolean }[];
}>(), {
  position: 'right',
  width: 32,
  triggerCount: 0,
  showPopover: false,
  entries: () => []
});

const emit = defineEmits<{
  (e: 'click-bubble'): void;
  (e: 'close-popover'): void;
  (e: 'toggle-entry', entry: any, action: 'enable' | 'temp' | 'resume' | 'disable'): void;
  (e: 'action', type: 'send' | 'cancel'): void;
}>();
</script>
