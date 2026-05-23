<template>
  <div class="relative w-full h-full overflow-hidden flex flex-col box-border">
    <!-- Inner content wrapper with padding -->
    <div class="p-2 flex flex-col gap-2 box-border flex-1 min-h-0 overflow-y-auto ark-scrollbar pb-14">
      
      <!-- Header Area (Now scrollable) -->
      <div class="tab-header flex flex-col gap-2 border-b border-outline pb-2 px-1 pt-1 flex-shrink-0 bg-transparent transition-all">
        <!-- SYS_MODULE Label -->
        <div class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
          <span class="w-1.5 h-1.5 bg-primary"></span>
          SYS_MODULE // SEC_INT
        </div>
        
        <!-- Title & Description -->
        <div class="flex flex-col min-w-0 w-full">
          <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface break-words whitespace-normal leading-tight uppercase">
            拦截预警控制中心
          </h1>
          <p class="tab-desc font-body text-on-surface-variant text-xs break-words whitespace-normal mt-1 leading-snug transition-all">
            监测所有世界书数据注入请求，以防止危险的内容污染与冗余的数据注入，优化上下文与LLM表现。
          </p>
        </div>
        
        <!-- Global Controls -->
        <div class="flex flex-wrap items-center justify-between gap-2 mt-1 w-full">
          <!-- PRE-CHECK ENABLED Toggle -->
          <label class="flex items-center gap-2 cursor-pointer border border-outline-variant px-2 py-1 bg-surface-container-low hover:bg-surface-variant transition-colors min-w-0">
            <span class="font-display text-xs text-on-surface uppercase font-bold tracking-widest whitespace-nowrap">预检拦截</span>
            <div class="relative w-8 h-4 flex items-center p-0.5 transition-colors border border-outline/50"
                 :class="currentConfig?.isInterceptorEnabled ? 'bg-primary justify-end border-primary' : 'bg-surface-variant justify-start'">
              <input type="checkbox" class="hidden" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
              <div class="w-3 h-3 bg-black transition-transform"></div>
            </div>
          </label>
          
          <!-- MANUAL SCAN Button -->
          <button class="bg-surface border border-outline-variant text-on-surface px-2 py-1 font-display text-xs font-bold tracking-widest uppercase hover:bg-inverse-on-surface transition-colors flex items-center justify-center gap-1 flex-1 min-w-[100px] outline-none" @click="runManualTest">
            <span class="material-symbols-outlined text-sm">radar</span>
            手动检测
          </button>
        </div>
      </div>

      <div v-if="!currentConfig?.isInterceptorEnabled && !isTestMode" class="text-on-surface-variant text-sm p-4 text-center border border-dashed border-outline-variant/50 mt-4 flex flex-col items-center gap-2">
        <span class="material-symbols-outlined text-outline">warning</span>
        预检拦截已关闭，发送请求将直接通行。
      </div>
      <div v-else-if="pendingEntries.length === 0" class="text-on-surface-variant text-sm p-4 text-center border border-dashed border-outline-variant/50 mt-4">
        <div v-if="!isTestMode" class="flex flex-col items-center">
          当前没有被拦截的发送请求。
          <p class="text-xs opacity-70 mt-1">点击发送按钮时，即将触发的条目将在此等待确认。</p>
        </div>
        <div v-else class="flex flex-col items-center">
          <div class="flex items-center gap-1 text-primary-text mb-1 font-bold">
            <span class="material-symbols-outlined text-[calc(16em/14)]">search</span>
            <span>测试结果</span>
          </div>
          <p>根据当前上下文，未触发任何条件世界书条目。</p>
          <button class="mt-4 bg-primary/10 text-primary-text border border-primary/30 px-3 py-1 font-bold text-xs hover:bg-primary/20 transition-colors" @click="clearTestResults">
            清除测试结果
          </button>
        </div>
      </div>
      <template v-else>
        <!-- Alert Banner / Warning Section -->
        <InterceptorAlert 
          :isTestMode="isTestMode" 
          :count="pendingEntries.length" 
          :tokenCount="Number(currentTokenCount) || 0" 
        />

        <!-- Pending Entries Queue -->
        <div class="flex flex-col gap-2 w-full mt-1">
          <div class="font-display text-xs font-bold tracking-widest uppercase text-on-surface-variant border-b border-surface-variant pb-1 flex justify-between">
            <span>待处理队列 (PENDING ENTRIES)</span>
            <button v-if="isTestMode" class="text-[calc(10em/14)] text-primary hover:underline" @click="clearTestResults">清除测试结果</button>
          </div>

          <InterceptorQueueItem
            v-for="entry in pendingEntries"
            :key="entry.uid || Math.random()"
            :status="getEntryStatus(entry)"
            :showTypeIndicator="currentConfig?.showConstantEntries"
            :entry="{
              name: entry.name || (entry.strategy?.keys && entry.strategy.keys.length ? entry.strategy.keys[0].toString() : '未知'),
              tokens: entryTokenCountCache[getEntryKey(entry)] || 0,
              source: entry.world || currentPrimaryWorldbook || '未知',
              type: entry.strategy?.type === 'constant' ? 'constant' : 'selective'
            }"
            @action="(actionType: 'enable' | 'resume' | 'temp' | 'disable') => handleEntryAction(entry, actionType)"
          />
        </div>

        <!-- Bottom Actions -->
        <div class="w-full mt-4 flex flex-wrap gap-2" v-if="!isTestMode">
          <button class="bg-surface border border-error text-error font-display text-[calc(11em/14)] font-bold tracking-widest uppercase py-2.5 hover:bg-error hover:text-on-error transition-colors flex items-center justify-center gap-1 flex-1 min-w-[120px] outline-none" @click="cancelSend">
            <span class="material-symbols-outlined text-base">block</span>
            中止 (ABORT)
          </button>
          <button class="bg-primary text-on-primary font-display text-[calc(11em/14)] font-bold tracking-widest uppercase py-2.5 hover:bg-primary-container transition-colors flex items-center justify-center gap-1 flex-1 min-w-[120px] outline-none shadow-[0_0_8px_rgba(78,213,255,0.4)]" @click="confirmSend">
            <span class="material-symbols-outlined text-base">send</span>
            发送 (PROCEED)
          </button>
        </div>
      </template>

    </div>
  </div>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { configStore, useArkConfig } from '../../../store/config_store';
import { useUIStateStore, type UIWorldbookEntry } from '../../../store/ui_state_store';

import InterceptorAlert from '../../../components/interceptor/InterceptorAlert.vue';
import InterceptorQueueItem from '../../../components/interceptor/InterceptorQueueItem.vue';

const uiStore = useUIStateStore();
const { 
  currentPrimaryWorldbook,
  currentTokenCount,
  entryTokenCountCache,
  isTestMode,
  pendingEntries,
} = storeToRefs(uiStore);

const { 
  getEntryKey
} = uiStore;

const emit = defineEmits<{ (e: 'close-panel'): void }>();
const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

// Token 计算逻辑已迁移至 ui_state_store.ts 进行全局监控，避免气泡态下不渲染导致无法计算

const runManualTest = () => {
  isTestMode.value = true;
  manager.runManualTest();
};

const clearTestResults = () => {
  pendingEntries.value = [];
  isTestMode.value = false;
};

const toggleInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ isInterceptorEnabled: checked });
};

const getEntryStatus = (entry: UIWorldbookEntry) => {
  if (entry.enabled === false && !entry.tempDisabled) return 'violation';
  if (entry.tempDisabled) return 'warning';
  return 'active';
};

const handleEntryAction = async (entry: UIWorldbookEntry, actionType: 'enable' | 'resume' | 'temp' | 'disable') => {
  const targetWorldbook = entry.world || currentPrimaryWorldbook.value;
  if (!targetWorldbook) return;

  if (actionType === 'enable' || actionType === 'disable') {
    entry.enabled = (actionType === 'enable');
    entry.tempDisabled = false;
    manager.interceptor.removeTempDisabledEntry(entry.uid, targetWorldbook);
    await manager.editor.toggleEntryEnabled(entry, targetWorldbook);
  } else if (actionType === 'temp' || actionType === 'resume') {
    entry.tempDisabled = (actionType === 'temp');
    entry.enabled = !entry.tempDisabled;
    if (entry.tempDisabled) {
      manager.interceptor.addTempDisabledEntry(entry.uid, targetWorldbook);
    } else {
      manager.interceptor.removeTempDisabledEntry(entry.uid, targetWorldbook);
    }
    await manager.interceptor.toggleEntrySilent(entry, targetWorldbook);
  }
};

const confirmSend = () => {
  const currentEntries = [...pendingEntries.value];
  pendingEntries.value = [];
  manager.releaseInterceptAndSend(currentEntries, currentTokenCount.value);
  emit('close-panel');
};

const cancelSend = async () => {
  await manager.interceptor.cancelSend();
  pendingEntries.value = [];
  emit('close-panel');
};
</script>
