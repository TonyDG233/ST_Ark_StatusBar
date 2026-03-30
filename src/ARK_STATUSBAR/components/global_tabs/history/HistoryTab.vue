<template>
  <div class="tab-panel flex-col">
    <!-- 区域 A：快照与高危操作 -->
    <div class="snapshot-panel" style="margin-bottom: 20px">
      <!-- 快照管理顶栏 (黄框介绍) -->
      <div class="warning-box" style="margin-bottom: 0; padding: 10px; border-radius: 6px 6px 0 0; border-bottom: none">
        <strong style="display: block; margin-bottom: 4px">📸 世界书快照管理</strong>
        <p style="margin: 0; font-size: 0.9em; opacity: 0.9">
          在此处可以对任意世界书拍摄（保存）当前所有条目状态的“快照”，并在日后随时无损恢复。
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
              <button
                class="btn-success tiny"
                @click="restoreSnapshot(snap.id)"
                style="padding: 4px; font-size: 0.85em"
              >
                ✅ 恢复
              </button>
              <button class="btn-danger tiny" @click="deleteSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em">
                ❌ 删除
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- 危险操作区域 (白细框包围) -->
      <div
        style="
          margin-top: 15px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 12px;
          background: rgba(0, 0, 0, 0.2);
        "
      >
        <div style="font-size: 0.85em; color: rgba(255, 255, 255, 0.8); margin-bottom: 12px; line-height: 1.4">
          <span style="color: orange; font-weight: bold">⚠️ 角色卡主书专属操作</span><br />
          以下操作仅作用于当前角色的主世界书: <strong>{{ currentPrimaryWorldbook || '无' }}</strong
          >。<br />
          如果需要大规模修改或回滚状态，强烈建议您优先使用上方更安全的【快照】功能。
        </div>

        <div class="action-bar compact" style="flex-wrap: wrap">
          <button
            class="btn-danger tiny"
            @click="resetToBaseline"
            style="flex: 1; min-width: 140px; padding: 8px; font-size: 0.9em"
          >
            ↺ 恢复初始状态 (Baseline)
          </button>
          <button
            class="btn-warning tiny"
            @click="closeSingleChar"
            style="flex: 1; min-width: 140px; padding: 8px; font-size: 0.9em"
          >
            ⚡ 屏蔽所有单字干员
          </button>
        </div>
      </div>
    </div>

    <hr class="record-divider" style="margin-bottom: 15px" />

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
        </div>
        <ul class="commit-changes">
          <li v-for="change in commit.changes" :key="change.uid">
            {{ change.comment }} : {{ getChangeText(commit, change.from) }} ->
            {{ getChangeText(commit, change.to) }}
          </li>
        </ul>
        <div
          v-if="!isBatchMode"
          class="commit-actions"
          style="margin-top: 8px; text-align: right; display: flex; justify-content: flex-end; gap: 8px"
        >
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
import { ArkEventBus } from '../../../core/event_bus';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import { ArkCommit } from '../../../types/system_config';
import { allAvailableWorldbooks, currentPrimaryWorldbook } from '../shared_ui_state';
import { UIWorldbookEntry } from '../shared_ui_state';

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

// --- Local UI State for History Tab ---
const newSnapshotName = ref('');
const selectedSnapshotWorldbook = ref('');

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

const getChangeText = (commit: unknown, value: boolean) => {
  if ((commit as ArkCommit).description?.includes('changed type')) {
    return value ? '蓝灯(常驻)' : '绿灯(条件)';
  }
  return value ? '开启' : '关闭';
};

const createSnapshot = async () => {
  const targetWb = selectedSnapshotWorldbook.value || currentPrimaryWorldbook.value;
  if (!targetWb) return;

  const name = newSnapshotName.value.trim() || `快照-${new Date().toLocaleTimeString()}`;
  await manager.worldbook.saveCurrentAsSnapshot(targetWb, name);
  newSnapshotName.value = '';
};

// 【注意】这里必须暴露出一个更新其他页面状态的逻辑，如果是彻底分离，
// 获取全局挂载列表这些操作也应该抽象到顶层监听中，但现在我们保留原样调用。
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

/**
 * 一键重置当前角色世界书状态到最初的基准线，并清空历史记录
 */
const resetToBaseline = async () => {
  if (!currentPrimaryWorldbook.value) {
    if (typeof toastr !== 'undefined') toastr.warning('当前没有主世界书。');
    return;
  }
  if (confirm('确定要一键还原至初始状态吗？这将清空历史修改记录。')) {
    await manager.worldbook.resetToBaseline(currentPrimaryWorldbook.value);
    configStore.updateConfig({ commits: [] });
    await loadWorldbookLists(); // Refresh

    if (typeof toastr !== 'undefined') toastr.success('已恢复基准线。');
  }
};

/**
 * 一键屏蔽所有单字干员（防止误触）
 */
const closeSingleChar = async () => {
  if (confirm('确定要一键关闭所有单字干员世界书吗？')) {
    await manager.worldbook.closeSingleCharEntries();
    await loadWorldbookLists();
  }
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
    await updateWorldbookWith(worldName, (wbEntries: UIWorldbookEntry[]) => {
      // 必须按照提交时间的反序 (从新到老) 来还原，防止先关后开同一词条导致状态覆盖错误
      const sortedCommits = [...commits].sort((a, b) => b.timestamp - a.timestamp);

      for (const commit of sortedCommits) {
        for (const change of commit.changes) {
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
              // 对于开关的恢复：要明确检查 change.from
              // 原来为 true（开启状态），关闭操作产生了一条从 true -> false 的记录。
              // 现在撤销，就要把状态调回 true。如果是 false->true，撤销就调回 false。
              // 这里用严格赋值确保布尔类型
              e.enabled = !!change.from;
            }
          }
        }
      }
      return wbEntries;
    });

    // 主动通知底层修改
    ArkEventBus.emit('worldbook:data_changed', worldName);
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

.tab-panel.flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.snapshot-panel {
  margin-bottom: 20px;
}

.snapshot-controls {
  border: 1px solid rgba(255, 165, 0, 0.4);
  border-top: none;
  border-radius: 0 0 6px 6px;
  padding: 15px;
  background: rgba(0, 0, 0, 0.15);
}

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
