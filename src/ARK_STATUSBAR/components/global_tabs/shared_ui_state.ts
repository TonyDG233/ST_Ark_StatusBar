import { ref, computed } from 'vue';

// ----------------------------------------------------------------------------
// 1. 全局与拦截器共享状态 (Global & Interceptor Shared State)
// ----------------------------------------------------------------------------
// 这些状态用于在父组件的迷你窗徽章和拦截器 Tab 详情列表之间实现 100% 内存同频
export const pendingEntries = ref<any[]>([]);
export const lastTriggeredEntries = ref<any[]>([]);
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

// 手风琴抽屉（Accordion）的展开状态和已加载的条目缓存
// 剥离出来，防止切换 Tab 时手风琴状态丢失
export const expandedWorldbooks = ref<string[]>([]);
export const worldbookEntriesCache = ref<Record<string, any[]>>({});
export const isLoadingWb = ref<string | null>(null);

// ----------------------------------------------------------------------------
// 3. 通用辅助工具状态与 UI 预览状态 (Utility State & UI Preview State)
// ----------------------------------------------------------------------------
// 全局过滤系统配置前缀条目使用的常量
export const CONFIG_ENTRY_PREFIX = '[SYS_CONFIG]';

// 用于设置界面拖动滑动条时，实现父容器外壳尺寸/字体的实时无延迟预览防撕裂
export const previewUiWidth = ref<number | null>(null);
export const previewUiFontSize = ref<number | null>(null);
