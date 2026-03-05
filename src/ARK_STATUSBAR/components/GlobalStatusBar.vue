<template>
  <div class="ark-global-statusbar" v-show="isVisible" :class="{ 'dark-theme': currentConfig?.theme === 'dark' }">
    <div class="statusbar-header">
      <div class="title">
        <span class="icon">📖</span> 罗德岛终端控制台
      </div>
      <div class="controls">
        <button class="close-btn" @click="closePanel">×</button>
      </div>
    </div>

    <div class="statusbar-tabs">
      <button :class="{ active: currentTab === 'interceptor' }" @click="currentTab = 'interceptor'">拦截预警</button>
      <button :class="{ active: currentTab === 'all' }" @click="currentTab = 'all'">全部条目</button>
      <button :class="{ active: currentTab === 'history' }" @click="currentTab = 'history'">记录(Git)</button>
      <button :class="{ active: currentTab === 'settings' }" @click="currentTab = 'settings'">设置</button>
    </div>

    <div class="statusbar-content">
      <!-- Tab 1: Interceptor -->
      <div v-show="currentTab === 'interceptor'" class="tab-panel">
        <div v-if="pendingEntries.length === 0" class="empty-state">
          当前没有被拦截的发送请求。
          <p class="hint">当预检拦截系统开启且点击发送时，触发的世界书将在此显示并等待放行。</p>
        </div>
        <div v-else>
          <div class="warning-box">
            <strong>⚠️ 拦截预警</strong>
            <p>本次回复将触发以下世界书条目，请确认是否放行：</p>
          </div>
          <ul class="entry-list">
            <li v-for="entry in pendingEntries" :key="entry.uid">
              <span class="entry-name">{{ entry.comment || (entry.key ? entry.key[0] : '未知') }}</span>
              <span class="badge">将被发送给大模型</span>
            </li>
          </ul>
          <div class="action-bar">
            <button class="btn-primary" @click="confirmSend">确认放行 (发送)</button>
            <button class="btn-danger" @click="cancelSend">取消发送</button>
          </div>
        </div>
      </div>

      <!-- Tab 2: All WBs -->
      <div v-show="currentTab === 'all'" class="tab-panel">
        <div class="all-wbs-list">
            <div v-for="entry in allEntries" :key="entry.uid" class="wb-item">
                <div class="wb-info">
                    <div class="wb-name">{{ entry.comment || entry.name || (entry.key ? entry.key[0] : '未知') }}</div>
                    <div class="wb-keys" v-if="entry.key && entry.key.length">触发词: {{ entry.key.join(', ') }}</div>
                </div>
                <div class="wb-action">
                    <label class="switch">
                        <input type="checkbox" v-model="entry.enabled" @change="toggleEntry(entry)">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        </div>
      </div>

      <!-- Tab 3: History -->
      <div v-show="currentTab === 'history'" class="tab-panel">
        <div v-if="!currentConfig?.commits?.length" class="empty-state">
          暂无修改记录。
        </div>
        <ul v-else class="commit-list">
          <li v-for="commit in [...currentConfig.commits].reverse()" :key="commit.id" class="commit-item">
            <div class="commit-header">
              <span class="commit-id">#{{ commit.id }}</span>
              <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
            </div>
            <div class="commit-desc">{{ commit.description }}</div>
            <ul class="commit-changes">
              <li v-for="change in commit.changes">
                 {{ change.comment }} : {{ change.from ? '开启' : '关闭' }} -> {{ change.to ? '开启' : '关闭' }}
              </li>
            </ul>
          </li>
        </ul>
      </div>

      <!-- Tab 4: Settings -->
      <div v-show="currentTab === 'settings'" class="tab-panel">
        <div class="setting-item">
          <label>UI 主题</label>
          <div class="theme-buttons">
            <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">默认</button>
            <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间</button>
          </div>
        </div>

        <div class="setting-item">
          <label>发送预检拦截</label>
          <label class="switch">
            <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor">
            <span class="slider round"></span>
          </label>
          <p class="hint">开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。</p>
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
import { onMounted, ref } from 'vue';
import { StatusBarManager, type ArkConfig } from '../logic/statusbar_manager';
import { WorldbookManager } from '../logic/worldbook_manager';

const isVisible = ref(false);
const currentTab = ref('interceptor');
const pendingEntries = ref<any[]>([]);
const currentConfig = ref<ArkConfig | null>(null);
const allEntries = ref<any[]>([]);

const manager = StatusBarManager.getInstance();

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
    manager.onConfigUpdate = (config) => {
        currentConfig.value = config;
    };
    if (manager.currentConfig) {
        currentConfig.value = manager.currentConfig;
    }

    // Listen for interceptor trigger
    document.addEventListener('ark-interceptor-triggered', ((e: CustomEvent) => {
        pendingEntries.value = e.detail.entries || [];
        currentTab.value = 'interceptor';
        isVisible.value = true;
    }) as EventListener);

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
    document.addEventListener('ark-toggle-statusbar', () => {
        isVisible.value = !isVisible.value;
        if (isVisible.value) {
            loadAllEntries();
            if (currentTab.value === 'interceptor' && pendingEntries.value.length === 0) {
                currentTab.value = 'all';
            }
        }
    });
});

const closePanel = () => {
    isVisible.value = false;
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

const updateTheme = (theme: 'light' | 'dark') => {
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
  bottom: 60px;
  right: 20px;
  width: 400px;
  max-width: 90vw;
  background: var(--SmartThemeBlurTintColor, #2c2f33);
  border: 1px solid var(--SmartThemeBorderColor, #444);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: sans-serif;
  color: var(--SmartThemeBodyColor, #eee);
  transition: all 0.3s ease;
}

.ark-global-statusbar.dark-theme {
    background: #1a1a1a;
    border-color: #333;
    color: #ccc;
}

.statusbar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(0,0,0,0.2);
  border-bottom: 1px solid var(--SmartThemeBorderColor, #444);
  font-weight: bold;
}

.statusbar-header .close-btn {
    background: transparent;
    border: none;
    color: inherit;
    font-size: 1.2em;
    cursor: pointer;
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

.btn-primary, .btn-danger {
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

.all-wbs-list .wb-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255,255,255,0.1);
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
.setting-action {
    margin-top: 25px;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 15px;
}
</style>
