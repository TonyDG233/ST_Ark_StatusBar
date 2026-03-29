<template>
  <!-- Settings Overlay (Mobile Backdrop) -->
  <div class="settings-overlay" v-if="isOpen" @click="$emit('close')"></div>

  <!-- Settings Panel -->
  <div class="settings-panel" :class="{ 'is-open': isOpen }">
    <h3>世界书控制</h3>

    <div class="wb-status-display" :class="wbStatusClass">
      <div class="status-label">SYSTEM STATUS</div>
      <div class="status-value">{{ wbStatusText }}</div>
      <div class="status-diff" v-if="config?.commits?.length">
        最近修改: {{ config.commits[config.commits.length - 1].description }}
        <br />
        共计 {{ config.commits.length }} 条修改记录
      </div>
      <div class="status-decor"></div>
    </div>

    <div class="wb-actions">
      <div class="ark-btn warning" @click="$emit('close-single-char')">
        <div class="btn-content">
          <span class="btn-icon">⚡</span>
          <span class="btn-text">屏蔽单字干员</span>
        </div>
        <div class="btn-decor"></div>
      </div>
      <div class="ark-btn danger" @click="$emit('restore-worldbook')">
        <div class="btn-content">
          <span class="btn-icon">↺</span>
          <span class="btn-text">还原世界书</span>
        </div>
        <div class="btn-decor"></div>
      </div>
    </div>

    <div id="wb-control-hint" class="warning-box">
      <strong style="color: orange">[!] 世界书管理提示</strong>
      <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">本面板会智能识别并管理当前角色的世界书状态。</p>
      <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">
        若您手动修改了世界书（如自行开启了某些条目），状态将显示为<strong style="color: #ff9800">“已修改”</strong
        >。此时切换开局可能会触发冲突警告，请按需选择继续或重置。
      </p>
    </div>

    <div class="settings-divider"></div>

    <h3>功能组件控制</h3>
    <div class="setting-item" style="margin-top: 10px">
      <label>世界书控制台开关</label>
      <label class="switch">
        <input type="checkbox" :checked="isSystemEnabled" @change="toggleSystem" />
        <span class="slider round"></span>
      </label>
    </div>
    <p style="font-size: 0.8em; color: var(--ui-text-secondary); margin-bottom: 20px">
      关闭后将彻底隐藏方舟世界书控制台，并暂停预检拦截系统。
    </p>

    <div class="settings-divider"></div>

    <h3>终端主题</h3>
    <div class="theme-buttons-container">
      <div class="theme-button light" :class="{ active: theme === 'light' }" @click="setTheme('light')">
        <span>默认(白)</span>
      </div>
      <div class="theme-button dark" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
        <span>夜间(黑)</span>
      </div>
      <div
        class="theme-button transparent"
        :class="{ active: theme === 'transparent' }"
        @click="setTheme('transparent')"
      >
        <span>透明</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ArkConfig } from '../../types/system_config';
import type { WorldbookStatus } from '../../logic/statusbar_manager';

const props = defineProps<{
  isOpen: boolean;
  config: ArkConfig | null;
  wbStatus: WorldbookStatus;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update:config', val: Partial<ArkConfig>): void;
  (e: 'close-single-char'): void;
  (e: 'restore-worldbook'): void;
}>();

const theme = computed(() => props.config?.theme || 'dark');
const isSystemEnabled = computed(() => props.config?.isSystemEnabled ?? true);

const wbStatusText = computed(() => {
  switch (props.wbStatus) {
    case 'original':
      return '初始状态';
    case 'single_char_closed':
      return '单字屏蔽';
    case 'modified':
      return '非标修改';
    default:
      return '未知状态';
  }
});

const wbStatusClass = computed(() => {
  switch (props.wbStatus) {
    case 'original':
      return 'status-green';
    case 'single_char_closed':
      return 'status-blue';
    case 'modified':
      return 'status-orange';
    default:
      return 'status-gray';
  }
});

const setTheme = (newTheme: 'light' | 'dark' | 'transparent') => {
  emit('update:config', { theme: newTheme });
};

const toggleSystem = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  emit('update:config', { isSystemEnabled: checked });
};
</script>

<style scoped>
@import '../styles/theme.scss';

/* Settings Panel */
.settings-panel {
  position: absolute;
  top: 0;
  right: calc(var(--panel-width) * -1);
  width: var(--panel-width);
  height: 100%;
  background-color: var(--ui-bg);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--ui-border-primary);
  z-index: 1000;
  padding: 20px;
  transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-sizing: border-box; /* Prevent padding from adding to width */
}

.settings-panel.is-open {
  right: 0;
}

/* Overlay Backdrop */
.settings-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999; /* Below panel (1000), above content */
  backdrop-filter: blur(2px);
}

.settings-divider {
  height: 1px;
  background-color: var(--ui-border-primary);
  margin: 20px 0;
}

.theme-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 15px;
}

.theme-button {
  width: 100%;
  height: 50px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid var(--ui-border-primary);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-button.light {
  background-color: #fafafa;
  color: #1a1a1a;
}
.theme-button.dark {
  background-color: #2a2a2a;
  color: #e0e0e0;
}
.theme-button.transparent {
  background: linear-gradient(135deg, rgba(200, 200, 200, 0.1), rgba(100, 100, 100, 0.1));
  color: var(--ui-text-main);
  backdrop-filter: blur(4px);
}
.theme-button.active {
  border-color: var(--ui-accent);
}

.theme-button {
  padding: 5px;
}

.theme-button span {
  position: absolute;
  bottom: 5px;
  right: 10px;
  font-size: 0.8em;
  font-weight: bold;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

h3 {
  color: var(--ui-text-main);
  font-weight: 500;
  font-size: 1.2em;
}

/* --- Arknights Style UI --- */

/* Status Display */
.wb-status-display {
  padding: 15px;
  margin-bottom: 20px;
  background: rgba(0, 0, 0, 0.05);
  border-left: 4px solid #999;
  position: relative;
  overflow: hidden;
}

.wb-status-display .status-label {
  font-size: 0.7em;
  letter-spacing: 2px;
  color: var(--ui-text-secondary);
  margin-bottom: 5px;
}

.wb-status-display .status-value {
  font-size: 1.2em;
  font-weight: bold;
  letter-spacing: 1px;
}

.wb-status-display .status-diff {
  margin-top: 8px;
  font-size: 0.8em;
  opacity: 0.8;
  line-height: 1.4;
}

.wb-status-display .status-decor {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: linear-gradient(45deg, transparent 50%, rgba(255, 255, 255, 0.1) 50%);
}

.status-green {
  border-left-color: #4caf50;
  color: #4caf50;
  background: rgba(76, 175, 80, 0.05);
}
.status-blue {
  border-left-color: #2196f3;
  color: #2196f3;
  background: rgba(33, 150, 243, 0.05);
}
.status-orange {
  border-left-color: #ff9800;
  color: #ff9800;
  background: rgba(255, 152, 0, 0.05);
}

.warning-box {
  background-color: rgba(255, 165, 0, 0.1);
  border-left: 3px solid var(--warning-accent);
  margin-bottom: 20px;
  padding: 15px;
  font-size: 0.9em;
  color: var(--ui-text-secondary);
  border: 1px solid rgba(255, 165, 0, 0.5);
  border-left-width: 3px;
  border-radius: 4px;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .settings-panel {
    padding: 12px;
  }

  .wb-status-display {
    padding: 10px;
  }

  .wb-status-display .status-value {
    font-size: 1em; /* Slightly smaller for 210px */
  }
}
</style>
