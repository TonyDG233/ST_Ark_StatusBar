<template>
  <div class="tab-panel flex-col">
    <div class="filters">
      <input type="text" v-model="filterText" placeholder="搜索世界书..." class="search-input" />
    </div>
    <div class="all-wbs-list">
      <div v-for="wb in filteredWorldbooks" :key="wb.name" class="wb-accordion-item">
        <div class="wb-accordion-header" @click="toggleAccordion(wb.name)">
          <div class="wb-accordion-title">
            <span v-if="wb.isPinned" class="pin-icon">📌</span>
            <span class="wb-type-badge" :class="wb.type">
              {{ wb.type === 'char' ? '角色绑定' : (wb.type === 'global' ? '已挂载' : '未挂载') }}
            </span>
            <span class="wb-name-text">{{ wb.name }}</span>
          </div>
          <div class="wb-accordion-actions">
            <button
              class="icon-btn tiny pin-btn"
              @click.stop="toggleWorldbookPin(wb.name)"
              :title="wb.isPinned ? '取消置顶' : '置顶世界书'"
              :class="{ pinned: wb.isPinned }"
            >
              {{ wb.isPinned ? '📌' : '📍' }}
            </button>
            <button 
              v-if="wb.type !== 'char'" 
              class="btn-tiny"
              :class="wb.type === 'global' ? 'btn-danger' : 'btn-success'"
              @click.stop="toggleGlobalMountUI(wb.name, wb.type !== 'global')"
            >
              {{ wb.type === 'global' ? '卸载' : '挂载' }}
            </button>
            <span class="accordion-arrow">{{ expandedWorldbooks.includes(wb.name) ? '▼' : '▶' }}</span>
          </div>
        </div>
        
        <div v-if="expandedWorldbooks.includes(wb.name)" class="wb-accordion-content">
          <div class="filters" style="margin-bottom: 5px;">
              <input type="text" v-model="filterEntryTexts[wb.name]" placeholder="搜索此书内的条目名称或触发词..." class="search-input" style="margin-bottom: 5px;" />
              <div class="filter-row">
                <select v-model="filterCategory" class="filter-select">
                  <option value="">全部类别</option>
                  <option v-for="cat in getAvailableCategories(wb.name)" :key="cat" :value="cat">{{ cat }}</option>
                </select>
                <select v-model="filterType" class="filter-select">
                  <option value="">全部类型(蓝/绿灯)</option>
                  <option value="constant">常驻 (🔵 蓝灯)</option>
                  <option value="selective">条件 (🟢 绿灯)</option>
                </select>
              </div>
          </div>
          <div v-if="isLoadingWb === wb.name" class="empty-state" style="padding: 10px;">加载中...</div>
          <div v-else-if="!worldbookEntriesCache[wb.name] || worldbookEntriesCache[wb.name].length === 0" class="empty-state" style="padding: 10px;">
            此世界书没有包含有效条目。
          </div>
          <div v-else class="wb-entries-container">
            <div
              v-for="entry in filterEntries(worldbookEntriesCache[wb.name], wb.name)"
              :key="entry.uid"
              class="wb-item"
              :class="{ 'disabled-entry': !entry.enabled }"
            >
              <div class="wb-info">
                <div class="wb-name">
                  <span v-if="isPinnedEntry(entry)" class="pin-icon">📌</span>
                  {{ entry.comment || entry.name || (entry.key ? entry.key[0] : '未知') }}
                </div>
                <div class="wb-keys" v-if="entry.key && entry.key.length">触发词: {{ entry.key.join(', ') }}</div>
              </div>
              <div class="wb-action">
                <button
                  class="icon-btn tiny pin-btn"
                  @click="togglePinEntry(entry)"
                  :title="isPinnedEntry(entry) ? '取消置顶' : '偏好置顶'"
                  :class="{ pinned: isPinnedEntry(entry) }"
                >
                  {{ isPinnedEntry(entry) ? '📌' : '📍' }}
                </button>
                <button
                  class="icon-btn tiny"
                  @click="toggleEntryType(entry, wb.name)"
                  :title="
                    getEntryType(entry) === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'
                  "
                >
                  {{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}
                </button>
                <label class="switch">
                  <input type="checkbox" v-model="entry.enabled" @change="toggleEntry(entry, wb.name)" />
                  <span class="slider round"></span>
                </label>
              </div>
            </div>
            <div v-if="filterEntries(worldbookEntriesCache[wb.name], wb.name).length === 0" class="empty-state" style="padding: 5px;">没有找到匹配的条目。</div>
          </div>
        </div>
      </div>
      <div v-if="filteredWorldbooks.length === 0" class="empty-state">没有找到匹配的世界书。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useArkConfig, configStore } from '../../../logic/core/config_store';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import {
  allAvailableWorldbooks,
  globalMountedWorldbooks,
  charBoundWorldbooks,
  expandedWorldbooks,
  worldbookEntriesCache,
  isLoadingWb,
  currentPrimaryWorldbook,
  CONFIG_ENTRY_PREFIX
} from '../shared_ui_state';

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

// --- Local UI State for Worldbook Tab ---
const filterText = ref(''); 
const filterCategory = ref(''); 
const filterType = ref(''); 
const filterEntryTexts = ref<Record<string, string>>({}); 

/**
 * 构建带有分类和排序状态的世界书列表对象
 */
const filteredWorldbooks = computed(() => {
  let result = allAvailableWorldbooks.value.map(name => {
    let type = 'unmounted';
    if (charBoundWorldbooks.value.includes(name)) type = 'char';
    else if (globalMountedWorldbooks.value.includes(name)) type = 'global';

    return {
      name,
      type,
      isPinned: currentConfig.value?.pinnedWorldbooks?.includes(name) || false,
    };
  });

  if (filterText.value) {
    const q = filterText.value.toLowerCase();
    result = result.filter(wb => wb.name.toLowerCase().includes(q));
  }

  result.sort((a, b) => {
    const getScore = (wb: any) => {
      if (wb.type === 'char') return 5;
      if (wb.type === 'global' && wb.isPinned) return 4;
      if (wb.type === 'global') return 3;
      if (wb.type === 'unmounted' && wb.isPinned) return 2;
      return 1;
    };
    return getScore(b) - getScore(a);
  });

  return result;
});

const toggleGlobalMountUI = async (wbName: string, isMount: boolean) => {
  try {
    await manager.worldbook.toggleGlobalMount(wbName, isMount);
    globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
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
  configStore.updateConfig({ pinnedWorldbooks: newPinned });
};

const toggleAccordion = async (wbName: string) => {
  const idx = expandedWorldbooks.value.indexOf(wbName);
  if (idx > -1) {
    expandedWorldbooks.value.splice(idx, 1); 
  } else {
    expandedWorldbooks.value.push(wbName); 
    if (!worldbookEntriesCache.value[wbName]) {
      isLoadingWb.value = wbName;
      try {
        const entries = await getWorldbook(wbName);
        worldbookEntriesCache.value[wbName] = entries.filter(
          (e: any) =>
            !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
            !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
        );
      } catch (e) {
        console.error(`[ARK_UI] 无法加载世界书 ${wbName}`, e);
        worldbookEntriesCache.value[wbName] = [];
      } finally {
        isLoadingWb.value = null;
      }
    }
  }
};

const getAvailableCategories = (wbName: string) => {
  const entries = worldbookEntriesCache.value[wbName] || [];
  const cats = new Set<string>();
  entries.forEach(e => {
    const name = e.name || e.comment || '';
    const match = name.match(/^\[(.*?)\]/);
    if (match) cats.add(match[1]);
    else cats.add('未分类');
  });
  const sorted = Array.from(cats).sort();
  const uncatIndex = sorted.indexOf('未分类');
  if (uncatIndex !== -1) {
    sorted.splice(uncatIndex, 1);
    sorted.push('未分类');
  }
  return sorted;
};

const isPinnedEntry = (entry: any) => {
  return currentConfig.value?.pinnedEntries?.includes(entry.uid) || false;
};

const filterEntries = (entries: any[], wbName: string) => {
  if (!entries) return [];
  return entries.filter(entry => {
    const searchText = filterEntryTexts.value[wbName];
    if (searchText) {
      const query = searchText.toLowerCase();
      const name = (entry.comment || entry.name || '').toLowerCase();
      const keys = (entry.key || []).join(' ').toLowerCase();
      if (!name.includes(query) && !keys.includes(query)) return false;
    }
    if (filterCategory.value) {
      const name = entry.name || entry.comment || '';
      const match = name.match(/^\[(.*?)\]/);
      const cat = match ? match[1] : '未分类';
      if (cat !== filterCategory.value) return false;
    }
    if (filterType.value) {
      if (getEntryType(entry) !== filterType.value) return false;
    }
    return true;
  }).sort((a, b) => {
    return (isPinnedEntry(b) ? 1 : 0) - (isPinnedEntry(a) ? 1 : 0);
  });
};

const getEntryType = (entry: any) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

const togglePinEntry = (entry: any) => {
  const pinned = currentConfig.value?.pinnedEntries || [];
  const index = pinned.indexOf(entry.uid);
  let newPinned = [...pinned];
  if (index === -1) newPinned.push(entry.uid);
  else newPinned.splice(index, 1);
  configStore.updateConfig({ pinnedEntries: newPinned });
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
    configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
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
    configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
  } catch (e) {
    console.error('Failed to toggle entry', e);
    entry.enabled = !entry.enabled; 
  }
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.tab-panel.flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 15px;
}

.search-input {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}

.filter-row {
  display: flex;
  gap: 8px;
}

.filter-select {
  flex: 1;
  padding: 6px;
  border-radius: 4px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: rgba(0, 0, 0, 0.1);
  color: inherit;
}

.all-wbs-list .wb-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: opacity 0.3s;
}

.wb-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wb-name {
  font-weight: bold;
}

.wb-keys {
  font-size: 0.8em;
  opacity: 0.7;
}

.wb-accordion-item {
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  margin-bottom: 8px;
  background: rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.wb-accordion-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  background: rgba(0, 0, 0, 0.1);
  transition: background-color 0.2s;
}

.wb-accordion-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.wb-accordion-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
  flex: 1;
  min-width: 0;
}

.wb-name-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-type-badge {
  font-size: 0.75em;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.3);
  flex-shrink: 0;
}

.wb-type-badge.char {
  background: rgba(0, 123, 255, 0.4);
  color: #cce5ff;
}

.wb-type-badge.global {
  background: rgba(40, 167, 69, 0.4);
  color: #d4edda;
}

.wb-accordion-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.accordion-arrow {
  font-size: 0.8em;
  opacity: 0.6;
  margin-left: 4px;
}

.wb-entries-container {
  padding: 0 10px 10px 10px;
}

.wb-accordion-content {
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.1);
  padding-top: 10px;
}
</style>
