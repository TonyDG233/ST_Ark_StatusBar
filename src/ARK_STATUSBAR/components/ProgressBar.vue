<template>
  <div class="ark-progress flex flex-col gap-1 w-full relative">
    <!-- 意图标签 -->
    <!-- <div class="absolute -top-4 right-0 bg-error/90 text-on-error text-[calc(8em/14)] px-1 font-mono z-50 opacity-0 hover:opacity-50 pointer-events-none transition-opacity">
      [ProgressBar]
    </div> -->

    <!-- 顶部标签与数值 -->
    <div class="flex justify-between items-end">
      <span class="font-display text-label-caps text-on-surface tracking-widest uppercase">{{ label }}</span>
      <span class="font-code-data text-primary-text">{{ current }} / {{ max }}</span>
    </div>

    <!-- 进度条本体 -->
    <div class="w-full h-[4px] bg-surface-container-high border border-outline-variant relative overflow-hidden">
      <!-- 填充层 -->
      <div
        class="absolute top-0 left-0 h-full bg-primary transition-all duration-300 ease-out"
        :style="{ width: `${percentage}%` }"
      ></div>

      <!-- 刻度线遮罩 (增加机械感) -->
      <div class="absolute inset-0 flex justify-between px-1 opacity-20 pointer-events-none">
        <div class="w-[1px] h-full bg-background" v-for="i in 3" :key="i"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

// ProgressBar: 数据驱动的工业风进度条
const props = withDefaults(
  defineProps<{
    label: string;
    current: number;
    max: number;
  }>(),
  {
    label: 'PROGRESS',
    current: 0,
    max: 100,
  },
);

const percentage = computed(() => {
  if (props.max <= 0) return 0;
  return Math.min(100, Math.max(0, (props.current / props.max) * 100));
});
</script>
