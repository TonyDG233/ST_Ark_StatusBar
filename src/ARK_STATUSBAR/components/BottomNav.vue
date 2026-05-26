<template>
  <nav
    class="ark-bottom-nav w-full max-w-full min-w-0 overflow-hidden flex flex-shrink-0 border-t border-outline-variant bg-surface relative"
  >
    <!-- 开发时对齐意图用 -->
    <!-- <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-error/90 text-on-error text-[calc(10em/14)] px-1 font-mono z-50 opacity-50 pointer-events-none">
      [BottomNav]
    </div> -->

    <!-- 菜单 1: Dashboard (主页) -->
    <button
      class="flex-1 py-2 flex flex-col items-center justify-center transition-all group border-t-2 bg-surface-container hover:bg-surface-container-high hover:shadow-[0_-5px_15px_rgba(0,0,0,0.3)]"
      :class="activeTab === 'dashboard' ? 'border-primary' : 'border-transparent'"
      @click="emit('change-tab', 'dashboard')"
    >
      <span
        class="material-symbols-outlined transition-colors text-[calc(20em/14)]"
        :class="activeTab === 'dashboard' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >dashboard</span
      >
      <span
        class="text-[calc(10em/14)] mt-0.5 font-bold tracking-widest transition-colors"
        :class="activeTab === 'dashboard' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >主页</span
      >
    </button>

    <!-- 菜单 2: Worldbook (世界书) -->
    <button
      class="flex-1 py-2 flex flex-col items-center justify-center transition-all group border-t-2 bg-surface-container hover:bg-surface-container-high hover:shadow-[0_-5px_15px_rgba(0,0,0,0.3)]"
      :class="activeTab === 'worldbook' ? 'border-primary' : 'border-transparent'"
      @click="emit('change-tab', 'worldbook')"
    >
      <span
        class="material-symbols-outlined transition-colors text-[calc(20em/14)]"
        :class="activeTab === 'worldbook' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >menu_book</span
      >
      <span
        class="text-[calc(10em/14)] mt-0.5 font-bold tracking-widest transition-colors"
        :class="activeTab === 'worldbook' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >世界书</span
      >
    </button>

    <!-- 菜单 3: Misc (多功能) -->
    <button
      class="flex-1 py-2 flex flex-col items-center justify-center transition-all group border-t-2 bg-surface-container hover:bg-surface-container-high hover:shadow-[0_-5px_15px_rgba(0,0,0,0.3)]"
      :class="activeTab === 'misc' ? 'border-primary' : 'border-transparent'"
      @click="emit('change-tab', 'misc')"
    >
      <span
        class="material-symbols-outlined transition-colors text-[calc(20em/14)]"
        :class="activeTab === 'misc' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >hub</span
      >
      <span
        class="text-[calc(10em/14)] mt-0.5 font-bold tracking-widest transition-colors"
        :class="activeTab === 'misc' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >多功能</span
      >
    </button>

    <!-- 菜单 4: Settings (设置) -->
    <button
      class="flex-1 py-2 flex flex-col items-center justify-center transition-all group border-t-2 bg-surface-container hover:bg-surface-container-high hover:shadow-[0_-5px_15px_rgba(0,0,0,0.3)]"
      :class="activeTab === 'settings' ? 'border-primary' : 'border-transparent'"
      @click="emit('change-tab', 'settings')"
    >
      <span
        class="material-symbols-outlined transition-colors text-[calc(20em/14)]"
        :class="activeTab === 'settings' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >tune</span
      >
      <span
        class="text-[calc(10em/14)] mt-0.5 font-bold tracking-widest transition-colors"
        :class="activeTab === 'settings' ? 'text-primary-text' : 'text-on-surface-variant group-hover:text-on-surface'"
        >设置</span
      >
    </button>
  </nav>
</template>

<script setup lang="ts">
// BottomNav: 全局底部导航栏
// 完全独立的 UI 组件，只负责接收当前 Tab 和发送切换事件
const props = defineProps<{
  activeTab: string;
}>();

const emit = defineEmits<{
  (e: 'change-tab', tabName: string): void;
}>();
</script>
