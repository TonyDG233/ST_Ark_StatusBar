<template>
  <button
    class="ark-action-toggle relative flex items-center justify-center font-display font-bold transition-all border outline-none cursor-pointer"
    :class="[
      // Size variants
      size === 'sm' ? 'text-[9px] px-1 py-0.5 gap-0.5 rounded-sm' : 'text-xs px-2 py-1 gap-1 rounded',
      // Type/Color variants
      type === 'temp' ? 'text-primary border-primary/40 bg-transparent hover:bg-primary/10' : '',
      type === 'disable' ? 'text-error border-error/40 bg-transparent hover:bg-error/10' : '',
      type === 'enable' || type === 'resume' ? 'text-[#28a745] border-[#28a745]/40 bg-transparent hover:bg-[#28a745]/10' : ''
    ]"
    @click.stop="emit('click')"
  >
    <!-- Visual reset tag -->
    <div class="hidden appearance-none bg-transparent m-0 p-0"></div>

    <!-- Icon -->
    <span class="material-symbols-outlined leading-none -translate-y-[0.5px]" :class="size === 'sm' ? 'text-[11px]' : 'text-sm'">
      {{ type === 'temp' ? 'hourglass_empty' : type === 'disable' ? 'block' : 'check_circle' }}
    </span>
    
    <!-- Text Label -->
    <span class="opacity-90">
      <slot>
        {{ type === 'temp' ? '单次' : type === 'disable' ? '彻底' : type === 'resume' ? '恢复' : '开启' }}
      </slot>
    </span>
  </button>
</template>

<script setup lang="ts">
/**
 * ActionToggle: Unified intercept action toggle button (Single, Permanent, Resume)
 * Designed to prevent host CSS pollution via strict scoped resets.
 */
withDefaults(defineProps<{
  type: 'temp' | 'disable' | 'enable' | 'resume';
  size?: 'sm' | 'md';
}>(), {
  size: 'md'
});

const emit = defineEmits<{
  (e: 'click'): void;
}>();
</script>

<style scoped>
/* Strict CSS Reset against host environment */
.ark-action-toggle {
  background-color: transparent !important;
  box-sizing: border-box !important;
  margin: 0 !important;
}
</style>
