<template>
  <div class="relative w-full h-full bg-background slim-scroll-container overflow-y-auto flex flex-col box-border">
    <!-- Inner content wrapper with padding -->
    <div class="p-2 flex flex-col gap-2 min-h-max box-border">
      
      <!-- Header Area (Now scrollable) -->
      <div class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all">
        <!-- SYS_MODULE Label -->
        <div class="font-mono text-primary mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // SEC_INT
        </div>
        
        <!-- Title & Description -->
        <div class="flex flex-col min-w-0 w-full">
          <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase">
            拦截预警控制中心
          </h1>
          <p class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all">
            主动扫描模式运行中。监测所有世界书数据注入请求以防止危险的内容污染或底层逻辑冲突。
          </p>
        </div>
        
        <!-- Global Controls -->
        <div class="flex flex-wrap items-center justify-between gap-2 mt-1 w-full">
          <!-- PRE-CHECK ENABLED Toggle Mock -->
          <label class="flex items-center gap-2 cursor-pointer border border-outline-variant px-2 py-1 bg-surface-container-low hover:bg-surface-variant transition-colors min-w-0">
            <span class="font-display text-xs text-on-surface uppercase font-bold tracking-widest whitespace-nowrap">预检拦截使能</span>
            <div class="relative w-8 h-4 bg-primary flex items-center justify-end p-0.5">
              <div class="w-3 h-3 bg-black"></div>
            </div>
          </label>
          
          <!-- MANUAL SCAN Button -->
          <button class="bg-surface border border-outline-variant text-on-surface px-2 py-1 font-display text-xs font-bold tracking-widest uppercase hover:bg-inverse-on-surface transition-colors flex items-center justify-center gap-1 flex-1 min-w-[100px] outline-none" @click="isTestMode = !isTestMode">
            <span class="material-symbols-outlined text-sm">radar</span>
            手动检测
          </button>
        </div>
      </div>

      <!-- Alert Banner / Warning Section -->
      <div v-if="!isTestMode" class="w-full border border-error bg-surface-container-low relative overflow-hidden flex flex-row flex-shrink-0 mt-1">
        <!-- Danger Strip -->
        <div class="bg-error text-on-error w-6 flex flex-col items-center justify-center py-2 font-mono font-bold tracking-widest gap-2 flex-shrink-0 relative z-20">
          <span class="material-symbols-outlined text-on-error text-sm" style="font-variation-settings: 'FILL' 1;">warning</span>
          <span class="[writing-mode:vertical-rl] rotate-180 uppercase text-[10px] whitespace-nowrap">CRITICAL_ALERT</span>
        </div>
        <!-- Alert Content -->
        <div class="p-2 flex-1 min-w-0 relative z-20 flex flex-col justify-center">
          <h2 class="font-display text-error uppercase text-sm font-bold mb-1 tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">拦截已触发</h2>
          <p class="font-body text-on-surface-variant text-xs leading-snug mb-2 whitespace-normal drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            系统已阻断新上下文数据的注入。以下挂载条目被当前对话内容触发，需进行确认与过滤。
          </p>
          <div class="font-mono text-error flex flex-wrap gap-x-4 gap-y-1 text-[10px] border-t border-error/30 pt-1.5 mt-auto">
            <div><span class="opacity-50">被拦截总数:</span> 03</div>
            <div><span class="opacity-50">预计 Token:</span> ~546 tok</div>
          </div>
        </div>
        <!-- Decorative Stripes (Full width, low opacity, z-0) -->
        <div class="absolute inset-0 z-0 opacity-10 pointer-events-none" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px); color: var(--color-error);"></div>
      </div>
      
      <!-- Test Mode Banner -->
      <div v-else class="w-full border border-primary bg-surface-container-low relative overflow-hidden flex flex-row flex-shrink-0 mt-1">
        <!-- Info Strip -->
        <div class="bg-primary text-on-primary w-6 flex flex-col items-center justify-center py-2 font-mono font-bold tracking-widest gap-2 flex-shrink-0 relative z-20">
          <span class="material-symbols-outlined text-on-primary text-sm" style="font-variation-settings: 'FILL' 1;">search</span>
          <span class="[writing-mode:vertical-rl] rotate-180 uppercase text-[10px] whitespace-nowrap">TEST_RESULTS</span>
        </div>
        <!-- Alert Content -->
        <div class="p-2 flex-1 min-w-0 relative z-20 flex flex-col justify-center">
          <h2 class="font-display text-primary uppercase text-sm font-bold mb-1 tracking-wider drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">主动检测结果</h2>
          <p class="font-body text-on-surface-variant text-xs leading-snug mb-2 whitespace-normal drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
            根据当前上下文，模拟检测触发了以下条目：
          </p>
          <div class="font-mono text-primary flex flex-wrap gap-x-4 gap-y-1 text-[10px] border-t border-primary/30 pt-1.5 mt-auto">
            <div><span class="opacity-50">预测触发:</span> 03</div>
            <div><span class="opacity-50">预计 Token:</span> ~546 tok</div>
          </div>
        </div>
        <div class="absolute inset-0 z-0 opacity-10 pointer-events-none" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, currentColor 10px, currentColor 20px); color: var(--color-primary);"></div>
      </div>

      <!-- Pending Entries Queue -->
      <div class="flex flex-col gap-2 w-full mt-1">
        <div class="font-display text-xs font-bold tracking-widest uppercase text-on-surface-variant border-b border-surface-variant pb-1">
          待处理队列 (PENDING ENTRIES)
        </div>

        <!-- Entry Item 1: Blocked by Default (VIOLATION) -->
        <div class="border border-outline-variant bg-surface hover:border-outline transition-colors p-0 flex flex-col relative w-full group">
          <div class="absolute left-0 top-0 right-0 h-[2px] bg-primary opacity-50"></div>
          <div class="p-2 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-sm font-bold text-on-surface break-words whitespace-normal leading-tight flex-1">
                [Originium] 矿石病发作症状描述
              </h3>
              <span class="font-mono text-[10px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~184 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1.5">
              <div class="font-mono text-error flex items-center gap-0.5 border border-error/50 px-1 py-0.5 text-[10px] bg-error/10">
                <span class="material-symbols-outlined text-[12px]">gavel</span>
                VIOLATION / 已阻断
              </div>
              <div class="font-body text-on-surface-variant text-[10px] ml-1">
                📁 来源: Core_Lorebook_v2
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-2 flex flex-wrap justify-between items-center w-full gap-2">
             <div class="font-mono text-[10px] text-on-surface-variant opacity-70">
                Action Req: 解除阻断需授权
             </div>
             <div class="flex flex-wrap gap-1.5 ml-auto">
               <ActionToggle type="enable">允许发送</ActionToggle>
             </div>
          </div>
        </div>

        <!-- Entry Item 2: Temp Disabled (WARNING) -->
        <div class="border border-rhodes-yellow/50 bg-surface-container hover:border-rhodes-yellow transition-colors p-0 flex flex-col relative w-full group">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-rhodes-yellow"></div>
          <div class="p-2 pl-3 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-sm font-bold text-on-surface break-words whitespace-normal leading-tight flex-1 opacity-70">
                塔露拉会议时间线修正
              </h3>
              <span class="font-mono text-[10px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~312 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1.5">
              <div class="font-mono text-rhodes-yellow flex items-center gap-0.5 border border-rhodes-yellow/50 px-1 py-0.5 text-[10px] bg-rhodes-yellow/10">
                <span class="material-symbols-outlined text-[12px]">warning</span>
                TEMP_HOLD / 临时阻断
              </div>
              <div class="font-body text-on-surface-variant text-[10px] ml-1">
                📁 来源: Reunion_Events
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-2 flex flex-wrap justify-between items-center w-full gap-2">
             <div class="font-mono text-[10px] text-on-surface-variant opacity-70">
                单次拦截，发后自动恢复
             </div>
             <div class="flex flex-wrap gap-1.5 ml-auto">
               <ActionToggle type="resume">取消单次</ActionToggle>
             </div>
          </div>
        </div>

        <!-- Entry Item 3: Active / Will be Sent -->
        <div class="border border-outline-variant bg-surface hover:border-outline transition-colors p-0 flex flex-col relative w-full group">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
          <div class="p-2 pl-3 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-sm font-bold text-on-surface break-words whitespace-normal leading-tight flex-1">
                神秘干员 'Ghost' 档案
              </h3>
              <span class="font-mono text-[10px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~50 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1.5">
              <div class="font-mono text-primary flex items-center gap-0.5 border border-primary/50 px-1 py-0.5 text-[10px] bg-primary/10">
                <span class="material-symbols-outlined text-[12px]">check_circle</span>
                ACTIVE / 将被发送
              </div>
              <div class="font-body text-on-surface-variant text-[10px] ml-1">
                📁 来源: Operators_Secret
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-2 flex flex-wrap justify-between items-center w-full gap-2">
             <div class="font-mono text-[10px] text-on-surface-variant opacity-70">
                可执行阻断操作
             </div>
             <div class="flex flex-wrap gap-1.5 ml-auto">
               <ActionToggle type="temp">单次</ActionToggle>
               <ActionToggle type="disable">彻底</ActionToggle>
             </div>
          </div>
        </div>
      </div>

      <!-- Bottom Actions (Now scrolls with content) -->
      <div class="w-full mt-4 flex gap-2">
        <button class="bg-surface border border-error text-error font-display text-[11px] font-bold tracking-widest uppercase py-2.5 hover:bg-error hover:text-on-error transition-colors flex items-center justify-center gap-1 flex-1 outline-none">
          <span class="material-symbols-outlined text-base">block</span>
          中止并清除 (ABORT)
        </button>
        <button class="bg-primary text-on-primary font-display text-[11px] font-bold tracking-widest uppercase py-2.5 hover:bg-primary-container transition-colors flex items-center justify-center gap-1 flex-1 outline-none shadow-[0_0_8px_rgba(78,213,255,0.4)]">
          <span class="material-symbols-outlined text-base">done_all</span>
          覆盖发送 (PROCEED)
        </button>
      </div>

      <!-- Spacer -->
      <div class="h-4 flex-shrink-0"></div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ActionToggle from '../../../ARK_STATUSBAR/components/ActionToggle.vue';

// Mock test mode toggle for sandbox visual testing
const isTestMode = ref(false);
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
