<template>
  <div
    class="ark-segmented-control flex border border-outline-variant divide-x divide-outline-variant rounded-sm overflow-hidden w-full"
  >
    <button
      v-for="option in options"
      :key="option.value"
      @click="model = option.value"
      class="flex-1 py-1.5 px-1 flex justify-center items-center gap-1 transition-colors font-display text-[calc(11em/14)] font-bold tracking-widest uppercase"
      :class="
        model === option.value ? 'bg-primary text-on-primary' : 'bg-surface hover:bg-surface-variant text-on-surface'
      "
    >
      <span
        v-if="option.icon"
        class="material-symbols-outlined text-[calc(14em/14)] flex-shrink-0"
        :style="model === option.value ? `font-variation-settings: 'FILL' 1;` : ''"
      >
        {{ option.icon }}
      </span>
      <span class="break-words whitespace-normal leading-tight min-w-0 text-center">{{ option.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts" generic="T extends string | number">
defineProps<{
  options: { label: string; value: T; icon?: string }[];
}>();

const model = defineModel<T>({ required: true });
</script>
