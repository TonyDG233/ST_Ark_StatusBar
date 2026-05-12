<template>
  <div class="ark-slider flex flex-col gap-1 w-full">
    <div class="flex justify-between items-end">
      <label class="font-display text-[11px] font-bold text-on-surface-variant tracking-widest uppercase">{{ label }}</label>
      <span class="font-mono text-[12px] text-on-surface">{{ displayValue }}</span>
    </div>
    
    <!-- Range Input -->
    <div class="relative w-full h-4 flex items-center group">
      <!-- Custom track background to ensure consistency -->
      <div class="absolute w-full h-1 bg-outline-variant pointer-events-none top-1/2 -translate-y-1/2"></div>
      
      <input
        type="range" 
        :min="min" 
        :max="max" 
        :step="step" 
        v-model="model" 
        class="w-full appearance-none bg-transparent focus:outline-none cursor-pointer relative z-10 m-0 p-0"
      />
    </div>
    
    <!-- Min / Max Labels -->
    <div class="flex justify-between text-[10px] text-outline font-mono">
      <span>{{ minLabel || 'MIN' }}</span>
      <span>{{ maxLabel || 'MAX' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  label: string;
  min: number | string;
  max: number | string;
  step?: number | string;
  minLabel?: string;
  maxLabel?: string;
  valueFormatter?: (val: number) => string;
}>(), {
  step: 1
});

const model = defineModel<number>({ required: true });

const displayValue = computed(() => {
  return props.valueFormatter ? props.valueFormatter(model.value) : model.value;
});
</script>

<style scoped>
/* WebKit (Chrome, Safari, Edge) */
input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 16px;
  width: 8px;
  border-radius: 0;
  background: var(--color-primary);
  cursor: pointer;
  /* Centering the thumb over the 4px track: (16 - 4) / 2 = 6px offset */
  /* Wait, the track is 4px height in the design mockup. My custom track is h-1 (4px) */
  margin-top: 0px; 
}

/* Track styles for WebKit are handled by the absolute div for better customizability, but we must hide default track */
input[type="range"]::-webkit-slider-runnable-track {
  width: 100%;
  height: 16px; /* give it height so the thumb doesn't overflow click area */
  background: transparent;
}

/* Firefox */
input[type="range"]::-moz-range-thumb {
  height: 16px;
  width: 8px;
  border: none;
  border-radius: 0;
  background: var(--color-primary);
  cursor: pointer;
}

input[type="range"]::-moz-range-track {
  width: 100%;
  height: 16px;
  background: transparent;
}
</style>
