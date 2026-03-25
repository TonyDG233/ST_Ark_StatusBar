import { BASELINE_STATE } from '../../config/baseline';
import { STARTUP_SCENARIOS } from '../../config/scenarios';
import { SINGLE_CHAR_ENTRIES } from '../../config/single_char_entries';
import { ArkEventBus } from '../core/event_bus';

export type WorldbookStatus = 'original' | 'single_char_closed' | 'modified';

/**
 * 负责单字关闭、条目重置、开局设定等底层黑盒服务
 */
export class EntryService {
  /**
   * 获取所有可用的世界书名称
   */
  async getAllAvailableWorldbooks(): Promise<string[]> {
    try {
      return getWorldbookNames();
    } catch (e) {
      console.error('[ARK_EntryService] Failed to get all worldbooks:', e);
      return [];
    }
  }

  /**
   * 获取已全局挂载的世界书名称
   */
  async getGlobalMountedWorldbooks(): Promise<string[]> {
    try {
      return getGlobalWorldbookNames();
    } catch (e) {
      console.error('[ARK_EntryService] Failed to get global mounted worldbooks:', e);
      return [];
    }
  }

  /**
   * 获取当前角色绑定的世界书名称列表（主世界书 + 附加世界书）
   */
  async getCharBoundWorldbooks(): Promise<string[]> {
    try {
      const result = await getCharWorldbookNames('current');
      const list: string[] = [];
      if (result.primary) list.push(result.primary);
      if (result.additional && result.additional.length > 0) {
        list.push(...result.additional);
      }
      return list;
    } catch (error) {
      console.error('[ARK_EntryService] Failed to get char bound worldbooks:', error);
      return [];
    }
  }

  /**
   * 切换某个世界书的全局挂载状态
   */
  async toggleGlobalMount(worldbookName: string, isMount: boolean): Promise<void> {
    try {
      const globals = await getGlobalWorldbookNames();
      const newGlobals = new Set(globals);
      if (isMount) {
        newGlobals.add(worldbookName);
      } else {
        newGlobals.delete(worldbookName);
      }
      await rebindGlobalWorldbooks(Array.from(newGlobals));
      console.info(`[ARK_EntryService] Global mount updated for ${worldbookName}: ${isMount}`);
    } catch (e) {
      console.error(`[ARK_EntryService] Failed to toggle global mount for ${worldbookName}:`, e);
      throw e;
    }
  }

  /**
   * 将世界书条目状态全部重置为基准线（Baseline）配置的初始状态。
   */
  async resetToBaseline(targetBook: string): Promise<void> {
    console.info('[ARK_EntryService] Resetting Worldbook to Baseline...');
    try {
      await updateWorldbookWith(targetBook, (entries: any[]) => {
        entries.forEach(entry => {
          if (entry.name && BASELINE_STATE.hasOwnProperty(entry.name)) {
            const baseline = BASELINE_STATE[entry.name];
            entry.enabled = baseline.enabled;
            if (entry.strategy) {
              entry.strategy.type = baseline.type;
            }
          }
        });
        return entries;
      });
      toastr.success('世界书已重置为初始状态');
    } catch (error) {
      console.error('[ARK_EntryService] Reset failed:', error);
      toastr.error('世界书重置失败: ' + (error as Error).message);
    }
  }

  /**
   * 获取当前世界书状态，通过对比 Baseline 数据来判断是否被修改过。
   */
  async getWorldbookStatus(targetBook: string): Promise<WorldbookStatus> {
    try {
      const entries = await getWorldbook(targetBook);
      let isOriginal = true;
      let isSingleCharClosed = true;

      for (const key of Object.keys(BASELINE_STATE)) {
        const entry = entries.find((e: any) => e.name === key);
        if (!entry) continue;

        const baseline = BASELINE_STATE[key];
        const currentEnabled = entry.enabled;
        const currentType = entry.strategy?.type || 'selective';

        if (currentEnabled !== baseline.enabled || currentType !== baseline.type) {
          isOriginal = false;
        }

        const isSingleChar = SINGLE_CHAR_ENTRIES.includes(key);
        if (isSingleChar) {
          if (currentEnabled !== false) {
            isSingleCharClosed = false;
          }
        } else {
          if (currentEnabled !== baseline.enabled || currentType !== baseline.type) {
            isSingleCharClosed = false;
          }
        }
      }

      if (isOriginal) return 'original';
      if (isSingleCharClosed) return 'single_char_closed';
      return 'modified';
    } catch (error) {
      console.error('[ARK_EntryService] Get Status failed:', error);
      return 'modified';
    }
  }

  /**
   * 一键关闭所有的“单字干员”世界书条目。
   */
  async closeSingleCharEntries(targetBook: string): Promise<void> {
    console.info('[ARK_EntryService] Closing all single-character entries...');
    try {
      let diffChanges: any[] = [];
      await updateWorldbookWith(targetBook, (entries: any[]) => {
        entries.forEach(entry => {
          if (entry.name && SINGLE_CHAR_ENTRIES.includes(entry.name)) {
            if (entry.enabled) {
              entry.enabled = false;
              diffChanges.push({
                uid: entry.uid,
                comment: entry.comment || entry.name,
                from: true,
                to: false,
              });
            }
          }
        });
        return entries;
      });
      toastr.success('已关闭所有单字条目');

      if (diffChanges.length > 0) {
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[Bulk Close] 关闭了所有单字干员 (${diffChanges.length}项)`,
          worldbook: targetBook,
          changes: diffChanges,
        };
        ArkEventBus.emit('history:commit_added', newCommit);
      }
    } catch (error) {
      console.error('[ARK_EntryService] Bulk close failed:', error);
      toastr.error('操作失败: ' + (error as Error).message);
    }
  }

  /**
   * 一键应用特定的开局设定 (Scenario)
   * 警告：如果当前状态已经是 'modified' 且 force 参数未开启，则抛出异常，这通常由调用者处理弹窗确认。
   *
   * @param targetBook 目标世界书名称
   * @param swipeId 设定的唯一标识 ID
   * @param force 是否强制覆盖当前修改
   */
  async applyScenario(targetBook: string, swipeId: number, force: boolean = false): Promise<void> {
    if (!force) {
      const status = await this.getWorldbookStatus(targetBook);
      if (status === 'modified') {
        throw new Error('STATUS_MODIFIED');
      }
    }

    const scenario = STARTUP_SCENARIOS.find(s => s.swipeId === swipeId);
    if (!scenario) {
      console.error(`[ARK_EntryService] Scenario #${swipeId} not found.`);
      return;
    }

    console.info(`[ARK_EntryService] Applying Scenario: ${scenario.title}`);
    toastr.info(`正在应用开局设置: ${scenario.title}...`);

    try {
      let diffChanges: any[] = [];

      await updateWorldbookWith(targetBook, (entries: any[]) => {
        entries.forEach(entry => {
          const name = entry.name;
          if (!name) return;

          const originalState = !!entry.enabled;
          let newState = originalState;

          // 1. 应用 Enable (开启) 逻辑：检查条目名或关键字是否命中需要开启的列表
          if (
            scenario.linkedWorldInfo.some(keyword => {
              const keys = (entry as any).key || (entry as any).keys || [];
              return name === keyword || keys.includes(keyword);
            })
          ) {
            newState = true;
          }

          // 2. 应用 Disable (关闭) 逻辑：检查是否命中需要关闭的列表
          if (
            scenario.disabledWorldInfo &&
            scenario.disabledWorldInfo.some(keyword => {
              const keys = (entry as any).key || (entry as any).keys || [];
              return name === keyword || keys.includes(keyword);
            })
          ) {
            newState = false;
          }

          // 如果状态发生变化，应用它并记录到差异数组中
          if (originalState !== newState) {
            entry.enabled = newState;
            diffChanges.push({
              uid: entry.uid,
              comment: (entry as any).comment || name, // 优先使用 comment 备注
              from: originalState,
              to: newState,
            });
          }
        });
        return entries;
      });

      toastr.success(`开局设置应用成功`);
      console.info('[ARK_EntryService] Scenario applied successfully.');

      // 将本次批量修改作为一次 Commit 推送
      if (diffChanges.length > 0) {
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[Apply Scenario] “${scenario.title}”`,
          changes: diffChanges,
        };
        ArkEventBus.emit('history:commit_added', newCommit);
      }
    } catch (error) {
      console.error('[ARK_EntryService] Apply Scenario failed:', error);
      toastr.error('应用开局失败: ' + (error as Error).message);
      throw error;
    }
  }
}

export const entryService = new EntryService();