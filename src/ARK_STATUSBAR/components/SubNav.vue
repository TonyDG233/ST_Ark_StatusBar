<template>
  <nav class="sub-nav z-50 flex items-center p-1 bg-surface-container-highest/90 backdrop-blur-md border border-outline-variant shadow-lg rounded-xl w-max mx-auto">
    <!-- 开发时对齐意图用 -->
    <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-error/90 text-on-error text-[8px] px-1 font-mono opacity-50 pointer-events-none rounded whitespace-nowrap">
      [SubNav]
    </div>

    <!-- 动态渲染的菜单项 -->
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="px-3 py-1.5 flex items-center justify-center gap-1.5 transition-all font-label-caps uppercase tracking-widest cursor-pointer appearance-none outline-none m-0 rounded-lg border-none"
      :class="activeSubTab === tab.id ? 'text-on-primary bg-primary shadow-sm font-bold' : 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-variant'"
      @click="emit('change-sub-tab', tab.id)"
    >
      <span v-if="tab.icon" class="material-symbols-outlined text-[12px] leading-none -translate-y-[0.5px]">{{ tab.icon }}</span>
      <span class="text-[10px]">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
// SubNav: 次级悬浮导航 (通用版)
// 可接收任意数量的 tabs，高度复用

export interface SubNavTab {
  id: string;
  label: string;
  icon?: string;
}

const props = defineProps<{
  activeSubTab: string;
  tabs: SubNavTab[];
}>();

const emit = defineEmits<{
  (e: 'change-sub-tab', tabId: string): void;
}>();
</script>
