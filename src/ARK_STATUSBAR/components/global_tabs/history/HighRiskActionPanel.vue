<template>
  <div
    v-if="isArknightsCard"
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
</template>

<script setup lang="ts">
import { StatusBarManager } from '../../../logic/statusbar_manager';
import { configStore } from '../../../store/config_store';

// Pinia化前端数据中心改造
import { storeToRefs } from 'pinia';
import { useUIStateStore } from '../../../store/ui_state_store';
// 1. 实例化 Store
const uiStore = useUIStateStore();
// 2. 解构状态变量（必须用 storeToRefs 保持响应式）
const { 
  allAvailableWorldbooks, 
  currentPrimaryWorldbook, 
  isArknightsCard
} = storeToRefs(uiStore);


const manager = StatusBarManager.getInstance();

const loadWorldbookLists = async () => {
  try {
    allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

const resetToBaseline = async () => {
  if (!currentPrimaryWorldbook.value) {
    if (typeof toastr !== 'undefined') toastr.warning('当前没有主世界书。');
    return;
  }
  if (confirm('确定要一键还原至初始状态吗？这将清空历史修改记录。')) {
    await manager.worldbook.resetToBaseline(currentPrimaryWorldbook.value);
    configStore.updateConfig({ commits: [] });
    await loadWorldbookLists();

    if (typeof toastr !== 'undefined') toastr.success('已恢复基准线。');
  }
};

const closeSingleChar = async () => {
  if (confirm('确定要一键关闭所有单字干员世界书吗？')) {
    await manager.worldbook.closeSingleCharEntries();
    await loadWorldbookLists();
  }
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';
</style>
