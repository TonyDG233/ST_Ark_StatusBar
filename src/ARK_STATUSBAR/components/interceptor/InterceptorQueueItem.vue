<template>
  <div class="border border-outline-variant bg-surface hover:border-outline transition-colors p-0 flex flex-col relative w-full group">
    <!-- Highlight Line (Blue by default, can be overridden by status) -->
    <div class="absolute left-0 top-0 right-0 h-[2px] opacity-50"
         :class="status === 'violation' ? 'bg-error' : status === 'warning' ? 'bg-primary' : 'bg-primary'">
    </div>

    <div class="p-2 flex flex-col gap-1.5">
      <div class="flex justify-between items-start w-full gap-2">
        <h3 class="font-display text-sm font-bold text-on-surface break-words whitespace-normal leading-tight flex-1"
            :class="status === 'warning' ? 'opacity-70' : ''">
          {{ entry.name }}
        </h3>
        <span class="font-mono text-[10px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
          ~{{ entry.tokens }} tok
        </span>
      </div>
      
      <div class="flex flex-wrap items-center gap-1.5">
        <!-- Status Badge -->
        <div v-if="status === 'violation'" class="font-mono text-error flex items-center gap-0.5 border border-error/50 px-1 py-0.5 text-[10px] bg-error/10">
          <span class="material-symbols-outlined text-[12px]">gavel</span>
          VIOLATION / 已阻断
        </div>
        <div v-else-if="status === 'warning'" class="font-mono text-primary flex items-center gap-0.5 border border-primary/50 px-1 py-0.5 text-[10px] bg-primary/10">
          <span class="material-symbols-outlined text-[12px]">warning</span>
          TEMP_HOLD / 临时阻断
        </div>
        <div v-else class="font-mono text-primary flex items-center gap-0.5 border border-primary/50 px-1 py-0.5 text-[10px] bg-primary/10">
          <span class="material-symbols-outlined text-[12px]">check_circle</span>
          ACTIVE / 将被发送
        </div>
        
        <!-- Source -->
        <div class="font-body text-on-surface-variant text-[10px] ml-1">
          📁 来源: {{ entry.source }}
        </div>
      </div>
    </div>
    
    <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-2 flex flex-wrap justify-between items-center w-full gap-2">
       <div class="font-mono text-[10px] text-on-surface-variant opacity-70">
          {{ actionReqText }}
       </div>
       <div class="flex flex-wrap gap-1.5 ml-auto">
         <ActionToggle v-if="status === 'violation'" type="enable">允许发送</ActionToggle>
         <ActionToggle v-else-if="status === 'warning'" type="resume">取消单次</ActionToggle>
         <template v-else>
           <ActionToggle type="temp">单次</ActionToggle>
           <ActionToggle type="disable">彻底</ActionToggle>
         </template>
       </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import ActionToggle from '../../../ARK_STATUSBAR/components/ActionToggle.vue';

const props = defineProps<{
  status: 'violation' | 'warning' | 'active';
  entry: {
    name: string;
    tokens: number;
    source: string;
  };
}>();

const actionReqText = computed(() => {
  if (props.status === 'violation') return 'Action Req: 解除阻断需授权';
  if (props.status === 'warning') return '单次拦截，发后自动恢复';
  return '可执行阻断操作';
});
</script>