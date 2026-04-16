<template>
  <div>
    <!-- 区域 B：操作历史 (Git Log) -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px">
      <h4 style="margin: 0">📖 操作历史记录</h4>
      <button
        v-if="currentConfig?.commits?.length"
        class="icon-btn tiny"
        style="padding: 4px 8px; border: 1px solid var(--SmartThemeBorderColor, #444); background: rgba(0, 0, 0, 0.2)"
        @click="toggleBatchMode"
      >
        {{ isBatchMode ? '退出多选' : '批量多选' }}
      </button>
    </div>

    <div
      style="
        font-size: 0.8em;
        color: var(--SmartThemeBodyColor, rgba(255, 255, 255, 0.6));
        opacity: 0.8;
        margin-bottom: 12px;
        line-height: 1.4;
      "
    >
      <strong style="color: var(--SmartThemeBodyColor, #ccc); font-weight: bold">【恢复】</strong
      >：撤销该记录的操作，将世界书条目的状态回滚，并从这里删除记录。<br />
      <strong style="color: var(--SmartThemeBodyColor, #ccc); font-weight: bold">【删除】</strong
      >：仅清理这条历史记录，但保持世界书现在的状态不变。
    </div>

    <!-- 批量操作工具栏 -->
    <div
      v-if="isBatchMode"
      class="batch-toolbar compact"
      style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        background: rgba(0, 0, 0, 0.2);
        padding: 8px;
        border-radius: 4px;
        border: 1px dashed rgba(255, 255, 255, 0.2);
      "
    >
      <label style="display: flex; align-items: center; gap: 5px; cursor: pointer">
        <input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /> 全选
      </label>
      <div style="display: flex; gap: 8px">
        <button
          class="icon-btn tiny"
          style="border: 1px solid #1e90ff; color: #1e90ff"
          @click="batchRevertCommits"
          :disabled="selectedCommits.length === 0"
        >
          ⏪ 恢复选中
        </button>
        <button
          class="icon-btn tiny"
          style="border: 1px solid #dc3545; color: #ff6b6b"
          @click="batchDeleteCommits"
          :disabled="selectedCommits.length === 0"
        >
          ❌ 删除选中
        </button>
      </div>
    </div>

    <div v-if="!currentConfig?.commits?.length" class="empty-state">暂无修改记录。</div>
    <ul v-else class="commit-list">
      <li
        v-for="commit in [...(currentConfig?.commits || [])].reverse()"
        :key="commit.id"
        class="commit-item"
        :class="{ selectable: isBatchMode }"
        @click="isBatchMode ? toggleSelection(commit.id) : null"
      >
        <div class="commit-header">
          <div style="display: flex; align-items: center; gap: 8px">
            <input v-if="isBatchMode" type="checkbox" :value="commit.id" v-model="selectedCommits" @click.stop />
            <span class="commit-id">#{{ commit.id }}</span>
          </div>
          <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
        </div>
        <div class="commit-desc">{{ commit.description }}</div>
        <div v-if="commit.worldbook" style="font-size: 0.8em; opacity: 0.7; margin-bottom: 5px">
          📁 来源: {{ commit.worldbook }}
          <span v-if="commit.isHeavy" style="color: #ffc107; margin-left: 5px">(重度修改)</span>
        </div>
        <ul class="commit-changes">
          <li v-for="change in commit.changes" :key="change.uid">
            {{ change.comment }} 
            <span v-if="change.path" style="color: #1e90ff">[{{ change.path }}]</span>
            : 
            <span style="color: #dc3545; text-decoration: line-through;">{{ getChangeText(commit, change.from) }}</span>
            <span v-if="change.to !== undefined"> -> <span style="color: #28a745">{{ getChangeText(commit, change.to) }}</span></span>
          </li>
        </ul>
        <div
          v-if="!isBatchMode"
          class="commit-actions"
          style="margin-top: 8px; text-align: right; display: flex; justify-content: flex-end; gap: 8px"
        >
          <button
            class="icon-btn tiny"
            @click.stop="togglePinCommit(commit)"
            :title="commit.isPinned ? '取消保护' : '置顶保护，防止被自动清理'"
            :style="{ border: commit.isPinned ? '1px solid #ffc107' : '1px solid #888', color: commit.isPinned ? '#ffc107' : '#888' }"
          >
            {{ commit.isPinned ? '📌 已保护' : '📍 保护' }}
          </button>
          <button
            class="icon-btn tiny"
            style="border: 1px solid #1e90ff; color: #1e90ff"
            @click.stop="revertCommit(commit)"
            title="撤销修改并还原状态"
          >
            ⏪ 恢复
          </button>
          <button
            class="icon-btn tiny"
            style="border: 1px solid #dc3545; color: #ff6b6b"
            @click.stop="deleteCommit(commit)"
            title="仅删除记录，不改变当前状态"
          >
            ❌ 删除
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { configStore, useArkConfig } from '../../../core/config_store';
import { ArkCommit } from '../../../types/system_config';
import { currentPrimaryWorldbook, UIWorldbookEntry } from '../shared_ui_state';

const currentConfig = useArkConfig();

// --- Batch Operation State ---
const isBatchMode = ref(false);
const selectedCommits = ref<string[]>([]);

const isAllSelected = computed(() => {
  const commits = currentConfig.value?.commits || [];
  return commits.length > 0 && selectedCommits.value.length === commits.length;
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
    selectedCommits.value = (currentConfig.value?.commits || []).map((c: unknown) => (c as ArkCommit).id);
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
  const commits = [...(currentConfig.value?.commits || [])];
  const target = commits.find(c => c.id === commit.id);
  if (target) {
    target.isPinned = !target.isPinned;
    configStore.updateConfig({ commits });
  }
};

const getChangeText = (commit: unknown, value: any) => {
  if (typeof value === 'boolean') {
    if ((commit as ArkCommit).description?.includes('changed type')) {
      return value ? '蓝灯(常驻)' : '绿灯(条件)';
    }
    return value ? '开启' : '关闭';
  }
  if (value === null || value === undefined) return '无';
  if (typeof value === 'object') return '{对象}';
  const str = String(value);
  return str.length > 15 ? str.substring(0, 15) + '...' : str;
};

/**
 * 执行底层世界书状态还原的核心函数
 * 因为可能包含多个 commits 或单条 commit，所以抽离出来复用
 */
const applyInverseChanges = async (commitList: ArkCommit[]) => {
  // 根据目标世界书对 commit 进行分组
  const worldbookGroups = commitList.reduce(
    (acc, curr) => {
      const target = curr.worldbook || currentPrimaryWorldbook.value;
      if (target) {
        if (!acc[target]) acc[target] = [];
        acc[target].push(curr);
      }
      return acc;
    },
    {} as Record<string, ArkCommit[]>,
  );

  for (const [worldName, commits] of Object.entries(worldbookGroups)) {
    // 必须按照提交时间的反序 (从新到老) 来还原
    const sortedCommits = [...commits].sort((a, b) => b.timestamp - a.timestamp);

    // 首先按类型分离：特殊操作（新建/删除世界书或条目）和属性修改
    // 为了保证时序，我们按 commit 依次处理
    for (const commit of sortedCommits) {
      // 检查是否有特殊操作
      const hasSpecialOp = commit.changes.some(c => 
        ['create_worldbook', 'delete_worldbook', 'create_entry', 'delete_entry'].includes(c.path as string)
      );

      if (hasSpecialOp) {
        for (const change of commit.changes) {
          if (change.path === 'create_worldbook') {
            try { await deleteWorldbook(worldName); } catch (e) { console.error('Failed to delete worldbook', e); }
          } else if (change.path === 'delete_worldbook') {
            try { await createWorldbook(worldName, change.from); } catch (e) { console.error('Failed to restore worldbook', e); }
          } else if (change.path === 'create_entry') {
            try { await deleteWorldbookEntries(worldName, entry => entry.uid === change.uid); } catch (e) { console.error('Failed to delete entry', e); }
          } else if (change.path === 'delete_entry') {
            try { await createWorldbookEntries(worldName, [change.from]); } catch (e) { console.error('Failed to restore entry', e); }
          }
        }
      }

      // 处理普通属性修改
      const propChanges = commit.changes.filter(c => 
        !['create_worldbook', 'delete_worldbook', 'create_entry', 'delete_entry'].includes(c.path as string)
      );

      if (propChanges.length > 0) {
        await updateWorldbookWith(worldName, (wbEntries: UIWorldbookEntry[]) => {
          for (const change of propChanges) {
            const e = wbEntries.find(x => x.uid === change.uid);
            if (e) {
              // 对类型的逆向恢复
              if (commit.description.includes('changed type') || commit.description.includes('修改触发类型')) {
                if (!e.strategy)
                  e.strategy = {
                    type: 'selective',
                    keys: [],
                    keys_secondary: { logic: 'and_any', keys: [] },
                    scan_depth: 'same_as_global',
                  };
                e.strategy.type = change.from ? 'constant' : 'selective';
              } else {
                // 对于开关的恢复
                if (e && change.path === undefined) {
                  e.enabled = !!change.from;
                } else if (e && change.path) {
                  // 处理基于路径的属性恢复
                  const pathParts = change.path.split('.');
                  let currentObj: any = e;
                  for (let i = 0; i < pathParts.length - 1; i++) {
                    currentObj = currentObj[pathParts[i]];
                    if (!currentObj) break;
                  }
                  if (currentObj) {
                    currentObj[pathParts[pathParts.length - 1]] = change.from;
                  }
                }
              }
            }
          }
          return wbEntries;
        });
      }
    }

    // 主动通知底层修改
    document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: worldName } }));
  }
};

/**
 * 恢复某一次特定的历史修改操作 (原撤销操作，删除且还原)
 */
const revertCommit = async (commit: ArkCommit) => {
  if (!confirm(`确定要恢复操作: ${commit.description} 吗？`)) return;

  try {
    await applyInverseChanges([commit]);

    // 从记录历史中删除该次提交
    const commits = (currentConfig.value?.commits || []).filter((c: ArkCommit) => c.id !== commit.id);
    configStore.updateConfig({ commits });

    if (typeof toastr !== 'undefined') toastr.success('恢复成功并已从记录中移除。');
  } catch (e) {
    console.error('Failed to revert commit', e);
    if (typeof toastr !== 'undefined') toastr.error('恢复失败，详见控制台。');
  }
};

/**
 * 删除某一次历史记录 (不还原状态)
 */
const deleteCommit = async (commit: ArkCommit) => {
  if (!confirm(`确定要仅删除该记录: ${commit.description} 吗？(当前世界书状态不变)`)) return;
  const commits = (currentConfig.value?.commits || []).filter((c: ArkCommit) => c.id !== commit.id);
  configStore.updateConfig({ commits });
};

/**
 * 批量恢复选中的提交记录
 */
const batchRevertCommits = async () => {
  const commitsToRevert = (currentConfig.value?.commits || []).filter((c: ArkCommit) =>
    selectedCommits.value.includes(c.id),
  );
  if (!commitsToRevert.length) return;

  if (!confirm(`确定要恢复这 ${commitsToRevert.length} 条选中的记录吗？(状态将被还原)`)) return;

  try {
    await applyInverseChanges(commitsToRevert);

    const commits = (currentConfig.value?.commits || []).filter(
      (c: ArkCommit) => !selectedCommits.value.includes(c.id),
    );
    configStore.updateConfig({ commits });
    selectedCommits.value = []; // 操作完清空选中
    isBatchMode.value = false;

    if (typeof toastr !== 'undefined') toastr.success(`成功批量恢复 ${commitsToRevert.length} 条记录。`);
  } catch (e) {
    console.error('Failed to batch revert commits', e);
    if (typeof toastr !== 'undefined') toastr.error('批量恢复失败，详见控制台。');
  }
};

/**
 * 批量删除选中的提交记录 (不还原)
 */
const batchDeleteCommits = async () => {
  const count = selectedCommits.value.length;
  if (!count) return;
  if (!confirm(`确定要删除这 ${count} 条选中的记录吗？(世界书底层状态保持不变)`)) return;

  const commits = (currentConfig.value?.commits || []).filter((c: ArkCommit) => !selectedCommits.value.includes(c.id));
  configStore.updateConfig({ commits });
  selectedCommits.value = [];
  isBatchMode.value = false;
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.commit-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.commit-item {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 10px;
  border-radius: 4px;
}
.commit-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  opacity: 0.7;
  margin-bottom: 5px;
}
.commit-id {
  font-family: monospace;
}
.commit-desc {
  font-weight: bold;
  margin-bottom: 5px;
}
.commit-changes {
  margin: 0;
  padding-left: 20px;
  font-size: 0.9em;
}
.commit-item.selectable {
  cursor: pointer;
  transition: background-color 0.15s;
}
.commit-item.selectable:hover {
  background: rgba(255, 255, 255, 0.08);
}
</style>