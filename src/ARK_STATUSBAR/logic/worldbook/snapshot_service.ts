import { unref } from 'vue';
import { useArkConfig } from '../../core/config_store';
import { ArkEventBus } from '../../core/event_bus';

/**
 * 负责世界书快照生命周期 (保存、恢复、删除) 的底层黑盒服务
 */
export class SnapshotService {
  /**
   * 创建快照 (保存指定世界书的当前所有条目状态)
   */
  async saveCurrentAsSnapshot(worldbookName: string, snapshotName: string): Promise<void> {
    try {
      const entries = await getWorldbook(worldbookName);
      const states: Record<number, { enabled: boolean; type: string }> = {};
      entries.forEach((e: any) => {
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

      const currentConfig = unref(useArkConfig());
      if (currentConfig) {
        const snapshots = [...(currentConfig.snapshots || []), newSnapshot];
        // 抛出配置更新事件
        ArkEventBus.emit('config:update_requested', { snapshots });
        toastr.success(`快照 [${snapshotName}] 保存成功`);
      }
    } catch (e) {
      console.error('[ARK_SnapshotService] saveCurrentAsSnapshot failed', e);
      toastr.error('快照保存失败');
    }
  }

  /**
   * 恢复快照 (将指定世界书的条目状态恢复至快照记录)
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      const currentConfig = unref(useArkConfig());
      if (!currentConfig || !currentConfig.snapshots) return;
      const snapshot = currentConfig.snapshots.find(s => s.id === snapshotId);
      if (!snapshot) throw new Error('Snapshot not found');

      await updateWorldbookWith(snapshot.worldbook, (entries: any[]) => {
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

      // 抛出内部自定义事件
      ArkEventBus.emit('worldbook:data_changed', snapshot.worldbook);

      // 从记录历史中删除该世界书的历史操作记录，因为已彻底回滚到了最初的快照状态
      const commits = currentConfig.commits.filter(c => c.worldbook !== snapshot.worldbook);
      ArkEventBus.emit('config:update_requested', { commits });

      toastr.success(`快照 [${snapshot.name}] 恢复成功`);
    } catch (e) {
      console.error('[ARK_SnapshotService] restoreSnapshot failed', e);
      toastr.error('快照恢复失败');
    }
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    const currentConfig = unref(useArkConfig());
    if (currentConfig && currentConfig.snapshots) {
      const snapshots = currentConfig.snapshots.filter(s => s.id !== snapshotId);
      ArkEventBus.emit('config:update_requested', { snapshots });
    }
  }
}

export const snapshotService = new SnapshotService();
