import { storeToRefs } from 'pinia';
import { StatusBarManager } from '../../../services/statusbar_manager';
import { configStore, useArkConfig } from '../../../store/config_store';
import { UIWorldbookEntry, useUIStateStore } from '../../../store/ui_state_store';
import { ArkCommitChange } from '../../../types/system_config';

/**
 * Worldbook 的前端 Hook 代理层
 * 仅作 UI 逻辑分发，所有的实际数据修改和 Commit 生成均由 StatusBarManager.editor 接管
 */
export function useWorldbookActions() {
  const uiStore = useUIStateStore();
  const { allAvailableWorldbooks, currentPrimaryWorldbook, globalMountedWorldbooks } = storeToRefs(uiStore);

  const currentConfig = useArkConfig();
  const manager = StatusBarManager.getInstance();

  // ---------- Worldbook 维度的操作 ----------

  const toggleGlobalMount = async (wbName: string, isMount: boolean) => {
    try {
      await manager.worldbook.toggleGlobalMount(wbName, isMount);
      globalMountedWorldbooks.value = await manager.worldbook.getGlobalMountedWorldbooks();
    } catch (e) {
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

  const deleteWorldbookUI = async (wbName: string) => {
    if (confirm(`确定要删除世界书 [${wbName}] 吗？`)) {
      try {
        await manager.editor.deleteWorldbook(wbName);
        allAvailableWorldbooks.value = allAvailableWorldbooks.value.filter((n: string) => n !== wbName);
        if (typeof toastr !== 'undefined') toastr.success('删除成功');
      } catch (e) {
        if (typeof toastr !== 'undefined') toastr.error('删除失败');
      }
    }
  };

  const createNewWorldbook = async () => {
    const name = prompt('请输入新世界书的名称:');
    if (!name || name.trim() === '') return;
    try {
      await manager.editor.createWorldbook(name.trim());
      allAvailableWorldbooks.value.push(name.trim());
      if (typeof toastr !== 'undefined') toastr.success('创建成功');
    } catch (e) {
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
      try {
        await manager.editor.deleteWorldbook(wbName);
        allAvailableWorldbooks.value = allAvailableWorldbooks.value.filter((n: string) => n !== wbName);
      } catch (e) {
        console.error('Failed to delete worldbook', e);
      }
    }
    if (typeof toastr !== 'undefined') toastr.success('批量删除完成');
    return true;
  };

  // ---------- Entry 维度的操作 ----------

  const getEntryType = (entry: UIWorldbookEntry) => {
    return manager.editor.getEntryType(entry);
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
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;
    try {
      await manager.editor.toggleEntryType(entry, targetWorldbook);
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('切换触发类型失败');
    }
  };

  const toggleEntryEnabled = async (entry: UIWorldbookEntry, explicitWbName: string) => {
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;
    try {
      await manager.editor.toggleEntryEnabled(entry, targetWorldbook);
    } catch (e) {
      entry.enabled = !entry.enabled; // 回滚 UI 状态
      if (typeof toastr !== 'undefined') toastr.error('切换开关失败');
    }
  };

  const handleSaveEntry = async (changes: ArkCommitChange[], newEntry: UIWorldbookEntry, explicitWbName: string) => {
    const targetWorldbook = explicitWbName || newEntry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;
    try {
      await manager.editor.saveEntry(newEntry, targetWorldbook, changes);
      if (typeof toastr !== 'undefined') toastr.success('保存成功');
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('保存失败，请检查控制台');
    }
  };

  const deleteEntryUI = async (entry: UIWorldbookEntry, wbName: string) => {
    if (confirm(`确定要删除条目 [${entry.name || '未命名'}] 吗？`)) {
      try {
        await manager.editor.batchDeleteEntries(wbName, [entry.uid]);
        if (typeof toastr !== 'undefined') toastr.success('删除成功');
      } catch (e) {
        if (typeof toastr !== 'undefined') toastr.error('删除失败');
      }
    }
  };

  const createNewEntry = async (wbName: string): Promise<number | null> => {
    const name = prompt('请输入新条目的名称 (标题):');
    if (!name) return null;
    try {
      const uid = await manager.editor.createNewEntry(wbName, name);
      if (uid !== null && typeof toastr !== 'undefined') toastr.success('创建成功，请编辑属性');
      return uid;
    } catch (e) {
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
      await manager.editor.batchToggleEntryType(wbName, uids);
      if (typeof toastr !== 'undefined') toastr.success('批量切换类型成功');
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error('批量切换类型失败');
    }
  };

  const batchToggleEntryEnabled = async (wbName: string, uids: number[], enable: boolean) => {
    if (uids.length === 0) return;
    try {
      await manager.editor.batchToggleEntryEnabled(wbName, uids, enable);
      if (typeof toastr !== 'undefined') toastr.success(`批量${enable ? '开启' : '关闭'}成功`);
    } catch (e) {
      if (typeof toastr !== 'undefined') toastr.error(`批量${enable ? '开启' : '关闭'}失败`);
    }
  };

  const batchDeleteEntries = async (wbName: string, uids: number[]) => {
    if (uids.length === 0) return false;
    if (confirm(`确定要删除选中的 ${uids.length} 个条目吗？`)) {
      try {
        await manager.editor.batchDeleteEntries(wbName, uids);
        if (typeof toastr !== 'undefined') toastr.success('批量删除完成');
        return true;
      } catch (e) {
        if (typeof toastr !== 'undefined') toastr.error('批量删除失败');
      }
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
