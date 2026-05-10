<template>
  <button 
    class="ark-button relative flex items-center justify-center gap-2 px-4 py-2 font-display font-bold text-sm tracking-widest transition-all overflow-hidden group border"
    :class="[
      variant === 'primary' ? 'bg-primary text-on-primary border-primary hover:bg-primary-container' : '',
      variant === 'outline' ? 'bg-transparent text-primary border-outline hover:border-primary hover:bg-primary/10' : '',
      variant === 'ghost' ? 'bg-transparent text-on-surface-variant border-transparent hover:text-on-surface hover:bg-surface-variant' : '',
      disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
    ]"
    :disabled="disabled"
  >
    <!-- 可视化意图标签 -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[8px] px-1 font-mono z-50 opacity-0 group-hover:opacity-50 pointer-events-none transition-opacity">
      [Button]
    </div>

    <!-- 图标区 -->
    <span v-if="icon" class="material-symbols-outlined text-[1.2em] leading-none">{{ icon }}</span>
    
    <!-- 文本区 -->
    <span><slot></slot></span>
    
    <!-- 右下角方舟风切角装饰 (仅在 Primary/Outline 且非 Ghost 时显示) -->
    <div v-if="variant !== 'ghost'" class="absolute bottom-0 right-0 w-2 h-2 bg-background transform translate-x-1 translate-y-1 rotate-45 border-l border-t" :class="variant === 'primary' ? 'border-primary' : 'border-outline group-hover:border-primary'"></div>
  </button>
</template>

<script setup lang="ts">
// Button: 方舟风格交互按钮
withDefaults(defineProps<{
  variant?: 'primary' | 'outline' | 'ghost';
  icon?: string;
  disabled?: boolean;
}>(), {
  variant: 'outline',
  disabled: false
});
</script>
