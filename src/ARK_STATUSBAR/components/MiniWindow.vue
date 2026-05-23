<template>
  <div class="ark-mini-window w-full bg-surface border-x border-b border-outline-variant flex flex-col relative overflow-hidden" style="max-height: 120px;">
    <!-- 开发意图标签 -->
    <div class="absolute top-0 right-10 bg-error/90 text-on-error text-[calc(8em/14)] px-1 font-mono z-50 pointer-events-none opacity-50">
      [MiniWindow]
    </div>

    <!-- 列表区，无数据时居中显示留白，有数据时可内部滚动 -->
    <div v-if="entries.length === 0" class="flex-1 flex flex-col items-center justify-center opacity-50 p-4">
      <span class="material-symbols-outlined text-outline text-xl mb-1">memory</span>
      <span class="text-[calc(10em/14)] text-outline font-code-data tracking-widest uppercase">STANDBY</span>
    </div>

    <!-- 内部列表：隐藏滚动条但保留滚动能力 -->
    <!-- TODO: [Phase 2] 平常状态下此处应展示基于 DashboardTab 2.3 的“触发记录概览”，而不是目前这样特定条目细节的堆砌 -->
    <ul v-else class="flex-1 overflow-y-auto scrollbar-none flex flex-col gap-1 min-h-0 px-3 py-2">
      <li v-for="(entry, index) in entries" :key="index" class="flex items-center gap-2 py-1 border-b border-outline-variant/30 last:border-0">
        <div class="w-1.5 h-1.5 flex-shrink-0 bg-primary" :class="{ '!bg-error': entry.enabled === false && !entry.tempDisabled }"></div>
        <span class="text-[calc(11em/14)] font-body text-on-surface truncate flex-1 min-w-0" :class="{ 'opacity-50 line-through': entry.enabled === false && !entry.tempDisabled }">{{ entry.name }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// MiniWindow: 悬浮窗态 (紧凑概览)
// 高度自适应，最高不超过 120px，抛弃原版圆润的边框，与 TopBar 合成一体。
withDefaults(defineProps<{
  entries?: { name: string; enabled?: boolean; tempDisabled?: boolean }[];
}>(), {
  entries: () => []
});
</script>
