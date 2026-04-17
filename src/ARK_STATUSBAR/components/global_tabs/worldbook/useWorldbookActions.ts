import { configStore, useArkConfig } from '../../../core/config_store';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import { ArkCommitChange } from '../../../types/system_config';
import {
  allAvailableWorldbooks,
  currentPrimaryWorldbook,
  globalMountedWorldbooks,
  UIWorldbookEntry,
} from '../shared_ui_state';

/**
 * 封装并接管 Worldbook 的所有增删改查动作，
 * 及生成 `ArkCommit` 的逻辑。供 UI 层调用。
 */
export function useWorldbookActions() {
  const currentConfig = useArkConfig();
  const manager = StatusBarManager.getInstance();

  // ---------- Worldbook 维度的操作 ----------

  const toggleGlobalMount = async (wbName: string, isMount: boolean) => {
    try {
      await manager.worldbook.toggleGlobalMount(wbName, isMount);
      globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    } catch (e) {
      console.error('toggleGlobalMountUI error', e);
      if (typeof toastr !== 'undefined') toastr.error('挂载状态切换失败');
    }
  };

  const toggleWorldbookPin = (wbName: string) => {
    const pinned = currentConfig.value?.pinnedWorldbooks || [];
    const idx = pinned.indexOf(wbName);
    const newPinned = [...pinned];
    if (idx === -1) newPinned.push(wbName);
    else newPinned.splice(idx, 1);
    configStore.updateConfig({ pinnedWorldbooks: newPinned });
  };

  const performDeleteWorldbook = async (wbName: string) => {
    try {
      const entries = await getWorldbook(wbName);
      await deleteWorldbook(wbName);
      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[删除世界书] ${wbName}`,
        worldbook: wbName,
        isHeavy: true,
        changes: [
          {
            uid: -1,
            comment: '整个世界书备份',
            path: 'delete_worldbook',
            from: entries,
          },
        ],
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });

      allAvailableWorldbooks.value = allAvailableWorldbooks.value.filter(n => n !== wbName);
    } catch (e) {
      console.error('delete worldbook failed', e);
    }
  };

  const deleteWorldbookUI = async (wbName: string) => {
    if (confirm(`确定要删除世界书 [${wbName}] 吗？`)) {
      await performDeleteWorldbook(wbName);
      if (typeof toastr !== 'undefined') toastr.success('删除成功');
    }
  };

  const createNewWorldbook = async () => {
    const name = prompt('请输入新世界书的名称:');
    if (!name || name.trim() === '') return;
    try {
      await createWorldbook(name.trim(), []);
      allAvailableWorldbooks.value.push(name.trim());

      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[创建世界书] ${name.trim()}`,
        worldbook: name.trim(),
        changes: [
          {
            uid: -1,
            comment: '新建的世界书',
            path: 'create_worldbook',
            from: null,
          },
        ],
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
      if (typeof toastr !== 'undefined') toastr.success('创建成功');
    } catch (e) {
      console.error('Create worldbook failed', e);
      if (typeof toastr !== 'undefined') toastr.error('创建失败');
    }
  };

  const batchPinWorldbooks = (selectedWbs: string[], isPin: boolean) => {
    const pinned = currentConfig.value?.pinnedWorldbooks || [];
    let newPinned = [...pinned];
    for (const wb of selectedWbs) {
      if (isPin && !newPinned.includes(wb)) newPinned.push(wb);
      else if (!isPin && newPinned.includes(wb)) newPinned = newPinned.filter(n => n !== wb);
    }
    configStore.updateConfig({ pinnedWorldbooks: newPinned });
  };

  const batchMountWorldbooks = async (selectedWbs: string[], isMount: boolean) => {
    for (const wb of selectedWbs) {
      try {
        await manager.worldbook.toggleGlobalMount(wb, isMount);
      } catch (e) {
        console.error('Failed to mount/unmount ' + wb, e);
      }
    }
    globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    if (typeof toastr !== 'undefined') toastr.success('批量操作完成');
  };

  const batchDeleteWorldbooks = async (selectedWbs: string[]) => {
    if (!confirm(`确定要删除选中的 ${selectedWbs.length} 本世界书吗？`)) return false;
    for (const wbName of selectedWbs) {
      await performDeleteWorldbook(wbName);
    }
    if (typeof toastr !== 'undefined') toastr.success('批量删除完成');
    return true;
  };

  // ---------- Entry 维度的操作 ----------

  const getEntryType = (entry: UIWorldbookEntry) => {
    return entry.strategy?.type || 'selective';
  };

  const togglePinEntry = (entryUid: number) => {
    const pinned = currentConfig.value?.pinnedEntries || [];
    const index = pinned.indexOf(entryUid);
    let newPinned = [...pinned];
    if (index === -1) newPinned.push(entryUid);
    else newPinned.splice(index, 1);
    configStore.updateConfig({ pinnedEntries: newPinned });
  };

  const toggleEntryType = async (entry: UIWorldbookEntry, explicitWbName: string) => {
    try {
      const currentType = getEntryType(entry);
      const newType = currentType === 'constant' ? 'selective' : 'constant';
      const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
      if (!targetWorldbook) return;

      await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
        const e = wbEntries.find(x => x.uid === entry.uid && x.name === entry.name);
        if (e) {
          if (!e.strategy)
            e.strategy = {
              type: 'selective',
              keys: [],
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global',
            };
          e.strategy.type = newType as 'constant' | 'selective';
        }
        return wbEntries;
      });

      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );

      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[修改触发类型] ${entry.name}`,
        worldbook: targetWorldbook,
        changes: [
          {
            uid: entry.uid,
            comment: entry.name || '未命名',
            from: currentType === 'constant',
            to: newType === 'constant',
          },
        ],
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
    } catch (e) {
      console.error('Failed to toggle entry type', e);
    }
  };

  const toggleEntryEnabled = async (entry: UIWorldbookEntry, explicitWbName: string) => {
    try {
      const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
      if (!targetWorldbook) return;

      await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
        const e = wbEntries.find(x => x.uid === entry.uid);
        if (e) e.enabled = entry.enabled;
        return wbEntries;
      });

      document.dispatchEvent(
        new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }),
      );

      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[切换开关] ${entry.name}`,
        worldbook: targetWorldbook,
        changes: [{ uid: entry.uid, comment: entry.name || '未命名', from: !entry.enabled, to: entry.enabled }],
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
    } catch (e) {
      console.error('Failed to toggle entry', e);
      entry.enabled = !entry.enabled; // 回滚 UI 状态
    }
  };

  const handleSaveEntry = async (changes: ArkCommitChange[], newEntry: UIWorldbookEntry, explicitWbName: string) => {
    try {
      const targetWorldbook = explicitWbName || newEntry.world || currentPrimaryWorldbook.value;
      if (!targetWorldbook) return;

      await updateWorldbookWith(targetWorldbook, (wbEntries: UIWorldbookEntry[]) => {
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
      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[修改条目属性] ${newEntry.name || '未命名条目'}`,
        worldbook: targetWorldbook,
        isHeavy,
        changes,
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
      if (typeof toastr !== 'undefined') toastr.success('保存成功');
    } catch (e) {
      console.error('Failed to save entry', e);
      if (typeof toastr !== 'undefined') toastr.error('保存失败，请检查控制台');
    }
  };

  const performDeleteEntries = async (wbName: string, uids: number[]) => {
    if (uids.length === 0) return;
    try {
      const { deleted_entries } = await deleteWorldbookEntries(wbName, e => uids.includes(e.uid));

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (deleted_entries.length > 0) {
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[删除条目] 共 ${deleted_entries.length} 个`,
          worldbook: wbName,
          changes: deleted_entries.map(e => ({
            uid: e.uid,
            comment: e.name || '未命名',
            path: 'delete_entry',
            from: e,
          })),
        };
        configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
      }
    } catch (e) {
      console.error('performDeleteEntries failed', e);
    }
  };

  const deleteEntryUI = async (entry: UIWorldbookEntry, wbName: string) => {
    if (confirm(`确定要删除条目 [${entry.name || '未命名'}] 吗？`)) {
      await performDeleteEntries(wbName, [entry.uid]);
      if (typeof toastr !== 'undefined') toastr.success('删除成功');
    }
  };

  const createNewEntry = async (wbName: string): Promise<number | null> => {
    const name = prompt('请输入新条目的名称 (标题):');
    if (!name) return null;
    try {
      const { new_entries } = await createWorldbookEntries(wbName, [{ name: name.trim() }]);

      document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: wbName } }));

      if (new_entries.length > 0) {
        const e = new_entries[0];
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[新建条目] ${e.name}`,
          worldbook: wbName,
          changes: [
            {
              uid: e.uid,
              comment: e.name || '未命名',
              path: 'create_entry',
              from: null,
              to: e,
            },
          ],
        };
        configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
        if (typeof toastr !== 'undefined') toastr.success('创建成功，请编辑属性');
        return e.uid;
      }
    } catch (e) {
      console.error('Create entry failed', e);
      if (typeof toastr !== 'undefined') toastr.error('创建失败');
    }
    return null;
  };

  // --- Entry 批量操作 ---

  const batchPinEntries = (selectedUids: number[], isPin: boolean) => {
    const pinned = currentConfig.value?.pinnedEntries || [];
    let newPinned = [...pinned];
    for (const uid of selectedUids) {
      if (isPin && !newPinned.includes(uid)) newPinned.push(uid);
      else if (!isPin && newPinned.includes(uid)) newPinned = newPinned.filter(n => n !== uid);
    }
    configStore.updateConfig({ pinnedEntries: newPinned });
  };

  const batchToggleEntryType = async (wbName: string, uids: number[]) => {
    if (uids.length === 0) return;
    try {
      const changes: any[] = [];
      await updateWorldbookWith(wbName, (wbEntries: UIWorldbookEntry[]) => {
        for (const uid of uids) {
          const e = wbEntries.find(x => x.uid === uid);
          if (e) {
            const currentType = getEntryType(e);
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

      const newCommit = {
        id: Math.random().toString(36).substr(2, 6),
        timestamp: Date.now(),
        description: `[批量修改触发类型] 选中了 ${uids.length} 个条目`,
        worldbook: wbName,
        changes,
      };
      configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
      if (typeof toastr !== 'undefined') toastr.success('批量切换类型成功');
    } catch (e) {
      console.error('Batch toggle type failed', e);
    }
  };

  const batchToggleEntryEnabled = async (wbName: string, uids: number[], enable: boolean) => {
    if (uids.length === 0) return;
    try {
      const changes: any[] = [];
      await updateWorldbookWith(wbName, (wbEntries: UIWorldbookEntry[]) => {
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
        const newCommit = {
          id: Math.random().toString(36).substr(2, 6),
          timestamp: Date.now(),
          description: `[批量${enable ? '开启' : '关闭'}开关] 选中了 ${changes.length} 个条目`,
          worldbook: wbName,
          changes,
        };
        configStore.updateConfig({ commits: [...(currentConfig.value?.commits || []), newCommit] });
      }
      if (typeof toastr !== 'undefined') toastr.success(`批量${enable ? '开启' : '关闭'}成功`);
    } catch (e) {
      console.error('Batch toggle enable failed', e);
    }
  };

  const batchDeleteEntries = async (wbName: string, uids: number[]) => {
    if (uids.length === 0) return false;
    if (confirm(`确定要删除选中的 ${uids.length} 个条目吗？`)) {
      await performDeleteEntries(wbName, uids);
      if (typeof toastr !== 'undefined') toastr.success('批量删除完成');
      return true;
    }
    return false;
  };

  return {
    toggleGlobalMount,
    toggleWorldbookPin,
    deleteWorldbookUI,
    createNewWorldbook,
    batchPinWorldbooks,
    batchMountWorldbooks,
    batchDeleteWorldbooks,

    getEntryType,
    togglePinEntry,
    toggleEntryType,
    toggleEntryEnabled,
    handleSaveEntry,
    deleteEntryUI,
    createNewEntry,
    batchPinEntries,
    batchToggleEntryType,
    batchToggleEntryEnabled,
    batchDeleteEntries,
  };
}
