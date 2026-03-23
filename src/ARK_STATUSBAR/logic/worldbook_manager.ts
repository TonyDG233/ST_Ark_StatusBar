import { BASELINE_STATE } from '../config/baseline';
import { STARTUP_SCENARIOS } from '../config/scenarios';
import { SINGLE_CHAR_ENTRIES } from '../config/single_char_entries';
import { StatusBarManager } from './statusbar_manager';

/**
 * 辅助函数：获取当前角色绑定的世界书名称。
 * 会优先返回主世界书 (primary)，如果没有则尝试返回附加世界书 (additional) 的第一项。
 *
 * @returns {Promise<string>} 绑定的世界书名称
 * @throws 如果未找到任何绑定的世界书，则抛出错误。
 */
async function getTargetWorldbookName(): Promise<string> {
  try {
    const result = await getCharWorldbookNames('current');
    if (result.primary) return result.primary;
    if (result.additional && result.additional.length > 0) return result.additional[0];
    throw new Error('未找到当前角色绑定的世界书');
  } catch (error) {
    console.error('[ARK_Manager] Failed to get target worldbook:', error);
    throw error;
  }
}

// 定义世界书的三种状态：
// 'original': 完全符合预设的基准线 (Baseline)
// 'single_char_closed': 基准线一致，且所有的“单字干员”世界书条目都已被关闭
// 'modified': 处于上述两者之外的任何被修改的状态
export type WorldbookStatus = 'original' | 'single_char_closed' | 'modified';

/**
 * WorldbookManager
 * 专门用于处理世界书内容的更新、状态比对、一键应用剧本（开局设置）和恢复初始化等功能。
 */
export const WorldbookManager = {
  /**
   * 获取所有可用的世界书名称
   */
  async getAllAvailableWorldbooks(): Promise<string[]> {
    try {
      return getWorldbookNames();
    } catch (e) {
      console.error('[ARK_Manager] Failed to get all worldbooks:', e);
      return [];
    }
  },

  /**
   * 获取已全局挂载的世界书名称
   */
  async getGlobalMountedWorldbooks(): Promise<string[]> {
    try {
      return getGlobalWorldbookNames();
    } catch (e) {
      console.error('[ARK_Manager] Failed to get global mounted worldbooks:', e);
      return [];
    }
  },

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
      console.error('[ARK_Manager] Failed to get char bound worldbooks:', error);
      return [];
    }
  },

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
      console.info(`[ARK_Manager] Global mount updated for ${worldbookName}: ${isMount}`);
    } catch (e) {
      console.error(`[ARK_Manager] Failed to toggle global mount for ${worldbookName}:`, e);
      throw e;
    }
  },

  /**
   * 获取当前世界书状态，通过对比 Baseline (基准线) 数据来判断是否被修改过。
   *
   * @returns {Promise<WorldbookStatus>} 返回比对后的状态
   */
  async getWorldbookStatus(): Promise<WorldbookStatus> {
    try {
      const targetBook = await getTargetWorldbookName();
      const entries = await getWorldbook(targetBook);

      let isOriginal = true;
      let isSingleCharClosed = true;

      // 仅遍历在基准线（BASELINE_STATE）中定义过的关键条目，忽略用户自行添加的扩展条目
      for (const key of Object.keys(BASELINE_STATE)) {
        const entry = entries.find(e => e.name === key);
        if (!entry) continue; // 如果当前世界书缺失该条目，则跳过（正常情况下不应发生）

        const baseline = BASELINE_STATE[key];
        const currentEnabled = entry.enabled;
        // 获取当前触发类型策略，如果不存在默认视作 selective（选择性触发）
        const currentType = entry.strategy?.type || 'selective';

        // 检查 'original' 状态：开启状态或蓝绿灯(触发策略)不匹配，即视为已修改
        if (currentEnabled !== baseline.enabled || currentType !== baseline.type) {
          isOriginal = false;
        }

        // 检查 'single_char_closed' 状态逻辑
        const isSingleChar = SINGLE_CHAR_ENTRIES.includes(key);
        if (isSingleChar) {
          // 对于单字干员条目，要满足 single_char_closed 状态，它必须是被关闭的(false)
          if (currentEnabled !== false) {
            isSingleCharClosed = false;
          }
        } else {
          // 对于非单字干员的普通条目，它必须严格匹配 Baseline 设定的状态
          if (currentEnabled !== baseline.enabled || currentType !== baseline.type) {
            isSingleCharClosed = false;
          }
        }
      }

      if (isOriginal) return 'original';
      if (isSingleCharClosed) return 'single_char_closed';
      return 'modified';
    } catch (error) {
      console.error('[ARK_Manager] Get Status failed:', error);
      return 'modified'; // 为了安全，发生错误时默认判定为已修改状态
    }
  },

  /**
   * 将世界书条目状态全部重置为基准线（Baseline）配置的初始状态。
   */
  async resetToBaseline(): Promise<void> {
    console.info('[ARK_Manager] Resetting Worldbook to Baseline...');
    try {
      const targetBook = await getTargetWorldbookName();
      await updateWorldbookWith(targetBook, entries => {
        entries.forEach(entry => {
          // 只重置那些记录在基准线中的核心条目
          if (entry.name && BASELINE_STATE.hasOwnProperty(entry.name)) {
            const baseline = BASELINE_STATE[entry.name];
            entry.enabled = baseline.enabled;
            if (entry.strategy) {
              entry.strategy.type = baseline.type; // 恢复蓝/绿灯策略
            }
          }
        });
        return entries;
      });
      toastr.success('世界书已重置为初始状态');
    } catch (error) {
      console.error('[ARK_Manager] Reset failed:', error);
      toastr.error('世界书重置失败: ' + (error as Error).message);
    }
  },

  /**
   * 一键应用特定的开局设定 (Scenario)
   * 警告：如果当前状态已经是 'modified' 且 force 参数未开启，则抛出异常，这通常由调用者处理弹窗确认。
   *
   * @param swipeId 设定的唯一标识 ID
   * @param force 是否强制覆盖当前修改
   */
  async applyScenario(swipeId: number, force: boolean = false): Promise<void> {
    // 检查是否在未强制(force)的情况下，世界书已经被玩家手动改动过了
    if (!force) {
      const status = await this.getWorldbookStatus();
      if (status === 'modified') {
        throw new Error('STATUS_MODIFIED');
      }
    }

    // 查找需要应用的场景配置
    const scenario = STARTUP_SCENARIOS.find(s => s.swipeId === swipeId);
    if (!scenario) {
      console.error(`[ARK_Manager] Scenario #${swipeId} not found.`);
      return;
    }

    console.info(`[ARK_Manager] Applying Scenario: ${scenario.title}`);
    toastr.info(`正在应用开局设置: ${scenario.title}...`);

    try {
      const targetBook = await getTargetWorldbookName();
      let diffChanges: any[] = []; // 收集修改差异，以便推入 StatusBar 的 Git 历史

      await updateWorldbookWith(targetBook, entries => {
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
      console.info('[ARK_Manager] Scenario applied successfully.');

      // 将本次批量修改作为一次 Commit 推送到状态栏管理器中，方便玩家溯源或撤回
      const manager = StatusBarManager.getInstance();
      if (manager.currentConfig) {
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6), // 随机生成短位 commit ID
          timestamp: Date.now(),
          description: `[Apply Scenario] “${scenario.title}”`,
          changes: diffChanges,
        };
        const commits = [...manager.currentConfig.commits, newCommit];
        manager.saveConfig({ commits });
      }
    } catch (error) {
      console.error('[ARK_Manager] Apply Scenario failed:', error);
      toastr.error('应用开局失败: ' + (error as Error).message);
      throw error;
    }
  },

  /**
   * 一键关闭所有的“单字干员”世界书条目。
   * 单字干员容易因日常用语造成误触发，此功能可批量规避。
   */
  async closeSingleCharEntries(): Promise<void> {
    console.info('[ARK_Manager] Closing all single-character entries...');
    try {
      const targetBook = await getTargetWorldbookName();
      let diffChanges: any[] = [];

      await updateWorldbookWith(targetBook, entries => {
        entries.forEach(entry => {
          // 如果条目名称在单字干员列表中，且当前为开启状态
          if (entry.name && SINGLE_CHAR_ENTRIES.includes(entry.name)) {
            if (entry.enabled) {
              entry.enabled = false; // 关闭它
              // 记录变更以便提交历史
              diffChanges.push({
                uid: entry.uid,
                comment: (entry as any).comment || entry.name,
                from: true,
                to: false,
              });
            }
          }
        });
        return entries;
      });
      toastr.success('已关闭所有单字条目');

      // 将批量关闭动作记录到操作历史
      const manager = StatusBarManager.getInstance();
      if (manager.currentConfig && diffChanges.length > 0) {
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[Bulk Close] 关闭了所有单字干员 (${diffChanges.length}项)`,
          worldbook: targetBook,
          changes: diffChanges,
        };
        const commits = [...manager.currentConfig.commits, newCommit];
        manager.saveConfig({ commits });
      }
    } catch (error) {
      console.error('[ARK_Manager] Bulk close failed:', error);
      toastr.error('操作失败: ' + (error as Error).message);
    }
  },

  /**
   * 创建快照 (保存指定世界书的当前所有条目状态)
   */
  async saveCurrentAsSnapshot(worldbookName: string, snapshotName: string): Promise<void> {
    try {
      const entries = await getWorldbook(worldbookName);
      const states: Record<number, { enabled: boolean; type: string }> = {};
      entries.forEach(e => {
        states[e.uid] = {
          enabled: e.enabled,
          type: e.strategy?.type || 'selective',
        };
      });

      const newSnapshot = {
        id: Math.random().toString(36).substr(2, 9),
        name: snapshotName,
        timestamp: Date.now(),
        worldbook: worldbookName,
        states,
      };

      const manager = StatusBarManager.getInstance();
      if (manager.currentConfig) {
        const snapshots = [...(manager.currentConfig.snapshots || []), newSnapshot];
        manager.saveConfig({ snapshots });
        toastr.success(`快照 [${snapshotName}] 保存成功`);
      }
    } catch (e) {
      console.error('[ARK_Manager] saveCurrentAsSnapshot failed', e);
      toastr.error('快照保存失败');
    }
  },

  /**
   * 恢复快照 (将指定世界书的条目状态恢复至快照记录)
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      const manager = StatusBarManager.getInstance();
      if (!manager.currentConfig || !manager.currentConfig.snapshots) return;
      const snapshot = manager.currentConfig.snapshots.find(s => s.id === snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');

      await updateWorldbookWith(snapshot.worldbook, entries => {
        entries.forEach(e => {
          if (snapshot.states[e.uid]) {
            const st = snapshot.states[e.uid];
            e.enabled = st.enabled;
            if (!e.strategy) (e as any).strategy = {};
            if (e.strategy) e.strategy.type = st.type as any;
            (e as any).constant = st.type === 'constant';
          }
        });
        return entries;
      });

      // 从记录历史中删除该世界书的历史操作记录，因为已彻底回滚到了最初的快照状态
      const commits = manager.currentConfig.commits.filter(c => c.worldbook !== snapshot.worldbook);
      manager.saveConfig({ commits });

      toastr.success(`快照 [${snapshot.name}] 恢复成功`);
    } catch (e) {
      console.error('[ARK_Manager] restoreSnapshot failed', e);
      toastr.error('快照恢复失败');
    }
  },

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const manager = StatusBarManager.getInstance();
    if (manager.currentConfig && manager.currentConfig.snapshots) {
      const snapshots = manager.currentConfig.snapshots.filter(s => s.id !== snapshotId);
      manager.saveConfig({ snapshots });
    }
  },
};
