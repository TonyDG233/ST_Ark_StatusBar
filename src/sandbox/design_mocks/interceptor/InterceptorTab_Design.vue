<template>
  <div class="relative w-full h-full slim-scroll-container overflow-y-auto flex flex-col box-border">
    <!-- Inner content wrapper with padding -->
    <div class="p-2 flex flex-col gap-2 min-h-max box-border">
      <!-- Header Area (Now scrollable) -->
      <div
        class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all"
      >
        <!-- SYS_MODULE Label -->
        <div
          class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider"
        >
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // SEC_INT
        </div>

        <!-- Title & Description -->
        <div class="flex flex-col min-w-0 w-full">
          <h1
            class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase"
          >
            拦截预警控制中心
          </h1>
          <p
            class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all"
          >
            主动扫描模式运行中。监测所有世界书数据注入请求以防止危险的内容污染或底层逻辑冲突。
          </p>
        </div>

        <!-- Global Controls -->
        <div class="flex flex-wrap items-center justify-between gap-2 mt-1 w-full">
          <!-- PRE-CHECK ENABLED Toggle Mock -->
          <label
            class="flex items-center gap-2 cursor-pointer border border-outline-variant px-2 py-1 bg-surface-container-low hover:bg-surface-variant transition-colors min-w-0"
          >
            <span class="font-display text-xs text-on-surface uppercase font-bold tracking-widest whitespace-nowrap"
              >预检拦截</span
            >
            <div class="relative w-8 h-4 bg-primary flex items-center justify-end p-0.5">
              <div class="w-3 h-3 bg-black"></div>
            </div>
          </label>

          <!-- MANUAL SCAN Button -->
          <button
            class="bg-surface border border-outline-variant text-on-surface px-2 py-1 font-display text-xs font-bold tracking-widest uppercase hover:bg-inverse-on-surface transition-colors flex items-center justify-center gap-1 flex-1 min-w-[100px] outline-none"
            @click="isTestMode = !isTestMode"
          >
            <span class="material-symbols-outlined text-sm">radar</span>
            手动检测
          </button>
        </div>
      </div>

      <!-- Alert Banner / Warning Section (Extracted Component) -->
      <InterceptorAlertDesign :isTestMode="isTestMode" :count="3" :tokenCount="546" />

      <!-- Pending Entries Queue -->
      <div class="flex flex-col gap-2 w-full mt-1">
        <div
          class="font-display text-xs font-bold tracking-widest uppercase text-on-surface-variant border-b border-surface-variant pb-1"
        >
          待处理队列 (PENDING ENTRIES)
        </div>

        <!-- Extracted Queue Items -->
        <InterceptorQueueItemDesign
          status="violation"
          :entry="{ name: '[Originium] 矿石病发作症状描述', tokens: 184, source: 'Core_Lorebook_v2' }"
        />

        <InterceptorQueueItemDesign
          status="warning"
          :entry="{ name: '塔露拉会议时间线修正', tokens: 312, source: 'Reunion_Events' }"
        />

        <InterceptorQueueItemDesign
          status="active"
          :entry="{ name: '神秘干员 \'Ghost\' 档案', tokens: 50, source: 'Operators_Secret' }"
        />
      </div>

      <!-- Bottom Actions (Now scrolls with content) -->
      <div class="w-full mt-4 flex flex-wrap gap-2">
        <button
          class="bg-surface border border-error text-error font-display text-[11px] font-bold tracking-widest uppercase py-2.5 hover:bg-error hover:text-on-error transition-colors flex items-center justify-center gap-1 flex-1 min-w-[120px] outline-none"
        >
          <span class="material-symbols-outlined text-base">block</span>
          中止 (ABORT)
        </button>
        <button
          class="bg-primary text-on-primary font-display text-[11px] font-bold tracking-widest uppercase py-2.5 hover:bg-primary-container transition-colors flex items-center justify-center gap-1 flex-1 min-w-[120px] outline-none shadow-[0_0_8px_rgba(78,213,255,0.4)]"
        >
          <span class="material-symbols-outlined text-base">send</span>
          发送 (PROCEED)
        </button>
      </div>

      <!-- Safe Area Spacer for BottomNav/SubNav -->
      <div class="h-14 w-full shrink-0 pointer-events-none"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import InterceptorAlertDesign from '../../../ARK_STATUSBAR/components/interceptor/InterceptorAlert.vue';
import InterceptorQueueItemDesign from '../../../ARK_STATUSBAR/components/interceptor/InterceptorQueueItem.vue';

// Mock test mode toggle for sandbox visual testing
const isTestMode = ref(false);
</script>

<style scoped></style>
