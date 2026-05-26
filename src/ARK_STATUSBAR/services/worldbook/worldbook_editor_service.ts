import { UIWorldbookEntry } from '../../store/ui_state_store';
import { ArkCommitChange } from '../../types/system_config';
import { historyService } from './history_service';

export class WorldbookEditorService {
  /**
   * 删除世界书
   */
  async deleteWorldbook(wbName: string): Promise<void> {
    try {
      const entries = await getWorldbook(wbName);
      await deleteWorldbook(wbName);

      historyService.logCommit(
        `[删除世界书] ${wbName}`,
        wbName,
        [
          {
            uid: -1,
            comment: '整个世界书备份',
            path: 'delete_worldbook',
            from: entries,
          },
        ],
        true,
      );
    } catch (e) {
      console.error('[ARK_EditorService] delete worldbook failed', e);
      throw e;
    }
  }

  /**
   * 创建世界书
   */
  async createWorldbook(name: string): Promise<void> {
    try {
      await createWorldbook(name, []);
      historyService.logCommit(`[创建世界书] ${name}`, name, [
        {
          uid: -1,
          comment: '新建的世界书',
          path: 'create_worldbook',
          from: null,
        },
      ]);
    } catch (e) {
      console.error('[ARK_EditorService] Create worldbook failed', e);
      throw e;
    }
  }

  /**
   * 获取条目策略类型
   */
  getEntryType(entry: UIWorldbookEntry): string {
    return entry.strategy?.type || 'selective';
  }

  /**
   * 切换单个条目触发类型
   */
  async toggleEntryType(entry: UIWorldbookEntry, targetWorldbook: string): Promise<void> {
    try {
      const currentType = this.getEntryType(entry);
      const newType = currentType === 'constant' ? 'selective' : 'constant';

      await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
        const e = wbEntries.find(x => x.uid === entry.uid && x.name === entry.name);
        if (e) {
          if (!e.strategy) {
            e.strategy = {
              type: 'selective',
              keys: [],
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global',
            };
          }
          e.strategy.type = newType as 'constant' | 'selective';
        }
        return wbEntries;
      });

      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );

      historyService.logCommit(`[修改触发类型] ${entry.name}`, targetWorldbook, [
        {
          uid: entry.uid,
          comment: entry.name || '未命名',
          from: currentType === 'constant',
          to: newType === 'constant',
        },
      ]);
    } catch (e) {
      console.error('[ARK_EditorService] Failed to toggle entry type', e);
      throw e;
    }
  }

  /**
   * 切换单个条目启用状态
   */
  async toggleEntryEnabled(entry: UIWorldbookEntry, targetWorldbook: string): Promise<void> {
    try {
      await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
        const e = wbEntries.find(x => x.uid === entry.uid);
        if (e) e.enabled = entry.enabled;
        return wbEntries;
      });

      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );

      historyService.logCommit(`[切换开关] ${entry.name}`, targetWorldbook, [
        {
          uid: entry.uid,
          comment: entry.name || '未命名',
          from: !entry.enabled,
          to: entry.enabled,
        },
      ]);
    } catch (e) {
      console.error('[ARK_EditorService] Failed to toggle entry', e);
      throw e;
    }
  }

  /**
   * 保存条目修改
   */
  async saveEntry(newEntry: UIWorldbookEntry, targetWorldbook: string, changes: ArkCommitChange[]): Promise<void> {
    try {
      await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
        const idx = wbEntries.findIndex(x => x.uid === newEntry.uid);
        if (idx !== -1) {
          wbEntries[idx] = { ...newEntry };
        }
        return wbEntries;
      });

      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );

      const isHeavy = changes.some(c => c.path === 'content');
      historyService.logCommit(`[修改条目属性] ${newEntry.name || '未命名条目'}`, targetWorldbook, changes, isHeavy);
    } catch (e) {
      console.error('[ARK_EditorService] Failed to save entry', e);
      throw e;
    }
  }

  /**
   * 批量删除条目
   */
  async batchDeleteEntries(wbName: string, uids: number[]): Promise<void> {
    if (uids.length === 0) return;
    try {
      const { deleted_entries } = await deleteWorldbookEntries(wbName, (e: any) => uids.includes(e.uid));

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (deleted_entries.length > 0) {
        historyService.logCommit(
          `[删除条目] 共 ${deleted_entries.length} 个`,
          wbName,
          deleted_entries.map((e: any) => ({
            uid: e.uid,
            comment: e.name || '未命名',
            path: 'delete_entry',
            from: e,
          })),
        );
      }
    } catch (e) {
      console.error('[ARK_EditorService] batchDeleteEntries failed', e);
      throw e;
    }
  }

  /**
   * 创建新条目
   */
  async createNewEntry(wbName: string, entryName: string): Promise<number | null> {
    try {
      const { new_entries } = await createWorldbookEntries(wbName, [{ name: entryName.trim() }]);

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (new_entries.length > 0) {
        const e = new_entries[0];
        historyService.logCommit(`[新建条目] ${e.name}`, wbName, [
          {
            uid: e.uid,
            comment: e.name || '未命名',
            path: 'create_entry',
            from: null,
            to: e,
          },
        ]);
        return e.uid;
      }
    } catch (e) {
      console.error('[ARK_EditorService] Create entry failed', e);
      throw e;
    }
    return null;
  }

  /**
   * 批量切换触发类型
   */
  async batchToggleEntryType(wbName: string, uids: number[]): Promise<void> {
    if (uids.length === 0) return;
    try {
      const changes: any[] = [];
      await updateWorldbookWith(wbName, (wbEntries: any[]) => {
        for (const uid of uids) {
          const e = wbEntries.find(x => x.uid === uid);
          if (e) {
            const currentType = this.getEntryType(e);
            const newType = currentType === 'constant' ? 'selective' : 'constant';
            if (!e.strategy) {
              e.strategy = {
                type: 'selective',
                keys: [],
                keys_secondary: { logic: 'and_any', keys: [] },
                scan_depth: 'same_as_global',
              };
            }
            e.strategy.type = newType;
            changes.push({
              uid: e.uid,
              comment: e.name || '未命名',
              from: currentType === 'constant',
              to: newType === 'constant',
            });
          }
        }
        return wbEntries;
      });

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (changes.length > 0) {
        historyService.logCommit(`[批量修改触发类型] 选中了 ${uids.length} 个条目`, wbName, changes);
      }
    } catch (e) {
      console.error('[ARK_EditorService] Batch toggle type failed', e);
      throw e;
    }
  }

  /**
   * 批量切换启用状态
   */
  async batchToggleEntryEnabled(wbName: string, uids: number[], enable: boolean): Promise<void> {
    if (uids.length === 0) return;
    try {
      const changes: any[] = [];
      await updateWorldbookWith(wbName, (wbEntries: any[]) => {
        for (const uid of uids) {
          const e = wbEntries.find(x => x.uid === uid);
          if (e && e.enabled !== enable) {
            changes.push({ uid: e.uid, comment: e.name || '未命名', from: e.enabled, to: enable });
            e.enabled = enable;
          }
        }
        return wbEntries;
      });

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (changes.length > 0) {
        historyService.logCommit(
          `[批量${enable ? '开启' : '关闭'}开关] 选中了 ${changes.length} 个条目`,
          wbName,
          changes,
        );
      }
    } catch (e) {
      console.error('[ARK_EditorService] Batch toggle enable failed', e);
      throw e;
    }
  }
}

export const worldbookEditorService = new WorldbookEditorService();
