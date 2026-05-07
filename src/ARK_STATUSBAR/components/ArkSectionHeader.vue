<template>
  <div class="ark-section-header flex flex-col relative">
    <!-- 意图标签 -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[8px] px-1 font-mono z-50 opacity-0 hover:opacity-50 pointer-events-none transition-opacity">
      [ArkSectionHeader]
    </div>

    <!-- 主标题栏 -->
    <div class="flex items-center gap-2">
      <!-- 装饰方块 -->
      <div v-if="showDecoration" class="w-1.5 h-4 bg-primary"></div>
      
      <div class="flex flex-col">
        <span class="font-display text-label-caps text-on-surface-variant tracking-widest uppercase">{{ subtitle }}</span>
        <h3 class="font-display text-lg font-bold text-on-surface tracking-wide">{{ title }}</h3>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// ArkSectionHeader: 带有工业风排版的区块头部
withDefaults(defineProps<{
  title: string;
  subtitle?: string;
  showDecoration?: boolean;
}>(), {
  subtitle: 'SYSTEM_DATA',
  showDecoration: false
});
</script>
