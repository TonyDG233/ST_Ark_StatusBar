import { unref } from 'vue';
import { BASELINE_STATE } from '../config/baseline';
import { configStore } from './core/config_store';

/**
 * 状态栏全局管理器 (Singleton 单例模式)
 * 负责与 SillyTavern 核心环境交互、管理持久化配置以及接管发送拦截功能。
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private targetWorldbook: string | null = null; // 当前绑定的世界书名称
  
  public tempDisabledUids: number[] = []; // 单次临时阻断的条目 UID 列表

  private constructor() {
    // 注入当前 targetWorldbook 提供器给拦截器服务
    import('./interceptor/send_interceptor').then(({ sendInterceptor }) => {
      sendInterceptor.setTargetWorldbookProvider(() => this.targetWorldbook);
    });
  }

  // 获取单例实例
  static getInstance(): StatusBarManager {
    if (!StatusBarManager.instance) {
      StatusBarManager.instance = new StatusBarManager();
    }
    return StatusBarManager.instance;
  }

  // 提供对配置存储的快速访问别名，用于兼容现存未拆分的逻辑调用
  get currentConfig() {
    return unref(configStore.state);
  }

  /**
   * 初始化管理器：获取当前世界书、加载配置并绑定相关事件。
   */
  async init() {
    console.info('[ARK_StatusBar] Initializing Manager...');
    try {
      // 获取当前角色所绑定的世界书名称
      const result = await getCharWorldbookNames('current');
      if (result.primary) this.targetWorldbook = result.primary;
      else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

      if (!this.targetWorldbook) {
        console.warn('[ARK_StatusBar] No worldbook bound to current character.');
      }

      // 将原来的 loadOrInitConfig 和 saveConfig 逻辑都委托给 Store
      await configStore.loadOrInitConfig(this.targetWorldbook);
      
      // 绑定事件监听器 (如聊天改变时检测 Baseline 差异)
      this.setupEvents();
    } catch (error) {
      console.error('[ARK_StatusBar] Init failed:', error);
    }
  }

  public saveConfig(configUpdate: Partial<import('../config/system_config').ArkConfig>) {
    configStore.updateConfig(configUpdate);
  }

  private eventsBound: boolean = false;

  /**
   * 设置环境事件监听。
   */
  private setupEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    // 监听生成结束事件：恢复“临时阻断”的世界书条目 (需求2)
    eventOn(tavern_events.GENERATION_ENDED, async () => {
      if (this.tempDisabledUids.length > 0 && this.targetWorldbook) {
        console.info('[ARK_StatusBar] Restoring temp disabled entries after generation...');
        const uidsToRestore = [...this.tempDisabledUids];
        this.tempDisabledUids = []; // 立即清空，防止重入
        try {
          await updateWorldbookWith(this.targetWorldbook, (wbEntries: any[]) => {
            let changed = false;
            for (const entry of wbEntries) {
              if (uidsToRestore.includes(entry.uid)) {
                entry.enabled = true;
                changed = true;
              }
            }
            return wbEntries;
          });
          // 虽然生成结束后界面可能已关闭，但仍抛出事件以便状态同步
          document.dispatchEvent(new CustomEvent('ark-chat-changed'));
        } catch (e) {
          console.error('[ARK_StatusBar] Failed to restore temp disabled entries', e);
        }
      }
    });

    // 监听酒馆原生 CHAT_CHANGED 事件（切换聊天或重新加载时）
    eventOn(tavern_events.CHAT_CHANGED, async () => {
      console.info('[ARK_StatusBar] Chat changed, checking baseline diff and reloading...');

      try {
        // 用户可能切换了角色，因此需要重新获取绑定的世界书
        const result = await getCharWorldbookNames('current');
        if (result.primary) this.targetWorldbook = result.primary;
        else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];

        if (this.targetWorldbook) {
          await configStore.loadOrInitConfig(this.targetWorldbook);
          await this.checkBaselineDiff(); // 检查当前状态是否偏离了设定的 Baseline
        }
      } catch (error) {
        console.error('[ARK_StatusBar] Failed to handle chat change', error);
      }

      // 派发事件通知 UI 刷新 "全部条目" 列表
      document.dispatchEvent(new CustomEvent('ark-chat-changed'));
    });
  }

  /**
   * 检查当前世界书状态与 Baseline (基准线) 的差异。
   */
  public async checkBaselineDiff() {
    if (!this.targetWorldbook) return;
    try {
      // 如果要求静默下一次警告（如刚恢复 Baseline 后），则跳过并复位标志
      if (this.currentConfig.suppressNextDiffWarning) {
        console.info('[ARK_StatusBar] Suppressing diff warning as requested.');
        await configStore.updateConfig({ suppressNextDiffWarning: false });
        return;
      }

      const entries = await getWorldbook(this.targetWorldbook);
      let hasDiff = false;
      for (const key of Object.keys(BASELINE_STATE)) {
        const entry = entries.find((e: any) => e.name === key || e.comment === key);
        const baseline = BASELINE_STATE[key];

        if (entry) {
          const currentType = entry.strategy?.type || 'selective';
          // 只要开关状态或触发类型（蓝/绿灯）有不一致，即认为存在差异
          if (entry.enabled !== baseline.enabled || currentType !== baseline.type) {
            hasDiff = true;
            break;
          }
        }
      }

      // 如果存在差异，可以通过抛出事件让 UI 进行提示
      if (hasDiff) {
        const event = new CustomEvent('ark-baseline-diff-detected');
        document.dispatchEvent(event);
      }
    } catch (e) {
      console.error('[ARK_StatusBar] Diff check failed', e);
    }
  }

  public async runManualTest() {
    const { sendInterceptor } = await import('./interceptor/send_interceptor');
    await sendInterceptor.runManualTest();
  }

  public releaseInterceptAndSend() {
    import('./interceptor/send_interceptor').then(({ sendInterceptor }) => {
      sendInterceptor.releaseInterceptAndSend();
    });
  }
}
