<template>
  <HistoryActionCard
    label="ACTION_01"
    title="创建快照 (Snapshot)"
    description="将当前世界书内容克隆并保存，以便在需要时无损回滚。"
    icon="camera"
    type="primary"
  >
    <div class="flex flex-col gap-2">
      <div v-if="!isArknightsCard && !hasSnapshotForPrimary && currentPrimaryWorldbook"
           class="bg-error/10 border border-error/30 p-2 flex flex-col gap-1">
        <div class="text-error text-[calc(10em/14)] font-bold flex items-center gap-1">
          <span class="material-symbols-outlined text-[calc(14em/14)]">warning</span> 缺失主书快照
        </div>
        <div class="text-error/80 text-[calc(10em/14)]">
          检测到当前角色卡世界书尚无快照。在您首次操作前，强烈建议您拍摄一张快照。
        </div>
      </div>

      <select v-model="selectedSnapshotWorldbook" class="bg-surface text-[calc(11em/14)] text-on-surface border border-outline-variant px-2 py-1 outline-none w-full">
        <option value="">选择要拍摄的世界书 (默认主书)</option>
        <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
      </select>

      <div class="flex gap-2 items-center flex-wrap">
        <input
          type="text"
          v-model="newSnapshotName"
          placeholder="输入快照名称 (留空自动生成时间戳)..."
          class="bg-surface border border-outline-variant px-2 py-1 flex-1 min-w-[150px] text-[calc(11em/14)] text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
        <button
          @click="createSnapshot"
          class="bg-primary text-on-primary font-bold px-3 py-1 text-[calc(11em/14)] uppercase tracking-wider hover:bg-primary-container transition-colors shrink-0 outline-none"
        >
          拍摄快照
        </button>
      </div>

      <!-- Snapshot List -->
      <div class="flex flex-col gap-1 mt-2 border-t border-outline-variant/50 pt-2">
        <div v-if="!currentConfig?.snapshots?.length" class="text-[calc(11em/14)] text-on-surface-variant p-2 text-center opacity-70">
          暂无保存的快照。
        </div>
        <div v-else v-for="snap in currentConfig?.snapshots" :key="snap.id" 
             class="flex flex-col border border-outline-variant bg-surface-container-lowest p-2 min-w-0 mb-1">
           <div class="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-1">
             <div class="text-[calc(11em/14)] font-bold text-on-surface break-all min-w-0">{{ snap.name }}</div>
             <div class="text-[calc(9em/14)] text-on-surface-variant font-mono whitespace-nowrap">{{ new Date(snap.timestamp).toLocaleString() }}</div>
           </div>
           <div class="text-[calc(10em/14)] text-primary-text/80 mb-2 truncate max-w-full">📁 来源: {{ snap.worldbook }}</div>
           <div class="flex flex-wrap gap-2 justify-end">
             <ActionToggle type="restore" @click="restoreSnapshot(snap.id)">恢复状态</ActionToggle>
             <ActionToggle type="delete" @click="deleteSnapshot(snap.id)">删除</ActionToggle>
           </div>
        </div>
      </div>
    </div>
  </HistoryActionCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, onMounted, ref } from 'vue';
import ActionToggle from '../../../components/ActionToggle.vue';
import HistoryActionCard from '../../../components/history/HistoryActionCard.vue';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { useArkConfig } from '../../../store/config_store';
import { useUIStateStore } from '../../../store/ui_state_store';

const uiStore = useUIStateStore();
const { 
  allAvailableWorldbooks, 
  currentPrimaryWorldbook, 
  isArknightsCard
} = storeToRefs(uiStore);

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
</style>
