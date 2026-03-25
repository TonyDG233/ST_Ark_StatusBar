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
    <h4 style="margin-top: 0; margin-bottom: 10px">📖 操作历史记录</h4>
    <div v-if="!currentConfig?.commits?.length" class="empty-state">暂无修改记录。</div>
    <ul v-else class="commit-list">
      <li v-for="commit in [...(currentConfig?.commits || [])].reverse()" :key="commit.id" class="commit-item">
        <div class="commit-header">
          <span class="commit-id">#{{ commit.id }}</span>
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
        <div class="commit-actions" style="margin-top: 8px; text-align: right">
          <button
            class="icon-btn tiny"
            style="border: 1px solid var(--SmartThemeBorderColor, #444)"
            @click="revertCommit(commit)"
            title="撤销此条记录的修改"
          >
            ⏪ 撤销
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { configStore, useArkConfig } from '../../../logic/core/config_store';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import {
  allAvailableWorldbooks,
  CONFIG_ENTRY_PREFIX,
  currentPrimaryWorldbook,
  expandedWorldbooks,
  worldbookEntriesCache,
} from '../shared_ui_state';

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

// --- Local UI State for History Tab ---
const newSnapshotName = ref('');
const selectedSnapshotWorldbook = ref('');

const getChangeText = (commit: any, value: boolean) => {
  if (commit.description?.includes('changed type')) {
    return value ? '蓝灯(常驻)' : '绿灯(条件)';
  }
  return value ? '开启' : '关闭';
};

const createSnapshot = async () => {
  const targetWb = selectedSnapshotWorldbook.value || currentPrimaryWorldbook.value;
  if (!targetWb) return;

  const name = newSnapshotName.value.trim() || `快照-${new Date().toLocaleTimeString()}`;
  await manager.worldbook.saveCurrentAsSnapshot(name);
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

    // 如果当前有展开的抽屉，重新拉取内容刷新缓存
    if (currentPrimaryWorldbook.value && expandedWorldbooks.value.includes(currentPrimaryWorldbook.value)) {
      try {
        const entries = await getWorldbook(currentPrimaryWorldbook.value);
        worldbookEntriesCache.value[currentPrimaryWorldbook.value] = entries.filter(
          (e: any) =>
            !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
            !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
        );
      } catch (e) {}
    }
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
  if (confirm('确定要一键还原至初始状态吗？这将清空历史修改记录。')) {
    await manager.worldbook.resetToBaseline();
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
 * 撤销某一次特定的历史修改操作 (类似 git revert)
 */
const revertCommit = async (commit: any) => {
  if (!confirm(`确定要撤销操作: ${commit.description} 吗？`)) return;

  try {
    const targetWorldbook = commit.worldbook || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    // 应用反向变更 (Inverse changes)
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      for (const change of commit.changes) {
        const e = wbEntries.find(x => x.uid === change.uid);
        if (e) {
          if (commit.description.includes('changed type') || commit.description.includes('修改触发类型')) {
            if (!e.strategy) e.strategy = {};
            e.strategy.type = change.from ? 'constant' : 'selective';
            e.constant = change.from;
          } else {
            e.enabled = change.from;
          }
        }
      }
      return wbEntries;
    });

    // 从记录历史中删除该次提交
    const commits = (currentConfig.value?.commits || []).filter((c: any) => c.id !== commit.id);
    configStore.updateConfig({ commits });

    // 如果该世界书的抽屉开着，刷新缓存
    if (expandedWorldbooks.value.includes(targetWorldbook)) {
      const entries = await getWorldbook(targetWorldbook);
      worldbookEntriesCache.value[targetWorldbook] = entries.filter(
        (e: any) =>
          !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
          !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
      );
    }
    if (typeof toastr !== 'undefined') toastr.success('撤销成功并已从记录中移除。');
  } catch (e) {
    console.error('Failed to revert commit', e);
    if (typeof toastr !== 'undefined') toastr.error('撤销失败，详见控制台。');
  }
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
</style>
