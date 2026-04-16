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
              {{ wb.type === 'char' ? '角色绑定' : wb.type === 'global' ? '已挂载' : '未挂载' }}
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
          <div class="filters" style="margin-bottom: 5px">
            <input
              type="text"
              v-model="filterEntryTexts[wb.name]"
              placeholder="搜索此书内的条目名称或触发词..."
              class="search-input"
              style="margin-bottom: 5px"
            />
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
          <div v-if="isLoadingWb === wb.name" class="empty-state" style="padding: 10px">加载中...</div>
          <div
            v-else-if="!worldbookEntriesCache[wb.name] || worldbookEntriesCache[wb.name].length === 0"
            class="empty-state"
            style="padding: 10px"
          >
            此世界书没有包含有效条目。
          </div>
          <div v-else class="wb-entries-container">
            <!-- 【性能修复】替换原有的大循环为动态计算属性渲染，防止在模板里重复调用复杂过滤函数 -->
            <template v-for="entry in getVisibleEntries(wb.name)" :key="entry.uid">
              <div
                class="wb-item"
                :class="{ 'disabled-entry': !entry.enabled }"
              >
                <div class="wb-info">
                  <div class="wb-name">
                    <!-- 【性能修复】直接读取对象上的 _isPinned 缓存值 -->
                    <span v-if="entry._isPinned" class="pin-icon">📌</span>
                    {{ entry.name || (entry.strategy?.keys ? entry.strategy.keys[0] : '未知') }}
                  </div>
                  <div class="wb-keys" v-if="entry.strategy?.keys && entry.strategy.keys.length">
                    触发词: {{ entry.strategy.keys.join(', ') }}
                  </div>
                </div>
                <div class="wb-action">
                  <button
                    class="icon-btn tiny"
                    @click="toggleEditEntry(entry)"
                    title="编辑完整属性"
                  >
                    ✏️
                  </button>
                  <button
                    class="icon-btn tiny pin-btn"
                    @click="togglePinEntry(entry)"
                    :title="entry._isPinned ? '取消置顶' : '偏好置顶'"
                    :class="{ pinned: entry._isPinned }"
                  >
                    {{ entry._isPinned ? '📌' : '📍' }}
                  </button>
                  <button
                    class="icon-btn tiny"
                    @click="toggleEntryType(entry, wb.name)"
                    :title="
                      entry._computedType === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'
                    "
                  >
                    {{ entry._computedType === 'constant' ? '🔵' : '🟢' }}
                  </button>
                  <label class="switch">
                    <input type="checkbox" v-model="entry.enabled" @change="toggleEntry(entry, wb.name)" />
                    <span class="slider round"></span>
                  </label>
                </div>
              </div>
              
              <!-- 内联展开的完整编辑器 -->
              <WorldbookEntryEditor 
                v-if="editingEntryUid === entry.uid"
                :entry="entry" 
                @save="(changes, newEntry) => handleSaveEntry(changes, newEntry, wb.name)" 
                @cancel="editingEntryUid = null" 
              />
            </template>
            <!-- 渐进式加载：点击加载更多区块 -->
            <div v-if="hasMoreEntries(wb.name)" class="load-more-container" style="text-align: center; padding: 10px 0">
              <button
                class="btn-primary"
                style="
                  padding: 4px 12px;
                  font-size: 0.9em;
                  border-radius: 4px;
                  background: rgba(0, 123, 255, 0.2);
                  cursor: pointer;
                "
                @click="loadMoreEntries(wb.name)"
              >
                往下加载更多... (当前显示 {{ getVisibleEntries(wb.name).length }} /
                {{ (processedEntries[wb.name] || []).length }})
              </button>
            </div>

            <div v-if="(processedEntries[wb.name] || []).length === 0" class="empty-state" style="padding: 5px">
              没有找到匹配的条目。
            </div>
          </div>
        </div>
      </div>
      <div v-if="filteredWorldbooks.length === 0" class="empty-state">没有找到匹配的世界书。</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { configStore, useArkConfig } from '../../../core/config_store';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import { ArkCommitChange } from '../../../types/system_config';
import {
  allAvailableWorldbooks,
  charBoundWorldbooks,
  CONFIG_ENTRY_PREFIX,
  currentPrimaryWorldbook,
  expandedWorldbooks,
  globalMountedWorldbooks,
  isLoadingWb,
  UIWorldbookEntry,
  worldbookEntriesCache,
} from '../shared_ui_state';
import WorldbookEntryEditor from './WorldbookEntryEditor.vue';

const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

// --- Local UI State for Worldbook Tab ---
const filterText = ref('');
const filterCategory = ref('');
const filterType = ref('');
const filterEntryTexts = ref<Record<string, string>>({});

// 【性能修复】保留这个基础函数供内部计算和外部点击使用，必须声明在被调用前
const getEntryType = (entry: UIWorldbookEntry) => {
  return entry.strategy?.type || 'selective';
};

// --- Editor UI State ---
const editingEntryUid = ref<number | null>(null);

const toggleEditEntry = (entry: UIWorldbookEntry) => {
  if (editingEntryUid.value === entry.uid) {
    editingEntryUid.value = null; // 关闭
  } else {
    editingEntryUid.value = entry.uid; // 打开
  }
};

const handleSaveEntry = async (changes: ArkCommitChange[], newEntry: UIWorldbookEntry, explicitWbName: string) => {
  try {
    const targetWorldbook = explicitWbName || newEntry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
      const idx = wbEntries.findIndex(x => x.uid === newEntry.uid);
      if (idx !== -1) {
        // 全量覆盖修改后的 entry
        wbEntries[idx] = { ...newEntry };
      }
      return wbEntries;
    });

    // 主动通知底层修改
    document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }));

    // 判断是否是 heavy commit (包含 content 的修改)
    const isHeavy = changes.some(c => c.path === 'content');

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[修改条目属性] ${newEntry.name || '未命名条目'}`,
      worldbook: targetWorldbook,
      isHeavy,
      changes,
    };
    configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });

    editingEntryUid.value = null;
    if (typeof toastr !== 'undefined') toastr.success('保存成功');
  } catch (e) {
    console.error('Failed to save entry', e);
    if (typeof toastr !== 'undefined') toastr.error('保存失败，请检查控制台');
  }
};

// 【性能修复】提取原模板中的计算密集型操作至专门的计算属性，避免模板重渲染卡顿
const processedEntries = computed(() => {
  const result: Record<string, UIWorldbookEntry[]> = {};
  for (const wbName of expandedWorldbooks.value) {
    const entries = worldbookEntriesCache.value[wbName] || [];
    if (!entries.length) {
      result[wbName] = [];
      continue;
    }

    // 1. 预处理数据 (挂载 _isPinned 和 _computedType) 避免模板中重复计算
    let mapped = entries.map((entry: any) => ({
      ...entry,
      _isPinned: currentConfig.value?.pinnedEntries?.includes(entry.uid) || false,
      _computedType: getEntryType(entry as UIWorldbookEntry),
    })) as UIWorldbookEntry[];

    // 2. 过滤
    const searchText = filterEntryTexts.value[wbName];
    if (searchText) {
      const query = searchText.toLowerCase();
      mapped = mapped.filter(entry => {
        const name = (entry.name || '').toLowerCase();
        const keys = (entry.strategy?.keys || []).join(' ').toLowerCase();
        return name.includes(query) || keys.includes(query);
      });
    }

    if (filterCategory.value) {
      mapped = mapped.filter(entry => {
        const name = entry.name || '';
        const match = name.match(/^\[(.*?)\]/);
        const cat = match ? match[1] : '未分类';
        return cat === filterCategory.value;
      });
    }

    if (filterType.value) {
      mapped = mapped.filter(entry => entry._computedType === filterType.value);
    }

    // 3. 排序
    mapped.sort((a, b) => (b._isPinned ? 1 : 0) - (a._isPinned ? 1 : 0));

    // 全量结果返回，不再进行强截断，而是通过分页加载 (Progressive Rendering)
    result[wbName] = mapped;
  }
  return result;
});

// 渐进式分页控制：每个世界书当前允许展示的条目数量上限
const displayLimits = ref<Record<string, number>>({});

// 默认每页展示大小
const PAGE_SIZE = 50;

// 获取当前应该展示的子列表
const getVisibleEntries = (wbName: string) => {
  const limit = displayLimits.value[wbName] || PAGE_SIZE;
  return (processedEntries.value[wbName] || []).slice(0, limit);
};

// 检查是否还有更多内容可以加载
const hasMoreEntries = (wbName: string) => {
  const currentLimit = displayLimits.value[wbName] || PAGE_SIZE;
  const total = (processedEntries.value[wbName] || []).length;
  return currentLimit < total;
};

// 加载更多
const loadMoreEntries = (wbName: string) => {
  const currentLimit = displayLimits.value[wbName] || PAGE_SIZE;
  displayLimits.value[wbName] = currentLimit + PAGE_SIZE;
};

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
    const getScore = (wb: { type: string; isPinned: boolean }) => {
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
    // 【体验优化】展开新世界书时自动关闭旧的，并重置分页限制
    expandedWorldbooks.value = [wbName];
    displayLimits.value[wbName] = PAGE_SIZE;

    if (!worldbookEntriesCache.value[wbName]) {
      isLoadingWb.value = wbName;
      try {
        const entries = (await getWorldbook(wbName)) as unknown as UIWorldbookEntry[];
        worldbookEntriesCache.value[wbName] = entries.filter(
          (e: UIWorldbookEntry) => !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)),
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
    const name = e.name || '';
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

const togglePinEntry = (entry: UIWorldbookEntry) => {
  const pinned = currentConfig.value?.pinnedEntries || [];
  const index = pinned.indexOf(entry.uid);
  let newPinned = [...pinned];
  if (index === -1) newPinned.push(entry.uid);
  else newPinned.splice(index, 1);
  configStore.updateConfig({ pinnedEntries: newPinned });
};

const toggleEntryType = async (entry: UIWorldbookEntry, explicitWbName?: string) => {
  try {
    const currentType = getEntryType(entry);
    const newType = currentType === 'constant' ? 'selective' : 'constant';
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid && x.name === entry.name);
      if (e) {
        if (!e.strategy)
          e.strategy = {
            type: 'selective',
            keys: [],
            keys_secondary: { logic: 'and_any', keys: [] },
            scan_depth: 'same_as_global',
          };
        e.strategy.type = newType as 'constant' | 'selective';
      }
      return wbEntries;
    });

    // 主动通知底层修改
    document.dispatchEvent(new CustomEvent('ark:worldbook:data_changed'));

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动修改触发类型] ${entry.name}`,
      worldbook: targetWorldbook,
      changes: [
        {
          uid: entry.uid,
          comment: entry.name,
          from: currentType === 'constant',
          to: newType === 'constant',
        },
      ],
    };
    configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
  } catch (e) {
    console.error('Failed to toggle entry type', e);
  }
};

const toggleEntry = async (entry: UIWorldbookEntry, explicitWbName?: string) => {
  try {
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid);
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });

    // 主动通知底层修改
    document.dispatchEvent(new CustomEvent('ark:worldbook:data_changed'));

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动切换开关] ${entry.name}`,
      worldbook: targetWorldbook,
      changes: [{ uid: entry.uid, comment: entry.name, from: !entry.enabled, to: entry.enabled }],
    };
    configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
  } catch (e) {
    console.error('Failed to toggle entry', e);
    // 此处还原开关视图，因为底层可能修改失败
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
