<template>
  <div class="flex flex-col border border-outline-variant bg-surface-container-low mb-4">
    <!-- Folder Header -->
    <LoreFolderItem
      :title="worldbook.title"
      :count="worldbook.entries.length"
      :bindType="worldbook.bindType"
      :isPinned="worldbook.isPinned"
      :expanded="expanded"
      :globalBatchMode="globalBatchMode"
      @toggle="expanded = !expanded"
    />

    <!-- Collapsible Entry List -->
    <LoreEntryList v-show="expanded" :entries="worldbook.entries" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { LoreEntryData } from '../../../ARK_STATUSBAR/components/worldbook/LoreDataCard.vue';
import LoreEntryList from '../../../ARK_STATUSBAR/components/worldbook/LoreEntryList.vue';
import LoreFolderItem from '../../../ARK_STATUSBAR/components/worldbook/LoreFolderItem.vue';

const props = defineProps<{
  worldbook: {
    id: string;
    title: string;
    bindType: 'char' | 'global' | 'unmounted';
    isPinned: boolean;
    entries: LoreEntryData[];
  };
  globalBatchMode?: boolean;
}>();

// 沙盒模式下的局部状态
const expanded = ref(true); // 默认展开方便测试
</script>

<style scoped></style>
