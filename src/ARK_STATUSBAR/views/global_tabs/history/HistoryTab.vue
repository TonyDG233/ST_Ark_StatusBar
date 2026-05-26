<template>
  <div class="relative flex flex-col overflow-hidden h-full box-border">
    <div class="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto overflow-x-hidden ark-scrollbar p-2">
      <!-- Header Area -->
      <div
        class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all"
      >
        <div
          class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider"
        >
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // HISTORY
        </div>
        <div class="flex flex-col min-w-0 w-full">
          <h1
            class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase"
          >
            历史记录管理
          </h1>
          <p
            class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all"
          >
            管理当前系统的快照与变更历史，提供无损回滚机制。请谨慎执行全局状态重置等破坏性指令。
          </p>
        </div>
      </div>

      <!-- Action Panels Area -->
      <div class="flex flex-col gap-2 flex-shrink-0">
        <SnapshotPanel />
        <FullBackupPanel />
        <HighRiskActionPanel />
      </div>

      <!-- Commit Log Timeline Area -->
      <CommitHistoryPanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import CommitHistoryPanel from './CommitHistoryPanel.vue';
import FullBackupPanel from './FullBackupPanel.vue';
import HighRiskActionPanel from './HighRiskActionPanel.vue';
import SnapshotPanel from './SnapshotPanel.vue';
</script>
