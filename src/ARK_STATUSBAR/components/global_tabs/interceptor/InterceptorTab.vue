<template>
  <div class="tab-panel flex-col">
    <div
      class="panel-header-action"
      style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap"
    >
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <button
        class="icon-btn tiny"
        style="border: 1px solid var(--SmartThemeBorderColor, #444); padding: 4px 8px"
        @click="runManualTest"
        title="主动测试当前输入和上下文会触发的条目"
      >
        🔍 主动检测
      </button>
    </div>

    <div v-if="!currentConfig?.isInterceptorEnabled && !isTestMode" class="empty-state">
      ⚠️ 预检拦截已关闭，发送请求将直接通行。
    </div>
    <div v-else-if="pendingEntries.length === 0" class="empty-state">
      <div v-if="!isTestMode">
        当前没有被拦截的发送请求。
        <p class="hint">点击发送按钮时，即将触发的条目将在此等待确认。</p>
      </div>
      <div v-else>
        <strong style="color: #007bff">🔍 测试结果</strong>
        <p>根据当前上下文，未触发任何条件世界书条目。</p>
        <div class="action-bar compact" style="margin-top: 15px">
          <button class="btn-primary" @click="clearTestResults" title="清除测试结果">清除测试结果</button>
        </div>
      </div>

      <div v-if="!isTestMode && lastTriggeredEntries.length > 0" class="last-record-box">
        <hr class="record-divider" />
        <strong>上一轮触发记录</strong>
        <ul class="entry-list read-only">
          <li
            v-for="entry in sortedLastTriggeredEntries"
            :key="entry.uid || Math.random()"
            :class="{ 'disabled-entry': !entry.enabled }"
          >
            <div class="entry-info">
              <span class="entry-name">
                <span v-if="isPinned(entry)" class="pin-icon">📌</span>
                <span style="font-size: 0.9em; margin-right: 4px">{{
                  getEntryType(entry) === 'constant' ? '🔵' : '🟢'
                }}</span>
                {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
                <span v-if="entry.world" style="font-size: 0.8em; opacity: 0.7; margin-left: 5px"
                  >({{ entry.world }})</span
                >
              </span>
              <span class="badge" v-if="entry.enabled !== false">已发送</span>
              <span class="badge blocked" v-else>已阻断</span>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <div v-else>
      <div
        class="warning-box"
        :style="isTestMode ? 'background: rgba(0, 123, 255, 0.2); border-left-color: #007bff;' : ''"
      >
        <strong v-if="!isTestMode">⚠️ 拦截预警</strong>
        <strong v-else>🔍 测试结果</strong>
        <p v-if="!isTestMode">
          本次回复将触发以下世界书条目：<br />
          <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
        </p>
        <p v-else>
          根据当前上下文，模拟检测触发了以下条目：<br />
          <span style="opacity: 0.8; font-size: 0.9em">(预计 Token: {{ currentTokenCount }})</span>
        </p>
      </div>
      <ul class="entry-list stacked">
        <li
          v-for="entry in sortedPendingEntries"
          :key="entry.uid || Math.random()"
          :class="{ 'disabled-entry': entry.enabled === false && !entry.tempDisabled }"
        >
          <div class="entry-name">
            <span v-if="isPinned(entry)" class="pin-icon">📌</span>
            <span style="font-size: 0.9em; margin-right: 4px">{{
              getEntryType(entry) === 'constant' ? '🔵' : '🟢'
            }}</span>
            {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
            <div v-if="entry.world" style="font-size: 0.75em; color: var(--ui-text-secondary); margin-top: 2px">
              📁 来源: {{ entry.world }}
            </div>
          </div>
          <div class="entry-footer">
            <div class="status-badges">
              <span class="badge" v-if="entry.enabled !== false && !entry.tempDisabled">将被发送</span>
              <span class="badge warning" v-else-if="entry.tempDisabled">临时阻断</span>
              <span class="badge blocked" v-else>已阻断</span>
            </div>
            <div class="action-btns">
              <!-- 如果当前是彻底关闭状态，只显示恢复开启 -->
              <button
                v-if="entry.enabled === false && !entry.tempDisabled"
                class="icon-btn tiny"
                style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                title="重新开启此条目"
                @click="togglePendingEntry(entry)"
              >
                ✅ 开启
              </button>

              <template v-else>
                <button
                  v-if="!entry.tempDisabled"
                  class="icon-btn tiny"
                  style="color: #ff9800; border-color: rgba(255, 152, 0, 0.4)"
                  title="本次发送阻断，发送后自动恢复"
                  @click="toggleTempDisable(entry)"
                >
                  ⏳ 单次
                </button>
                <button
                  v-else
                  class="icon-btn tiny"
                  style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                  title="取消临时阻断，重新加入本次发送"
                  @click="toggleTempDisable(entry)"
                >
                  ✅ 恢复
                </button>
                <button
                  class="icon-btn tiny"
                  style="color: #dc3545; border-color: rgba(220, 53, 69, 0.4)"
                  title="彻底阻断此条目，不再自动恢复"
                  @click="togglePendingEntry(entry)"
                >
                  ❎ 彻底
                </button>
              </template>
            </div>
          </div>
        </li>
      </ul>
      <div class="action-bar compact" v-if="!isTestMode">
        <button class="btn-success" @click="confirmSend" title="确认发送">确认发送</button>
        <button class="btn-danger" @click="cancelSend" title="取消发送">取消发送</button>
      </div>
      <div class="action-bar compact" v-else>
        <button class="btn-primary" @click="clearTestResults" title="清除测试结果">清除测试结果</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { configStore, useArkConfig } from '../../../core/config_store';
import { ArkEventBus } from '../../../core/event_bus';
import { StatusBarManager } from '../../../logic/statusbar_manager';
import {
  currentPrimaryWorldbook,
  currentTokenCount,
  isTestMode,
  lastTriggeredEntries,
  pendingEntries,
  sortedLastTriggeredEntries,
  sortedPendingEntries,
} from '../shared_ui_state';

const emit = defineEmits<{ (e: 'close-panel'): void }>();
const currentConfig = useArkConfig();
const manager = StatusBarManager.getInstance();

/**
 * 触发“主动检测”：运行一次 Dry Run 并在拦截器面板显示将被触发的条目，但不实际发送。
 */
const runManualTest = () => {
  isTestMode.value = true;
  manager.runManualTest();
};

/**
 * 清除“主动检测”的结果，退出测试模式。
 */
const clearTestResults = () => {
  pendingEntries.value = [];
  isTestMode.value = false;
};

/**
 * 切换拦截器功能的总开关
 */
const toggleInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ isInterceptorEnabled: checked });
};

/**
 * 检查条目是否被用户置顶
 */
const isPinned = (entry: any) => {
  return currentConfig.value?.pinnedEntries?.includes(entry.uid) || false;
};

/**
 * 获取世界书条目的触发类型 (constant=蓝灯常驻, selective=绿灯条件触发)
 */
const getEntryType = (entry: any) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

/**
 * 确认发送：将当前列表存入快照记录，并通知管理器释放拦截
 */
const confirmSend = () => {
  lastTriggeredEntries.value = [...pendingEntries.value];
  pendingEntries.value = [];
  manager.releaseInterceptAndSend();
  emit('close-panel');
};

const toggleEntrySilent = async (entry: any) => {
  try {
    const targetWorldbook = entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) {
      console.warn('[ARK_UI] 临时切换状态失败：无法确定目标世界书', entry);
      return;
    }
    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      // 放宽匹配条件：只比对 UID，因为世界书条目的 name 和 comment 可能会在中间环节变空或被剔除
      const e = wbEntries.find(x => x.uid === entry.uid);
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });

    // 主动通知底层修改
    ArkEventBus.emit('worldbook:data_changed', targetWorldbook);
  } catch (e) {
    console.error('Failed to toggle entry silently', e);
  }
};

const toggleTempDisable = (entry: any) => {
  entry.tempDisabled = !entry.tempDisabled;

  const targetWorldbook = entry.world || currentPrimaryWorldbook.value;

  if (entry.tempDisabled) {
    entry.enabled = false;
    if (!manager.tempDisabledEntries.find(e => e.uid === entry.uid && e.world === targetWorldbook)) {
      manager.tempDisabledEntries.push({ uid: entry.uid, world: targetWorldbook });
    }
    toggleEntrySilent(entry);
  } else {
    entry.enabled = true;
    const idx = manager.tempDisabledEntries.findIndex(e => e.uid === entry.uid && e.world === targetWorldbook);
    if (idx !== -1) manager.tempDisabledEntries.splice(idx, 1);
    toggleEntrySilent(entry);
  }
};

/**
 * 取消发送：不释放拦截，清空当前列表并收起面板。恢复临时阻断。
 */
const cancelSend = () => {
  lastTriggeredEntries.value = [...pendingEntries.value];

  if (manager.tempDisabledEntries.length > 0) {
    pendingEntries.value.forEach(e => {
      if (e.tempDisabled) {
        e.tempDisabled = false;
        e.enabled = true;
        toggleEntrySilent(e);
      }
    });
    manager.tempDisabledEntries = [];
  }
  pendingEntries.value = [];
  emit('close-panel');
};

/**
 * 切换任意世界书条目的开关 (enabled) 状态，并记录进提交历史
 */
const toggleEntry = async (entry: any, explicitWbName?: string) => {
  try {
    const targetWorldbook = explicitWbName || entry.world || currentPrimaryWorldbook.value;
    if (!targetWorldbook) return;

    await updateWorldbookWith(targetWorldbook, (wbEntries: any[]) => {
      const e = wbEntries.find(x => x.uid === entry.uid);
      if (e) e.enabled = entry.enabled;
      return wbEntries;
    });

    // 主动通知底层修改
    ArkEventBus.emit('worldbook:data_changed', targetWorldbook);

    const newCommit = {
      id: Math.random().toString(36).substr(2, 6),
      timestamp: Date.now(),
      description: `[用户手动切换开关] ${entry.comment || entry.name}`,
      worldbook: targetWorldbook,
      changes: [{ uid: entry.uid, comment: entry.comment || entry.name, from: !entry.enabled, to: entry.enabled }],
    };
    const commits = [...(currentConfig.value?.commits || []), newCommit];
    configStore.updateConfig({ commits });
  } catch (e) {
    console.error('Failed to toggle entry', e);
    entry.enabled = !entry.enabled; // 如果失败则恢复 UI 状态
  }
};

/**
 * 拦截预警面板中使用的快捷开关功能，关联上面的 toggleEntry
 */
const togglePendingEntry = async (entry: any) => {
  const targetWorldbook = entry.world || currentPrimaryWorldbook.value;

  if (entry.tempDisabled) {
    entry.tempDisabled = false;
    const idx = manager.tempDisabledEntries.findIndex(e => e.uid === entry.uid && e.world === targetWorldbook);
    if (idx !== -1) manager.tempDisabledEntries.splice(idx, 1);
    await toggleEntry(entry);
    return;
  }

  entry.enabled = !entry.enabled;
  if (!entry.enabled) {
    entry.tempDisabled = false;
    const idx = manager.tempDisabledEntries.findIndex(e => e.uid === entry.uid && e.world === targetWorldbook);
    if (idx !== -1) manager.tempDisabledEntries.splice(idx, 1);
  }
  await toggleEntry(entry);
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.tab-panel.flex-col {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.last-record-box {
  margin-top: 15px;
  text-align: left;
}

.record-divider {
  border: none;
  border-top: 1px dashed rgba(255, 255, 255, 0.2);
  margin: 15px 0;
}

.entry-list.stacked li {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.entry-list.stacked .entry-name {
  word-break: break-all;
  font-weight: 500;
}

.entry-list.stacked .entry-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.entry-list.stacked .action-btns {
  display: flex;
  gap: 4px;
}

.entry-list.stacked .badge.warning {
  background: #ff9800;
  color: white;
}

.status-badges {
  display: flex;
  gap: 4px;
}
</style>
