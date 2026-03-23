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
      width: isMiniMode ? 'auto' : displayWidth + 'px',
      fontSize: displayFontSize + 'px',
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
      <div v-show="currentTab === 'interceptor'" class="tab-panel flex-col">
        <div
          class="panel-header-action"
          style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap"
        >
          <div style="display: flex; align-items: center; gap: 10px">
            <label>发送预检拦截</label>
            <label class="switch">
              <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
              <span class="slider round"></span>
            </label>
          </div>
          <button
            class="icon-btn tiny"
            style="border: 1px solid var(--SmartThemeBorderColor, #444); padding: 4px 8px"
            @click="runManualTest"
            title="主动测试当前输入和上下文会触发的条目"
          >
            🔍 主动检测
          </button>
        </div>

        <div v-if="!currentConfig?.isInterceptorEnabled && !isTestMode" class="empty-state">
          ⚠️ 预检拦截已关闭，发送请求将直接通行。
        </div>
        <div v-else-if="pendingEntries.length === 0" class="empty-state">
          <div v-if="!isTestMode">
            当前没有被拦截的发送请求。
            <p class="hint">点击发送按钮时，即将触发的条目将在此等待确认。</p>
          </div>
          <div v-else>
            <strong style="color: #007bff">🔍 测试结果</strong>
            <p>根据当前上下文，未触发任何条件世界书条目。</p>
            <div class="action-bar compact" style="margin-top: 15px">
              <button class="btn-primary" @click="clearTestResults" title="清除测试结果">清除测试结果</button>
            </div>
          </div>

          <div v-if="!isTestMode && lastTriggeredEntries.length > 0" class="last-record-box">
            <hr class="record-divider" />
            <strong>上一轮触发记录</strong>
            <ul class="entry-list read-only">
              <li
                v-for="entry in sortedLastTriggeredEntries"
                :key="entry.uid || Math.random()"
                :class="{ 'disabled-entry': !entry.enabled }"
              >
                <div class="entry-info">
                  <span class="entry-name">
                    <span v-if="isPinned(entry)" class="pin-icon">📌</span>
                    <span style="font-size: 0.9em; margin-right: 4px;">{{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}</span>
                    {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
                    <span v-if="entry.world" style="font-size: 0.8em; opacity: 0.7; margin-left: 5px;">({{ entry.world }})</span>
                  </span>
                  <span class="badge" v-if="entry.enabled !== false">已发送</span>
                  <span class="badge blocked" v-else>已阻断</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
        <div v-else>
          <div
            class="warning-box"
            :style="isTestMode ? 'background: rgba(0, 123, 255, 0.2); border-left-color: #007bff;' : ''"
          >
            <strong v-if="!isTestMode">⚠️ 拦截预警</strong>
            <strong v-else>🔍 测试结果</strong>
            <p v-if="!isTestMode">
              本次回复将触发以下世界书条目：<br />
              <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
            </p>
            <p v-else>
              根据当前上下文，模拟检测触发了以下条目：<br />
              <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
            </p>
          </div>
          <ul class="entry-list stacked">
            <li
              v-for="entry in sortedPendingEntries"
              :key="entry.uid || Math.random()"
              :class="{ 'disabled-entry': entry.enabled === false && !entry.tempDisabled }"
            >
              <div class="entry-name">
                <span v-if="isPinned(entry)" class="pin-icon">📌</span>
                <span style="font-size: 0.9em; margin-right: 4px;">{{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}</span>
                {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
                <div v-if="entry.world" style="font-size: 0.75em; color: var(--ui-text-secondary); margin-top: 2px;">
                  📁 来源: {{ entry.world }}
                </div>
              </div>
              <div class="entry-footer">
                <div class="status-badges">
                  <span class="badge" v-if="entry.enabled !== false && !entry.tempDisabled">将被发送</span>
                  <span class="badge warning" v-else-if="entry.tempDisabled">临时阻断</span>
                  <span class="badge blocked" v-else>已阻断</span>
                </div>
                <div class="action-btns">
                  <!-- 如果当前是彻底关闭状态，只显示恢复开启 -->
                  <button
                    v-if="entry.enabled === false && !entry.tempDisabled"
                    class="icon-btn tiny"
                    style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                    title="重新开启此条目"
                    @click="togglePendingEntry(entry)"
                  >
                    ✅ 开启
                  </button>

                  <template v-else>
                    <button
                      v-if="!entry.tempDisabled"
                      class="icon-btn tiny"
                      style="color: #ff9800; border-color: rgba(255, 152, 0, 0.4)"
                      title="本次发送阻断，发送后自动恢复"
                      @click="toggleTempDisable(entry)"
                    >
                      ⏳ 单次
                    </button>
                    <button
                      v-else
                      class="icon-btn tiny"
                      style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                      title="取消临时阻断，重新加入本次发送"
                      @click="toggleTempDisable(entry)"
                    >
                      ✅ 恢复
                    </button>
                    <button
                      class="icon-btn tiny"
                      style="color: #dc3545; border-color: rgba(220, 53, 69, 0.4)"
                      title="彻底阻断此条目，不再自动恢复"
                      @click="togglePendingEntry(entry)"
                    >
                      ❎ 彻底
                    </button>
                  </template>
                </div>
              </div>
            </li>
          </ul>
          <div class="action-bar compact" v-if="!isTestMode">
            <button class="btn-success" @click="confirmSend" title="确认发送">确认发送</button>
            <button class="btn-danger" @click="cancelSend" title="取消发送">取消发送</button>
          </div>
          <div class="action-bar compact" v-else>
            <button class="btn-primary" @click="clearTestResults" title="清除测试结果">清除测试结果</button>
          </div>
        </div>
      </div>

      <!-- Tab 2: All WBs -->
      <div v-show="currentTab === 'all'" class="tab-panel flex-col">
        <div class="filters">
          <input type="text" v-model="filterText" placeholder="搜索名称或触发词..." class="search-input" />
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
          <div class="filter-row" style="margin-top: 5px">
            <button class="btn-danger tiny" @click="resetToBaseline" style="flex: 1; padding: 4px; font-size: 0.9em">
              ↺ 恢复初始状态
            </button>
            <button class="btn-warning tiny" @click="closeSingleChar" style="flex: 1; padding: 4px; font-size: 0.9em">
              ⚡ 关闭单字干员
            </button>
          </div>
        </div>
        <div class="all-wbs-list">
          <div
            v-for="entry in filteredEntries"
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
                @click="togglePin(entry)"
                :title="isPinned(entry) ? '取消置顶' : '偏好置顶'"
                :class="{ pinned: isPinned(entry) }"
              >
                {{ isPinned(entry) ? '📌' : '📍' }}
              </button>
              <button
                class="icon-btn tiny"
                @click="toggleEntryType(entry)"
                :title="
                  getEntryType(entry) === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'
                "
              >
                {{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}
              </button>
              <label class="switch">
                <input type="checkbox" v-model="entry.enabled" @change="toggleEntry(entry)" />
                <span class="slider round"></span>
              </label>
            </div>
          </div>
          <div v-if="filteredEntries.length === 0" class="empty-state">没有找到匹配的条目。</div>
        </div>
      </div>

      <!-- Tab 3: History -->
      <div v-show="currentTab === 'history'" class="tab-panel">
        <div v-if="!currentConfig?.commits?.length" class="empty-state">暂无修改记录。</div>
        <ul v-else class="commit-list">
          <li v-for="commit in [...(currentConfig?.commits || [])].reverse()" :key="commit.id" class="commit-item">
            <div class="commit-header">
              <span class="commit-id">#{{ commit.id }}</span>
              <span class="commit-time">{{ new Date(commit.timestamp).toLocaleString() }}</span>
            </div>
            <div class="commit-desc">{{ commit.description }}</div>
            <ul class="commit-changes">
              <li v-for="change in commit.changes" :key="change.uid">
                {{ change.comment }} : {{ getChangeText(commit, change.from) }} ->
                {{ getChangeText(commit, change.to) }}
              </li>
            </ul>
            <div class="commit-actions" style="margin-top: 8px; text-align: right">
              <button
                class="icon-btn tiny"
                style="border: 1px solid var(--SmartThemeBorderColor, #444)"
                @click="revertCommit(commit)"
                title="撤销此条记录的修改"
              >
                ⏪ 撤销
              </button>
            </div>
          </li>
        </ul>
      </div>

      <!-- Tab 4: Settings -->
      <div v-show="currentTab === 'settings'" class="tab-panel">
        <div class="setting-item">
          <label>UI 主题</label>
          <div class="theme-buttons">
            <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">
              默认(白)
            </button>
            <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
            <button :class="{ active: currentConfig?.theme === 'transparent' }" @click="updateTheme('transparent')">
              透明
            </button>
          </div>
        </div>

        <div class="setting-item">
          <div style="display: flex; align-items: center; gap: 10px">
            <label>发送预检拦截</label>
            <label class="switch">
              <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
              <span class="slider round"></span>
            </label>
          </div>
          <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
            开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。
          </p>
        </div>

        <div class="setting-item">
          <div style="display: flex; align-items: center; gap: 10px">
            <label>回车键拦截预警</label>
            <label class="switch">
              <input
                type="checkbox"
                :checked="currentConfig?.enableEnterToIntercept"
                @change="toggleEnterInterceptor"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
            开启后，按下回车键发送也将被拦截预览。默认关闭，以方便习惯回车换行或原生发送的用户。
          </p>
        </div>

        <div class="setting-item">
          <div style="display: flex; align-items: center; gap: 10px">
            <label>显示常驻(蓝灯)条目</label>
            <label class="switch">
              <input
                type="checkbox"
                :checked="currentConfig?.showConstantEntries"
                @change="toggleShowConstantEntries"
              />
              <span class="slider round"></span>
            </label>
          </div>
          <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
            开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
          </p>
        </div>

        <div class="setting-item">
          <div style="display: flex; align-items: center; gap: 10px">
            <label style="color: #dc3545; font-weight: bold">🔧 开启调试日志导出</label>
            <label class="switch">
              <input type="checkbox" :checked="currentConfig?.isDebugMode" @change="toggleDebugMode" />
              <span class="slider round" :style="currentConfig?.isDebugMode ? 'background-color: #dc3545;' : ''"></span>
            </label>
          </div>
          <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8; color: #dc3545">
            开启后将记录所有底层检测流。当遇到检测失效等 Bug 时，请开启此项，进行一次检测，然后检查名为
            "[SYS_DEBUG]系统调试日志导出" 的世界书条目内容并反馈给开发者。
          </p>
        </div>

        <div class="setting-item flex-col-align-start">
          <label>UI 宽度 ({{ displayWidth }}px)</label>
          <input
            type="range"
            min="200"
            max="600"
            step="10"
            :value="displayWidth"
            @input="updateUiWidth"
            @change="commitUiWidth"
            class="slider-input"
          />
        </div>

        <div class="setting-item flex-col-align-start">
          <label>字体大小 ({{ displayFontSize }}px)</label>
          <input
            type="range"
            min="10"
            max="24"
            step="1"
            :value="displayFontSize"
            @input="updateUiFontSize"
            @change="commitUiFontSize"
            class="slider-input"
          />
        </div>

        <div class="setting-action">
          <div style="margin-bottom: 15px">
            <button class="btn-warning" @click="clearPins">清空所有偏好置顶</button>
            <p class="hint">取消全部条目的置顶状态。</p>
          </div>

          <div style="border-top: 1px dashed rgba(128, 128, 128, 0.3); padding-top: 15px">
            <button class="btn-danger" @click="resetToBaseline">重置世界书至初始状态</button>
            <p class="hint warning">将清除所有手动修改记录和开局预设，恢复至角色卡最初的干净状态。</p>
          </div>
        </div>
      </div>
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
import { CONFIG_ENTRY_PREFIX, type ArkConfig } from '../config/system_config';
import { StatusBarManager } from '../logic/statusbar_manager';
import { WorldbookManager } from '../logic/worldbook_manager';

// --- 全局与 UI 状态 ---
const isVisible = ref(true); // 控制整个面板的显示与隐藏，受系统总开关控制
const isMiniMode = ref(true); // 控制面板是否处于缩小(胶囊)模式
const currentTab = ref('interceptor'); // 当前选中的标签页: interceptor, all, history, settings
const pendingEntries = ref<any[]>([]); // 拦截器捕获到的，即将被发送的世界书条目
const currentTokenCount = ref<number | string>(0); // 当前干跑计算的 Token
const isTestMode = ref(false); // 是否处于“主动检测”模式

/**
 * 触发“主动检测”：运行一次 Dry Run 并在拦截器面板显示将被触发的条目，但不实际发送。
 */
const runManualTest = () => {
  isTestMode.value = true;
  manager.runManualTest();
};

/**
 * 清除“主动检测”的结果，退出测试模式。
 */
const clearTestResults = () => {
  pendingEntries.value = [];
  isTestMode.value = false;
};

// --- [FEATURE: MINI_SNAPSHOT] 快照功能 ---
// 记录上一轮真实发送时触发的世界书条目，用于在迷你模式下或拦截列表为空时展示快照。
const lastTriggeredEntries = ref<any[]>([]);

// 对即将触发的条目进行排序：被用户“置顶 (Pinned)”的条目排在最前面
const sortedPendingEntries = computed(() => {
  return [...pendingEntries.value].sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
});

// 对快照条目进行排序：同样置顶优先
const sortedLastTriggeredEntries = computed(() => {
  return [...lastTriggeredEntries.value].sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
});
// --- [FEATURE: MINI_SNAPSHOT] END ---

const currentConfig = ref<ArkConfig | null>(null); // 本地缓存的系统配置
const allEntries = ref<any[]>([]); // 所有的世界书条目 (剔除了系统配置本身)
const currentPrimaryWorldbook = ref<string | null>(null); // 当前角色的主世界书名称

const manager = StatusBarManager.getInstance();
const isSystemEnabled = computed(() => currentConfig.value?.isSystemEnabled ?? true);

/**
 * 切换缩小(Mini) / 展开状态。
 * 当从缩小恢复展开时，默认切回拦截预警页签。
 */
const toggleMinimize = () => {
  isMiniMode.value = !isMiniMode.value;
  if (isMiniMode.value) {
    currentTab.value = 'interceptor';
  }
};

/**
 * 格式化历史记录(Commit)中文本的变化描述
 */
const getChangeText = (commit: any, value: boolean) => {
  if (commit.description?.includes('changed type')) {
    return value ? '蓝灯(常驻)' : '绿灯(条件)';
  }
  return value ? '开启' : '关闭';
};

// --- 性能优化：拖动条 ---
// 使用局部 ref 处理滑动条拖拽，避免在拖动过程中高频触发世界书读写保存
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

// --- DOM 节点与拖拽坐标 ---
const statusBarEl = ref<HTMLElement | null>(null);

const transformX = ref(0); // 整体 UI 横向偏移量
const transformY = ref(0); // 整体 UI 纵向偏移量
const absoluteLeft = ref<number | null>(null);
const absoluteTop = ref<number | null>(null);
const hasAbsolutePos = computed(() => absoluteLeft.value !== null && absoluteTop.value !== null);

// --- Tab 2: 全部条目 (Filters & Logic) ---
const filterText = ref(''); // 文本搜索框内容
const filterCategory = ref(''); // 分类筛选下拉框值
const filterType = ref(''); // 状态筛选下拉框值

/**
 * 动态计算所有可用的分类。
 * 根据条目名称中的前缀 (如 "[角色]", "[设定]") 进行分组。
 */
const availableCategories = computed(() => {
  const cats = new Set<string>();
  allEntries.value.forEach(e => {
    const name = e.name || e.comment || '';
    const match = name.match(/^\[(.*?)\]/);
    if (match) cats.add(match[1]);
    else cats.add('未分类');
  });
  const sorted = Array.from(cats).sort();
  // 强制将 "未分类" 排在下拉框的最底部
  const uncatIndex = sorted.indexOf('未分类');
  if (uncatIndex !== -1) {
    sorted.splice(uncatIndex, 1);
    sorted.push('未分类');
  }
  return sorted;
});

/**
 * 获取世界书条目的触发类型 (constant=蓝灯常驻, selective=绿灯条件触发)
 */
const getEntryType = (entry: any) => {
  // 优先判断酒馆原生的 constant 属性
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  // 兜底判断本项目的自定义 strategy.type
  return entry.strategy?.type || 'selective';
};

/**
 * 检查条目是否被用户置顶
 */
const isPinned = (entry: any) => {
  return currentConfig.value?.pinnedEntries?.includes(entry.uid) || false;
};

/**
 * 切换条目的置顶状态并保存到配置中
 */
const togglePin = (entry: any) => {
  const pinned = currentConfig.value?.pinnedEntries || [];
  const index = pinned.indexOf(entry.uid);
  let newPinned = [...pinned];
  if (index === -1) {
    newPinned.push(entry.uid);
  } else {
    newPinned.splice(index, 1);
  }
  manager.saveConfig({ pinnedEntries: newPinned });
};

/**
 * 一键清空所有的置顶设置
 */
const clearPins = () => {
  if (confirm('确定要清空所有置顶的偏好条目吗？')) {
    manager.saveConfig({ pinnedEntries: [] });
  }
};

/**
 * 计算应用了搜索、分类、状态和置顶排序后的最终条目列表
 */
const filteredEntries = computed(() => {
  let result = allEntries.value.filter(entry => {
    // 1. 文本模糊搜索 (匹配名称或关键字)
    if (filterText.value) {
      const query = filterText.value.toLowerCase();
      const name = (entry.comment || entry.name || '').toLowerCase();
      const keys = (entry.key || []).join(' ').toLowerCase();
      if (!name.includes(query) && !keys.includes(query)) return false;
    }
    // 2. 分类筛选
    if (filterCategory.value) {
      const name = entry.name || entry.comment || '';
      const match = name.match(/^\[(.*?)\]/);
      const cat = match ? match[1] : '未分类';
      if (cat !== filterCategory.value) return false;
    }
    // 3. 触发类型筛选 (蓝灯/绿灯)
    if (filterType.value) {
      if (getEntryType(entry) !== filterType.value) return false;
    }
    return true;
  });

  // 排序：被置顶的排在最上方
  result.sort((a, b) => {
    const pinA = isPinned(a) ? 1 : 0;
    const pinB = isPinned(b) ? 1 : 0;
    return pinB - pinA;
  });

  return result;
});

/**
 * 切换条目的蓝灯(constant)与绿灯(selective)属性
 */
const toggleEntryType = async (entry: any) => {
  try {
    const currentType = getEntryType(entry);
    const newType = currentType === 'constant' ? 'selective' : 'constant';

    // 1. 精确路由：优先操作条目自身携带的 world 属性，如果找不到则回退到当前主世界书
    const targetWorldbook = entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) {
      console.warn('[ARK_UI] 切换条目触发类型失败：无法确定目标世界书', entry);
      return;
    }

    // 2. 复合匹配与后端写入：修改世界书该条目的 strategy.type 和 constant 属性
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid && (x.name === entry.name || x.comment === entry.comment));
      if (e) {
        if (!e.strategy) e.strategy = {};
        e.strategy.type = newType;
        e.constant = newType === 'constant'; // 同步修改酒馆原生属性
        console.info(`[ARK_UI] 成功在 ${targetWorldbook} 中切换类型: ${e.name || e.comment} -> ${newType}`);
      } else {
        console.warn(`[ARK_UI] 在 ${targetWorldbook} 中未能匹配到条目:`, entry);
      }
      return wbEntries;
    });

    // 乐观更新本地 UI 状态
    if (!entry.strategy) entry.strategy = {};
    entry.strategy.type = newType;
    entry.constant = newType === 'constant';

    // 记录修改历史 (Commit)
    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动修改触发类型] ${entry.comment || entry.name}`,
      changes: [
        {
          uid: entry.uid,
          comment: entry.comment || entry.name,
          from: currentType === 'constant',
          to: newType === 'constant',
        },
      ],
    };
    const commits = [...(currentConfig.value?.commits || []), newCommit];
    manager.saveConfig({ commits });
  } catch (e) {
    console.error('Failed to toggle entry type', e);
  }
};
// --- 结束: Tab 2 (全部条目) 逻辑 ---

// --- Tab 3 (历史记录) 逻辑 ---
/**
 * 撤销某一次特定的历史修改操作 (类似 git revert)
 * @param commit 要撤销的提交记录
 */
const revertCommit = async (commit: any) => {
  if (!confirm(`确定要撤销操作: ${commit.description} 吗？`)) return;

  try {
    const result = await getCharWorldbookNames('current');
    const targetWorldbook =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
    if (!targetWorldbook) return;

    // 应用反向变更 (Inverse changes)
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      for (const change of commit.changes) {
        const e = wbEntries.find(x => x.uid === change.uid);
        if (e) {
          // 通过提交描述判断这次是开启/关闭的切换，还是蓝/绿灯类型的切换
          if (commit.description.includes('changed type') || commit.description.includes('修改触发类型')) {
            if (!e.strategy) e.strategy = {};
            e.strategy.type = change.from ? 'constant' : 'selective';
          } else {
            e.enabled = change.from; // 恢复为 from 的状态
          }
        }
      }
      return wbEntries;
    });

    // 从记录历史中删除该次提交
    const commits = (currentConfig.value?.commits || []).filter((c: any) => c.id !== commit.id);
    manager.saveConfig({ commits });

    await loadAllEntries(); // 刷新视图
    toastr.success('撤销成功并已从记录中移除。');
  } catch (e) {
    console.error('Failed to revert commit', e);
    toastr.error('撤销失败，详见控制台。');
  }
};
// --- 结束: Tab 3 (历史记录) 逻辑 ---

// --- 拖拽交互 (Drag) 逻辑 ---
let isDragging = false;
let startX = 0;
let startY = 0;
let initialX = 0;
let initialY = 0;

/**
 * 开始拖拽：记录鼠标或触摸的初始坐标
 */
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

  // 绑定到父级 document (酒馆宿主) 以支持在 iframe 外继续拖拽
  const ST_DOC = window.parent?.document || document;
  ST_DOC.addEventListener('mousemove', onDrag);
  ST_DOC.addEventListener('touchmove', onDrag, { passive: false });
  ST_DOC.addEventListener('mouseup', stopDrag);
  ST_DOC.addEventListener('touchend', stopDrag);
};

/**
 * 拖拽中：计算偏移量并更新 UI 位置
 */
const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging || !statusBarEl.value) return;
  e.preventDefault(); // 阻止移动端的默认滚动行为

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

/**
 * 边界检查：确保面板不会被拖出屏幕可见区域之外。
 * 尤其保证顶部的标题栏(拖拽手柄)永远可用。
 */
const checkBounds = () => {
  if (!statusBarEl.value) return;
  const rect = statusBarEl.value.getBoundingClientRect();
  const ST_WIN = window.parent || window;

  const viewportWidth = ST_WIN.innerWidth;
  const viewportHeight = ST_WIN.innerHeight;

  let deltaX = 0;
  let deltaY = 0;

  // 1. 检查右边界
  if (rect.right > viewportWidth) {
    deltaX = viewportWidth - rect.right;
  }
  // 2. 检查左边界 (优先级更高：确保左侧始终可见)
  if (rect.left + deltaX < 0) {
    deltaX = 0 - rect.left;
  }

  // 3. 检查下边界
  if (rect.bottom > viewportHeight) {
    deltaY = viewportHeight - rect.bottom;
  }

  // 4. 检查上边界 (最高优先级：必须保证拖动区域不被酒馆的原生 Navbar 遮挡)
  // 增加 70px 安全高度缓冲区
  const SAFE_TOP = 70;
  if (rect.top + deltaY < SAFE_TOP) {
    deltaY = SAFE_TOP - rect.top;
  }

  // 如果超出了边界，则回推坐标
  if (deltaX !== 0 || deltaY !== 0) {
    transformX.value += deltaX;
    transformY.value += deltaY;
  }
};

/**
 * 结束拖拽：解绑事件并执行最终的边界修正
 */
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

/**
 * 双击头部重置面板位置到默认状态
 */
const resetPosition = () => {
  transformX.value = 0;
  transformY.value = 0;
};
// --- 结束: 拖拽逻辑 ---

/**
 * 加载当前角色的所有世界书条目（剔除系统配置自身）
 */
const loadAllEntries = async () => {
  try {
    const result = await getCharWorldbookNames('current');
    const targetWorldbook =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
    if (targetWorldbook) {
      currentPrimaryWorldbook.value = targetWorldbook;
      const entries = await getWorldbook(targetWorldbook);
      // 过滤掉包含配置项前缀 [SYS_CONFIG] 的条目
      allEntries.value = entries.filter(
        (e: any) =>
          !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
          !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX)),
      );
    }
  } catch (e) {
    console.error('Failed to load worldbook entries', e);
  }
};

onMounted(() => {
  // 监听配置更新事件（如外部切换了主题或宽度）
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

  // 监听拦截器触发预警的事件
  document.addEventListener('ark-interceptor-triggered', ((e: CustomEvent) => {
    const triggered = e.detail.entries || [];
    const isManualTest = !!e.detail.isManualTest; // 判断是否是来自"主动检测"的触发
    isTestMode.value = isManualTest;
    currentTokenCount.value = e.detail.tokenCount ?? 0;

    // 映射与解耦：基于拦截器抛回的 raw 数据直接渲染。不需要回 allEntries 找死引用
    let matchedEntries = triggered
      .map((raw: any) => {
        // 1. 确保带有开关状态标识
        raw.enabled = raw.enabled !== false;
        // 2. 确保跨书的 fallback
        if (!raw.world && currentPrimaryWorldbook.value) {
          raw.world = currentPrimaryWorldbook.value;
        }
        // 3. 补充 Vue 需要的反应式属性模板，防止直接使用 raw 时出错
        if (!raw.strategy) raw.strategy = {};
        return raw;
      });
      
    // 根据系统配置，决定是否在拦截器中渲染蓝灯(常驻)条目
    if (!currentConfig.value?.showConstantEntries) {
      matchedEntries = matchedEntries.filter((entry: any) => getEntryType(entry) !== 'constant');
    }

    // 如果存在需要预警的绿灯条目，或者正处于主动测试模式
    if (matchedEntries.length > 0 || isManualTest) {
      pendingEntries.value = matchedEntries;
      currentTab.value = 'interceptor'; // 强制切回拦截预警页签
      isMiniMode.value = false; // 强制展开面板

      // 确保系统总开关处于开启状态以免界面不可见
      if (!isSystemEnabled.value) {
        manager.saveConfig({ isSystemEnabled: true });
      }
      if (isManualTest && typeof toastr !== 'undefined') {
        toastr.success('检测完成。', 'ARK_STATUSBAR');
      }
    } else {
      // 如果只有蓝灯条目或空列表，无需阻拦，静默放行
      manager.releaseInterceptAndSend();
    }
  }) as EventListener);

  // 处理面板尺寸动态变化时的边界检查 (例如切换 Tab 导致高度变化)
  // 防止内容增加时顶部溢出屏幕
  if (statusBarEl.value) {
    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        checkBounds();
      });
    });
    resizeObserver.observe(statusBarEl.value);
  }

  // 初始化时执行一次边界修正，防止移动端初始渲染在屏幕外部
  requestAnimationFrame(() => {
    checkBounds();
  });

  // 监听：检测到与 Baseline(基准线) 不符时的提示事件
  document.addEventListener('ark-baseline-diff-detected', () => {
    if (typeof toastr !== 'undefined') {
      toastr.warning(
        '检测到当前世界书带有开局剧情或手动修改的残余状态。为防止剧情串台，建议在侧边栏重置。',
        'ARK_STATUSBAR 提示',
        { timeOut: 8000, positionClass: 'toast-top-center' },
      );
    }
  });

  // 监听：切换聊天记录时重新加载所有条目
  document.addEventListener('ark-chat-changed', () => {
    if (currentConfig.value?.isSystemEnabled) {
      loadAllEntries();
    }
  });

  // 监听：侧边栏扩展按钮发出的系统总开关切换事件
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

  // 处理窗口尺寸改变 (例如手机横竖屏切换)
  const ST_WIN = window.parent || window;
  ST_WIN.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      checkBounds();
    });
  });
});

/**
 * 关闭拦截预警面板（将其缩小为胶囊状态）
 */
const closePanel = () => {
  isMiniMode.value = true;
};

/**
 * 确认发送：将当前列表存入快照记录，并通知管理器释放拦截
 */
const confirmSend = () => {
  // 存入快照
  lastTriggeredEntries.value = [...pendingEntries.value];
  // 临时阻断条目已经在点击操作时即时写入，无需在此集中处理防竞态

  pendingEntries.value = [];
  manager.releaseInterceptAndSend();
  closePanel();
};

const toggleEntrySilent = async (entry: any) => {
  try {
    // 精确路由定向
    const targetWorldbook = entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) {
      console.warn('[ARK_UI] 临时切换状态失败：无法确定目标世界书', entry);
      return;
    }

    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid && (x.name === entry.name || x.comment === entry.comment));
      if (e) {
        e.enabled = entry.enabled;
      } else {
        console.warn(`[ARK_UI] 临时静默切换：在 ${targetWorldbook} 中未能精确匹配到条目:`, entry);
      }
      return wbEntries;
    });
  } catch (e) {
    console.error('Failed to toggle entry silently', e);
  }
};

const toggleTempDisable = (entry: any) => {
  entry.tempDisabled = !entry.tempDisabled;

  if (entry.tempDisabled) {
    entry.enabled = false;
    if (!manager.tempDisabledUids.includes(entry.uid)) {
      manager.tempDisabledUids.push(entry.uid);
    }
    // 即时异步写入，无需 await 阻塞 UI
    toggleEntrySilent(entry);
  } else {
    entry.enabled = true;
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
    toggleEntrySilent(entry);
  }
};

const toggleEnterInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  manager.saveConfig({ enableEnterToIntercept: checked });
};

const toggleShowConstantEntries = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  manager.saveConfig({ showConstantEntries: checked });
};

const toggleDebugMode = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  manager.saveConfig({ isDebugMode: checked });
  if (checked && typeof toastr !== 'undefined') {
    toastr.warning('调试日志已开启！将在下一次拦截或检测后写入世界书。', 'ARK_DEBUG');
  }
};

/**
 * 取消发送：不释放拦截，清空当前列表并收起面板。恢复临时阻断。
 */
const cancelSend = () => {
  // 取消也存入快照以便查看
  lastTriggeredEntries.value = [...pendingEntries.value];

  // 取消发送时，必须将被临时关闭的条目立刻恢复
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
  closePanel();
};

/**
 * 切换系统 UI 主题
 */
const updateTheme = (theme: 'light' | 'dark' | 'transparent') => {
  manager.saveConfig({ theme });
};

/**
 * 切换拦截器功能的总开关
 */
const toggleInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  manager.saveConfig({ isInterceptorEnabled: checked });
};

/**
 * 一键重置所有世界书状态到最初的基准线，并清空历史记录
 */
const resetToBaseline = async () => {
  if (confirm('确定要一键还原至初始状态吗？这将清空历史修改记录。')) {
    await WorldbookManager.resetToBaseline();
    manager.saveConfig({ commits: [] });
    await loadAllEntries();
    toastr.success('已恢复基准线。');
  }
};

/**
 * 一键屏蔽所有单字干员（防止误触）
 */
const closeSingleChar = async () => {
  if (confirm('确定要一键关闭所有单字干员世界书吗？')) {
    await WorldbookManager.closeSingleCharEntries();
    await loadAllEntries();
  }
};

/**
 * 切换任意世界书条目的开关 (enabled) 状态，并记录进提交历史
 */
const toggleEntry = async (entry: any) => {
  try {
    const result = await getCharWorldbookNames('current');
    const targetWorldbook =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
    if (!targetWorldbook) return;

    // 更新真实的世界书对象
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid);
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });

    // 将该操作添加到历史修改记录 (Commit)
    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动切换开关] ${entry.comment || entry.name}`,
      changes: [
        {
          uid: entry.uid,
          comment: entry.comment || entry.name,
          from: !entry.enabled,
          to: entry.enabled,
        },
      ],
    };
    const commits = [...(currentConfig.value?.commits || []), newCommit];
    manager.saveConfig({ commits });
  } catch (e) {
    console.error('Failed to toggle entry', e);
    entry.enabled = !entry.enabled; // 如果失败则恢复 UI 状态
  }
};

/**
 * 拦截预警面板中使用的快捷开关功能，关联上面的 toggleEntry
 */
const togglePendingEntry = async (entry: any) => {
  // 修复：如果当前条目处于“临时单次阻断”状态，用户点击了“彻底阻断”
  if (entry.tempDisabled) {
    entry.tempDisabled = false;
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
    // 此时它的 enabled 本来就是 false，保持为 false，只清除临时标记，并刷新记录
    await toggleEntry(entry);
    return;
  }

  // 正常情况下的反转开关
  entry.enabled = !entry.enabled;
  if (!entry.enabled) {
    entry.tempDisabled = false; // 彻底关闭时移除临时阻断标记
    const idx = manager.tempDisabledUids.indexOf(entry.uid);
    if (idx !== -1) manager.tempDisabledUids.splice(idx, 1);
  }
  await toggleEntry(entry);
};
</script>

<style scoped>
.ark-global-statusbar {
  position: fixed;
  bottom: 60px;
  right: 20px;
  width: 400px;
  max-width: 90vw;
  max-height: calc(100dvh - 80px); /* Prevents expanding upwards out of screen */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: sans-serif;
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
  /* Let the width be controlled by auto (content) but limited by max-width */
  width: auto;
  max-width: 180px; /* Reduced from 300px to ensure it's a small pill */
  border-radius: 20px;
  opacity: 0.8;
  /* Removed hardcoded font-size: 0.85em to allow UI settings to control it */
}

/* <!-- [FEATURE: MINI_SNAPSHOT] --> */
.statusbar-mini-content {
  padding: 0 10px 10px 10px;
  max-height: 90px; /* Roughly 4 lines */
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
  background-color: #007bff; /* green light/sent indicator */
  flex-shrink: 0;
}

.mini-entry-list .indicator.blocked {
  background-color: #dc3545; /* red light/blocked indicator */
}

.mini-entry-list .text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
/* <!-- [FEATURE: MINI_SNAPSHOT] END --> */

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
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 5px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.entry-list .entry-info {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
  margin-right: 10px;
}

.entry-list .entry-name {
  word-break: break-all;
}

.entry-list .badge {
  font-size: 0.8em;
  background: #007bff;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.entry-list .badge.blocked {
  background: var(--ui-border-primary);
  color: var(--ui-text-secondary);
}

.action-bar {
  display: flex;
  gap: 10px;
}

.btn-primary,
.btn-danger,
.btn-success,
.btn-warning {
  flex: 1;
  padding: 10px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  color: white;
}
.btn-primary {
  background: #007bff;
}
.btn-primary:hover {
  background: #0056b3;
}
.btn-danger {
  background: #dc3545;
}
.btn-danger:hover {
  background: #a71d2a;
}
.btn-success {
  background: #28a745;
}
.btn-success:hover {
  background: #218838;
}
.btn-warning {
  background: #ff9800;
}
.btn-warning:hover {
  background: #e68a00;
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

/* Switch style */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 20px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: 0.4s;
}
.slider:before {
  position: absolute;
  content: '';
  height: 16px;
  width: 16px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.4s;
}
input:checked + .slider {
  background-color: #007bff;
}
input:checked + .slider:before {
  transform: translateX(20px);
}
.slider.round {
  border-radius: 20px;
}
.slider.round:before {
  border-radius: 50%;
}

.commit-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.commit-item {
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
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
.commit-id {
  font-family: monospace;
}
.commit-desc {
  font-weight: bold;
  margin-bottom: 5px;
}
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

.setting-action {
  margin-top: 25px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
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

.action-bar.compact {
  gap: 5px;
}

.icon-only {
  flex: 1;
  font-size: 1.2em;
  padding: 5px;
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

.last-record-box {
  margin-top: 15px;
  text-align: left;
}
.record-divider {
  border: none;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  margin: 15px 0;
}
.entry-list.read-only li {
  opacity: 0.8;
}

.panel-header-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.entry-list.stacked li {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.entry-list.stacked .entry-name {
  word-break: break-all;
  font-weight: 500;
}
.entry-list.stacked .entry-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.entry-list.stacked .action-btns {
  display: flex;
  gap: 4px;
}
.entry-list.stacked .badge.warning {
  background: #ff9800;
  color: white;
}
</style>
