<template>
  <div class="sandbox-container min-h-screen w-full flex flex-col" :class="isDark ? 'dark-theme' : 'light-theme'">
    <!-- 顶部控制栏 -->
    <header class="p-4 border-b border-outline-variant bg-surface flex justify-between items-center z-50 shadow-md">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-2xl">science</span>
        <h1 class="text-xl text-primary font-display font-bold tracking-widest uppercase">ARK UI Sandbox</h1>
      </div>
      
      <button 
        @click="isDark = !isDark" 
        class="px-4 py-2 flex items-center gap-2 bg-surface-container-high hover:bg-surface-variant text-on-surface font-label font-bold border border-outline transition-colors cursor-pointer"
      >
        <span class="material-symbols-outlined text-lg">{{ isDark ? 'light_mode' : 'dark_mode' }}</span>
        {{ isDark ? 'SWITCH TO LIGHT (ENDFIELD)' : 'SWITCH TO DARK (RHODES)' }}
      </button>
    </header>

    <!-- 预览工作台 (去除固定高度和 overflow，让整个网页可以自然滚动) -->
    <main class="flex-1 p-4 md:p-8 relative">
      <div class="absolute inset-0 opacity-10 pointer-events-none bg-cover bg-center z-0 fixed" :style="{ backgroundImage: 'var(--bg-watermark)' }"></div>
      
      <div class="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-12 pb-20">
        
        <!-- 颜色系统预览 -->
        <section>
          <h2 class="text-2xl text-on-surface font-display mb-6 border-l-4 border-primary pl-3">1. Token & Design System</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="h-24 bg-primary flex items-center justify-center text-on-primary font-bold shadow border border-outline">Primary</div>
            <div class="h-24 bg-surface flex items-center justify-center text-on-surface font-bold shadow border border-outline">Surface</div>
            <div class="h-24 bg-surface-container-high flex items-center justify-center text-on-surface font-bold shadow border border-outline">Container High</div>
            <div class="h-24 bg-error flex items-center justify-center text-on-error font-bold shadow border border-outline">Error</div>
          </div>
        </section>

        <!-- 组件画廊预留位 -->
        <section>
          <h2 class="text-2xl text-on-surface font-display mb-6 border-l-4 border-primary pl-3">2. Atomic Components</h2>
          <div class="p-8 border border-outline-variant bg-surface-container flex flex-col gap-8">
            
            <div>
              <h3 class="text-on-surface mb-2 font-display">ArkButton</h3>
              <div class="flex gap-4">
                <ArkButton variant="primary" icon="check">Primary</ArkButton>
                <ArkButton variant="outline" icon="science">Outline</ArkButton>
                <ArkButton variant="ghost">Ghost Button</ArkButton>
                <ArkButton disabled>Disabled</ArkButton>
              </div>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">ArkSectionHeader & ArkProgressBar</h3>
              <ArkPanel class="p-6 gap-4">
                <div class="flex justify-between items-center">
                  <ArkSectionHeader title="当前剧情节点: 12-1" subtitle="SYS_LOC" showDecoration />
                  <ArkSectionHeader title="In-Game Time: 14:00" subtitle="SYS_TIME" class="text-right" />
                </div>
                <ArkProgressBar label="SANITY / HP" :current="120" :max="135" />
              </ArkPanel>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">ArkWipMask (Hover on Panel)</h3>
              <ArkPanel class="p-6 h-32 flex items-center justify-center relative">
                <span class="text-on-surface">Behind the mask</span>
                <ArkWipMask text="功能开发中" />
              </ArkPanel>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">ArkBottomNav</h3>
              <div class="w-full max-w-sm">
                <ArkBottomNav activeTab="lore" />
              </div>
            </div>

          </div>
        </section>

        <!-- 页面骨架拼装预览 -->
        <section>
          <h2 class="text-2xl text-on-surface font-display mb-6 border-l-4 border-primary pl-3">3. View Assembly (DashboardTab)</h2>
          <div class="w-full max-w-[400px] mx-auto h-[700px] border-4 border-outline-variant rounded-xl overflow-hidden shadow-2xl relative bg-surface flex flex-col">
            <!-- 模拟手机壳/悬浮窗壳 -->
            <div class="flex-1 overflow-y-auto">
              <DashboardTab />
            </div>
            <ArkBottomNav activeTab="dashboard" />
          </div>
        </section>

      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ArkBottomNav from '../ARK_STATUSBAR/components/ArkBottomNav.vue';
import ArkButton from '../ARK_STATUSBAR/components/ArkButton.vue';
import ArkPanel from '../ARK_STATUSBAR/components/ArkPanel.vue';
import ArkProgressBar from '../ARK_STATUSBAR/components/ArkProgressBar.vue';
import ArkSectionHeader from '../ARK_STATUSBAR/components/ArkSectionHeader.vue';
import ArkWipMask from '../ARK_STATUSBAR/components/ArkWipMask.vue';
import DashboardTab from '../ARK_STATUSBAR/views/global_tabs/dashboard/DashboardTab.vue';

const isDark = ref(true);
</script>

<style scoped>
.sandbox-container {
  /* 严格使用提取的主题变量控制沙盒背景 */
  background-color: var(--color-background);
  color: var(--color-on-background);
  transition: background-color 0.3s ease, color 0.3s ease;
}
</style>
