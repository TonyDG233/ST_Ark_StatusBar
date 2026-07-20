<template>
  <div class="dashboard-tab relative flex flex-col p-4 gap-4 @container scrollbar-none overflow-y-auto">
    <!-- 开发标签 -->
    <!-- <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[calc(10em/14)] px-1 font-mono z-50 pointer-events-none opacity-50">
      [DashboardTab]
    </div> -->

    <!-- 顶部状态面板 (Top Status) -->
    <div class="relative flex-shrink-0">
      <Panel class="p-4 gap-4 h-full">
        <div class="flex flex-col @[300px]:flex-row justify-between items-start gap-4">
          <SectionHeader title="12-1" subtitle="当前剧情节点" showDecoration class="w-full @[300px]:w-auto" />
          <SectionHeader title="14:00" subtitle="游戏内时间" class="w-full @[300px]:w-auto @[300px]:text-right" />
        </div>
        <ProgressBar label="理智 / HP" :current="120" :max="135" class="mt-2" />
      </Panel>
      <WipMask text="缓慢开发中" />
    </div>

    <!-- 中部活动日志 (Recent Activity) -->
    <Panel class="flex-col flex-shrink-0">
      <div
        class="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low flex-shrink-0"
      >
        <span class="font-bold tracking-widest text-[calc(11em/14)] uppercase text-on-surface">近期触发记录</span>
        <div class="w-1.5 h-1.5 bg-secondary"></div>
      </div>

      <div class="p-3 flex flex-col gap-3 overflow-y-auto max-h-[240px] slim-scroll-container">
        <div
          v-if="recentTriggerLogs.length === 0"
          class="text-on-surface-variant text-xs text-center py-2 opacity-70 font-mono"
        >
          NO_RECORDS_FOUND
        </div>
        <div
          v-else
          v-for="(log, idx) in recentTriggerLogs"
          :key="log.timestamp"
          class="flex flex-col border-b border-outline-variant/50 pb-3 last:border-0 last:pb-0 -mx-3 px-3"
        >
          <!-- 概览条目 -->
          <div
            class="flex gap-2 items-start cursor-pointer hover:bg-surface-variant/30 transition-colors py-1"
            @click="toggleExpand(idx)"
          >
            <span class="material-symbols-outlined text-on-surface-variant mt-0.5 flex-shrink-0 text-[calc(14em/14)]"
              >memory</span
            >
            <div class="flex-1 min-w-0 flex flex-col">
              <span class="text-on-surface text-[calc(12em/14)] font-bold tracking-wide truncate"
                >Triggered {{ log.entries.length }} entries</span
              >
              <span class="text-on-surface-variant text-[calc(10em/14)] font-mono mt-1 tracking-wider truncate"
                >~{{ log.tokenCount }} TOKENS</span
              >
            </div>
            <div class="flex flex-col items-end gap-1">
              <span class="text-on-surface-variant text-[calc(10em/14)] font-mono mt-0.5 flex-shrink-0">{{
                formatTime(log.timestamp)
              }}</span>
              <span
                class="material-symbols-outlined text-on-surface-variant text-[calc(16em/14)] transition-transform duration-200"
                :class="{ 'rotate-180': expandedLogIdx === idx }"
                >expand_more</span
              >
            </div>
          </div>
          <!-- 展开详情 (简化的 InterceptorQueueItem) -->
          <div
            v-show="expandedLogIdx === idx"
            class="flex flex-col gap-1.5 mt-2 pl-6 pr-1 overflow-hidden transition-all duration-300"
          >
            <div
              v-for="(entry, eIdx) in log.entries"
              :key="eIdx"
              class="flex flex-col gap-1 p-1.5 rounded-sm border border-outline-variant/30 bg-surface-container-lowest"
            >
              <div class="flex justify-between items-start gap-1">
                <span
                  class="text-[calc(11em/14)] font-display text-on-surface flex-1 min-w-0 break-words whitespace-normal leading-tight"
                >
                  {{
                    entry.name ||
                    (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0].toString() : '未知')
                  }}
                </span>
                <span
                  class="text-[calc(9em/14)] font-mono text-on-surface-variant whitespace-nowrap flex-shrink-0 opacity-70 bg-surface-container-high px-1 py-0.5 rounded-sm"
                >
                  ~{{ uiStore.entryTokenCountCache[uiStore.getEntryKey(entry)] || 0 }} tok
                </span>
              </div>
              <div class="font-body text-on-surface-variant text-[calc(9em/14)] mt-0.5">
                📁 来源: {{ entry.world || uiStore.currentPrimaryWorldbook || '未知' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Panel>

    <!-- 底部快捷操作网格 (Quick Access) -->
    <div class="grid grid-cols-1 @[400px]:grid-cols-2 gap-3 flex-shrink-0">
      <!-- 大按键跨列 -->
      <Button
        variant="primary"
        icon="menu_book"
        class="h-16 @[400px]:col-span-2 text-sm font-bold tracking-widest uppercase"
        @click="handleNavigate('worldbook', 'lore')"
      >
        世界书管理器
      </Button>

      <!-- 小按键加遮罩 -->
      <div class="relative h-12">
        <Button class="w-full h-full" icon="security" @click="handleNavigate('worldbook', 'interceptor')"
          >拦截记录</Button
        >
      </div>

      <div class="relative h-12">
        <Button class="w-full h-full" icon="history" @click="handleNavigate('worldbook', 'history')">历史档案</Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { ref } from 'vue';
import Button from '../../../components/Button.vue';
import Panel from '../../../components/Panel.vue';
import ProgressBar from '../../../components/ProgressBar.vue';
import SectionHeader from '../../../components/SectionHeader.vue';
import WipMask from '../../../components/WipMask.vue';
import { useUIStateStore } from '../../../store/ui_state_store';

const emit = defineEmits<{
  (e: 'navigate', tab: string, subTab?: string): void;
}>();

// 路由跳转处理
// @note: 如果需要修改跳转的目标，请查阅 src/ARK_STATUSBAR/views/GlobalStatusBar.vue 中 v-if="currentTab === 'xxx'"
// 以及 SubNav.vue 所约定的标识符。当前世界书相关的页面均归属于 'worldbook' tab 之下。
const handleNavigate = (tab: string, subTab?: string) => {
  console.log(`[Dashboard] Navigating to ${tab} -> ${subTab}`);
  emit('navigate', tab, subTab);
};

const uiStore = useUIStateStore();
const { recentTriggerLogs } = storeToRefs(uiStore);

const expandedLogIdx = ref<number | null>(null); // 默认收起

const toggleExpand = (idx: number) => {
  if (expandedLogIdx.value === idx) {
    expandedLogIdx.value = null;
  } else {
    expandedLogIdx.value = idx;
  }
};

const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
</script>
