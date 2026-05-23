<template>
  <div class="border border-outline-variant transition-colors p-0 flex flex-col relative w-full group overflow-hidden"
       :class="[
         status === 'violation' ? 'bg-error/5 border-error/30' :
         status === 'warning' ? 'bg-outline-variant/10 border-outline-variant' : 'bg-surface hover:border-outline'
       ]">
    <!-- Background Stripes for specific statuses -->
    <div v-if="status === 'violation'" class="absolute inset-0 z-0 opacity-10 pointer-events-none"
         style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px); color: var(--color-error);"></div>
    <div v-if="status === 'warning'" class="absolute inset-0 z-0 opacity-[0.05] pointer-events-none"
         style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px); color: var(--color-on-surface);"></div>

    <!-- Highlight Line -->
    <div class="absolute left-0 top-0 right-0 h-[2px] opacity-80 z-20"
         :class="status === 'violation' ? 'bg-error' : status === 'warning' ? 'bg-outline' : 'bg-primary'">
    </div>

    <div class="p-2 flex flex-col gap-1.5 relative z-10">
      <div class="flex justify-between items-start w-full gap-2">
        <div class="flex-1 flex gap-2 items-start min-w-0">
          <div v-if="showTypeIndicator"
               class="w-2 h-2 mt-1 flex-shrink-0 border-none p-0 m-0 rounded-none shadow-sm"
               :class="entry.type === 'constant' ? 'bg-[#4ed5ff] shadow-[0_0_6px_#4ed5ff88]' : 'bg-[#afd439] shadow-[0_0_6px_#afd43988]'"
               :title="entry.type === 'constant' ? '蓝灯(常驻)' : '绿灯(条件)'">
          </div>
          <h3 class="font-display text-sm font-bold break-words whitespace-normal leading-tight min-w-0 flex-1"
              :class="status === 'warning' ? 'text-on-surface-variant opacity-80' : 'text-on-surface'">
            {{ entry.name }}
          </h3>
        </div>
        <span class="font-mono text-[calc(10em/14)] bg-surface-container-high text-on-surface-variant px-1 py-0.5 rounded-sm border border-outline-variant whitespace-nowrap flex-shrink-0">
          ~{{ entry.tokens }} tok
        </span>
      </div>
      
      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Status Badge -->
        <div v-if="status === 'violation'" class="font-mono text-error flex items-center gap-0.5 border border-error/50 px-1 py-0.5 text-[calc(10em/14)] bg-error/10">
          <span class="material-symbols-outlined text-[calc(12em/14)]">gavel</span>
          VIOLATION / 已阻断
        </div>
        <div v-else-if="status === 'warning'" class="font-mono text-on-surface-variant flex items-center gap-0.5 border border-outline-variant/80 px-1 py-0.5 text-[calc(10em/14)] bg-surface-variant/30">
          <span class="material-symbols-outlined text-[calc(12em/14)]">warning</span>
          TEMP_HOLD / 临时阻断
        </div>
        <div v-else class="font-mono text-primary-text flex items-center gap-0.5 border border-primary/50 px-1 py-0.5 text-[calc(10em/14)] bg-primary/10">
          <span class="material-symbols-outlined text-[calc(12em/14)]">check_circle</span>
          ACTIVE / 将被发送
        </div>
        
        <!-- Source -->
        <div class="font-body text-on-surface-variant text-[calc(10em/14)] ml-1">
          📁 来源: {{ entry.source }}
        </div>
      </div>
    </div>
    
    <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-2 flex flex-wrap justify-between items-center w-full gap-2 relative z-10">
       <div class="font-mono text-[calc(10em/14)] text-on-surface-variant opacity-70">
          {{ actionReqText }}
       </div>
       <div class="flex flex-wrap gap-1.5 ml-auto">
         <ActionToggle v-if="status === 'violation'" type="enable" @click="$emit('action', 'enable')">允许发送</ActionToggle>
         <ActionToggle v-else-if="status === 'warning'" type="resume" @click="$emit('action', 'resume')">取消单次</ActionToggle>
         <template v-else>
           <ActionToggle type="temp" @click="$emit('action', 'temp')">单次</ActionToggle>
           <ActionToggle type="disable" @click="$emit('action', 'disable')">彻底</ActionToggle>
         </template>
       </div>
     </div>
   </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ActionToggle from '../../../ARK_STATUSBAR/components/ActionToggle.vue';

const emit = defineEmits<{
  (e: 'action', type: 'enable' | 'resume' | 'temp' | 'disable'): void;
}>();

const props = withDefaults(defineProps<{
  status: 'violation' | 'warning' | 'active';
  showTypeIndicator?: boolean;
  entry: {
    name: string;
    tokens: number;
    source: string;
    type?: 'constant' | 'selective';
  };
}>(), {
  showTypeIndicator: false
});

const actionReqText = computed(() => {
  if (props.status === 'violation') return 'Action Req: 解除阻断需授权';
  if (props.status === 'warning') return '单次拦截，发后自动恢复';
  return '可执行阻断操作';
});
</script>