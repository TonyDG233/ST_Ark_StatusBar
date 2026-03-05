<template>
  <div v-if="isSystemEnabled"
       class="ark-global-statusbar"
       v-show="isVisible"
       :class="{ 'light-theme': currentConfig?.theme === 'light', 'dark-theme': currentConfig?.theme === 'dark', 'transparent-theme': currentConfig?.theme === 'transparent', 'mini-mode': isMiniMode, 'absolute-positioned': hasAbsolutePos }"
       :style="{
         width: isMiniMode ? 'auto' : displayWidth + 'px',
         fontSize: displayFontSize + 'px',
         transform: `translate(${transformX}px, ${transformY}px)`,
         left: absoluteLeft !== null ? absoluteLeft + 'px' : 'auto',
         top: absoluteTop !== null ? absoluteTop + 'px' : 'auto',
         bottom: absoluteTop !== null ? 'auto' : '60px',
         right: absoluteLeft !== null ? 'auto' : '20px'
       }"
       ref="statusBarEl">
    <div class="statusbar-header" @mousedown="startDrag" @touchstart="startDrag">
      <div class="title" v-if="!isMiniMode">
        <span class="icon">📖</span> 罗德岛终端控制台
      </div>
      <div class="title mini" v-else>
        <span class="icon">📖</span> 终端 (预警: {{pendingEntries.length}})
      </div>
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

    <div class="statusbar-content">
      <!-- Tab 1: Interceptor -->
      <div v-show="currentTab === 'interceptor'" class="tab-panel flex-col">
        <div class="panel-header-action" style="display: flex; align-items: center; gap: 10px;">
          <label>发送预检拦截</label>
          <label class="switch">
            <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor">
            <span class="slider round"></span>
          </label>
        </div>
        
        <div v-if="!currentConfig?.isInterceptorEnabled" class="empty-state">
            ⚠️ 预检拦截已关闭，发送请求将直接通行。
        </div>
        <div v-else-if="pendingEntries.length === 0" class="empty-state">
          当前没有被拦截的发送请求。
          <p class="hint">点击发送按钮时，即将触发的条目将在此等待确认。</p>
        </div>
        <div v-else>
          <div class="warning-box">
            <strong>⚠️ 拦截预警</strong>
            <p>本次回复将触发以下世界书条目：</p>
          </div>
          <ul class="entry-list">
            <li v-for="entry in pendingEntries" :key="entry.uid">
              <span class="entry-name">{{ entry.comment || (entry.key ? entry.key[0] : '未知') }}</span>
              <span class="badge">将被发送</span>
            </li>
          </ul>
          <div class="action-bar compact">
            <button class="btn-success icon-only" @click="confirmSend" title="确认放行 (发送)">✅ 放行</button>
            <button class="btn-danger icon-only" @click="cancelSend" title="取消发送">❎ 阻断</button>
          </div>
        </div>
      </div>

      <!-- Tab 2: All WBs -->
      <div v-show="currentTab === 'all'" class="tab-panel flex-col">
        <div class="filters">
            <input type="text" v-model="filterText" placeholder="搜索名称或触发词..." class="search-input">
            <div class="filter-row">
                <select v-model="filterCategory" class="filter-select">
                    <option value="">全部类别</option>
                    <option v-for="cat in availableCategories" :key="cat" :value="cat">{{ cat }}</option>
                </select>
                <select v-model="filterType" class="filter-select">
                    <option value="">全部类型(蓝/绿灯)</option>
                    <option value="constant">常驻 (🔵 蓝灯)</option>
                    <option value="selective">条件 (🟢 绿灯)</option>
                </select>
            </div>
            <div class="filter-row" style="margin-top: 5px;">
                <button class="btn-danger tiny" @click="resetToBaseline" style="flex:1; padding: 4px; font-size: 0.9em;">↺ 恢复 Baseline</button>
                <button class="btn-warning tiny" @click="closeSingleChar" style="flex:1; padding: 4px; font-size: 0.9em;">⚡ 关闭单字干员</button>
            </div>
        </div>
        <div class="all-wbs-list">
            <div v-for="entry in filteredEntries" :key="entry.uid" class="wb-item" :class="{ 'disabled-entry': !entry.enabled }">
                <div class="wb-info">
                    <div class="wb-name">
                        {{ entry.comment || entry.name || (entry.key ? entry.key[0] : '未知') }}
                    </div>
                    <div class="wb-keys" v-if="entry.key && entry.key.length">触发词: {{ entry.key.join(', ') }}</div>
                </div>
                <div class="wb-action">
                    <button class="icon-btn tiny" @click="toggleEntryType(entry)" :title="getEntryType(entry) === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'">
                        {{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}
                    </button>
                    <label class="switch">
                        <input type="checkbox" v-model="entry.enabled" @change="toggleEntry(entry)">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
            <div v-if="filteredEntries.length === 0" class="empty-state">
                没有找到匹配的条目。
            </div>
        </div>
      </div>

      <!-- Tab 3: History -->
      <div v-show="currentTab === 'history'" class="tab-panel">
        <div v-if="!currentConfig?.commits?.length" class="empty-state">
          暂无修改记录。
        </div>
        <ul v-else class="commit-list">
          <li v-for="commit in [...(currentConfig?.commits || [])].reverse()" :key="commit.id" class="commit-item">
            <div class="commit-header">
              <span class="commit-id">#{{ commit.id }}</span>
              <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
            </div>
            <div class="commit-desc">{{ commit.description }}</div>
            <ul class="commit-changes">
              <li v-for="change in commit.changes" :key="change.uid">
                 {{ change.comment }} : {{ getChangeText(commit, change.from) }} -> {{ getChangeText(commit, change.to) }}
              </li>
            </ul>
            <div class="commit-actions" style="margin-top: 8px; text-align: right;">
                <button class="icon-btn tiny" style="border: 1px solid var(--SmartThemeBorderColor, #444);" @click="revertCommit(commit)" title="撤销此条记录的修改">⏪ 撤销</button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Tab 4: Settings -->
      <div v-show="currentTab === 'settings'" class="tab-panel">
        <div class="setting-item">
          <label>UI 主题</label>
          <div class="theme-buttons">
            <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">默认(白)</button>
            <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
            <button :class="{ active: currentConfig?.theme === 'transparent' }" @click="updateTheme('transparent')">透明</button>
          </div>
        </div>

        <div class="setting-item">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label>发送预检拦截</label>
            <label class="switch">
              <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor">
              <span class="slider round"></span>
            </label>
          </div>
          <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8;">开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。</p>
        </div>

        <div class="setting-item flex-col-align-start">
            <label>UI 宽度 ({{ displayWidth }}px)</label>
            <input type="range" min="200" max="600" step="10"
                   :value="displayWidth"
                   @input="updateUiWidth"
                   @change="commitUiWidth"
                   class="slider-input">
        </div>

        <div class="setting-item flex-col-align-start">
            <label>字体大小 ({{ displayFontSize }}px)</label>
            <input type="range" min="10" max="24" step="1"
                   :value="displayFontSize"
                   @input="updateUiFontSize"
                   @change="commitUiFontSize"
                   class="slider-input">
        </div>

        <div class="setting-action">
          <button class="btn-danger" @click="resetToBaseline">重置世界书至基准线</button>
          <p class="hint warning">将清除所有手动修改记录和开局预设，恢复至角色卡最初的干净状态。</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { StatusBarManager, type ArkConfig } from '../logic/statusbar_manager';
import { WorldbookManager } from '../logic/worldbook_manager';

const isVisible = ref(true); // Now controlled by system state and toggle
const isMiniMode = ref(true);
const currentTab = ref('interceptor');
const pendingEntries = ref<any[]>([]);
const currentConfig = ref<ArkConfig | null>(null);
const allEntries = ref<any[]>([]);

const manager = StatusBarManager.getInstance();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

const toggleMinimize = () => {
    isMiniMode.value = !isMiniMode.value;
    if (isMiniMode.value) {
        currentTab.value = 'interceptor';
    }
};

const getChangeText = (commit: any, value: boolean) => {
    if (commit.description?.includes('changed type')) {
        return value ? '蓝灯(常驻)' : '绿灯(条件)';
    }
    return value ? '开启' : '关闭';
};

// Use local refs for smooth dragging without spamming Worldbook saves
const localUiWidth = ref<number | null>(null);
const localUiFontSize = ref<number | null>(null);

const displayWidth = computed(() => localUiWidth.value ?? currentConfig.value?.uiWidth ?? 400);
const displayFontSize = computed(() => localUiFontSize.value ?? currentConfig.value?.uiFontSize ?? 14);

const updateUiWidth = (e: Event) => {
    const val = Number((e.target as HTMLInputElement).value);
    localUiWidth.value = val;
};
const commitUiWidth = () => {
    if (localUiWidth.value !== null) {
        manager.saveConfig({ uiWidth: localUiWidth.value });
    }
};

const updateUiFontSize = (e: Event) => {
    const val = Number((e.target as HTMLInputElement).value);
    localUiFontSize.value = val;
};
const commitUiFontSize = () => {
    if (localUiFontSize.value !== null) {
        manager.saveConfig({ uiFontSize: localUiFontSize.value });
    }
};

const statusBarEl = ref<HTMLElement | null>(null);

const transformX = ref(0);
const transformY = ref(0);
const absoluteLeft = ref<number | null>(null);
const absoluteTop = ref<number | null>(null);
const hasAbsolutePos = computed(() => absoluteLeft.value !== null && absoluteTop.value !== null);

// --- Tab 2 Filters & Logic ---
const filterText = ref('');
const filterCategory = ref('');
const filterType = ref('');

const availableCategories = computed(() => {
    const cats = new Set<string>();
    allEntries.value.forEach(e => {
        const name = e.name || e.comment || '';
        const match = name.match(/^\[(.*?)\]/);
        if (match) cats.add(match[1]);
        else cats.add('未分类');
    });
    return Array.from(cats).sort();
});

const getEntryType = (entry: any) => {
    return entry.strategy?.type || 'selective';
};

const filteredEntries = computed(() => {
    return allEntries.value.filter(entry => {
        // 1. Text filter
        if (filterText.value) {
            const query = filterText.value.toLowerCase();
            const name = (entry.comment || entry.name || '').toLowerCase();
            const keys = (entry.key || []).join(' ').toLowerCase();
            if (!name.includes(query) && !keys.includes(query)) return false;
        }
        // 2. Category filter
        if (filterCategory.value) {
            const name = entry.name || entry.comment || '';
            const match = name.match(/^\[(.*?)\]/);
            const cat = match ? match[1] : '未分类';
            if (cat !== filterCategory.value) return false;
        }
        // 3. Type filter
        if (filterType.value) {
            if (getEntryType(entry) !== filterType.value) return false;
        }
        return true;
    });
});

const toggleEntryType = async (entry: any) => {
    try {
        const currentType = getEntryType(entry);
        const newType = currentType === 'constant' ? 'selective' : 'constant';
        
        const result = await getCharWorldbookNames('current');
        const targetWorldbook = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
        if (!targetWorldbook) return;

        await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
            const e = wbEntries.find(x => x.uid === entry.uid);
            if (e) {
                if (!e.strategy) e.strategy = {};
                e.strategy.type = newType;
            }
            return wbEntries;
        });

        // Update local state
        if (!entry.strategy) entry.strategy = {};
        entry.strategy.type = newType;

        // Add to commit log
        const newCommit = {
            id: Math.random().toString(36).substr(2, 6),
            timestamp: Date.now(),
            description: `[User manually changed type] ${entry.comment || entry.name}`,
            changes: [{
                uid: entry.uid,
                comment: entry.comment || entry.name,
                from: currentType === 'constant',
                to: newType === 'constant'
            }]
        };
        const commits = [...(currentConfig.value?.commits || []), newCommit];
        manager.saveConfig({ commits });

    } catch (e) {
        console.error("Failed to toggle entry type", e);
    }
};
// --- End Tab 2 Logic ---

// --- Tab 3 Logic ---
const revertCommit = async (commit: any) => {
    if (!confirm(`确定要撤销操作: ${commit.description} 吗？`)) return;

    try {
        const result = await getCharWorldbookNames('current');
        const targetWorldbook = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
        if (!targetWorldbook) return;

        // Apply inverse changes
        await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
            for (const change of commit.changes) {
                const e = wbEntries.find(x => x.uid === change.uid);
                if (e) {
                    // It could be an enabled toggle or a type toggle.
                    // Let's infer it from the description
                    if (commit.description.includes('changed type')) {
                        if (!e.strategy) e.strategy = {};
                        e.strategy.type = change.from ? 'constant' : 'selective';
                    } else {
                        e.enabled = change.from;
                    }
                }
            }
            return wbEntries;
        });

        // Actually drop the commit from history (like a Git hard reset for that specific commit)
        const commits = (currentConfig.value?.commits || []).filter((c: any) => c.id !== commit.id);
        manager.saveConfig({ commits });
        
        await loadAllEntries(); // refresh the view
        toastr.success('撤销成功并已从记录中移除。');
    } catch (e) {
        console.error("Failed to revert commit", e);
        toastr.error('撤销失败，详见控制台。');
    }
};
// --- End Tab 3 Logic ---

// --- Drag Logic ---
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
    
    // Convert to absolute positioning on first interaction so it expands downwards instead of upwards
    if (absoluteLeft.value === null && statusBarEl.value) {
        const rect = statusBarEl.value.getBoundingClientRect();
        absoluteLeft.value = rect.left - transformX.value;
        absoluteTop.value = rect.top - transformY.value;
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
    e.preventDefault(); // Prevent scrolling on mobile
    
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
    
    const dx = clientX - startX;
    const dy = clientY - startY;
    
    transformX.value = initialX + dx;
    transformY.value = initialY + dy;
};

const checkBounds = () => {
    if (!statusBarEl.value) return;
    const rect = statusBarEl.value.getBoundingClientRect();
    const ST_WIN = window.parent || window;
    
    const viewportWidth = ST_WIN.innerWidth;
    const viewportHeight = ST_WIN.innerHeight;

    let newX = transformX.value;
    let newY = transformY.value;

    // Check right edge
    if (rect.right > viewportWidth) {
        newX -= (rect.right - viewportWidth);
    }
    // Check left edge
    if (rect.left < 0) {
        newX += (0 - rect.left);
    }
    // Check bottom edge
    if (rect.bottom > viewportHeight) {
        newY -= (rect.bottom - viewportHeight);
    }
    // Check top edge
    if (rect.top < 0) {
        newY += (0 - rect.top);
    }

    transformX.value = newX;
    transformY.value = newY;
};

const stopDrag = () => {
    isDragging = false;
    const ST_DOC = window.parent?.document || document;
    ST_DOC.removeEventListener('mousemove', onDrag);
    ST_DOC.removeEventListener('touchmove', onDrag);
    ST_DOC.removeEventListener('mouseup', stopDrag);
    ST_DOC.removeEventListener('touchend', stopDrag);
    
    requestAnimationFrame(() => {
        checkBounds();
    });
};
// --- End Drag Logic ---

const loadAllEntries = async () => {
    try {
        const result = await getCharWorldbookNames('current');
        const targetWorldbook = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
        if (targetWorldbook) {
            const entries = await getWorldbook(targetWorldbook);
            // Filter out system config
            allEntries.value = entries.filter((e: any) => e.name !== '[ARK_SYS_CONFIG]' && e.comment !== '[ARK_SYS_CONFIG]');
        }
    } catch (e) {
        console.error("Failed to load worldbook entries", e);
    }
};

onMounted(() => {
    document.addEventListener('ark-config-updated', ((e: CustomEvent) => {
        const config = e.detail;
        const wasNull = !currentConfig.value;
        currentConfig.value = config;
        if (wasNull && config.isSystemEnabled) {
            loadAllEntries();
        }
    }) as EventListener);
    
    if (manager.currentConfig) {
        currentConfig.value = manager.currentConfig;
        if (manager.currentConfig.isSystemEnabled) {
            loadAllEntries();
        }
    }

    // Listen for interceptor trigger
    document.addEventListener('ark-interceptor-triggered', ((e: CustomEvent) => {
        pendingEntries.value = e.detail.entries || [];
        currentTab.value = 'interceptor';
        isMiniMode.value = false;
        // Make sure it's fully visible (not hidden by system off)
        if (!isSystemEnabled.value) {
           manager.saveConfig({ isSystemEnabled: true });
        }
    }) as EventListener);

    requestAnimationFrame(() => {
        checkBounds();
    });

    // Listen for baseline diff
    document.addEventListener('ark-baseline-diff-detected', () => {
        if (typeof toastr !== 'undefined') {
            toastr.warning(
                '检测到当前世界书带有开局剧情或手动修改的残余状态。为防止剧情串台，建议在侧边栏重置。',
                'ARK_STATUSBAR 提示',
                { timeOut: 8000, positionClass: "toast-top-center" }
            );
        }
    });

    // Listen for toggle visibility from TavernHelper button
    document.addEventListener('ark-toggle-system', () => {
        const newState = !(currentConfig.value?.isSystemEnabled ?? true);
        manager.saveConfig({ isSystemEnabled: newState });
        
        if (newState) {
            loadAllEntries();
            requestAnimationFrame(() => {
                checkBounds();
            });
        }
    });
    
    const ST_WIN = window.parent || window;
    ST_WIN.addEventListener('resize', checkBounds);
});

const closePanel = () => {
    isMiniMode.value = true;
};

const confirmSend = () => {
    pendingEntries.value = [];
    manager.releaseInterceptAndSend();
    closePanel();
};

const cancelSend = () => {
    pendingEntries.value = [];
    closePanel();
};

const updateTheme = (theme: 'light' | 'dark' | 'transparent') => {
    manager.saveConfig({ theme });
};

const toggleInterceptor = (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    manager.saveConfig({ isInterceptorEnabled: checked });
};

const resetToBaseline = async () => {
    if (confirm('确定要一键还原至初始状态吗？这将清空历史修改记录。')) {
        await WorldbookManager.resetToBaseline();
        manager.saveConfig({ commits: [] });
        await loadAllEntries();
        toastr.success('已恢复基准线。');
    }
};

const closeSingleChar = async () => {
    if (confirm('确定要一键关闭所有单字干员世界书吗？')) {
        await WorldbookManager.closeSingleCharEntries();
        await loadAllEntries();
    }
};

const toggleEntry = async (entry: any) => {
    try {
        const result = await getCharWorldbookNames('current');
        const targetWorldbook = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
        if (!targetWorldbook) return;

        await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
            const e = wbEntries.find(x => x.uid === entry.uid);
            if (e) e.enabled = entry.enabled;
            return wbEntries;
        });

        // Add to commit log
        const newCommit = {
            id: Math.random().toString(36).substr(2, 6),
            timestamp: Date.now(),
            description: `[User manually toggled] ${entry.comment || entry.name}`,
            changes: [{
                uid: entry.uid,
                comment: entry.comment || entry.name,
                from: !entry.enabled,
                to: entry.enabled
            }]
        };
        const commits = [...(currentConfig.value?.commits || []), newCommit];
        manager.saveConfig({ commits });

    } catch (e) {
        console.error("Failed to toggle entry", e);
        entry.enabled = !entry.enabled; // revert UI
    }
};
</script>

<style scoped>
.ark-global-statusbar {
  position: fixed;
  width: 400px;
  max-width: 90vw;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: sans-serif;
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease, opacity 0.3s ease;
}

.ark-global-statusbar:not(.absolute-positioned) {
  bottom: 60px;
  right: 20px;
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
    border: 1px solid rgba(255,255,255,0.1);
    color: #eee;
}

.ark-global-statusbar.mini-mode {
    width: auto;
    min-width: 150px;
    max-width: 250px;
    border-radius: 20px;
    opacity: 0.8;
    font-size: 0.85em;
}

.ark-global-statusbar.mini-mode:not(.absolute-positioned) {
    bottom: 60px;
    right: 20px;
}

.ark-global-statusbar.mini-mode .tab-header {
    display: none; /* Hide tabs in mini mode to save space */
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
  background: rgba(0,0,0,0.2);
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
  background: rgba(0,0,0,0.1);
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

.empty-state {
    text-align: center;
    padding: 20px;
    opacity: 0.7;
}

.hint {
    font-size: 0.85em;
    opacity: 0.8;
    margin-top: 5px;
}

.warning-box {
    background: rgba(255, 165, 0, 0.2);
    border-left: 4px solid orange;
    padding: 10px;
    margin-bottom: 15px;
}

.entry-list {
    list-style: none;
    padding: 0;
    margin: 0 0 15px 0;
}

.entry-list li {
    padding: 8px;
    background: rgba(0,0,0,0.2);
    margin-bottom: 5px;
    border-radius: 4px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.entry-list .badge {
    font-size: 0.8em;
    background: #007bff;
    padding: 2px 6px;
    border-radius: 4px;
}

.action-bar {
    display: flex;
    gap: 10px;
}

.btn-primary, .btn-danger, .btn-success {
    flex: 1;
    padding: 10px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: bold;
    color: white;
}
.btn-primary { background: #007bff; }
.btn-primary:hover { background: #0056b3; }
.btn-danger { background: #dc3545; }
.btn-danger:hover { background: #a71d2a; }
.btn-success { background: #28a745; }
.btn-success:hover { background: #218838; }

.all-wbs-list .wb-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
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

.wb-name { font-weight: bold; }
.wb-keys { font-size: 0.8em; opacity: 0.7; }

/* Switch style */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}
.switch input { opacity: 0; width: 0; height: 0; }
.slider {
  position: absolute;
  cursor: pointer;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: #ccc;
  transition: .4s;
}
.slider:before {
  position: absolute;
  content: "";
  height: 16px; width: 16px;
  left: 2px; bottom: 2px;
  background-color: white;
  transition: .4s;
}
input:checked + .slider { background-color: #007bff; }
input:checked + .slider:before { transform: translateX(20px); }
.slider.round { border-radius: 20px; }
.slider.round:before { border-radius: 50%; }

.commit-list {
    list-style: none;
    padding: 0;
    margin: 0;
}
.commit-item {
    padding: 10px;
    background: rgba(0,0,0,0.2);
    margin-bottom: 10px;
    border-radius: 4px;
}
.commit-header {
    display: flex;
    justify-content: space-between;
    font-size: 0.85em;
    opacity: 0.7;
    margin-bottom: 5px;
}
.commit-id { font-family: monospace; }
.commit-desc { font-weight: bold; margin-bottom: 5px; }
.commit-changes {
    margin: 0;
    padding-left: 20px;
    font-size: 0.9em;
}

.setting-item {
    margin-bottom: 15px;
}
.theme-buttons {
    display: flex;
    gap: 10px;
    margin-top: 5px;
}
.theme-buttons button {
    flex: 1;
    padding: 8px;
    border: 1px solid var(--SmartThemeBorderColor, #444);
    background: transparent;
    color: inherit;
    cursor: pointer;
}
.theme-buttons button.active {
    background: #007bff;
    border-color: #007bff;
}

.flex-col-align-start {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
}
.slider-input {
    width: 100%;
    cursor: pointer;
}
.btn-warning { background: #ff9800; border: none; border-radius: 4px; color: white; cursor: pointer; }
.btn-warning:hover { background: #e68a00; }

.setting-action {
    margin-top: 25px;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 15px;
}

/* Filters & Layout additions */
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
    background: rgba(0,0,0,0.1);
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
    background: rgba(0,0,0,0.1);
    color: inherit;
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
    background: rgba(255,255,255,0.1);
}

.action-bar.compact {
    gap: 5px;
}

.icon-only {
    flex: 1;
    font-size: 1.2em;
    padding: 5px;
}

.panel-header-action {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    margin-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}
</style>
