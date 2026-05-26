import { unref } from 'vue';
import { configStore, useArkConfig } from '../../store/config_store';
import { UIWorldbookEntry } from '../../store/ui_state_store';
import { ArkCommit, ArkCommitChange } from '../../types/system_config';

export class HistoryService {
  /**
   * 统一生成并推入 ArkCommit 历史记录。
   * 此方法仅限 Services 层调用，绝不应在前端视图层直接调用。
   */
  public logCommit(
    description: string,
    worldbook: string,
    changes: ArkCommitChange[],
    isHeavy: boolean = false
  ): void {
    const newCommit: ArkCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description,
      worldbook,
      isHeavy,
      changes,
    };

    const currentConfig = unref(useArkConfig());
    if (!currentConfig) return;

    let commits = [...(currentConfig.commits || [])];
    commits.push(newCommit);

    const maxHistoryCommits = currentConfig.maxHistoryCommits ?? 100;
    const maxHeavyHistoryCommits = currentConfig.maxHeavyHistoryCommits ?? 30;

    // 清理逻辑: 分别统计 heavy 和 普通 commits，剔除未置顶的超限记录
    let heavyCount = 0;
    let totalCount = 0;
    const nextCommits: ArkCommit[] = [];

    // 从后往前遍历，保留最新的和置顶的
    for (let i = commits.length - 1; i >= 0; i--) {
      const c = commits[i];
      if (c.isPinned) {
        nextCommits.unshift(c);
        continue;
      }
      if (c.isHeavy) {
        if (heavyCount < maxHeavyHistoryCommits && totalCount < maxHistoryCommits) {
          nextCommits.unshift(c);
          heavyCount++;
          totalCount++;
        }
      } else {
        if (totalCount < maxHistoryCommits) {
          nextCommits.unshift(c);
          totalCount++;
        }
      }
    }

    configStore.updateConfig({ commits: nextCommits });
  }

  /**
   * 执行底层世界书状态还原的核心函数
   * @param commitList 必须按照传入顺序从新到老依次还原
   */
  async applyInverseChanges(commitList: ArkCommit[], currentPrimaryWorldbook: string | null): Promise<void> {
    // 根据目标世界书对 commit 进行分组
    const worldbookGroups = commitList.reduce(
      (acc, curr) => {
        const target = curr.worldbook || currentPrimaryWorldbook;
        if (target) {
          if (!acc[target]) acc[target] = [];
          acc[target].push(curr);
        }
        return acc;
      },
      {} as Record<string, ArkCommit[]>,
    );

    for (const [worldName, commits] of Object.entries(worldbookGroups)) {
      // 必须按照提交时间的反序 (从新到老) 来还原
      const sortedCommits = [...commits].sort((a, b) => b.timestamp - a.timestamp);

      // 首先按类型分离：特殊操作（新建/删除世界书或条目）和属性修改
      // 为了保证时序，按 commit 依次处理
      for (const commit of sortedCommits) {
        const hasSpecialOp = commit.changes.some(c =>
          ['create_worldbook', 'delete_worldbook', 'create_entry', 'delete_entry'].includes(c.path as string),
        );

        if (hasSpecialOp) {
          for (const change of commit.changes) {
            if (change.path === 'create_worldbook') {
              try {
                await deleteWorldbook(worldName);
              } catch (e) {
                console.error('[ARK_HistoryService] Failed to delete worldbook', e);
              }
            } else if (change.path === 'delete_worldbook') {
              try {
                await createWorldbook(worldName, change.from);
              } catch (e) {
                console.error('[ARK_HistoryService] Failed to restore worldbook', e);
              }
            } else if (change.path === 'create_entry') {
              try {
                await deleteWorldbookEntries(worldName, (entry: any) => entry.uid === change.uid);
              } catch (e) {
                console.error('[ARK_HistoryService] Failed to delete entry', e);
              }
            } else if (change.path === 'delete_entry') {
              try {
                await createWorldbookEntries(worldName, [change.from]);
              } catch (e) {
                console.error('[ARK_HistoryService] Failed to restore entry', e);
              }
            }
          }
        }

        // 处理普通属性修改
        const propChanges = commit.changes.filter(
          c => !['create_worldbook', 'delete_worldbook', 'create_entry', 'delete_entry'].includes(c.path as string),
        );

        if (propChanges.length > 0) {
          await updateWorldbookWith(worldName, (wbEntries: UIWorldbookEntry[]) => {
            for (const change of propChanges) {
              const e = wbEntries.find(x => x.uid === change.uid);
              if (e) {
                // 对类型的逆向恢复
                if (commit.description?.includes('changed type') || commit.description?.includes('修改触发类型')) {
                  if (!e.strategy) {
                    e.strategy = {
                      type: 'selective',
                      keys: [],
                      keys_secondary: { logic: 'and_any', keys: [] },
                      scan_depth: 'same_as_global',
                    };
                  }
                  e.strategy.type = change.from ? 'constant' : 'selective';
                }
                // 如果是单纯的 enabled
                else if (change.path === 'enabled' || (!change.path && typeof change.from === 'boolean')) {
                  e.enabled = change.from;
                }
                // 通用深度属性赋值
                else if (change.path) {
                  const props = (change.path as string).split('.');
                  let current: any = e;
                  for (let i = 0; i < props.length - 1; i++) {
                    if (current[props[i]] === undefined) {
                      current[props[i]] = {};
                    }
                    current = current[props[i]];
                  }
                  current[props[props.length - 1]] = change.from;
                }
              }
            }
            return wbEntries;
          });
        }
      }

      // 处理完毕后，通知该世界书的数据已更新
      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: worldName } }));
    }
  }

  /**
   * 恢复单条记录
   */
  async revertCommit(commit: ArkCommit, currentPrimaryWorldbook: string | null): Promise<void> {
    try {
      await this.applyInverseChanges([commit], currentPrimaryWorldbook);

      // 从 configStore 中删除该记录
      const currentConfig = unref(useArkConfig());
      if (currentConfig && currentConfig.commits) {
        const newCommits = currentConfig.commits.filter(c => c.id !== commit.id);
        configStore.updateConfig({ commits: newCommits });
      }
    } catch (error) {
      console.error('[ARK_HistoryService] Failed to revert commit', error);
      throw error;
    }
  }

  /**
   * 恢复选中的多条记录
   */
  async batchRevertCommits(commitIds: string[], currentPrimaryWorldbook: string | null): Promise<void> {
    if (commitIds.length === 0) return;

    try {
      const currentConfig = unref(useArkConfig());
      if (!currentConfig || !currentConfig.commits) return;

      const commitsToRevert = currentConfig.commits.filter(c => commitIds.includes(c.id));
      await this.applyInverseChanges(commitsToRevert, currentPrimaryWorldbook);

      // 删除恢复完的记录
      const newCommits = currentConfig.commits.filter(c => !commitIds.includes(c.id));
      configStore.updateConfig({ commits: newCommits });
    } catch (error) {
      console.error('[ARK_HistoryService] Failed to batch revert commits', error);
      throw error;
    }
  }

  /**
   * 删除单条历史记录（仅清理记录，不改变当前状态）
   */
  deleteCommit(commitId: string): void {
    const currentConfig = unref(useArkConfig());
    if (currentConfig && currentConfig.commits) {
      const newCommits = currentConfig.commits.filter(c => c.id !== commitId);
      configStore.updateConfig({ commits: newCommits });
    }
  }

  /**
   * 批量删除记录
   */
  batchDeleteCommits(commitIds: string[]): void {
    if (commitIds.length === 0) return;
    const currentConfig = unref(useArkConfig());
    if (currentConfig && currentConfig.commits) {
      const newCommits = currentConfig.commits.filter(c => !commitIds.includes(c.id));
      configStore.updateConfig({ commits: newCommits });
    }
  }

  /**
   * 置顶/取消置顶历史记录
   */
  togglePinCommit(commitId: string): void {
    const currentConfig = unref(useArkConfig());
    if (currentConfig && currentConfig.commits) {
      const commits = [...currentConfig.commits];
      const target = commits.find(c => c.id === commitId);
      if (target) {
        target.isPinned = !target.isPinned;
        configStore.updateConfig({ commits });
      }
    }
  }
}

export const historyService = new HistoryService();
