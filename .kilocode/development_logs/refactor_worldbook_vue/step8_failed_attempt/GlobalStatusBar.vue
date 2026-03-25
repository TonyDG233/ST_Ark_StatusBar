<template>
  <div
    v-if="isSystemEnabled"
    class="ark-global-statusbar"
    v-show="isVisible"
    :class="{
      'light-theme': currentConfig?.theme === 'light',
      'dark-theme': currentConfig?.theme === 'dark',
      'transparent-theme': currentConfig?.theme === 'transparent',
      'mini-mode': isMiniMode,
    }"
    :style="{
      '--ui-width': isMiniMode ? 'auto' : displayWidth + 'px',
      '--ui-font-size': displayFontSize + 'px',
      transform: `translate(${transformX}px, ${transformY}px)`,
    }"
    ref="statusBarEl"
  >
    <div
      class="statusbar-header"
      @mousedown="startDrag"
      @touchstart="startDrag"
      @dblclick="resetPosition"
      title="拖拽移动，双击还原位置"
    >
      <div class="title" v-if="!isMiniMode"><span class="icon">📖</span> 方舟世界书控制台</div>
      <div class="title mini" v-else><span class="icon">📖</span> 世界书 (预警: {{ pendingEntries.length }})</div>
      <div class="controls">
        <button class="icon-btn" @click="toggleMinimize" title="折叠/展开">
          {{ isMiniMode ? '↗' : '↙' }}
        </button>
      </div>
    </div>

    <div class="statusbar-tabs" v-show="!isMiniMode">
      <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">拦截预警</button>
      <button :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部条目</button>
      <button :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">记录(Git)</button>
      <button :class="{ active: currentTab === 'settings' }" @click="currentTab = 'settings'">设置</button>
    </div>

    <div class="statusbar-content" v-show="!isMiniMode">
      <!-- Tab 1: Interceptor -->
      <InterceptorTab
        v-show="currentTab === 'interceptor'"
        :config="currentConfig"
        :is-test-mode="isTestMode"
        :pending-entries="pendingEntries"
        :last-triggered-entries="lastTriggeredEntries"
        :current-token-count="currentTokenCount"
        @update-config="onUpdateConfig"
        @run-manual-test="runManualTest"
        @clear-test-results="clearTestResults"
        @confirm-send="confirmSend"
        @cancel-send="cancelSend"
        @toggle-pending-entry="togglePendingEntry"
        @toggle-temp-disable="toggleTempDisable"
      />

      <!-- Tab 2: All WBs -->
      <WorldbookManagerTab
        v-show="currentTab === 'all'"
        ref="worldbookManagerTabRef"
        :config="currentConfig"
        :all-available-worldbooks="allAvailableWorldbooks"
        :global-mounted-worldbooks="globalMountedWorldbooks"
        :char-bound-worldbooks="charBoundWorldbooks"
        @toggle-global-mount="toggleGlobalMountUI"
        @toggle-worldbook-pin="toggleWorldbookPin"
        @toggle-pin="togglePin"
        @toggle-entry-type="toggleEntryType"
        @toggle-entry="toggleEntry"
        @fetch-worldbook-entries="fetchWorldbookEntries"
      />

      <!-- Tab 3: History -->
      <HistoryAndManageTab
        v-show="currentTab === 'history'"
        :config="currentConfig"
        :all-available-worldbooks="allAvailableWorldbooks"
        :current-primary-worldbook="currentPrimaryWorldbook"
        @save-snapshot="createSnapshot"
        @restore-snapshot="restoreSnapshot"
        @delete-snapshot="deleteSnapshot"
        @restore-baseline="resetToBaseline"
        @close-single-char="closeSingleChar"
        @revert-commit="revertCommit"
      />

      <!-- Tab 4: Settings -->
      <SettingsTab
        v-show="currentTab === 'settings'"
        :config="currentConfig"
        @update-config="onUpdateConfig"
        @preview-ui-width="val => previewUiWidth = val"
        @preview-ui-font-size="val => previewUiFontSize = val"
      />
    </div>

    <!-- [FEATURE: MINI_SNAPSHOT] -> Compact list shown ONLY in mini mode -->
    <div class="statusbar-mini-content" v-show="isMiniMode">
      <div v-if="(pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries).length === 0" class="mini-empty">
        无近期触发记录
      </div>
      <ul v-else class="mini-entry-list">
        <li
          v-for="entry in pendingEntries.length > 0 ? pendingEntries : lastTriggeredEntries"
          :key="entry.uid || Math.random()"
        >
          <span class="indicator" :class="{ blocked: entry.enabled === false }"></span>
          <span class="text">{{
            entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知')
          }}</span>
        </li>
      </ul>
    </div>
    <!-- [FEATURE: MINI_SNAPSHOT] END -->
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { type ArkConfig } from '../config/system_config';
import { StatusBarManager } from '../logic/statusbar_manager';
import { WorldbookManager } from '../logic/worldbook_manager';

import HistoryAndManageTab from './global_tabs/HistoryAndManageTab.vue';
import InterceptorTab from './global_tabs/InterceptorTab.vue';
import SettingsTab from './global_tabs/SettingsTab.vue';
import WorldbookManagerTab from './global_tabs/WorldbookManagerTab.vue';

// --- 全局与 UI 状态 ---
const isVisible = ref(true); // 控制整个面板的显示与隐藏，受系统总开关控制
const isMiniMode = ref(true); // 控制面板是否处于缩小(胶囊)模式
const currentTab = ref('interceptor'); // 当前选中的标签页: interceptor, all, history, settings
const pendingEntries = ref<any[]>([]); // 拦截器捕获到的，即将被发送的世界书条目
const currentTokenCount = ref<number | string>(0); // 当前干跑计算的 Token
const isTestMode = ref(false); // 是否处于“主动检测”模式

const runManualTest = () => {
  isTestMode.value = true;
  manager.runManualTest();
};

const clearTestResults = () => {
  pendingEntries.value = [];
  isTestMode.value = false;
};

// [FEATURE: MINI_SNAPSHOT] 记录上一轮真实发送时触发的世界书条目
const lastTriggeredEntries = ref<any[]>([]);

const currentConfig = ref<ArkConfig | null>(null); // 本地缓存的系统配置
const currentPrimaryWorldbook = ref<string | null>(null); // 当前角色的主世界书名称

const manager = StatusBarManager.getInstance();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const toggleMinimize = () => {
  isMiniMode.value = !isMiniMode.value;
  if (isMiniMode.value) {
    currentTab.value = 'interceptor';
  }
};

const onUpdateConfig = (update: Partial<ArkConfig>) => {
  manager.saveConfig(update);
  if (update.uiWidth !== undefined) previewUiWidth.value = null;
  if (update.uiFontSize !== undefined) previewUiFontSize.value = null;
};

// 性能优化：UI拖动条响应由Config计算，包含预览值
const previewUiWidth = ref<number | null>(null);
const previewUiFontSize = ref<number | null>(null);
const displayWidth = computed(() => previewUiWidth.value ?? currentConfig.value?.uiWidth ?? 400);
const displayFontSize = computed(() => previewUiFontSize.value ?? currentConfig.value?.uiFontSize ?? 14);

// --- DOM 节点与拖拽坐标 ---
const statusBarEl = ref<HTMLElement | null>(null);

const transformX = ref(0); // 整体 UI 横向偏移量
const transformY = ref(0); // 整体 UI 纵向偏移量
let isDragging = false;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging = true;
  if (e.type === 'touchstart') {
    const touch = (e as TouchEvent).touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
  } else {
    startX = (e as MouseEvent).clientX;
    startY = (e as MouseEvent).clientY;
  }
  initialX = transformX.value;
  initialY = transformY.value;
  const ST_DOC = window.parent?.document || document;
  ST_DOC.addEventListener('mousemove', onDrag);
  ST_DOC.addEventListener('touchmove', onDrag, { passive: false });
  ST_DOC.addEventListener('mouseup', stopDrag);
  ST_DOC.addEventListener('touchend', stopDrag);
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging || !statusBarEl.value) return;
  e.preventDefault();
  let clientX = 0;
  let clientY = 0;
  if (e.type === 'touchmove') {
    const touch = (e as TouchEvent).touches[0];
    clientX = touch.clientX;
    clientY = touch.clientY;
  } else {
    clientX = (e as MouseEvent).clientX;
    clientY = (e as MouseEvent).clientY;
  }
  transformX.value = initialX + (clientX - startX);
  transformY.value = initialY + (clientY - startY);
};

const checkBounds = () => {
  if (!statusBarEl.value) return;
  const rect = statusBarEl.value.getBoundingClientRect();
  const ST_WIN = window.parent || window;
  const viewportWidth = ST_WIN.innerWidth;
  const viewportHeight = ST_WIN.innerHeight;
  let deltaX = 0;
  let deltaY = 0;
  if (rect.right > viewportWidth) deltaX = viewportWidth - rect.right;
  if (rect.left + deltaX < 0) deltaX = 0 - rect.left;
  if (rect.bottom > viewportHeight) deltaY = viewportHeight - rect.bottom;
  const SAFE_TOP = 70;
  if (rect.top + deltaY < SAFE_TOP) deltaY = SAFE_TOP - rect.top;
  if (deltaX !== 0 || deltaY !== 0) {
    transformX.value += deltaX;
    transformY.value += deltaY;
  }
};

const stopDrag = () => {
  isDragging = false;
  const ST_DOC = window.parent?.document || document;
  ST_DOC.removeEventListener('mousemove', onDrag);
  ST_DOC.removeEventListener('touchmove', onDrag);
  ST_DOC.removeEventListener('mouseup', stopDrag);
  ST_DOC.removeEventListener('touchend', stopDrag);
  requestAnimationFrame(() => checkBounds());
};

const resetPosition = () => {
  transformX.value = 0;
  transformY.value = 0;
};

// --- 世界书数据与方法 ---
const allAvailableWorldbooks = ref<string[]>([]);
const globalMountedWorldbooks = ref<string[]>([]);
const charBoundWorldbooks = ref<string[]>([]);
const worldbookManagerTabRef = ref<any>(null);

const loadWorldbookLists = async () => {
  try {
    allAvailableWorldbooks.value = await WorldbookManager.getAllAvailableWorldbooks();
    globalMountedWorldbooks.value = await WorldbookManager.getGlobalMountedWorldbooks();
    charBoundWorldbooks.value = await WorldbookManager.getCharBoundWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

const fetchWorldbookEntries = async (wbName: string, callback: (entries: any[]) => void) => {
  try {
    const entries = await getWorldbook(wbName);
    callback(entries);
  } catch (e) {
    console.error(`[ARK_UI] 无法加载世界书 ${wbName}`, e);
    callback([]);
  }
};

const toggleGlobalMountUI = async (wbName: string, isMount: boolean) => {
  try {
    await WorldbookManager.toggleGlobalMount(wbName, isMount);
    globalMountedWorldbooks.value = await WorldbookManager.getGlobalMountedWorldbooks();
  } catch (e) {
    console.error('toggleGlobalMountUI error', e);
    if (typeof toastr !== 'undefined') toastr.error('挂载状态切换失败');
  }
};

const toggleWorldbookPin = (wbName: string) => {
  const pinned = currentConfig.value?.pinnedWorldbooks || [];
  const idx = pinned.indexOf(wbName);
  const newPinned = [...pinned];
  if (idx === -1) newPinned.push(wbName);
  else newPinned.splice(idx, 1);
  manager.saveConfig({ pinnedWorldbooks: newPinned });
};

const togglePin = (entry: any) => {
  const pinned = currentConfig.value?.pinnedEntries || [];
  const index = pinned.indexOf(entry.uid);
  let newPinned = [...pinned];
  if (index === -1) newPinned.push(entry.uid);
  else newPinned.splice(index, 1);
  manager.saveConfig({ pinnedEntries: newPinned });
};

const getEntryType = (entry: any) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

const toggleEntryType = async (entry: any, explicitWbName?: string) => {
  try {
    const currentType = getEntryType(entry);
    const newType = currentType === 'constant' ? 'selective' : 'constant';
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid && (x.name === entry.name || x.comment === entry.comment));
      if (e) {
        if (!e.strategy) e.strategy = {};
        e.strategy.type = newType;
        e.constant = newType === 'constant';
      }
      return wbEntries;
    });

    if (!entry.strategy) entry.strategy = {};
    entry.strategy.type = newType;
    entry.constant = newType === 'constant';

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动修改触发类型] ${entry.comment || entry.name}`,
      worldbook: targetWorldbook,
      changes: [{ uid: entry.uid, comment: entry.comment || entry.name, from: currentType === 'constant', to: newType === 'constant' }],
    };
    const commits = [...(currentConfig.value?.commits || []), newCommit];
    manager.saveConfig({ commits });
  } catch (e) {
    console.error('Failed to toggle entry type', e);
  }
};

const toggleEntry = async (entry: any, explicitWbName?: string) => {
  try {
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid);
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动切换开关] ${entry.comment || entry.name}`,
      worldbook: targetWorldbook,
      changes: [{ uid: entry.uid, comment: entry.comment || entry.name, from: !entry.enabled, to: entry.enabled }],
    };
    const commits = [...(currentConfig.value?.commits || []), newCommit];
    manager.saveConfig({ commits });
  } catch (e) {
    console.error('Failed to toggle entry', e);
    entry.enabled = !entry.enabled;
  }
};

// --- 拦截预警相关 ---
const confirmSend = () => {
  lastTriggeredEntries.value = [...pendingEntries.value];
  pendingEntries.value = [];
  manager.releaseInterceptAndSend();
  isMiniMode.value = true;
};

const toggleEntrySilent = async (entry: any) => {
  try {
    const targetWorldbook = entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid && (x.name === entry.name || x.comment === entry.comment));
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });
  } catch (e) {}
};

const toggleTempDisable = (entry: any) => {
  entry.tempDisabled = !entry.tempDisabled;
  if (entry.tempDisabled) {
    entry.enabled = false;
    if (!manager.tempDisabledUids.includes(entry.uid)) manager.tempDisabledUids.push(entry.uid);
    toggleEntrySilent(entry);
  } else {
    entry.enabled = true;
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
    toggleEntrySilent(entry);
  }
};

const cancelSend = () => {
  lastTriggeredEntries.value = [...pendingEntries.value];
  if (manager.tempDisabledUids.length > 0) {
    pendingEntries.value.forEach(e => {
      if (e.tempDisabled) {
        e.tempDisabled = false;
        e.enabled = true;
        toggleEntrySilent(e);
      }
    });
    manager.tempDisabledUids = [];
  }
  pendingEntries.value = [];
  isMiniMode.value = true;
};

const togglePendingEntry = async (entry: any) => {
  if (entry.tempDisabled) {
    entry.tempDisabled = false;
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
    await toggleEntry(entry);
    return;
  }
  entry.enabled = !entry.enabled;
  if (!entry.enabled) {
    entry.tempDisabled = false;
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
  }
  await toggleEntry(entry);
};

// --- 快照相关 ---
const createSnapshot = async (targetWb: string, name: string) => {
  await WorldbookManager.saveCurrentAsSnapshot(targetWb, name);
};

const restoreSnapshot = async (id: string) => {
  await WorldbookManager.restoreSnapshot(id);
  await loadWorldbookLists();
  if (worldbookManagerTabRef.value) {
    worldbookManagerTabRef.value.refreshExpanded();
  }
};

const deleteSnapshot = async (id: string) => {
  await WorldbookManager.deleteSnapshot(id);
};

const revertCommit = async (commit: any) => {
  try {
    const targetWorldbook = commit.worldbook || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      for (const change of commit.changes) {
        const e = wbEntries.find(x => x.uid === change.uid);
        if (e) {
          if (commit.description.includes('changed type') || commit.description.includes('修改触发类型')) {
            if (!e.strategy) e.strategy = {};
            e.strategy.type = change.from ? 'constant' : 'selective';
            e.constant = change.from;
          } else {
            e.enabled = change.from;
          }
        }
      }
      return wbEntries;
    });
    const commits = (currentConfig.value?.commits || []).filter((c: any) => c.id !== commit.id);
    manager.saveConfig({ commits });
    if (worldbookManagerTabRef.value) {
      worldbookManagerTabRef.value.clearCache(targetWorldbook);
      worldbookManagerTabRef.value.refreshExpanded();
    }
    toastr.success('撤销成功并已从记录中移除。');
  } catch (e) {
    toastr.error('撤销失败，详见控制台。');
  }
};

const resetToBaseline = async () => {
  await WorldbookManager.resetToBaseline();
  manager.saveConfig({ commits: [] });
  await loadWorldbookLists();
  toastr.success('已恢复基准线。');
};

const closeSingleChar = async () => {
  await WorldbookManager.closeSingleCharEntries();
  await loadWorldbookLists();
};

const loadPrimaryWorldbookName = async () => {
  try {
    const result = await getCharWorldbookNames('current');
    currentPrimaryWorldbook.value = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
  } catch(e) {}
};

onMounted(() => {
  document.addEventListener('ark-config-updated', ((e: CustomEvent) => {
    const config = e.detail;
    const wasNull = !currentConfig.value;
    currentConfig.value = config;
    if (wasNull && config.isSystemEnabled) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
    }
  }) as EventListener);
  
  if (manager.currentConfig) {
    currentConfig.value = manager.currentConfig;
    if (manager.currentConfig.isSystemEnabled) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
    }
  }

  document.addEventListener('ark-interceptor-triggered', ((e: CustomEvent) => {
    const triggered = e.detail.entries || [];
    const isManualTest = !!e.detail.isManualTest;
    isTestMode.value = isManualTest;
    currentTokenCount.value = e.detail.tokenCount ?? 0;

    let matchedEntries = triggered.map((raw: any) => {
      raw.enabled = raw.enabled !== false;
      if (!raw.world && currentPrimaryWorldbook.value) raw.world = currentPrimaryWorldbook.value;
      if (!raw.strategy) raw.strategy = {};
      return raw;
    });
      
    if (!currentConfig.value?.showConstantEntries) {
      matchedEntries = matchedEntries.filter((entry: any) => getEntryType(entry) !== 'constant');
    }

    if (matchedEntries.length > 0 || isManualTest) {
      pendingEntries.value = matchedEntries;
      currentTab.value = 'interceptor';
      isMiniMode.value = false;
      if (!isSystemEnabled.value) manager.saveConfig({ isSystemEnabled: true });
      if (isManualTest && typeof toastr !== 'undefined') toastr.success('检测完成。', 'ARK_STATUSBAR');
    } else {
      manager.releaseInterceptAndSend();
    }
  }) as EventListener);

  if (statusBarEl.value) {
    const resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => checkBounds()));
    resizeObserver.observe(statusBarEl.value);
  }
  requestAnimationFrame(() => checkBounds());

  document.addEventListener('ark-baseline-diff-detected', () => {
    if (typeof toastr !== 'undefined') toastr.warning('检测到当前世界书带有开局剧情或手动修改的残余状态。', 'ARK_STATUSBAR 提示');
  });

  document.addEventListener('ark-chat-changed', () => {
    if (currentConfig.value?.isSystemEnabled) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
    }
  });

  document.addEventListener('ark-toggle-system', () => {
    const newState = !(currentConfig.value?.isSystemEnabled ?? true);
    manager.saveConfig({ isSystemEnabled: newState });
    if (newState) {
      loadPrimaryWorldbookName();
      loadWorldbookLists();
      requestAnimationFrame(() => checkBounds());
    }
  });

  const ST_WIN = window.parent || window;
  ST_WIN.addEventListener('resize', () => requestAnimationFrame(() => checkBounds()));
});
</script>

<style scoped>
@import './styles/theme.scss';

.ark-global-statusbar {
  position: fixed;
  bottom: 60px;
  right: 20px;
  width: var(--ui-width, 400px);
  max-width: 90vw;
  max-height: calc(100dvh - 80px);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition:
    background-color 0.3s ease,
    border-color 0.3s ease,
    color 0.3s ease,
    opacity 0.3s ease;
}

.ark-global-statusbar.light-theme {
  background: #fdfdfd;
  border: 1px solid #ccc;
  color: #333;
}

.ark-global-statusbar.dark-theme {
  background: #1a1a1a;
  border: 1px solid #333;
  color: #ccc;
}

.ark-global-statusbar.transparent-theme {
  background: rgba(44, 47, 51, 0.4);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #eee;
}

.ark-global-statusbar.mini-mode {
  width: auto;
  max-width: 180px;
  border-radius: 20px;
  opacity: 0.8;
}

.statusbar-mini-content {
  padding: 0 10px 10px 10px;
  max-height: 90px;
  overflow-y: auto;
  font-size: 0.9em;
}

.mini-empty {
  text-align: center;
  opacity: 0.5;
  padding: 5px;
  font-size: 0.9em;
}

.mini-entry-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.mini-entry-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
  border-bottom: 1px dashed rgba(128, 128, 128, 0.3);
}

.mini-entry-list li:last-child {
  border-bottom: none;
}

.mini-entry-list .indicator {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #007bff;
  flex-shrink: 0;
}

.mini-entry-list .indicator.blocked {
  background-color: #dc3545;
}

.mini-entry-list .text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.ark-global-statusbar.mini-mode .tab-header {
  display: none;
}

.ark-global-statusbar.mini-mode .interceptor-actions {
  flex-direction: column;
  gap: 5px;
}

.ark-global-statusbar.mini-mode:hover {
  opacity: 1;
}

.statusbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
  font-weight: bold;
  cursor: grab;
}

.statusbar-header:active {
  cursor: grabbing;
}

.ark-global-statusbar.mini-mode .statusbar-header {
  border-bottom: none;
  padding: 5px 15px;
  border-radius: 20px;
}

.title.mini {
  font-size: 0.85em;
  margin-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.statusbar-header .icon-btn {
  background: transparent;
  border: none;
  color: inherit;
  font-size: 1.1em;
  cursor: pointer;
  padding: 0 5px;
}

.statusbar-tabs {
  display: flex;
  background: rgba(0, 0, 0, 0.1);
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
}

.statusbar-tabs button {
  flex: 1;
  padding: 8px 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
}

.statusbar-tabs button.active {
  opacity: 1;
  border-bottom: 2px solid #007bff;
  font-weight: bold;
}

.statusbar-content {
  padding: 15px;
  max-height: 400px;
  overflow-y: auto;
}
</style>
