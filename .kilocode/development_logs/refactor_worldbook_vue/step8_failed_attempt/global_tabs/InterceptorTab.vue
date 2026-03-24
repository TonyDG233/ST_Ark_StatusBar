<template>
  <div class="tab-panel flex-col">
    <div
      class="panel-header-action"
      style="display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap"
    >
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="config?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <button
        class="icon-btn tiny"
        style="border: 1px solid var(--SmartThemeBorderColor, #444); padding: 4px 8px"
        @click="emit('run-manual-test')"
        title="主动测试当前输入和上下文会触发的条目"
      >
        🔍 主动检测
      </button>
    </div>

    <div v-if="!config?.isInterceptorEnabled && !isTestMode" class="empty-state">
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
          <button class="btn-primary" @click="emit('clear-test-results')" title="清除测试结果">清除测试结果</button>
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
                <span style="font-size: 0.9em; margin-right: 4px;">{{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}</span>
                {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
                <span v-if="entry.world" style="font-size: 0.8em; opacity: 0.7; margin-left: 5px;">({{ entry.world }})</span>
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
            <span style="font-size: 0.9em; margin-right: 4px;">{{ getEntryType(entry) === 'constant' ? '🔵' : '🟢' }}</span>
            {{ entry.comment || entry.name || (entry.key && entry.key.length ? entry.key[0] : '未知') }}
            <div v-if="entry.world" style="font-size: 0.75em; color: var(--ui-text-secondary); margin-top: 2px;">
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
                @click="emit('toggle-pending-entry', entry)"
              >
                ✅ 开启
              </button>

              <template v-else>
                <button
                  v-if="!entry.tempDisabled"
                  class="icon-btn tiny"
                  style="color: #ff9800; border-color: rgba(255, 152, 0, 0.4)"
                  title="本次发送阻断，发送后自动恢复"
                  @click="emit('toggle-temp-disable', entry)"
                >
                  ⏳ 单次
                </button>
                <button
                  v-else
                  class="icon-btn tiny"
                  style="color: #28a745; border-color: rgba(40, 167, 69, 0.4)"
                  title="取消临时阻断，重新加入本次发送"
                  @click="emit('toggle-temp-disable', entry)"
                >
                  ✅ 恢复
                </button>
                <button
                  class="icon-btn tiny"
                  style="color: #dc3545; border-color: rgba(220, 53, 69, 0.4)"
                  title="彻底阻断此条目，不再自动恢复"
                  @click="emit('toggle-pending-entry', entry)"
                >
                  ❎ 彻底
                </button>
              </template>
            </div>
          </div>
        </li>
      </ul>
      <div class="action-bar compact" v-if="!isTestMode">
        <button class="btn-success" @click="emit('confirm-send')" title="确认发送">确认发送</button>
        <button class="btn-danger" @click="emit('cancel-send')" title="取消发送">取消发送</button>
      </div>
      <div class="action-bar compact" v-else>
        <button class="btn-primary" @click="emit('clear-test-results')" title="清除测试结果">清除测试结果</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArkConfig } from '../../config/system_config';

const props = defineProps<{
  config: ArkConfig | null;
  isTestMode: boolean;
  pendingEntries: any[];
  lastTriggeredEntries: any[];
  currentTokenCount: number | string;
}>();

const emit = defineEmits<{
  (e: 'update-config', update: Partial<ArkConfig>): void;
  (e: 'run-manual-test'): void;
  (e: 'clear-test-results'): void;
  (e: 'confirm-send'): void;
  (e: 'cancel-send'): void;
  (e: 'toggle-pending-entry', entry: any): void;
  (e: 'toggle-temp-disable', entry: any): void;
}>();

const toggleInterceptor = (e: Event) => {
  emit('update-config', { isInterceptorEnabled: (e.target as HTMLInputElement).checked });
};

const getEntryType = (entry: any) => {
  if (entry.constant === true) return 'constant';
  if (entry.constant === false) return 'selective';
  return entry.strategy?.type || 'selective';
};

const isPinned = (entry: any) => {
  return props.config?.pinnedEntries?.includes(entry.uid) || false;
};

const sortedPendingEntries = computed(() => {
  return [...props.pendingEntries].sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
});

const sortedLastTriggeredEntries = computed(() => {
  return [...props.lastTriggeredEntries].sort((a, b) => (isPinned(b) ? 1 : 0) - (isPinned(a) ? 1 : 0));
});
</script>

<style scoped>
@import '../styles/theme.scss';

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

.empty-state {
  text-align: center;
  padding: 20px;
  opacity: 0.7;
}

.hint {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 5px;
}

.warning-box {
  background: rgba(255, 165, 0, 0.2);
  border-left: 4px solid orange;
  padding: 10px;
  margin-bottom: 15px;
}

.action-bar {
  display: flex;
  gap: 10px;
}

.action-bar.compact {
  gap: 5px;
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

.entry-list {
  list-style: none;
  padding: 0;
  margin: 0 0 15px 0;
}

.entry-list li {
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  margin-bottom: 5px;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.entry-list .entry-info {
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
  min-width: 0;
  margin-right: 10px;
}

.entry-list .entry-name {
  word-break: break-all;
}

.entry-list .badge {
  font-size: 0.8em;
  background: #007bff;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
  margin-top: 2px;
}

.entry-list .badge.blocked {
  background: var(--ui-border-primary);
  color: var(--ui-text-secondary);
}

.entry-list.read-only li {
  opacity: 0.8;
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

.disabled-entry {
  opacity: 0.4;
}

.icon-btn.tiny {
  font-size: 0.9em;
  padding: 2px 4px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  background: transparent;
  margin-right: 5px;
}

.icon-btn.tiny:hover {
  background: rgba(255, 255, 255, 0.1);
}

.pin-icon {
  font-size: 0.9em;
  margin-right: 4px;
}
</style>
