<template>
  <header class="ark-top-bar w-full max-w-full min-w-0 flex justify-between items-center px-4 bg-surface border-b border-outline-variant flex-shrink-0 select-none cursor-grab active:cursor-grabbing transition-all duration-300 overflow-hidden"
          :class="isMini ? 'h-8' : 'h-12'">
    <!-- 开发标签 -->
    <div class="absolute top-0 right-10 bg-error/90 text-on-error text-[8px] px-1 font-mono z-50 pointer-events-none opacity-50">
      [ArkTopBar]
    </div>

    <!-- 左侧标题与图标 -->
    <div class="flex items-center gap-2 text-primary font-display font-bold tracking-widest uppercase truncate min-w-0 flex-1">
      <span v-if="icon" class="material-symbols-outlined flex-shrink-0 transition-all duration-300" :class="isMini ? 'text-[14px]' : 'text-[20px]'">{{ icon }}</span>
      <!-- 动态标题样式转换 -->
      <span class="truncate transition-all duration-300 min-w-0"
            :class="isMini ? 'text-[10px] font-code-data text-on-surface-variant tracking-widest' : 'text-sm'">
        {{ title }}
      </span>
    </div>

    <!-- 右侧操作区 -->
    <div class="flex items-center gap-3 flex-shrink-0 text-on-surface mr-1">
      <slot name="actions"></slot>
      
      <!-- 原版四角折叠切换按钮 (样式已迁移至 scoped) -->
      <button
        class="toggle-btn"
        :class="{ 'is-mini': isMini }"
        @click.stop="emit('toggle-minimize')"
        title="折叠/展开"
      >
        <div class="corner top-left"></div>
        <div class="corner top-right"></div>
        <div class="corner bottom-left"></div>
        <div class="corner bottom-right"></div>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
// ArkTopBar: 全局顶部标题与拖拽控制栏
withDefaults(defineProps<{
  title?: string;
  icon?: string;
  isMini?: boolean;
}>(), {
  title: 'RHODES_MANAGEMENT_SYS',
  icon: 'menu_book',
  isMini: false
});

const emit = defineEmits<{
  (e: 'toggle-minimize'): void;
}>();
</script>

<style scoped>
/* --- 伸缩按钮样式 (The 4-corner Box) --- */
.toggle-btn {
  position: relative;
  width: 20px !important;
  height: 20px !important;
  padding: 0 !important;
  margin: 0 !important;
  box-sizing: border-box !important;
  background: transparent !important;
  border: none !important;
  color: inherit;
  cursor: pointer;
  appearance: none;
}

.toggle-btn:hover {
  color: var(--color-primary);
}

.toggle-btn .corner {
  position: absolute;
  width: 5px;
  height: 5px;
  border-color: currentColor;
  border-style: solid;
  border-width: 0;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-btn .top-left {
  top: 3px;
  left: 3px;
  border-top-width: 1.5px;
  border-left-width: 1.5px;
}

.toggle-btn .top-right {
  top: 3px;
  right: 3px;
  border-top-width: 1.5px;
  border-right-width: 1.5px;
}

.toggle-btn .bottom-left {
  bottom: 3px;
  left: 3px;
  border-bottom-width: 1.5px;
  border-left-width: 1.5px;
}

.toggle-btn .bottom-right {
  bottom: 3px;
  right: 3px;
  border-bottom-width: 1.5px;
  border-right-width: 1.5px;
}

/* 放大状态：直角朝外 */
.toggle-btn:not(.is-mini) .top-left {
  transform: translate(-2px, -2px);
}

.toggle-btn:not(.is-mini) .top-right {
  transform: translate(2px, -2px);
}

.toggle-btn:not(.is-mini) .bottom-left {
  transform: translate(-2px, 2px);
}

.toggle-btn:not(.is-mini) .bottom-right {
  transform: translate(2px, 2px);
}

/* 缩小状态：直角朝内 */
.toggle-btn.is-mini .top-left {
  transform: translate(2px, 2px) rotate(180deg);
}

.toggle-btn.is-mini .top-right {
  transform: translate(-2px, 2px) rotate(180deg);
}

.toggle-btn.is-mini .bottom-left {
  transform: translate(2px, -2px) rotate(180deg);
}

.toggle-btn.is-mini .bottom-right {
  transform: translate(-2px, -2px) rotate(180deg);
}
</style>
