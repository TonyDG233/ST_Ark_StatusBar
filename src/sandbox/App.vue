<template>
  <div
    class="ark-global-statusbar-mount-point sandbox-container min-h-screen w-full flex flex-col"
    :class="isDark ? 'dark-theme' : 'light-theme'"
  >
    <!-- 顶部控制栏 -->
    <header class="p-4 border-b border-outline-variant bg-surface flex justify-between items-center z-50 shadow-md">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-primary-text text-2xl">science</span>
        <h1 class="text-xl text-primary-text font-display font-bold tracking-widest uppercase">ARK UI Sandbox</h1>
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
      <div
        class="absolute inset-0 opacity-10 pointer-events-none bg-cover bg-center z-0 fixed"
        :style="{ backgroundImage: 'var(--bg-watermark)' }"
      ></div>

      <div class="relative z-10 w-full max-w-5xl mx-auto flex flex-col gap-12 pb-20">
        <!-- 颜色系统预览 -->
        <section>
          <h2 class="text-2xl text-on-surface font-display mb-6 border-l-4 border-primary pl-3">
            1. Token & Design System
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              class="h-24 bg-primary flex items-center justify-center text-on-primary font-bold shadow border border-outline"
            >
              Primary
            </div>
            <div
              class="h-24 bg-surface flex items-center justify-center text-on-surface font-bold shadow border border-outline"
            >
              Surface
            </div>
            <div
              class="h-24 bg-surface-container-high flex items-center justify-center text-on-surface font-bold shadow border border-outline"
            >
              Container High
            </div>
            <div
              class="h-24 bg-error flex items-center justify-center text-on-error font-bold shadow border border-outline"
            >
              Error
            </div>
          </div>
        </section>

        <!-- 组件画廊预留位 -->
        <section>
          <h2 class="text-2xl text-on-surface font-display mb-6 border-l-4 border-primary pl-3">
            2. Atomic Components
          </h2>
          <div class="p-8 border border-outline-variant bg-surface-container flex flex-col gap-8">
            <div>
              <h3 class="text-on-surface mb-2 font-display">Button</h3>
              <div class="flex gap-4">
                <Button variant="primary" icon="check">Primary</Button>
                <Button variant="outline" icon="science">Outline</Button>
                <Button variant="ghost">Ghost Button</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">SectionHeader & ProgressBar</h3>
              <Panel class="p-6 gap-4">
                <div class="flex justify-between items-center">
                  <SectionHeader title="当前剧情节点: 12-1" subtitle="SYS_LOC" showDecoration />
                  <SectionHeader title="In-Game Time: 14:00" subtitle="SYS_TIME" class="text-right" />
                </div>
                <ProgressBar label="SANITY / HP" :current="120" :max="135" />
              </Panel>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">WipMask (Hover on Panel)</h3>
              <Panel class="p-6 h-32 flex items-center justify-center relative">
                <span class="text-on-surface">Behind the mask</span>
                <WipMask text="功能开发中" />
              </Panel>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">BottomNav</h3>
              <div class="w-full max-w-sm">
                <BottomNav activeTab="lore" />
              </div>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">SubNav (Floating Pill)</h3>
              <div class="w-full max-w-sm p-4 bg-surface-container border border-outline-variant flex justify-center">
                <SubNav activeSubTab="lore" :tabs="worldbookSubTabs" />
              </div>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">TopBar</h3>
              <div class="w-full max-w-sm border border-outline-variant">
                <TopBar />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 class="text-on-surface mb-2 font-display">MiniWindow</h3>
                <div class="w-full max-w-[200px] border-4 border-outline-variant rounded-xl overflow-hidden bg-surface">
                  <TopBar title="拦截预警: 3" icon="warning" :isMini="true" class="!h-8" />
                  <MiniWindow :entries="mockEntries" />
                </div>
              </div>

              <div>
                <h3 class="text-on-surface mb-2 font-display">BubbleWindow</h3>
                <div
                  class="w-full max-w-[200px] h-[200px] bg-background relative border border-outline-variant flex items-center"
                >
                  <BubbleWindow
                    position="left"
                    :width="32"
                    :triggerCount="3"
                    :showPopover="true"
                    :entries="mockEntries"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 class="text-on-surface mb-2 font-display">Worldbook Components (LoreDataCard & Folder)</h3>
              <div class="flex flex-col gap-4 border border-outline-variant p-2 bg-background">
                <LoreFolderItem
                  title="组件独立测试文件夹"
                  :count="99"
                  :expanded="false"
                  bindType="global"
                  :isPinned="false"
                />
                <LoreDataCard
                  :entry="{
                    uid: 'TEST-001',
                    name: '独立卡片测试：一段非常非常长的标题用来测试 Flex 撑爆问题会不会重演',
                    enabled: true,
                    isPinned: false,
                    type: 'constant',
                    keys: ['超长关键词测试一', '超长关键词测试二'],
                  }"
                  :selected="true"
                  :batchMode="true"
                />
              </div>
            </div>
          </div>
        </section>

        <!-- 页面骨架拼装预览 -->
        <section>
          <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
            <h2 class="text-2xl text-on-surface font-display border-l-4 border-primary pl-3">
              3. View Assembly (Multi-State Integration)
            </h2>

            <!-- 状态切换控制器 -->
            <div class="flex gap-2 bg-surface-container p-2 border border-outline-variant">
              <button
                class="px-3 py-1 font-label-caps text-xs border"
                :class="
                  uiMode === 'FULL'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'text-on-surface border-outline-variant hover:border-primary'
                "
                @click="toggleMode('FULL')"
              >
                FULL (展开)
              </button>
              <button
                class="px-3 py-1 font-label-caps text-xs border"
                :class="
                  uiMode === 'MINI'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'text-on-surface border-outline-variant hover:border-primary'
                "
                @click="toggleMode('MINI')"
              >
                MINI (悬浮窗)
              </button>
              <button
                class="px-3 py-1 font-label-caps text-xs border"
                :class="
                  uiMode === 'BUBBLE'
                    ? 'bg-primary text-on-primary border-primary'
                    : 'text-on-surface border-outline-variant hover:border-primary'
                "
                @click="toggleMode('BUBBLE')"
              >
                BUBBLE (气泡)
              </button>
            </div>

            <!-- 宽度和高度控制器 -->
            <div
              class="flex gap-6 items-center bg-surface-container p-4 border border-outline-variant shadow-sm w-full md:w-auto"
              v-show="uiMode === 'FULL'"
            >
              <div class="flex flex-col gap-1 w-full md:w-auto">
                <label class="text-on-surface-variant text-label-caps flex justify-between"
                  ><span>宽 (WIDTH):</span> <span>{{ previewWidth }}px</span></label
                >
                <input type="range" min="200" max="800" v-model="previewWidth" class="w-full md:w-32 accent-primary" />
              </div>
              <div class="flex flex-col gap-1 w-full md:w-auto" v-if="uiMode === 'FULL'">
                <label class="text-on-surface-variant text-label-caps flex justify-between"
                  ><span>高 (HEIGHT):</span> <span>{{ previewHeight }}px</span></label
                >
                <input
                  type="range"
                  min="300"
                  max="1000"
                  v-model="previewHeight"
                  class="w-full md:w-32 accent-primary"
                />
              </div>
            </div>
          </div>

          <div
            class="mx-auto border-4 border-outline-variant rounded-xl shadow-2xl relative bg-surface flex flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
            :style="{
              width: previewWidth + 'px',
              height: uiMode === 'FULL' ? previewHeight + 'px' : 'auto',
              maxWidth: '100%',
            }"
            :class="{
              'overflow-hidden': uiMode !== 'BUBBLE',
              'overflow-visible !border-none !bg-transparent !shadow-none items-end': uiMode === 'BUBBLE',
            }"
          >
            <template v-if="uiMode === 'FULL'">
              <TopBar title="方舟世界书控制台" icon="menu_book" @toggle-minimize="toggleMode('MINI')" />

              <!-- 修复 UI 消失 bug：必须添加 min-h-0，否则 flex 子元素无法被压缩，会导致底部导航被挤出屏幕 -->
              <!-- 增加 global-watermark 和 bg-background，移除子 tab 的硬编码背景，使水印全局连贯透出 -->
              <div
                class="flex-1 overflow-y-auto scrollbar-none flex flex-col relative min-h-0 bg-background global-watermark"
              >
                <DashboardTab v-if="activeTab === 'dashboard'" />

                <InterceptorTabDesign v-if="activeTab === 'worldbook' && activeSubTab === 'interceptor'" />

                <LoreEntriesTabDesign v-if="activeTab === 'worldbook' && activeSubTab === 'lore'" />

                <HistoryTabDesign v-if="activeTab === 'worldbook' && activeSubTab === 'history'" />

                <ToolsTabDesign v-if="activeTab === 'misc'" />

                <SettingsTabDesign v-if="activeTab === 'settings'" />
              </div>

              <!-- 将 BottomNav 与 SubNav 封装在一个独立的定位底座中 -->
              <div class="relative flex-shrink-0 z-50 flex flex-col">
                <!-- Secondary Navigation for Worldbook (恢复绝对悬浮状态，浮在内容上方，以防物理打断背景连续性) -->
                <div
                  class="absolute bottom-full left-0 right-0 z-40 flex justify-center mb-2 pointer-events-none px-2 box-border"
                >
                  <SubNav
                    class="pointer-events-auto"
                    v-if="activeTab === 'worldbook'"
                    :activeSubTab="activeSubTab"
                    :tabs="worldbookSubTabs"
                    @change-sub-tab="(val: string) => (activeSubTab = val)"
                  />
                </div>
                <BottomNav :activeTab="activeTab" @change-tab="(val: string) => (activeTab = val)" />
              </div>
            </template>

            <template v-else-if="uiMode === 'MINI'">
              <!-- 点击顶部假装触发拦截 -> 回到 FULL -->
              <TopBar
                title="拦截预警: 3"
                icon="warning"
                :isMini="true"
                @toggle-minimize="toggleMode('FULL')"
                @click="toggleMode('FULL')"
                class="cursor-pointer !h-8"
              />
              <MiniWindow :entries="mockEntries" />
            </template>

            <template v-else-if="uiMode === 'BUBBLE'">
              <!-- Bubble has overflow visible so popover can show -->
              <BubbleWindow
                position="right"
                :width="previewWidth"
                :triggerCount="3"
                :showPopover="showPopover"
                :entries="mockEntries"
                @click-bubble="showPopover = !showPopover"
                @close-popover="showPopover = false"
                @action="showPopover = false"
              />
            </template>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import BottomNav from '../ARK_STATUSBAR/components/BottomNav.vue';
import Button from '../ARK_STATUSBAR/components/Button.vue';
import Panel from '../ARK_STATUSBAR/components/Panel.vue';
import ProgressBar from '../ARK_STATUSBAR/components/ProgressBar.vue';
import SectionHeader from '../ARK_STATUSBAR/components/SectionHeader.vue';
import WipMask from '../ARK_STATUSBAR/components/WipMask.vue';

// New views
import DashboardTab from '../ARK_STATUSBAR/views/global_tabs/dashboard/DashboardTab.vue';
import HistoryTabDesign from './design_mocks/history/HistoryTab_Design.vue';
import InterceptorTabDesign from './design_mocks/interceptor/InterceptorTab_Design.vue';
import SettingsTabDesign from './design_mocks/settings/SettingsTab_Design.vue';
import ToolsTabDesign from './design_mocks/tools/ToolsTab_Design.vue';
import LoreEntriesTabDesign from './design_mocks/worldbook/LoreEntriesTab_Design.vue';

// New Components
import BubbleWindow from '../ARK_STATUSBAR/components/BubbleWindow.vue';
import MiniWindow from '../ARK_STATUSBAR/components/MiniWindow.vue';
import SubNav from '../ARK_STATUSBAR/components/SubNav.vue';
import TopBar from '../ARK_STATUSBAR/components/TopBar.vue';

import LoreDataCard from '../ARK_STATUSBAR/components/worldbook/LoreDataCard.vue';
import LoreFolderItem from '../ARK_STATUSBAR/components/worldbook/LoreFolderItem.vue';

const isDark = ref(true);
const previewWidth = ref(400);
const previewHeight = ref(700);

const uiMode = ref<'FULL' | 'MINI' | 'BUBBLE'>('FULL');
const showPopover = ref(false);

const activeTab = ref('worldbook');
const activeSubTab = ref('lore');

const worldbookSubTabs = [
  { id: 'interceptor', label: '预警', icon: 'security' },
  { id: 'lore', label: '条目', icon: 'menu_book' },
  { id: 'history', label: '历史', icon: 'history' },
];

const mockEntries = ref([
  { name: 'Entry [Amiya] triggered', enabled: true, tempDisabled: false },
  { name: 'System Snapshot created', enabled: false, tempDisabled: false },
  { name: 'Data sync pending...', enabled: true, tempDisabled: true },
]);

const toggleMode = (mode: 'FULL' | 'MINI' | 'BUBBLE') => {
  uiMode.value = mode;
  showPopover.value = false;
  if (mode === 'MINI') {
    previewWidth.value = 240;
    previewHeight.value = 182; // 32(topbar) + 150(miniwindow)
  } else if (mode === 'BUBBLE') {
    previewWidth.value = 32;
    previewHeight.value = 60;
  } else {
    previewWidth.value = 400;
    previewHeight.value = 700;
  }
};
</script>

<style scoped>
.sandbox-container {
  /* 严格使用提取的主题变量控制沙盒背景 */
  background-color: var(--color-background);
  color: var(--color-on-background);
  transition:
    background-color 0.3s ease,
    color 0.3s ease;
}
</style>
