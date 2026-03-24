<template>
  <div class="tab-panel flex-col">
    <!-- 区域 A：快照与高危操作 -->
    <div class="snapshot-panel" style="margin-bottom: 20px;">
      
      <!-- 快照管理顶栏 (黄框介绍) -->
      <div class="warning-box" style="margin-bottom: 0; padding: 10px; border-radius: 6px 6px 0 0; border-bottom: none;">
        <strong style="display: block; margin-bottom: 4px;">📸 世界书快照管理</strong>
        <p style="margin: 0; font-size: 0.9em; opacity: 0.9;">
          在此处可以对任意世界书拍摄（保存）当前所有条目状态的“快照”，并在日后随时无损恢复。
        </p>
      </div>

      <!-- 实际的快照操作区域 -->
      <div class="snapshot-controls" style="border: 1px solid rgba(255, 165, 0, 0.4); border-top: none; border-radius: 0 0 6px 6px; padding: 15px; background: rgba(0,0,0,0.15);">
        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px;">
          <select v-model="selectedSnapshotWorldbook" class="filter-select" style="width: 100%;">
            <option value="">选择要拍摄的世界书 (默认主书)</option>
            <option v-for="wbName in allAvailableWorldbooks" :key="wbName" :value="wbName">{{ wbName }}</option>
          </select>
          <div style="display: flex; gap: 8px;">
            <input type="text" v-model="newSnapshotName" placeholder="输入快照名称 (留空自动生成时间戳)..." class="search-input" style="flex: 1;" />
            <button class="btn-primary" @click="createSnapshot" style="padding: 6px 12px; white-space: nowrap;">拍摄快照</button>
          </div>
        </div>
        
        <div v-if="!config?.snapshots?.length" class="empty-state" style="padding: 10px;">暂无保存的快照。</div>
        <ul v-else class="entry-list read-only" style="margin: 0; max-height: 200px; overflow-y: auto;">
          <li v-for="snap in config?.snapshots" :key="snap.id" style="flex-direction: column; align-items: stretch; background: rgba(255,255,255,0.05); margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
              <strong style="font-size: 0.95em;">{{ snap.name }}</strong>
              <span style="font-size: 0.8em; opacity: 0.7;">{{ new Date(snap.timestamp).toLocaleString() }}</span>
            </div>
            <div style="font-size: 0.8em; opacity: 0.7; margin-bottom: 8px;">📁 来源: {{ snap.worldbook }}</div>
            <div class="action-bar compact">
              <button class="btn-success tiny" @click="restoreSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em;">✅ 恢复</button>
              <button class="btn-danger tiny" @click="deleteSnapshot(snap.id)" style="padding: 4px; font-size: 0.85em;">❌ 删除</button>
            </div>
          </li>
        </ul>
      </div>
      
      <!-- 危险操作区域 (白细框包围) -->
      <div style="margin-top: 15px; border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 12px; background: rgba(0,0,0,0.2);">
        <div style="font-size: 0.85em; color: rgba(255, 255, 255, 0.8); margin-bottom: 12px; line-height: 1.4;">
          <span style="color: orange; font-weight: bold;">⚠️ 角色卡主书专属操作</span><br/>
          以下操作仅作用于当前角色的主世界书: <strong>{{ currentPrimaryWorldbook || '无' }}</strong>。<br/>
          如果需要大规模修改或回滚状态，强烈建议您优先使用上方更安全的【快照】功能。
        </div>

        <div class="action-bar compact">
          <button class="btn-danger tiny" @click="emit('restore-baseline')" style="flex: 1; padding: 8px; font-size: 0.9em">
            ↺ 恢复初始状态 (Baseline)
          </button>
          <button class="btn-warning tiny" @click="emit('close-single-char')" style="flex: 1; padding: 8px; font-size: 0.9em">
            ⚡ 屏蔽所有单字干员
          </button>
        </div>
      </div>
    </div>

    <hr class="record-divider" style="margin-bottom: 15px;" />
    
    <!-- 区域 B：操作历史 (Git Log) -->
    <h4 style="margin-top: 0; margin-bottom: 10px;">📖 操作历史记录</h4>
    <div v-if="!config?.commits?.length" class="empty-state">暂无修改记录。</div>
    <ul v-else class="commit-list">
      <li v-for="commit in [...(config?.commits || [])].reverse()" :key="commit.id" class="commit-item">
        <div class="commit-header">
          <span class="commit-id">#{{ commit.id }}</span>
          <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
        </div>
        <div class="commit-desc">{{ commit.description }}</div>
        <div v-if="commit.worldbook" style="font-size: 0.8em; opacity: 0.7; margin-bottom: 5px;">📁 来源: {{ commit.worldbook }}</div>
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
            @click="emit('revert-commit', commit)"
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
import type { ArkConfig } from '../../config/system_config';

const props = defineProps<{
  config: ArkConfig | null;
  allAvailableWorldbooks: string[];
  currentPrimaryWorldbook: string | null;
}>();

const emit = defineEmits<{
  (e: 'save-snapshot', targetWb: string, name: string): void;
  (e: 'restore-snapshot', id: string): void;
  (e: 'delete-snapshot', id: string): void;
  (e: 'restore-baseline'): void;
  (e: 'close-single-char'): void;
  (e: 'revert-commit', commit: any): void;
}>();

const selectedSnapshotWorldbook = ref('');
const newSnapshotName = ref('');

const createSnapshot = () => {
  const targetWb = selectedSnapshotWorldbook.value || props.currentPrimaryWorldbook;
  if (!targetWb) return;
  
  const name = newSnapshotName.value.trim() || `快照-${new Date().toLocaleTimeString()}`;
  emit('save-snapshot', targetWb, name);
  newSnapshotName.value = '';
};

const restoreSnapshot = (id: string) => {
  if (confirm('确定要恢复到此快照的状态吗？')) {
    emit('restore-snapshot', id);
  }
};

const deleteSnapshot = (id: string) => {
  if (confirm('确定要删除此快照吗？')) {
    emit('delete-snapshot', id);
  }
};

const getChangeText = (commit: any, value: boolean) => {
  if (commit.description?.includes('changed type')) {
    return value ? '蓝灯(常驻)' : '绿灯(条件)';
  }
  return value ? '开启' : '关闭';
};
</script>

<style scoped>
@import '../styles/theme.scss';

.tab-panel.flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.warning-box {
  background: rgba(255, 165, 0, 0.2);
  border-left: 4px solid orange;
  padding: 10px;
  margin-bottom: 15px;
}

.empty-state {
  text-align: center;
  padding: 20px;
  opacity: 0.7;
}

.search-input {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}

.filter-select {
  flex: 1;
  padding: 6px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0 0 15px 0;
}

.entry-list.read-only li {
  opacity: 0.8;
}

.entry-list li {
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 5px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-bar.compact {
  gap: 5px;
  display: flex;
}

.record-divider {
  border: none;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  margin: 15px 0;
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
.icon-btn.tiny {
  font-size: 0.9em;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  margin-right: 5px;
}

.icon-btn.tiny:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
