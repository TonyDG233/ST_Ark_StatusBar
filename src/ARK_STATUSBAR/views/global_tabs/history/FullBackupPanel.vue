<template>
  <HistoryActionCard
    label="ACTION_02"
    title="全量备份 (Full Backup)"
    description="克隆目标世界书所有的条目内容与状态并创建独立文件。适用于大范围重构前的兜底。"
    icon="save"
    type="default"
  >
    <div class="flex flex-col gap-2">
      <!-- Warning -->
      <div v-if="backupWarningMsg" class="bg-[#ffc107]/10 border border-[#ffc107]/30 p-2 flex flex-col gap-1">
        <div class="text-[#ffc107] text-[calc(10em/14)] font-bold flex items-center gap-1">
          <span class="material-symbols-outlined text-[calc(14em/14)]">warning</span> 备份数量警告
        </div>
        <div class="text-[#ffc107]/80 text-[calc(10em/14)]">{{ backupWarningMsg }}</div>
      </div>

      <select
        v-model="selectedFullBackupWorldbook"
        class="bg-surface text-[calc(11em/14)] text-on-surface border border-outline-variant px-2 py-1 outline-none w-full"
      >
        <option value="">选择要全量备份的世界书 (默认主书)</option>
        <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
      </select>

      <div class="flex gap-2 items-center flex-wrap">
        <input
          type="text"
          v-model="newFullBackupName"
          placeholder="自定义标识 (如: v1.2版本)..."
          class="bg-surface border border-outline-variant px-2 py-1 flex-1 min-w-[150px] text-[calc(11em/14)] text-on-surface outline-none placeholder:text-on-surface-variant/50"
        />
        <button
          @click="createFullBackup"
          class="bg-[#17a2b8] text-white font-bold px-3 py-1 text-[calc(11em/14)] uppercase tracking-wider hover:bg-[#17a2b8]/80 transition-colors shrink-0 outline-none"
        >
          新建独立备份
        </button>
      </div>

      <!-- Backup List -->
      <div class="flex flex-col gap-1 mt-2 border-t border-outline-variant/50 pt-2">
        <div
          v-if="!fullBackupsList.length"
          class="text-[calc(11em/14)] text-on-surface-variant p-2 text-center opacity-70"
        >
          暂无本地全量备份文件。
        </div>
        <div
          v-else
          v-for="snap in fullBackupsList"
          :key="snap"
          class="flex flex-col border border-outline-variant bg-surface-container-lowest p-2 min-w-0 mb-1"
        >
          <div class="flex flex-wrap justify-between items-center gap-x-2 gap-y-1 mb-1">
            <div class="text-[calc(11em/14)] font-bold text-on-surface break-words min-w-0">
              {{ extractBackupName(snap).name }}
            </div>
            <div class="text-[calc(9em/14)] text-on-surface-variant font-mono whitespace-nowrap">
              {{ extractBackupName(snap).time }}
            </div>
          </div>
          <div class="text-[calc(10em/14)] text-on-surface-variant mb-2 truncate max-w-full">
            📁 实体文件: {{ snap }}
          </div>
          <div class="flex flex-wrap gap-2 justify-end">
            <ActionToggle type="restore" @click="restoreFullBackup(snap)">完整覆盖</ActionToggle>
            <ActionToggle type="delete" @click="deleteFullBackup(snap)">删除文件</ActionToggle>
          </div>
        </div>
      </div>
    </div>
  </HistoryActionCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { onMounted, ref } from 'vue';
import ActionToggle from '../../../components/ActionToggle.vue';
import HistoryActionCard from '../../../components/history/HistoryActionCard.vue';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { useUIStateStore } from '../../../store/ui_state_store';

const uiStore = useUIStateStore();
const { allAvailableWorldbooks, currentPrimaryWorldbook } = storeToRefs(uiStore);

const manager = StatusBarManager.getInstance();

const newFullBackupName = ref('');
const selectedFullBackupWorldbook = ref('');
const fullBackupsList = ref<string[]>([]);
const backupWarningMsg = ref<string | null>(null);

const fetchBackups = async () => {
  fullBackupsList.value = await manager.worldbook.getAllBackups();
  backupWarningMsg.value = await manager.worldbook.checkBackupLimitWarning();
};

onMounted(() => {
  fetchBackups();
});

const extractBackupName = (wbName: string) => {
  const match = wbName.match(/^\[ARK_BACKUP_(.+?)\]_(.+)$/);
  if (match) {
    const timeStr = match[1].replace(/-/g, ':').replace('T', ' ').substring(0, 19);
    return { name: `备份 - ${match[2]}`, time: timeStr };
  }
  return { name: wbName, time: '' };
};

const createFullBackup = async () => {
  const targetWb = selectedFullBackupWorldbook.value || currentPrimaryWorldbook.value;
  if (!targetWb) return;

  const name = newFullBackupName.value.trim();
  try {
    await manager.worldbook.createFullBackup(targetWb, name || undefined);
    newFullBackupName.value = '';
    await fetchBackups(); // 刷新列表
    if (typeof toastr !== 'undefined') {
      toastr.success('世界书全量备份创建成功！');
      if (backupWarningMsg.value) {
        if (backupWarningMsg.value.includes('接近上限')) {
          toastr.info(backupWarningMsg.value);
        } else {
          toastr.warning(backupWarningMsg.value);
        }
      }
    }
  } catch (e) {
    if (typeof toastr !== 'undefined') toastr.error('备份失败，详见控制台');
  }
};

const restoreFullBackup = async (backupName: string) => {
  const targetMatch = backupName.match(/^\[ARK_BACKUP_.+?\]_(.+)$/);
  const targetWb = targetMatch ? targetMatch[1] : null;

  if (!targetWb) {
    if (typeof toastr !== 'undefined') toastr.error('无法解析该备份的目标世界书名称。');
    return;
  }

  if (confirm(`【警告】确定要使用此备份 (${backupName}) 覆盖还原至原世界书 (${targetWb}) 吗？此操作不可逆！`)) {
    try {
      await manager.worldbook.restoreFullBackup(targetWb, backupName);
      if (typeof toastr !== 'undefined') toastr.success('世界书内容已成功还原！');
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('还原失败，详见控制台');
    }
  }
};

declare const deleteWorldbook: (name: string) => Promise<void>;

const deleteFullBackup = async (backupName: string) => {
  if (confirm(`确定要彻底删除该全量备份文件 (${backupName}) 吗？`)) {
    try {
      if (typeof deleteWorldbook !== 'undefined') {
        await deleteWorldbook(backupName);
      } else {
        throw new Error('deleteWorldbook is not defined in global scope');
      }
      await fetchBackups();
      if (typeof toastr !== 'undefined') toastr.success('备份删除成功');
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('备份删除失败');
      console.error(e);
    }
  }
};
</script>

<style scoped></style>
