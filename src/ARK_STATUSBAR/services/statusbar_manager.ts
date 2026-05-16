import { unref } from 'vue';
import { configStore } from '../store/config_store';
import { backupService } from './worldbook/backup_service';
import { entryService } from './worldbook/entry_service';
import { historyService } from './worldbook/history_service';
import { snapshotService } from './worldbook/snapshot_service';
import { worldbookEditorService } from './worldbook/worldbook_editor_service';

/**
 * Worldbook 的局部外观 (Facade)
 * 隶属于 StatusBarManager
 */
class WorldbookFacade {
  constructor(private getTargetWorldbook: () => string | null) {}

  // --- 旧版快照功能 (保留以兼容) ---
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

  // --- 新版全量备份功能 ---
  public async createFullBackup(worldbookName: string, customName?: string): Promise<string | undefined> {
    if (worldbookName) {
      return await backupService.createFullBackup(worldbookName, customName);
    }
    return undefined;
  }

  public async restoreFullBackup(targetWorldbook: string, backupWorldbook: string): Promise<void> {
    await backupService.restoreFullBackup(targetWorldbook, backupWorldbook);
  }

  public async getAllBackups(targetWorldbook?: string): Promise<string[]> {
    return await backupService.getAllBackups(targetWorldbook);
  }

  public async checkBackupLimitWarning(): Promise<string | null> {
    return await backupService.checkBackupLimitWarning();
  }
  // -------------------------

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
 *    都应在此处进行聚合和透传，禁止前端组件去直接 import `src/ARK_STATUSBAR/../../core/` 等细分文件。
 * 2. 【解耦实现】：如果某一类业务功能代码超过了 200 行（例如发信拦截干跑，日志记录），
 *    必须将其拆分到子文件夹下（如 `worldbook/send_interceptor.ts`），然后在此文件中保留一个简单的转调函数。
 * 3. 【状态直通】：配置等响应式状态依然存在于 `configStore`，本文件通过 `get currentConfig()` 暴露出响应式引用，前端组件依然只需对接此类。
 */
export class StatusBarManager {
  private static instance: StatusBarManager;
  private targetWorldbook: string | null = null; // 当前绑定的世界书名称

  public tempDisabledEntries: { uid: number; world: string }[] = []; // 单次临时阻断的条目 UID 及世界书名称列表
  public readonly worldbook: WorldbookFacade;
  public readonly editor = worldbookEditorService;
  public readonly history = historyService;

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
      // 【修复】捕获这里的错误，避免酒馆初始化尚未完成时导致整个管理器挂掉
      try {
        const result = await getCharWorldbookNames('current');
        if (result.primary) this.targetWorldbook = result.primary;
        else if (result.additional && result.additional.length > 0) this.targetWorldbook = result.additional[0];
      } catch (e) {
        console.warn('[ARK_StatusBar] getCharWorldbookNames failed during init (character may not be loaded yet).', e);
        if (typeof toastr !== 'undefined') {
          toastr.warning('ARK 状态栏：正在等待角色卡加载...', '初始化提示', { timeOut: 3000 });
        }
      }

      if (!this.targetWorldbook) {
        console.warn('[ARK_StatusBar] No worldbook bound to current character at startup.');
        if (typeof toastr !== 'undefined') {
          toastr.info('ARK 状态栏：当前角色卡未绑定世界书，部分功能可能受限。', '初始化提示', { timeOut: 3000 });
        }
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

  public saveConfig(configUpdate: Partial<import('../types/system_config').ArkConfig>) {
    configStore.updateConfig(configUpdate);
  }

  private eventsBound: boolean = false;

  /**
   * 设置环境事件监听 (已移交至专门的 worldbookAutomator)。
   * 此处仅做桥接调用，保持门面纯净。
   */
  private setupEvents() {
    if (this.eventsBound) return;
    this.eventsBound = true;

    import('./worldbook/worldbook_automator').then(({ worldbookAutomator }) => {
      worldbookAutomator.startWatching(
        async () => {
          // 在触发事件时，重新获取当前的角色并更新 targetWorldbook
          const result = await getCharWorldbookNames('current');
          if (result && result.primary) this.targetWorldbook = result.primary;
          else if (result && result.additional && result.additional.length > 0)
            this.targetWorldbook = result.additional[0];

          return this.targetWorldbook;
        },
        () => this.tempDisabledEntries,
        () => {
          this.tempDisabledEntries = [];
        },
      );
    });
  }

  public async runManualTest() {
    const { sendInterceptor } = await import('./worldbook/send_interceptor');
    await sendInterceptor.runManualTest();
  }

  public releaseInterceptAndSend(entriesToLog?: any[], tokenCount?: number | string) {
    import('./worldbook/send_interceptor').then(({ sendInterceptor }) => {
      sendInterceptor.releaseInterceptAndSend(entriesToLog, tokenCount);
    });
  }

  /**
   * 唤醒拦截器：防止按需加载导致拦截器未初始化
   */
  public async wakeupInterceptor() {
    const { sendInterceptor } = await import('./worldbook/send_interceptor');
    sendInterceptor.bindInterceptor();
  }

  /**
   * 销毁管理器，清理所有通过它初始化的全局副作用（防止热重载导致幽灵监听器死锁）
   */
  public async destroy() {
    console.info('[ARK_StatusBar] Destroying Manager...');
    const { sendInterceptor } = await import('./worldbook/send_interceptor');
    sendInterceptor.unbindInterceptor();
  }
}
