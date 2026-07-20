<template>
  <div
    class="tools-tab relative flex flex-col p-4 gap-4 @container overflow-y-auto scrollbar-none min-h-0 w-full h-full text-on-surface"
  >
    <!-- 占位区 -->
    <div
      class="flex-1 flex flex-col items-center justify-center relative min-h-[300px] border border-outline-variant/30 bg-surface-container-low/50"
    >
      <WipMask text="扩展模块缓慢开发中" />
    </div>
  </div>
</template>

<script setup lang="ts">
import WipMask from '../../../components/WipMask.vue';
</script>

<style scoped>
/* Any required scoped overrides */
</style>
