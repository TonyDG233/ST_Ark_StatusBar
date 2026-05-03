import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import type { WorldbookEntry } from '../types/st_worldbook_types';

/**
 * 【重构说明与内部逻辑架构】
 * 本文件由原先的 shared_ui_state 散装 ref 集合重构为标准的 Pinia Store。
 *
 * 核心设计理念 (单向数据流与内存同频)：
 * 1. 它是连接“酒馆黑盒环境”、“后台拦截器脚本”与“前端 Vue 视图面板”的唯一数据中枢。
 * 2. 避免了传统的 emit 瀑布流，所有前端组件只需绑定这里的 state 即可实现无延迟的视图更新。
 * 3. `setupGlobalListeners` 充当了“被动数据泵”：它监听原生酒馆事件（如 WORLDINFO_UPDATED）和
 *    自定义内部总线事件（ark:worldbook-data-changed），一旦底层数据变异，立马在此处调用真实的
 *    API 刷新自身内存，从而驱动全量 UI 组件重绘，彻底杜绝了 UI 假死与数据撕裂。
 */

export type UIWorldbookEntry = WorldbookEntry & {
  world?: string;
  tempDisabled?: boolean;
  _isPinned?: boolean;
  _computedType?: string;
};

export const useUIStateStore = defineStore('ark_ui_state', () => {
  // ----------------------------------------------------------------------------
  // 1. 全局与拦截器共享状态 (Global & Interceptor Shared State)
  // ----------------------------------------------------------------------------
  // 这些状态用于在父组件的迷你窗徽章和拦截器 Tab 详情列表之间实现 100% 内存同频
  const pendingEntries = ref<UIWorldbookEntry[]>([]);
  const lastTriggeredEntries = ref<UIWorldbookEntry[]>([]);
  const isTestMode = ref(false);
  const currentTokenCount = ref<number | string>(0);

  // 单个条目的 Token 数量缓存
  const entryTokenCountCache = ref<Record<string, number>>({});

  /**
   * 为条目生成唯一的缓存 Key
   */
  const getEntryKey = (entry: UIWorldbookEntry) => {
    return entry.uid
      ? `${entry.uid}-${entry.world || 'unknown'}`
      : `${entry.name || 'unnamed'}-${entry.world || 'unknown'}`;
  };

  /**
   * 异步计算条目的 Token 数量并存入缓存
   */
  const calculateTokenForEntry = async (entry: UIWorldbookEntry) => {
    const key = getEntryKey(entry);
    if (entryTokenCountCache.value[key] !== undefined) return;

    if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getTokenCountAsync === 'function') {
      try {
        const content = entry.content || '';
        const tokens = await SillyTavern.getTokenCountAsync(content);
        entryTokenCountCache.value[key] = tokens;
      } catch (e) {
        console.warn('[ARK_UI_STATE] Failed to calculate tokens for entry', key, e);
      }
    }
  };

  // 计算属性：对即将触发的条目进行排序（置顶优先）
  const sortedPendingEntries = computed(() => {
    // 注意：在实际使用时，isPinned 方法可能需要组件引入 configStore，
    // 为了保持 ui_state 纯净，我们可以在这里做简单的结构准备，具体排序可在使用时或传入 isPinned 判断逻辑
    return [...pendingEntries.value];
  });

  // 计算属性：对快照条目进行排序（置顶优先）
  const sortedLastTriggeredEntries = computed(() => {
    return [...lastTriggeredEntries.value];
  });

  // ----------------------------------------------------------------------------
  // 2. 世界书与手风琴共享状态 (Worldbook & Accordion Shared State)
  // ----------------------------------------------------------------------------
  // 存储从底层加载上来的全量基本信息字典
  const allAvailableWorldbooks = ref<string[]>([]);
  const globalMountedWorldbooks = ref<string[]>([]);
  const charBoundWorldbooks = ref<string[]>([]);
  const currentPrimaryWorldbook = ref<string | null>(null);

  // 泛用性标志：当前角色卡是否包含“明日方舟”，用于决定是否开启特定UI和底层功能
  const isArknightsCard = ref<boolean>(false);

  // 手风琴抽屉（Accordion）的展开状态和已加载的条目缓存
  // 剥离出来，防止切换 Tab 时手风琴状态丢失
  const expandedWorldbooks = ref<string[]>([]);
  const worldbookEntriesCache = ref<Record<string, UIWorldbookEntry[]>>({});
  const isLoadingWb = ref<string | null>(null);

  // 全局过滤系统配置前缀条目使用的常量
  const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';

  /**
   * 核心架构升级：强制刷新指定世界书缓存的唯一入口。
   * 当底层数据改变时，通过真实的 getWorldbook 获取最新数据覆盖缓存，杜绝 UI 的自欺欺人假死。
   */
  const refreshWorldbookCache = async (wbName: string) => {
    if (!expandedWorldbooks.value.includes(wbName) && currentPrimaryWorldbook.value !== wbName) return;

    try {
      const entries = await getWorldbook(wbName);
      worldbookEntriesCache.value[wbName] = entries.filter((e: any) => !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)));
    } catch (e) {
      console.error(`[ARK_UI_STATE] Failed to refresh cache for ${wbName}`, e);
    }
  };

  /**
   * 集中在此处响应环境变化并预先拉取所有的业务所需的数据列表
   */
  const loadWorldbookLists = async () => {
    try {
      const { StatusBarManager } = await import('../logic/statusbar_manager');
      const manager = StatusBarManager.getInstance();
      allAvailableWorldbooks.value = await manager.worldbook.getAllAvailableWorldbooks();
      globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
      charBoundWorldbooks.value = await manager.worldbook.getCharBoundWorldbooks();
    } catch (e) {
      console.error('[ARK_UI] loadWorldbookLists failed', e);
    }
  };

  const loadPrimaryWorldbookName = async () => {
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
  const setupGlobalListeners = () => {
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
      // 世界书级别的增删也可能发生，顺便刷新全局挂载与可用列表缓存
      await loadWorldbookLists();
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
      // 主动同步一次当前的身份，避免漏掉早期抛出的事件
      if (typeof getCurrentCharacterName === 'function') {
        const charName = getCurrentCharacterName() || '';
        isArknightsCard.value = charName.includes('明日方舟');
      }

      const { useArkConfig } = await import('./config_store');
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
  const previewUiWidth = ref<number | null>(null);
  const previewUiFontSize = ref<number | null>(null);

  return {
    // === 响应式变量 / 计算属性 (States & Getters) ===
    // 注：在其他组件中解构这些变量时，必须使用 storeToRefs(useUIStateStore())，否则会丢失响应式。
    pendingEntries,
    lastTriggeredEntries,
    isTestMode,
    currentTokenCount,
    entryTokenCountCache,
    sortedPendingEntries,
    sortedLastTriggeredEntries,
    allAvailableWorldbooks,
    globalMountedWorldbooks,
    charBoundWorldbooks,
    currentPrimaryWorldbook,
    isArknightsCard,
    expandedWorldbooks,
    worldbookEntriesCache,
    isLoadingWb,
    previewUiWidth,
    previewUiFontSize,

    // === 纯静态常量 & 方法 / 动作 (Constants & Actions) ===
    // 注：在其他组件中可以直接解构：const { getEntryKey, CONFIG_ENTRY_PREFIX } = useUIStateStore();
    // 绝对不要把它们放进 storeToRefs 中！
    CONFIG_ENTRY_PREFIX,
    getEntryKey,
    calculateTokenForEntry,
    refreshWorldbookCache,
    loadWorldbookLists,
    loadPrimaryWorldbookName,
    setupGlobalListeners,
  };
});
