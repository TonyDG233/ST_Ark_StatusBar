<template>
  <div>
    <div
      v-if="!isArknightsCard && !hasSnapshotForPrimary && currentPrimaryWorldbook"
      class="warning-box"
      style="margin-bottom: 10px; background-color: rgba(220, 53, 69, 0.2); border-color: #dc3545"
    >
      <strong style="color: #ff6b6b; display: block; margin-bottom: 4px">⚠️ 警告：检测到角色卡主书快照缺失</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        检测到当前角色卡世界书尚无快照。在您首次操作世界书前，强烈建议您拍摄一张快照，以便在需要时无损回滚。
      </p>
    </div>

    <!-- 快照管理顶栏 (黄框介绍) -->
    <div class="warning-box" style="margin-bottom: 0; padding: 10px; border-radius: 6px 6px 0 0; border-bottom: none">
      <strong style="display: block; margin-bottom: 4px">📸 世界书快照管理</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        此处可以对任意世界书保存当前所有条目 “蓝/绿灯”，“开启/禁用状态” 的快照，并在日后随时无损恢复。
      </p>
    </div>

    <!-- 实际的快照操作区域 -->
    <div
      class="snapshot-controls"
      style="
        border: 1px solid rgba(255, 165, 0, 0.4);
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.15);
      "
    >
      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px">
        <select v-model="selectedSnapshotWorldbook" class="filter-select" style="width: 100%">
          <option value="">选择要拍摄的世界书 (默认主书)</option>
          <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
        </select>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <input
            type="text"
            v-model="newSnapshotName"
            placeholder="输入快照名称 (留空自动生成时间戳)..."
            class="search-input"
            style="flex: 1; min-width: 150px"
          />
          <button
            class="btn-primary"
            @click="createSnapshot"
            style="padding: 6px 12px; white-space: nowrap; flex-grow: 1"
          >
            拍摄快照
          </button>
        </div>
      </div>

      <div v-if="!currentConfig?.snapshots?.length" class="empty-state" style="padding: 10px">暂无保存的快照。</div>
      <ul v-else class="entry-list read-only" style="margin: 0; max-height: 200px; overflow-y: auto">
        <li
          v-for="snap in currentConfig?.snapshots"
          :key="snap.id"
          style="
            flex-direction: column;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 8px;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
            <strong style="font-size: 0.95em">{{ snap.name }}</strong>
            <span style="font-size: 0.8em; opacity: 0.7">{{ new Date(snap.timestamp).toLocaleString() }}</span>
          </div>
          <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 8px">📁 来源: {{ snap.worldbook }}</div>
          <div class="action-bar compact">
            <button class="btn-success tiny" @click="restoreSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em">
              ✅ 恢复状态
            </button>
            <button class="btn-danger tiny" @click="deleteSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em">
              ❌ 删除
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useArkConfig } from '../../../core/config_store';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import { allAvailableWorldbooks, currentPrimaryWorldbook, isArknightsCard } from '../shared_ui_state';

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

const newSnapshotName = ref('');
const selectedSnapshotWorldbook = ref('');
const fullBackupsList = ref<string[]>([]);

onMounted(async () => {
  fullBackupsList.value = await manager.worldbook.getAllBackups();
});

const hasSnapshotForPrimary = computed(() => {
  if (!currentPrimaryWorldbook.value) return false;
  return fullBackupsList.value.some((s: string) => s.endsWith(`_${currentPrimaryWorldbook.value}`));
});

const createSnapshot = async () => {
  const targetWb = selectedSnapshotWorldbook.value || currentPrimaryWorldbook.value;
  if (!targetWb) return;

  const name = newSnapshotName.value.trim() || `快照-${new Date().toLocaleTimeString()}`;
  await manager.worldbook.saveCurrentAsSnapshot(targetWb, name);
  newSnapshotName.value = '';
};

const loadWorldbookLists = async () => {
  try {
    allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

const restoreSnapshot = async (id: string) => {
  if (confirm('确定要恢复到此快照的状态吗？')) {
    await manager.worldbook.restoreSnapshot(id);
    await loadWorldbookLists();
  }
};

const deleteSnapshot = async (id: string) => {
  if (confirm('确定要删除此快照吗？')) {
    await manager.worldbook.deleteSnapshot(id);
  }
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.filter-select {
  padding: 6px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}

.search-input {
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}
</style>
