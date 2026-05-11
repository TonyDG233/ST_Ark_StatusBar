<template>
  <div class="relative flex flex-col w-full h-full p-2 gap-2 overflow-hidden box-border bg-background">
    <!-- Header Area -->
    <div class="flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent">
      <!-- SYS_MODULE Label -->
      <div class="font-mono text-primary mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-[10px] tracking-wider">
        <span class="w-1.5 h-1.5 bg-primary"></span>
        SYS_MODULE // SEC_INT
      </div>
      
      <!-- Title & Description -->
      <div class="flex flex-col min-w-0 w-full">
        <h1 class="font-display text-xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase">
          拦截预警控制中心
        </h1>
        <p class="font-body text-on-surface-variant text-[10px] break-words whitespace-normal mt-1 leading-snug">
          主动扫描模式运行中。监测所有世界书数据注入请求以防止危险的内容污染或底层逻辑冲突。
        </p>
      </div>
      
      <!-- Global Controls -->
      <div class="flex flex-wrap items-center justify-between gap-2 mt-1 w-full">
        <!-- PRE-CHECK ENABLED Toggle Mock -->
        <label class="flex items-center gap-2 cursor-pointer border border-surface-variant px-2 py-1 bg-surface-container-low hover:bg-surface-variant transition-colors min-w-0">
          <span class="font-display text-[10px] text-on-surface uppercase font-bold tracking-widest whitespace-nowrap">预检拦截使能</span>
          <div class="relative w-8 h-4 bg-primary flex items-center justify-end p-0.5">
            <div class="w-3 h-3 bg-black"></div>
          </div>
        </label>
        
        <!-- MANUAL SCAN Button -->
        <button class="bg-surface border border-outline text-on-surface px-2 py-1 font-display text-[10px] font-bold tracking-widest uppercase hover:bg-inverse-on-surface transition-colors flex items-center justify-center gap-1 flex-1 min-w-[100px] outline-none">
          <span class="material-symbols-outlined text-[14px]">radar</span>
          手动检测
        </button>
      </div>
    </div>

    <!-- Scrollable Content Area -->
    <div class="flex-1 overflow-y-auto slim-scroll-container flex flex-col gap-3 pb-16">
      
      <!-- Alert Banner / Warning Section -->
      <div class="w-full border border-rhodes-red bg-surface-container-low relative overflow-hidden flex flex-row flex-shrink-0">
        <!-- Danger Strip -->
        <div class="bg-rhodes-red text-black w-6 flex flex-col items-center justify-center py-2 font-mono font-bold tracking-widest gap-2 flex-shrink-0">
          <span class="material-symbols-outlined text-black text-[14px]" style="font-variation-settings: 'FILL' 1;">warning</span>
          <span class="[writing-mode:vertical-rl] rotate-180 uppercase text-[9px] whitespace-nowrap">CRITICAL_ALERT</span>
        </div>
        <!-- Alert Content -->
        <div class="p-2 flex-1 min-w-0 relative z-10 flex flex-col justify-center">
          <h2 class="font-display text-rhodes-red uppercase text-sm font-bold mb-1 tracking-wider">拦截已触发</h2>
          <p class="font-body text-on-surface-variant text-[10px] leading-snug mb-2 whitespace-normal">
            系统已阻断新上下文数据的注入。以下挂载条目被当前对话内容触发，需进行确认与过滤。
          </p>
          <div class="font-mono text-rhodes-red flex flex-wrap gap-x-4 gap-y-1 text-[9px] border-t border-rhodes-red/30 pt-1.5 mt-auto">
            <div><span class="opacity-50">被拦截总数:</span> 03</div>
            <div><span class="opacity-50">严重等级:</span> CLASS_IV</div>
          </div>
        </div>
        <!-- Decorative Stripes -->
        <div class="absolute right-0 top-0 bottom-0 w-24 opacity-10 pointer-events-none" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 10px, #e53e3e 10px, #e53e3e 20px);"></div>
      </div>

      <!-- Pending Entries Queue -->
      <div class="flex flex-col gap-2 w-full">
        <div class="font-display text-[10px] font-bold tracking-widest uppercase text-on-surface-variant border-b border-surface-variant pb-1">
          待处理队列 (PENDING ENTRIES)
        </div>

        <!-- Entry Item 1: Blocked by Default (VIOLATION) -->
        <div class="border border-rhodes-red/50 bg-surface-container hover:border-rhodes-red transition-colors p-0 flex flex-col relative w-full">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-rhodes-red"></div>
          <div class="p-2 pl-3 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-[12px] font-bold text-on-surface break-words whitespace-normal leading-tight flex-1">
                [Originium] 矿石病发作症状描述
              </h3>
              <!-- Token Badge -->
              <span class="font-mono text-[9px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~184 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1">
              <div class="font-mono text-rhodes-red flex items-center gap-0.5 border border-rhodes-red/50 px-1 py-0.5 text-[9px] bg-rhodes-red/10">
                <span class="material-symbols-outlined text-[10px]">gavel</span>
                VIOLATION / 已阻断
              </div>
              <div class="font-body text-on-surface-variant text-[9px] ml-1">
                📁 来源: Core_Lorebook_v2
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-1.5 flex justify-between items-center w-full">
             <div class="font-mono text-[9px] text-on-surface-variant opacity-70">
                Action Req: 解除阻断需授权
             </div>
             <div class="flex gap-1">
               <ActionToggle type="enable" size="sm">允许发送</ActionToggle>
             </div>
          </div>
        </div>

        <!-- Entry Item 2: Temp Disabled (WARNING) -->
        <div class="border border-rhodes-yellow/50 bg-surface-container hover:border-rhodes-yellow transition-colors p-0 flex flex-col relative w-full">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-rhodes-yellow"></div>
          <div class="p-2 pl-3 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-[12px] font-bold text-on-surface break-words whitespace-normal leading-tight flex-1 opacity-70">
                塔露拉会议时间线修正
              </h3>
              <span class="font-mono text-[9px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~312 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1">
              <div class="font-mono text-rhodes-yellow flex items-center gap-0.5 border border-rhodes-yellow/50 px-1 py-0.5 text-[9px] bg-rhodes-yellow/10">
                <span class="material-symbols-outlined text-[10px]">warning</span>
                TEMP_HOLD / 临时阻断
              </div>
              <div class="font-body text-on-surface-variant text-[9px] ml-1">
                📁 来源: Reunion_Events
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-1.5 flex justify-between items-center w-full">
             <div class="font-mono text-[9px] text-on-surface-variant opacity-70">
                单次拦截，发后自动恢复
             </div>
             <div class="flex gap-1">
               <ActionToggle type="resume" size="sm">取消单次</ActionToggle>
             </div>
          </div>
        </div>

        <!-- Entry Item 3: Active / Will be Sent -->
        <div class="border border-outline-variant bg-surface hover:border-outline transition-colors p-0 flex flex-col relative w-full">
          <div class="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
          <div class="p-2 pl-3 flex flex-col gap-1.5">
            <div class="flex justify-between items-start w-full gap-2">
              <h3 class="font-display text-[12px] font-bold text-on-surface break-words whitespace-normal leading-tight flex-1">
                神秘干员 'Ghost' 档案
              </h3>
              <span class="font-mono text-[9px] bg-white/10 text-white/60 px-1 py-0.5 rounded-sm border border-white/10 whitespace-nowrap flex-shrink-0">
                ~50 tok
              </span>
            </div>
            
            <div class="flex flex-wrap items-center gap-1">
              <div class="font-mono text-primary flex items-center gap-0.5 border border-primary/50 px-1 py-0.5 text-[9px] bg-primary/10">
                <span class="material-symbols-outlined text-[10px]">check_circle</span>
                ACTIVE / 将被发送
              </div>
              <div class="font-body text-on-surface-variant text-[9px] ml-1">
                📁 来源: Operators_Secret
              </div>
            </div>
          </div>
          
          <div class="bg-surface-container-lowest border-t border-surface-variant/50 p-1.5 flex justify-between items-center w-full">
             <div class="font-mono text-[9px] text-on-surface-variant opacity-70">
                可执行阻断操作
             </div>
             <div class="flex gap-1">
               <ActionToggle type="temp" size="sm">单次</ActionToggle>
               <ActionToggle type="disable" size="sm">彻底</ActionToggle>
             </div>
          </div>
        </div>

      </div>

      <!-- Spacer for sticky bottom actions -->
      <div class="h-16 flex-shrink-0"></div>
    </div>

    <!-- Sticky Bottom Actions -->
    <div class="absolute bottom-0 left-0 w-full border-t border-surface-variant bg-surface-container p-2 flex gap-2 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] z-20">
      <button class="bg-surface border border-rhodes-red text-rhodes-red font-display text-[10px] font-bold tracking-widest uppercase py-2 hover:bg-rhodes-red hover:text-black transition-colors flex items-center justify-center gap-1 flex-1 outline-none">
        <span class="material-symbols-outlined text-[14px]">block</span>
        中止并清除 (ABORT)
      </button>
      <button class="bg-primary text-black font-display text-[10px] font-bold tracking-widest uppercase py-2 hover:bg-primary-container transition-colors flex items-center justify-center gap-1 flex-1 outline-none shadow-[0_0_8px_rgba(78,213,255,0.4)]">
        <span class="material-symbols-outlined text-[14px]">done_all</span>
        覆盖发送 (PROCEED)
      </button>
    </div>

  </div>
</template>

<script setup lang="ts">
import ActionToggle from '../../../ARK_STATUSBAR/components/ActionToggle.vue';
</script>

<style scoped>
/* Inherit standard sandbox scrolling */
.slim-scroll-container::-webkit-scrollbar {
  width: 4px;
}
.slim-scroll-container::-webkit-scrollbar-track {
  background: transparent;
}
.slim-scroll-container::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}
.slim-scroll-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.3);
}
</style>
