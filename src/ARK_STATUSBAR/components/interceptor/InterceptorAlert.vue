<template>
  <div
    v-if="!isTestMode"
    class="w-full border border-error bg-surface-container-low relative overflow-hidden flex flex-row flex-shrink-0 mt-1"
  >
    <!-- Danger Strip -->
    <div
      class="bg-error text-on-error w-6 flex flex-col items-center justify-center py-2 font-mono font-bold tracking-widest gap-2 flex-shrink-0 relative z-20"
    >
      <span class="material-symbols-outlined text-on-error text-sm" style="font-variation-settings: 'FILL' 1"
        >warning</span
      >
      <span class="[writing-mode:vertical-rl] rotate-180 uppercase text-[calc(10em/14)] whitespace-nowrap"
        >CRITICAL_ALERT</span
      >
    </div>
    <!-- Alert Content -->
    <div class="p-2 flex-1 min-w-0 relative z-20 flex flex-col justify-center">
      <h2 class="font-display text-error uppercase text-sm font-bold mb-1 tracking-wider">拦截已触发</h2>
      <p class="font-body text-on-surface-variant text-xs leading-snug mb-2 whitespace-normal">
        系统已阻断新上下文数据的注入。以下挂载条目被当前对话内容触发，需进行确认与过滤。
      </p>
      <div
        class="font-mono text-error flex flex-wrap gap-x-4 gap-y-1 text-[calc(10em/14)] border-t border-error/30 pt-1.5 mt-auto"
      >
        <div><span class="opacity-50">被拦截总数:</span> {{ count }}</div>
        <div>
          <span class="opacity-50">预计 Token:</span>
          {{ typeof tokenCount === 'string' ? tokenCount : '~' + tokenCount + ' tok' }}
        </div>
      </div>
    </div>
    <!-- Decorative Stripes -->
    <div
      class="absolute inset-0 z-0 opacity-10 pointer-events-none"
      style="
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          currentColor 10px,
          currentColor 20px
        );
        color: var(--color-error);
      "
    ></div>
  </div>

  <!-- Test Mode Banner -->
  <div
    v-else
    class="w-full border border-primary bg-surface-container-low relative overflow-hidden flex flex-row flex-shrink-0 mt-1"
  >
    <!-- Info Strip -->
    <div
      class="bg-primary text-on-primary w-6 flex flex-col items-center justify-center py-2 font-mono font-bold tracking-widest gap-2 flex-shrink-0 relative z-20"
    >
      <span class="material-symbols-outlined text-on-primary text-sm" style="font-variation-settings: 'FILL' 1"
        >search</span
      >
      <span class="[writing-mode:vertical-rl] rotate-180 uppercase text-[calc(10em/14)] whitespace-nowrap"
        >TEST_RESULTS</span
      >
    </div>
    <!-- Alert Content -->
    <div class="p-2 flex-1 min-w-0 relative z-20 flex flex-col justify-center">
      <h2 class="font-display text-primary-text uppercase text-sm font-bold mb-1 tracking-wider">主动检测结果</h2>
      <p class="font-body text-on-surface-variant text-xs leading-snug mb-2 whitespace-normal">
        根据当前上下文，模拟检测触发了以下条目：
      </p>
      <div
        class="font-mono text-primary-text flex flex-wrap gap-x-4 gap-y-1 text-[calc(10em/14)] border-t border-primary/30 pt-1.5 mt-auto"
      >
        <div><span class="opacity-50">预测触发:</span> {{ count }}</div>
        <div>
          <span class="opacity-50">预计 Token:</span>
          {{ typeof tokenCount === 'string' ? tokenCount : '~' + tokenCount + ' tok' }}
        </div>
      </div>
    </div>
    <div
      class="absolute inset-0 z-0 opacity-10 pointer-events-none"
      style="
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          currentColor 10px,
          currentColor 20px
        );
        color: var(--color-primary);
      "
    ></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isTestMode: boolean;
  count: number;
  tokenCount: number | string;
}>();
</script>
