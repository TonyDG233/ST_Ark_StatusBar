<template>
  <div class="flex flex-col flex-shrink-0 mt-4">
    <!-- Section Title & Tools -->
    <div class="flex flex-col gap-2 pb-2 border-b border-outline-variant mb-4">
      <div class="font-display text-[11px] font-bold tracking-widest uppercase text-on-surface-variant flex justify-between items-center px-1 flex-wrap gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <span>COMMIT_LOG / 操作历史</span>
          <div class="text-[9px] px-1.5 py-0.5 rounded-sm bg-error/10 text-error border border-error/20 flex items-center gap-1 font-mono normal-case tracking-normal shrink-0 whitespace-normal">
            <span class="material-symbols-outlined text-[10px]">warning</span>
            重度修改额度: {{ heavyCommitsCount }}/{{ maxHeavy }}
          </div>
        </div>
        <span class="text-[9px] opacity-70">{{ currentConfig?.commits?.length || 0 }} 条记录</span>
      </div>
      
      <!-- Filter and Batch Tools -->
      <div class="flex flex-wrap items-center justify-between gap-2 bg-surface-variant/30 p-2 border border-outline-variant/50 min-w-0">
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="material-symbols-outlined text-[14px] text-on-surface-variant shrink-0">filter_list</span>
          <select v-model="selectedFilter" class="bg-surface text-[11px] text-on-surface border border-outline-variant px-1 py-0.5 flex-1 min-w-0 outline-none w-full">
            <option value="all">显示全部 ({{ currentConfig?.commits?.length || 0 }})</option>
            <option v-for="filter in availableFilters" :key="filter.value" :value="filter.value">
              {{ filter.label }} ({{ filter.count }})
            </option>
          </select>
        </div>
        <button v-if="currentConfig?.commits?.length"
                class="border border-outline-variant px-2 py-0.5 text-[10px] uppercase tracking-wider text-on-surface hover:bg-surface-variant whitespace-nowrap shrink-0 transition-colors"
                @click="toggleBatchMode">
          {{ isBatchMode ? '退出多选' : '批量多选' }}
        </button>
      </div>

      <!-- Batch Action Bar -->
      <div v-if="isBatchMode" class="flex flex-wrap justify-between items-center gap-2 mt-2 bg-surface-variant/30 p-2 border border-dashed border-outline-variant/50">
        <label class="flex items-center gap-2 cursor-pointer text-[11px] text-on-surface group">
          <input type="checkbox" :checked="isAllSelected" class="hidden peer" @change="toggleSelectAll" />
          <div class="w-3.5 h-3.5 border border-outline-variant bg-surface rounded-sm flex items-center justify-center peer-checked:bg-primary peer-checked:border-primary transition-colors group-hover:border-primary/50">
            <span v-if="isAllSelected" class="material-symbols-outlined text-[12px] text-on-primary font-bold">check</span>
          </div>
          全选
        </label>
        <div class="flex gap-2">
          <ActionToggle type="restore" @click="batchRevertCommits" :disabled="selectedCommits.length === 0">恢复选中</ActionToggle>
          <ActionToggle type="delete" @click="batchDeleteCommits" :disabled="selectedCommits.length === 0">删除选中</ActionToggle>
        </div>
      </div>
    </div>

    <!-- Timeline Items Container -->
    <div v-if="!currentConfig?.commits?.length" class="text-[11px] text-on-surface-variant p-4 text-center opacity-70">
      暂无修改记录。
    </div>
    <div v-else-if="filteredCommits.length === 0" class="text-[11px] text-on-surface-variant p-4 text-center opacity-70">
      没有符合当前筛选条件的记录。
    </div>
    <div v-else class="relative flex flex-col ml-1 pl-4 pb-4 border-l border-outline-variant border-dashed">
      <HistoryCommitItem
        v-for="commit in filteredCommits"
        :key="commit.id"
        :commitId="commit.id"
        :time="new Date(commit.timestamp).toLocaleString()"
        :title="commit.description"
        :source="commit.worldbook"
        :isPinned="commit.isPinned"
        :isHeavy="commit.isHeavy"
        :isBatchMode="isBatchMode"
        :isSelected="selectedCommits.includes(commit.id)"
        :changes="mapChanges(commit)"
        @togglePin="togglePinCommit(commit)"
        @restore="revertCommit(commit)"
        @delete="deleteCommit(commit)"
        @toggleSelection="toggleSelection(commit.id)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref, watch } from 'vue';
import ActionToggle from '../../../components/ActionToggle.vue';
import HistoryCommitItem from '../../../components/history/HistoryCommitItem.vue';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { useArkConfig } from '../../../store/config_store';
import { useUIStateStore } from '../../../store/ui_state_store';
import { ArkCommit } from '../../../types/system_config';

const uiStore = useUIStateStore();
const { currentPrimaryWorldbook } = storeToRefs(uiStore);

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

const heavyCommitsCount = computed(() => currentConfig.value?.commits?.filter(c => c.isHeavy).length || 0);
const maxHeavy = computed(() => currentConfig.value?.maxHeavyHistoryCommits || 20);

const selectedFilter = ref<string>('all');

const pathLabels: Record<string, string> = {
  enabled: '状态开关 (Enabled)',
  name: '条目名称 (Name)',
  'strategy.type': '触发类型',
  'strategy.keys': '主关键词',
  'strategy.keys_secondary.logic': '次要关键词逻辑',
  'strategy.keys_secondary.keys': '次要关键词',
  'position.type': '插入位置类型',
  'position.order': '插入顺序',
  'position.role': '插入角色',
  'position.depth': '插入深度',
  probability: '触发概率',
  'recursion.prevent_incoming': '递归: 阻止传入',
  'recursion.prevent_outgoing': '递归: 阻止传出',
  'recursion.delay_until': '递归: 延迟直到',
  content: '条目内容',
  create_entry: '新建条目',
  delete_entry: '删除条目',
  create_worldbook: '新建世界书',
  delete_worldbook: '删除世界书',
};

const getChangePath = (commit: ArkCommit, change: any) => {
  if (change.path) return change.path as string;
  if (commit.description?.includes('changed type') || commit.description?.includes('修改触发类型')) {
    return 'strategy.type';
  }
  return 'enabled';
};

const availableFilters = computed(() => {
  const commits = currentConfig.value?.commits || [];
  const counts: Record<string, number> = {};

  commits.forEach(c => {
    const pathsInCommit = new Set<string>();
    c.changes.forEach(ch => {
      pathsInCommit.add(getChangePath(c, ch));
    });

    pathsInCommit.forEach(path => {
      counts[path] = (counts[path] || 0) + 1;
    });
  });

  return Object.keys(counts)
    .map(path => ({
      value: path,
      label: pathLabels[path] || path,
      count: counts[path],
    }))
    .sort((a, b) => b.count - a.count);
});

const filteredCommits = computed(() => {
  let commits = [...(currentConfig.value?.commits || [])];
  
  if (selectedFilter.value !== 'all') {
    commits = commits.filter(commit => {
      return commit.changes.some(change => {
        return getChangePath(commit, change) === selectedFilter.value;
      });
    });
  }

  // 先按时间倒序排（最新的在前），再将置顶的提升到最前
  return commits.sort((a, b) => {
    if (!!a.isPinned !== !!b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    const timeA = Number(a.timestamp) || 0;
    const timeB = Number(b.timestamp) || 0;
    return timeB - timeA;
  });
});

watch(selectedFilter, () => {
  selectedCommits.value = [];
});

const isBatchMode = ref(false);
const selectedCommits = ref<string[]>([]);

const isAllSelected = computed(() => {
  return filteredCommits.value.length > 0 && selectedCommits.value.length === filteredCommits.value.length;
});

const toggleBatchMode = () => {
  isBatchMode.value = !isBatchMode.value;
  if (!isBatchMode.value) {
    selectedCommits.value = [];
  }
};

const toggleSelectAll = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    selectedCommits.value = filteredCommits.value.map((c: ArkCommit) => c.id);
  } else {
    selectedCommits.value = [];
  }
};

const toggleSelection = (id: string) => {
  const idx = selectedCommits.value.indexOf(id);
  if (idx === -1) {
    selectedCommits.value.push(id);
  } else {
    selectedCommits.value.splice(idx, 1);
  }
};

const togglePinCommit = (commit: ArkCommit) => {
  manager.history.togglePinCommit(commit.id);
};

const getChangeText = (commit: unknown, value: any) => {
  if (typeof value === 'boolean') {
    if ((commit as ArkCommit).description?.includes('changed type') || (commit as ArkCommit).description?.includes('修改触发类型') || (commit as ArkCommit).description?.includes('切换灯色')) {
      return value ? '蓝灯(常驻)' : '绿灯(条件)';
    }
    return value ? '开启' : '关闭';
  }
  if (value === null || value === undefined) return '无';
  if (typeof value === 'object') return '{对象}';
  const str = String(value);
  return str.length > 15 ? str.substring(0, 15) + '...' : str;
};

const mapChanges = (commit: ArkCommit) => {
  return commit.changes.map(change => ({
    label: change.comment || '',
    path: change.path,
    from: getChangeText(commit, change.from),
    to: getChangeText(commit, change.to)
  }));
};

const revertCommit = async (commit: ArkCommit) => {
  if (!confirm(`确定要恢复操作: ${commit.description} 吗？`)) return;

  try {
    await manager.history.revertCommit(commit, currentPrimaryWorldbook.value);
    if (typeof toastr !== 'undefined') toastr.success('恢复成功并已从记录中移除。');
  } catch (e) {
    console.error('Failed to revert commit', e);
    if (typeof toastr !== 'undefined') toastr.error('恢复失败，详见控制台。');
  }
};

const deleteCommit = async (commit: ArkCommit) => {
  if (!confirm(`确定要仅删除该记录: ${commit.description} 吗？(当前世界书状态不变)`)) return;
  manager.history.deleteCommit(commit.id);
};

const batchRevertCommits = async () => {
  const commitsToRevert = (currentConfig.value?.commits || []).filter((c: ArkCommit) =>
    selectedCommits.value.includes(c.id),
  );
  if (!commitsToRevert.length) return;

  if (!confirm(`确定要恢复这 ${commitsToRevert.length} 条选中的记录吗？(状态将被还原)`)) return;

  try {
    await manager.history.batchRevertCommits(selectedCommits.value, currentPrimaryWorldbook.value);
    
    selectedCommits.value = [];
    isBatchMode.value = false;

    if (typeof toastr !== 'undefined') toastr.success(`成功批量恢复 ${commitsToRevert.length} 条记录。`);
  } catch (e) {
    console.error('Failed to batch revert commits', e);
    if (typeof toastr !== 'undefined') toastr.error('批量恢复失败，详见控制台。');
  }
};

const batchDeleteCommits = async () => {
  const count = selectedCommits.value.length;
  if (!count) return;
  if (!confirm(`确定要删除这 ${count} 条选中的记录吗？(世界书底层状态保持不变)`)) return;

  manager.history.batchDeleteCommits(selectedCommits.value);
  selectedCommits.value = [];
  isBatchMode.value = false;
};
</script>

<style scoped>
</style>
