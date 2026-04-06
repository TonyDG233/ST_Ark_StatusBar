/**
 * Ark 状态栏内部解耦事件总线 (手写实现，无外部依赖，100% 编译安全)
 *
 * 核心设计原则：
 * 所有 Service 层（如 interceptor, logger, worldbook_service）之间禁止互相 import 调用。
 * 如果它们需要跨模块协作，必须通过此 EventBus 发布与订阅事件。
 */
interface ArkInternalEvents {
  /**
   * 当需要记录调试日志时触发。
   * 被 logger.ts 监听处理。
   */
  'log:debug': (message: string, isDryRun?: boolean) => void;

  /**
   * 当拦截器成功执行了一次干跑并需要通知配置更新时触发。
   * 被 config_store 监听。
   */
  'interceptor:token_calculated': (data: { chatTurnsCount: number; realTimePassedMs: number }) => void;

  /**
   * 触发系统总开关（在酒馆侧边栏扩展按钮点击时触发）
   */
  'system:toggle': () => void;

  /**
   * 聊天切换事件（在酒馆原生 CHAT_CHANGED 触发时广播）
   */
  'system:chat_changed': () => void;

  /**
   * 当世界书快照或剧本应用被修改时，通知产生一条历史记录 (Commit)
   */
  'history:commit_added': (commitData: import('../types/system_config').ArkCommit) => void;

  /**
   * 当拦截器开关状态发生改变时触发（由 config_store 发出，被 send_interceptor 监听）
   */
  'config:interceptor_state_changed': (shouldEnable: boolean) => void;

  /**
   * 请求更新配置存储的内容
   */
  'config:update_requested': (partialConfig: Partial<import('../types/system_config').ArkConfig>) => void;

  /**
   * 底层世界书数据已经被修改，要求前端状态中心 (shared_ui_state) 触发真实的拉取覆盖。
   * (代替原有的 Document CustomEvent)
   */
  'worldbook:data_changed': (worldbookName: string) => void;

  /**
   * 发现当前状态与 Baseline(基准线) 存在差异，通知前端显示提示
   */
  'worldbook:baseline_diff_detected': () => void;
}

type EventName = keyof ArkInternalEvents;
type EventCallback<K extends EventName> = ArkInternalEvents[K];

class ArkEventBusImpl {
  private listeners: {
    [K in EventName]?: Array<EventCallback<K>>;
  } = {};

  /**
   * 监听一个内部事件
   */
  public on<K extends EventName>(event: K, callback: EventCallback<K>): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
  }

  /**
   * 取消监听一个内部事件
   */
  public off<K extends EventName>(event: K, callback: EventCallback<K>): void {
    const callbacks = this.listeners[event];
    if (callbacks) {
      this.listeners[event] = callbacks.filter(cb => cb !== callback) as (typeof this.listeners)[K];
    }
  }

  /**
   * 发布一个内部事件
   */
  public emit<K extends EventName>(event: K, ...args: Parameters<EventCallback<K>>): void {
    const callbacks = this.listeners[event];
    if (callbacks) {
      callbacks.forEach(cb => {
        try {
          (cb as (...args: any[]) => void)(...args);
        } catch (error) {
          console.error(`[ArkEventBus] 触发事件 ${event} 时发生错误:`, error);
        }
      });
    }
  }
}

/**
 * 全局内部事件总线实例
 */
export const ArkEventBus = new ArkEventBusImpl();
