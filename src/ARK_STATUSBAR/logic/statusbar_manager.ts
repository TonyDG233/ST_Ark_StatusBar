import { unref } from 'vue';
import { BASELINE_STATE } from '../config/baseline';
import { configStore, useArkConfig } from './core/config_store';
import { entryService } from './worldbook/entry_service';
import { snapshotService } from './worldbook/snapshot_service';

/**
 * Worldbook 的局部外观 (Facade)
 * 隶属于 StatusBarManager
 */
class WorldbookFacade {
  constructor(private getTargetWorldbook: () => string | null) {}

  public async saveCurrentAsSnapshot(worldbookName: string, snapshotName: string): Promise<void> {
    if (worldbookName) {
      await snapshotService.saveCurrentAsSnapshot(worldbookName, snapshotName);
    }
  }

  public async restoreSnapshot(snapshotId: string): Promise<void> {
    await snapshotService.restoreSnapshot(snapshotId);
  }

  public async deleteSnapshot(snapshotId: string): Promise<void> {
    await snapshotService.deleteSnapshot(snapshotId);
  }

  public async resetToBaseline(worldbookName?: string): Promise<void> {
    const wb = worldbookName || this.getTargetWorldbook();
    if (wb) await entryService.resetToBaseline(wb);
  }

  public async applyScenario(swipeId: number, force: boolean = false): Promise<void> {
    const wb = this.getTargetWorldbook();
    if (wb) await entryService.applyScenario(wb, swipeId, force);
  }

  public async closeSingleCharEntries(): Promise<void> {
    const wb = this.getTargetWorldbook();
    if (wb) await entryService.closeSingleCharEntries(wb);
  }

  public async getStatus() {
    const wb = this.getTargetWorldbook();
    return wb ? await entryService.getWorldbookStatus(wb) : 'modified';
  }

  public async getAllAvailableWorldbooks(): Promise<string[]> {
    return await entryService.getAllAvailableWorldbooks();
  }

  public async getGlobalMountedWorldbooks(): Promise<string[]> {
    return await entryService.getGlobalMountedWorldbooks();
  }

  public async getCharBoundWorldbooks(): Promise<string[]> {
    return await entryService.getCharBoundWorldbooks();
  }

  public async toggleGlobalMount(worldbookName: string, isMount: boolean): Promise<void> {
    await entryService.toggleGlobalMount(worldbookName, isMount);
  }
}

export type { WorldbookStatus } from './worldbook/entry_service';

/**
 * 状态栏全局管理器 (Singleton 单例模式)
 *
 * @architect 架构定位：本文件是所有前端业务组件与底层逻辑交互的唯一枢纽（Facade 门面）。
 *
 * @api_standard API 设计标准与扩展模式：
 * 1. 【聚合收束】：所有提供给 Vue 层调用的后端业务逻辑（如保存配置、应用剧本、执行干跑），
 *    都应在此处进行聚合和透传，禁止前端组件去直接 import `src/ARK_STATUSBAR/logic/core/` 等细分文件。
 * 2. 【解耦实现】：如果某一类业务功能代码超过了 200 行（例如发信拦截干跑，日志记录），
 *    必须将其拆分到子文件夹下（如 `interceptor/send_interceptor.ts`），然后在此文件中保留一个简单的转调函数。
 * 3. 【状态直通】：配置等响应式状态依然存在于 `configStore`，本文件通过 `get currentConfig()` 暴露出响应式引用，前端组件依然只需对接此类。
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private targetWorldbook: string | null = null; // 当前绑定的世界书名称

  public tempDisabledEntries: { uid: number; world: string }[] = []; // 单次临时阻断的条目 UID 及世界书名称列表
  public readonly worldbook: WorldbookFacade;

  private constructor() {
    this.worldbook = new WorldbookFacade(() => this.targetWorldbook);
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

      // CRITICAL BUG FIX: 拦截器处于按需加载状态，如果初次打开页面，没进过检测面板，拦截器实例就不会创建。
      // 我们需要在此处主动唤醒它，让它读取到配置后自动开始监听。
      if (this.currentConfig.isInterceptorEnabled) {
        await this.wakeupInterceptor();
      }

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
      if (this.tempDisabledEntries.length > 0) {
        console.info('[ARK_StatusBar] Restoring temp disabled entries after generation...');
        const entriesToRestore = [...this.tempDisabledEntries];
        this.tempDisabledEntries = []; // 立即清空，防止重入
        try {
          // 根据不同的世界书分类恢复
          const worldGroups = entriesToRestore.reduce(
            (acc, curr) => {
              if (!acc[curr.world]) acc[curr.world] = [];
              acc[curr.world].push(curr.uid);
              return acc;
            },
            {} as Record<string, number[]>,
          );

          let hasFailures = false;
          const failedItems: { world: string; uid: number }[] = [];

          for (const [worldName, uids] of Object.entries(worldGroups)) {
            try {
              await updateWorldbookWith(worldName, (wbEntries: any[]) => {
                for (const uid of uids) {
                  const entry = wbEntries.find(e => e.uid === uid);
                  if (entry) {
                    entry.enabled = true;
                  } else {
                    hasFailures = true;
                    failedItems.push({ world: worldName, uid });
                  }
                }
                return wbEntries;
              });
            } catch (err) {
              hasFailures = true;
              failedItems.push(...uids.map(uid => ({ world: worldName, uid })));
            }
          }

          // 如果还原有失败的（比如世界书被删了或者临时故障），就扔一条 Commit 提醒用户
          if (hasFailures) {
            console.error('[ARK_StatusBar] Some temp disabled entries failed to restore:', failedItems);
            const currentConfig = useArkConfig().value;
            if (currentConfig) {
              const newCommit = {
                id: Math.random().toString(36).substr(2, 6),
                timestamp: Date.now(),
                description: `[警告] 拦截器单次屏蔽恢复失败`,
                worldbook: 'System',
                changes: failedItems.map(item => ({
                  uid: item.uid,
                  comment: `World: ${item.world}`,
                  from: false,
                  to: false, // 没能开启
                })),
              };
              const commits = [...(currentConfig.commits || []), newCommit];
              configStore.updateConfig({ commits });
            }
          }

          // 虽然生成结束后界面可能已关闭，但仍抛出事件以便状态同步
          document.dispatchEvent(new CustomEvent('ark-chat-changed'));
        } catch (e) {
          console.error('[ARK_StatusBar] Failed to process temp disabled entries restoration', e);
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

  /**
   * 唤醒拦截器：防止按需加载导致拦截器未初始化
   */
  public async wakeupInterceptor() {
    const { sendInterceptor } = await import('./interceptor/send_interceptor');
    sendInterceptor.bindInterceptor();
  }
}
