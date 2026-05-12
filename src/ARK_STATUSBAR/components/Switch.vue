<template>
  <button 
    class="ark-switch relative w-9 h-5 rounded-none flex items-center transition-colors border outline-none cursor-pointer p-0 m-0 shrink-0"
    :class="model ? 'bg-primary border-primary' : 'bg-transparent border-outline-variant hover:border-outline'"
    @click="model = !model"
  >
    <div 
      class="absolute w-3.5 h-3.5 bg-background transition-transform duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
      :class="model ? 'translate-x-[18px]' : 'translate-x-[3px] bg-outline'"
    ></div>
  </button>
</template>

<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
</script>
