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
              @click.stop="emit('toggle-worldbook-pin', wb.name)"
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
                  <span v-if="isPinned(entry)" class="pin-icon">📌</span>
                  {{ entry.comment || entry.name || (entry.key ? entry.key[0] : '未知') }}
                </div>
                <div class="wb-keys" v-if="entry.key && entry.key.length">触发词: {{ entry.key.join(', ') }}</div>
              </div>
              <div class="wb-action">
                <button
                  class="icon-btn tiny pin-btn"
                  @click="emit('toggle-pin', entry)"
                  :title="isPinned(entry) ? '取消置顶' : '偏好置顶'"
                  :class="{ pinned: isPinned(entry) }"
                >
                  {{ isPinned(entry) ? '📌' : '📍' }}
                </button>
                <button
                  class="icon-btn tiny"
                  @click="emit('toggle-entry-type', entry, wb.name)"
                  :title="
                    getEntryType(entry) === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'
                  "
                >
                  {{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}
                </button>
                <label class="switch">
                  <input type="checkbox" v-model="entry.enabled" @change="emit('toggle-entry', entry, wb.name)" />
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
import { computed, ref } from 'vue';
import type { ArkConfig } from '../../config/system_config';
import { CONFIG_ENTRY_PREFIX } from '../../config/system_config';

const props = defineProps<{
  config: ArkConfig | null;
  allAvailableWorldbooks: string[];
  globalMountedWorldbooks: string[];
  charBoundWorldbooks: string[];
}>();

const emit = defineEmits<{
  (e: 'toggle-global-mount', wbName: string, isMount: boolean): void;
  (e: 'toggle-worldbook-pin', wbName: string): void;
  (e: 'toggle-pin', entry: any): void;
  (e: 'toggle-entry-type', entry: any, wbName: string): void;
  (e: 'toggle-entry', entry: any, wbName: string): void;
  (e: 'fetch-worldbook-entries', wbName: string, callback: (entries: any[]) => void): void;
}>();

const filterText = ref('');
const filterCategory = ref('');
const filterType = ref('');
const filterEntryTexts = ref<Record<string, string>>({});
const expandedWorldbooks = ref<string[]>([]);
const worldbookEntriesCache = ref<Record<string, any[]>>({});
const isLoadingWb = ref<string | null>(null);

const filteredWorldbooks = computed(() => {
  let result = props.allAvailableWorldbooks.map(name => {
    let type = 'unmounted';
    if (props.charBoundWorldbooks.includes(name)) type = 'char';
    else if (props.globalMountedWorldbooks.includes(name)) type = 'global';

    return {
      name,
      type,
      isPinned: props.config?.pinnedWorldbooks?.includes(name) || false,
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

const toggleGlobalMountUI = (wbName: string, isMount: boolean) => {
  emit('toggle-global-mount', wbName, isMount);
};

const toggleAccordion = (wbName: string) => {
  const idx = expandedWorldbooks.value.indexOf(wbName);
  if (idx > -1) {
    expandedWorldbooks.value.splice(idx, 1);
  } else {
    expandedWorldbooks.value.push(wbName);
    if (!worldbookEntriesCache.value[wbName]) {
      isLoadingWb.value = wbName;
      emit('fetch-worldbook-entries', wbName, (entries) => {
        worldbookEntriesCache.value[wbName] = entries.filter(
          (e: any) =>
            !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
            !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
        );
        isLoadingWb.value = null;
      });
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

const getEntryType = (entry: any) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

const isPinned = (entry: any) => {
  return props.config?.pinnedEntries?.includes(entry.uid) || false;
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
    return (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0);
  });
};

// 暴露缓存更新方法，以便父组件（如从快照恢复后）可以刷新
defineExpose({
  clearCache: (wbName: string) => {
    delete worldbookEntriesCache.value[wbName];
  },
  refreshExpanded: () => {
    for (const wbName of expandedWorldbooks.value) {
      delete worldbookEntriesCache.value[wbName];
      toggleAccordion(wbName); // 关闭
      toggleAccordion(wbName); // 重新打开
    }
  }
});
</script>

<style scoped>
@import '../styles/theme.scss';

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

.empty-state {
  text-align: center;
  padding: 20px;
  opacity: 0.7;
}

.all-wbs-list .wb-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: opacity 0.3s;
}

.disabled-entry {
  opacity: 0.4;
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
.btn-tiny {
  font-size: 0.75em;
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: white;
}
.btn-success {
  background-color: #28a745;
}
.btn-danger {
  background-color: #dc3545;
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
.icon-btn.tiny {
  font-size: 0.9em;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  margin-right: 5px;
}
.icon-btn.tiny:hover {
  background: rgba(255, 255, 255, 0.1);
}
.pin-icon {
  font-size: 0.9em;
  margin-right: 4px;
}
.pin-btn {
  opacity: 0.5;
}
.pin-btn.pinned {
  opacity: 1;
  background: rgba(255, 165, 0, 0.2);
}
</style>
