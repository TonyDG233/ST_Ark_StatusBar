<template>
  <div
    class="tools-tab relative flex flex-col p-4 gap-4 @container overflow-y-auto scrollbar-none min-h-0 w-full h-full text-on-surface"
  >
    <!-- 开发意图标签 -->
    <div
      class="absolute top-0 right-0 bg-error/90 text-on-error text-[10px] px-1 font-mono z-50 pointer-events-none opacity-50"
    >
      [ToolsTab_Design]
    </div>

    <!-- 顶部状态面板 -->
    <!--     
    <div class="tab-header flex flex-col gap-2 border-b border-outline-variant pb-3 px-1 pt-1 flex-shrink-0 bg-transparent transition-all mb-2">
      <div class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
        <span class="w-1.5 h-1.5 bg-primary"></span>
        SYS_MODULE // UTILITIES
      </div>
      <div class="flex items-center gap-2 text-primary-text">
        <div class="w-1.5 h-6 bg-primary flex-shrink-0"></div>
        <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface tracking-widest uppercase">多功能扩展</h1>
      </div>
    </div> 
-->

    <!-- 占位区 -->
    <div
      class="flex-1 flex flex-col items-center justify-center relative min-h-[300px] border border-outline-variant/30 bg-surface-container-low/50"
    >
      <WipMask text="扩展模块开发中" />
    </div>
  </div>
</template>

<script setup lang="ts">
import WipMask from '../../../ARK_STATUSBAR/components/WipMask.vue';
</script>
