<template>
  <div class="ark-wip-mask absolute inset-0 bg-surface/80 backdrop-blur-[2px] flex items-center justify-center z-10 select-none overflow-hidden">
    <!-- 开发意图标签 -->
    <!-- <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[calc(10em/14)] px-1 font-mono z-50 pointer-events-none opacity-50">
      [WipMask]
    </div> -->

    <!-- 警示条纹装饰 -->
    <div class="absolute inset-0 opacity-10" style="background: repeating-linear-gradient(45deg, transparent, transparent 10px, var(--color-on-surface) 10px, var(--color-on-surface) 20px);"></div>
    
    <!-- 文本容器 -->
    <div class="bg-surface border border-outline px-4 py-2 relative z-20 flex items-center gap-2 shadow-lg">
      <span class="material-symbols-outlined text-on-surface-variant text-sm">construction</span>
      <span class="font-display text-label-caps text-on-surface-variant tracking-widest">{{ text }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
// WipMask: 绝对定位的遮罩，用于覆盖在开发中的功能块上方
withDefaults(defineProps<{
  text?: string;
}>(), {
  text: 'WIP / 敬请期待'
});
</script>
