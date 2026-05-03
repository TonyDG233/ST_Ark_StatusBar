<template>
  <div>
    <!-- 全量备份区域 (新) -->
    <div
      class="warning-box"
      style="
        margin-top: 20px;
        margin-bottom: 0;
        padding: 10px;
        border-radius: 6px 6px 0 0;
        border-bottom: none;
        background-color: rgba(23, 162, 184, 0.1);
        border-color: #17a2b8;
      "
    >
      <strong style="display: block; margin-bottom: 4px; color: #17a2b8">💾 世界书全量备份</strong>
      <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
        克隆目标世界书所有的条目内容与状态并创建独立文件。适用于大范围编辑或重构前的安全兜底。
      </p>
    </div>
    <div
      class="snapshot-controls"
      style="
        border: 1px solid rgba(23, 162, 184, 0.4);
        border-top: none;
        border-radius: 0 0 6px 6px;
        padding: 15px;
        background: rgba(0, 0, 0, 0.15);
      "
    >
      <div
        v-if="backupWarningMsg"
        class="warning-box"
        style="margin-bottom: 10px; background-color: rgba(255, 193, 7, 0.2); border-color: #ffc107; color: #ffc107"
      >
        <strong>⚠️ 备份数量警告</strong>
        <p style="margin: 0; font-size: 0.85em">{{ backupWarningMsg }}</p>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px">
        <select v-model="selectedFullBackupWorldbook" class="filter-select" style="width: 100%">
          <option value="">选择要全量备份的世界书 (默认主书)</option>
          <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
        </select>
        <div style="display: flex; gap: 8px; flex-wrap: wrap">
          <input
            type="text"
            v-model="newFullBackupName"
            placeholder="自定义标识 (如: v1.2版本)..."
            class="search-input"
            style="flex: 1; min-width: 150px"
          />
          <button
            class="btn-primary"
            @click="createFullBackup"
            style="
              padding: 6px 12px;
              white-space: nowrap;
              flex-grow: 1;
              background-color: #17a2b8;
              border-color: #17a2b8;
            "
          >
            新建独立备份
          </button>
        </div>
      </div>

      <div v-if="!fullBackupsList.length" class="empty-state" style="padding: 10px">暂无本地全量备份文件。</div>
      <ul v-else class="entry-list read-only" style="margin: 0; max-height: 200px; overflow-y: auto">
        <li
          v-for="snap in fullBackupsList"
          :key="snap"
          style="
            flex-direction: column;
            align-items: stretch;
            background: rgba(255, 255, 255, 0.05);
            margin-bottom: 8px;
          "
        >
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
            <strong style="font-size: 0.95em">{{ extractBackupName(snap) }}</strong>
          </div>
          <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 8px">📁 实体文件: {{ snap }}</div>
          <div class="action-bar compact">
            <button class="btn-success tiny" @click="restoreFullBackup(snap)" style="padding: 4px; font-size: 0.85em">
              ✅ 完整覆盖
            </button>
            <button class="btn-danger tiny" @click="deleteFullBackup(snap)" style="padding: 4px; font-size: 0.85em">
              ❌ 删除文件
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { StatusBarManager } from '../../../logic/statusbar_manager';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../../../store/ui_state_store';
// 1. 实例化 Store
const uiStore = useUIStateStore();
// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { 
  allAvailableWorldbooks, 
  currentPrimaryWorldbook
} = storeToRefs(uiStore);

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
    return `备份 - ${match[2]} (${timeStr})`;
  }
  return wbName;
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

const deleteFullBackup = async (backupName: string) => {
  if (confirm(`确定要彻底删除该全量备份文件 (${backupName}) 吗？`)) {
    try {
      await deleteWorldbook(backupName);
      await fetchBackups();
      if (typeof toastr !== 'undefined') toastr.success('备份删除成功');
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('备份删除失败');
      console.error(e);
    }
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
