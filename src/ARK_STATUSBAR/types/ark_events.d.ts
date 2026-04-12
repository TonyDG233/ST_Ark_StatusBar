import type { ArkCommit, ArkConfig } from './system_config';

declare global {
  interface DocumentEventMap {
    /**
     * 当需要记录调试日志时触发。
     * 被 logger.ts 监听处理。
     */
    'ark:log-debug': CustomEvent<{ message: string; isDryRun?: boolean }>;

    /**
     * 当拦截器成功执行了一次干跑并需要通知配置更新时触发。
     * 被 config_store 监听。
     */
    'ark:interceptor-token-calculated': CustomEvent<{ chatTurnsCount: number; realTimePassedMs: number }>;

    /**
     * 触发系统总开关（在酒馆侧边栏扩展按钮点击时触发）
     */
    'ark:system-toggle': CustomEvent<void>;

    /**
     * 聊天切换事件（在酒馆原生 CHAT_CHANGED 触发时广播）
     */
    'ark:system-chat-changed': CustomEvent<void>;

    /**
     * 当世界书快照或剧本应用被修改时，通知产生一条历史记录 (Commit)
     */
    'ark:history-commit-added': CustomEvent<ArkCommit>;

    /**
     * 当拦截器开关状态发生改变时触发（由 config_store 发出，被 send_interceptor 监听）
     */
    'ark:config-interceptor-state-changed': CustomEvent<{ shouldEnable: boolean }>;

    /**
     * 请求更新配置存储的内容
     */
    'ark:config-update-requested': CustomEvent<Partial<ArkConfig>>;

    /**
     * 底层世界书数据已经被修改，要求前端状态中心 (shared_ui_state) 触发真实的拉取覆盖。
     */
    'ark:worldbook-data-changed': CustomEvent<{ worldbookName: string }>;

    /**
     * 发现当前状态与 Baseline(基准线) 存在差异，通知前端显示提示
     */
    'ark:worldbook-baseline-diff-detected': CustomEvent<void>;

    // 兼容原有的事件名，避免类型报错
    'ark-config-updated': CustomEvent<Partial<ArkConfig> | void>;
    'ark-interceptor-triggered': CustomEvent<{ entries?: any[]; isManualTest?: boolean; tokenCount?: number | string }>;
  }
}
