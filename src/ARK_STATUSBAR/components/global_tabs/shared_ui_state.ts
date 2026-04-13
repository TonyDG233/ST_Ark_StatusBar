import { computed, ref } from 'vue';

import type { WorldbookEntry } from '../../types/st_worldbook_types';

export type UIWorldbookEntry = WorldbookEntry & {
  world?: string;
  tempDisabled?: boolean;
  _isPinned?: boolean;
  _computedType?: string;
};

// ----------------------------------------------------------------------------
// 1. 全局与拦截器共享状态 (Global & Interceptor Shared State)
// ----------------------------------------------------------------------------
// 这些状态用于在父组件的迷你窗徽章和拦截器 Tab 详情列表之间实现 100% 内存同频
export const pendingEntries = ref<UIWorldbookEntry[]>([]);
export const lastTriggeredEntries = ref<UIWorldbookEntry[]>([]);
export const isTestMode = ref(false);
export const currentTokenCount = ref<number | string>(0);

// 计算属性：对即将触发的条目进行排序（置顶优先）
export const sortedPendingEntries = computed(() => {
  // 注意：在实际使用时，isPinned 方法可能需要组件引入 configStore，
  // 为了保持 ui_state 纯净，我们可以在这里做简单的结构准备，具体排序可在使用时或传入 isPinned 判断逻辑
  return [...pendingEntries.value];
});

// 计算属性：对快照条目进行排序（置顶优先）
export const sortedLastTriggeredEntries = computed(() => {
  return [...lastTriggeredEntries.value];
});

// ----------------------------------------------------------------------------
// 2. 世界书与手风琴共享状态 (Worldbook & Accordion Shared State)
// ----------------------------------------------------------------------------
// 存储从底层加载上来的全量基本信息字典
export const allAvailableWorldbooks = ref<string[]>([]);
export const globalMountedWorldbooks = ref<string[]>([]);
export const charBoundWorldbooks = ref<string[]>([]);
export const currentPrimaryWorldbook = ref<string | null>(null);

// 泛用性标志：当前角色卡是否包含“明日方舟”，用于决定是否开启特定UI和底层功能
export const isArknightsCard = ref<boolean>(false);

// 手风琴抽屉（Accordion）的展开状态和已加载的条目缓存
// 剥离出来，防止切换 Tab 时手风琴状态丢失
export const expandedWorldbooks = ref<string[]>([]);
export const worldbookEntriesCache = ref<Record<string, UIWorldbookEntry[]>>({});
export const isLoadingWb = ref<string | null>(null);

// 全局过滤系统配置前缀条目使用的常量
export const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';

/**
 * 核心架构升级：强制刷新指定世界书缓存的唯一入口。
 * 当底层数据改变时，通过真实的 getWorldbook 获取最新数据覆盖缓存，杜绝 UI 的自欺欺人假死。
 */
export const refreshWorldbookCache = async (wbName: string) => {
  if (!expandedWorldbooks.value.includes(wbName) && currentPrimaryWorldbook.value !== wbName) return;

  try {
    const entries = await getWorldbook(wbName);
    worldbookEntriesCache.value[wbName] = entries.filter(e => !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)));
  } catch (e) {
    console.error(`[ARK_UI_STATE] Failed to refresh cache for ${wbName}`, e);
  }
};

/**
 * 集中在此处响应环境变化并预先拉取所有的业务所需的数据列表
 */
export const loadWorldbookLists = async () => {
  try {
    const { StatusBarManager } = await import('../../logic/statusbar_manager');
    const manager = StatusBarManager.getInstance();
    allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
    globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    charBoundWorldbooks.value = await manager.worldbook.getCharBoundWorldbooks();
  } catch (e) {
    console.error('[ARK_UI] loadWorldbookLists failed', e);
  }
};

export const loadPrimaryWorldbookName = async () => {
  try {
    const result = await getCharWorldbookNames('current');
    currentPrimaryWorldbook.value =
      result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);
  } catch (e) {
    console.error('Failed to load primary worldbook', e);
  }
};

/**
 * 全局挂载：监听所有可能导致世界书状态变化的原生及自定义事件。
 * 这个函数只应在外壳组件初始化时被调用一次。
 */
export const setupGlobalListeners = () => {
  // 1. 监听酒馆原生抛出的事件（兜底防范用户在外部侧边栏手动编辑条目）
  if (typeof tavern_events !== 'undefined') {
    // 监听特定世界书条目的更新
    eventOn(tavern_events.WORLDINFO_UPDATED, async (name: string) => {
      await refreshWorldbookCache(name);
    });

    // 监听世界书重新加载（如刷新、换卡）
    eventOn(tavern_events.WORLDINFO_ENTRIES_LOADED, async () => {
      // 全量刷新当前展开的所有世界书
      for (const wbName of expandedWorldbooks.value) {
        await refreshWorldbookCache(wbName);
      }
      if (currentPrimaryWorldbook.value && !expandedWorldbooks.value.includes(currentPrimaryWorldbook.value)) {
        await refreshWorldbookCache(currentPrimaryWorldbook.value);
      }
      await loadWorldbookLists();
    });
    
    // 聊天切换时，重载基本列表
    eventOn(tavern_events.CHAT_CHANGED, async () => {
      await loadPrimaryWorldbookName();
    });
  }

  // 2. 监听我们自己底层的“黑盒修改”抛出的内部事件（主动通知，保证极速反馈）
  document.addEventListener('ark:worldbook-data-changed', async (e: any) => {
    if (e.detail.worldbookName) {
      await refreshWorldbookCache(e.detail.worldbookName);
    }
  });

  document.addEventListener('ark-config-updated', async (e: any) => {
    const config = e.detail;
    if (config && config.isSystemEnabled) {
      await loadPrimaryWorldbookName();
      await loadWorldbookLists();
    }
  });

  document.addEventListener('ark:identity-updated', (e: any) => {
    if (e.detail && typeof e.detail.isArknights === 'boolean') {
      isArknightsCard.value = e.detail.isArknights;
    }
  });

  // 启动时初始化一次数据
  const initData = async () => {
    const { useArkConfig } = await import('../../core/config_store');
    const currentConfig = useArkConfig();
    if (currentConfig.value && currentConfig.value.isSystemEnabled) {
      await loadPrimaryWorldbookName();
      await loadWorldbookLists();
    }
  };
  initData();
};

// ----------------------------------------------------------------------------
// 3. 通用辅助工具状态与 UI 预览状态 (Utility State & UI Preview State)
// ----------------------------------------------------------------------------
// 用于设置界面拖动滑动条时，实现父容器外壳尺寸/字体的实时无延迟预览防撕裂
export const previewUiWidth = ref<number | null>(null);
export const previewUiFontSize = ref<number | null>(null);
