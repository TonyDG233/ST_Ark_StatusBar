<template>
  <div class="tab-panel flex-col">
    <!-- 区域 A：快照与高危操作 -->
    <div class="snapshot-panel" style="margin-bottom: 20px">
      <SnapshotPanel />
      <FullBackupPanel />
      <HighRiskActionPanel />
    </div>

    <hr class="record-divider" style="margin-bottom: 15px" />

    <!-- 区域 B：操作历史 (Git Log) -->
    <CommitHistoryPanel />
  </div>
</template>

<script setup lang="ts">
import CommitHistoryPanel from './CommitHistoryPanel.vue';
import FullBackupPanel from './FullBackupPanel.vue';
import HighRiskActionPanel from './HighRiskActionPanel.vue';
import SnapshotPanel from './SnapshotPanel.vue';
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.tab-panel.flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.snapshot-panel {
  margin-bottom: 20px;
}
</style>
