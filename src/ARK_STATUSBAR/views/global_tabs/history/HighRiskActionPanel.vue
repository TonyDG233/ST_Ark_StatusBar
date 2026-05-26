<template>
  <HistoryActionCard
    v-if="isArknightsCard"
    label="CRITICAL"
    title="恢复基准状态 (Reset Baseline)"
    description="一键还原至初始状态，这将清空所有历史修改记录。操作仅作用于当前主书。"
    icon="warning"
    type="danger"
  >
    <div class="flex gap-2 flex-wrap">
      <button
        @click="resetToBaseline"
        class="flex-1 min-w-[140px] bg-error/20 text-error border border-error/50 font-bold px-3 py-2 text-[calc(11em/14)] hover:bg-error/30 transition-colors outline-none flex justify-center items-center gap-1 text-center"
      >
        <span class="material-symbols-outlined text-[calc(14em/14)]">settings_backup_restore</span> 恢复初始状态
        (Baseline)
      </button>
      <button
        @click="closeSingleChar"
        class="flex-1 min-w-[140px] bg-[#ffc107]/20 text-[#ffc107] border border-[#ffc107]/50 font-bold px-3 py-2 text-[calc(11em/14)] hover:bg-[#ffc107]/30 transition-colors outline-none flex justify-center items-center gap-1 text-center"
      >
        <span class="material-symbols-outlined text-[calc(14em/14)]">bolt</span> 屏蔽所有单字干员
      </button>
    </div>
  </HistoryActionCard>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import HistoryActionCard from '../../../components/history/HistoryActionCard.vue';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { configStore } from '../../../store/config_store';
import { useUIStateStore } from '../../../store/ui_state_store';

const uiStore = useUIStateStore();
const { allAvailableWorldbooks, currentPrimaryWorldbook, isArknightsCard } = storeToRefs(uiStore);

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

<style scoped></style>
