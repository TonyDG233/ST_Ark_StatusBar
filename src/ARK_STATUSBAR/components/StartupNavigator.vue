<template>
  <div class="ark-startup-container" :class="{ 'dark-theme': theme === 'dark' }">
    <div class="main-container">
      <div class="content-wrapper">
        <!-- Header Section -->
        <div class="header-section">
          <div class="arknights-logo-container">
            <img :src="ASSETS.LOGO_URL" alt="Arknights Logo" class="arknights-logo" />
          </div>
          <p class="author-info">初版作者：打不准的豌豆射手 | v版作者：F.o.x.i.o</p>
          <p class="author-info">UI重构：ARK_STATUSBAR Project</p>
        </div>

        <div class="copyright-notice">
          <strong>版权声明</strong><br />
          本卡完全免费，永远禁止商业化行为，如果您是购买获得，请立即退款并向购买平台举报贩卖者，维护创作者和您自身的权益。
        </div>

        <div class="usage-instructions">
          <strong>使用说明</strong><br />
          请第一次使用本角色卡的用户，务必前往最后一个开局阅读<strong style="color: var(--warning-accent)"
            >“狐の言（在首次游玩前请一定要看！）”</strong
          >。<br />
          若需管理单字干员或重置世界书状态，请点击右下角按钮打开侧边栏进行操作。
        </div>

        <div class="section-title">◆ 简介</div>
        <p class="intro-desc">
          从先史文明的终焉开始，到萨卡兹的第一位魔王，再到移动城市的拔地而起……<br />
          如今的泰拉已经历经许多，源石将诅咒与馈赠印刻于这片大地，列国的城邦永无止境地在天灾轨迹中迁徙，感染者的悲鸣与帝国的号角于风雪中交织，仇恨浸染大地，而希望亦如天光。<br />
          现在，你来到于此。<br />
          你将作何抉择？你将行向何方？<br />
          你是……谁？
        </p>

        <!-- Scenarios Grid -->
        <div class="section-title">◆ 点击—开启故事</div>
        <div class="opening-section">
          <div class="opening-grid">
            <div
              v-for="scenario in scenarios"
              :key="scenario.swipeId"
              class="opening-card"
              @click="handleScenarioClick(scenario)"
            >
              <div class="opening-title">{{ scenario.title }}</div>

              <!-- Decorational Info -->
              <div class="opening-info" v-if="scenario.linkedWorldInfo && scenario.linkedWorldInfo.length > 0">
                <span class="info-label">开启:</span> {{ scenario.linkedWorldInfo.slice(0, 3).join(', ')
                }}{{ scenario.linkedWorldInfo.length > 3 ? '...' : '' }}
              </div>
              <div class="opening-info" v-if="scenario.disabledWorldInfo && scenario.disabledWorldInfo.length > 0">
                <span class="info-label">关闭:</span> {{ scenario.disabledWorldInfo.slice(0, 3).join(', ')
                }}{{ scenario.disabledWorldInfo.length > 3 ? '...' : '' }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Toggle -->
      <div class="settings-tab" :class="{ 'is-open': isSettingsOpen }" @click="toggleSettings">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
          <path d="M0 0h24v24H0V0z" fill="none" />
          <path
            d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"
          />
        </svg>
      </div>

      <!-- Settings Overlay (Mobile Backdrop) -->
      <div class="settings-overlay" v-if="isSettingsOpen" @click="isSettingsOpen = false"></div>

      <!-- Settings Panel -->
      <div class="settings-panel" :class="{ 'is-open': isSettingsOpen }">
        <h3>世界书控制</h3>

        <div class="wb-status-display" :class="wbStatusClass">
          <div class="status-label">SYSTEM STATUS</div>
          <div class="status-value">{{ wbStatusText }}</div>
          <div class="status-decor"></div>
        </div>

        <div class="wb-actions">
          <div class="ark-btn warning" @click="handleCloseSingleChar">
            <div class="btn-content">
              <span class="btn-icon">⚡</span>
              <span class="btn-text">屏蔽单字干员</span>
            </div>
            <div class="btn-decor"></div>
          </div>
          <div class="ark-btn danger" @click="handleRestoreWorldbook">
            <div class="btn-content">
              <span class="btn-icon">↺</span>
              <span class="btn-text">还原世界书</span>
            </div>
            <div class="btn-decor"></div>
          </div>
        </div>

        <div id="wb-control-hint" class="warning-box">
          <strong style="color: orange">[!] 世界书管理提示</strong>
          <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">
            本面板会智能识别并管理当前角色的世界书状态。
          </p>
          <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6">
            若您手动修改了世界书（如自行开启了某些条目），状态将显示为<strong style="color: #ff9800">“已修改”</strong
            >。此时切换开局可能会触发冲突警告，请按需选择继续或重置。
          </p>
        </div>

        <div class="settings-divider"></div>

        <h3>页面主题</h3>
        <div class="theme-buttons-container">
          <div class="theme-button light" :class="{ active: theme === 'light' }" @click="setTheme('light')">
            <span>默认</span>
          </div>
          <div class="theme-button dark" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
            <span>夜间</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ASSETS } from '../config/assets';
import { STARTUP_SCENARIOS, type Scenario } from '../config/scenarios';
import { WorldbookManager, type WorldbookStatus } from '../logic/worldbook_manager';

// Constants
const STORAGE_KEY_THEME = 'ark_statusbar_theme';

// State
const scenarios = ref(STARTUP_SCENARIOS);
const theme = ref<'light' | 'dark'>('dark');
const isSettingsOpen = ref(false);
const wbStatus = ref<WorldbookStatus>('original');

// Computed
const wbStatusText = computed(() => {
  switch (wbStatus.value) {
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
  switch (wbStatus.value) {
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

// Methods
const toggleSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value;
  // Refresh status when opening settings
  if (isSettingsOpen.value) {
    checkWbStatus();
  }
};

const setTheme = (newTheme: 'light' | 'dark') => {
  theme.value = newTheme;
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
};

const checkWbStatus = async () => {
  wbStatus.value = await WorldbookManager.getWorldbookStatus();
};

const handleCloseSingleChar = async () => {
  await WorldbookManager.closeSingleCharEntries();
  await checkWbStatus();
};

const handleRestoreWorldbook = async () => {
  if (confirm('确定要将世界书重置为初始状态吗？这将丢失所有自定义修改。')) {
    await WorldbookManager.resetToBaseline();
    await checkWbStatus();
  }
};

// Initialize
onMounted(() => {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme;
  }
  checkWbStatus();
});

const handleScenarioClick = async (scenario: Scenario) => {
  try {
    // 1. Apply Worldbook Logic
    try {
      await WorldbookManager.applyScenario(scenario.swipeId);
    } catch (e) {
      if ((e as Error).message === 'STATUS_MODIFIED') {
        if (
          confirm(
            '检测到世界书包含非标准修改（可能是您手动开启了某些条目）。\n直接跳转开局可能会在当前基础上叠加设置，导致状态混乱。\n\n是否继续？',
          )
        ) {
          await WorldbookManager.applyScenario(scenario.swipeId, true); // Force apply
        } else {
          return; // User cancelled
        }
      } else {
        throw e;
      }
    }

    // Update status after apply
    await checkWbStatus();

    // 2. Switch Swipe (Legacy Logic)
    // We assume SillyTavern global is available
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
      throw new Error('SillyTavern environment not found.');
    }

    const firstMessage = SillyTavern.chat[0];
    if (!firstMessage || !firstMessage.swipes || typeof firstMessage.swipes[scenario.swipeId] !== 'string') {
      throw new Error(`Swipe #${scenario.swipeId} content not found.`);
    }

    console.info(`[Startup] Switching to Swipe #${scenario.swipeId}`);

    // Update the message content to the selected swipe
    firstMessage.swipe_id = scenario.swipeId;
    firstMessage.mes = firstMessage.swipes[scenario.swipeId];

    // Save and Reload
    await SillyTavern.saveChat();
    await SillyTavern.reloadCurrentChat();
  } catch (error) {
    console.error('[Startup] Failed to apply scenario:', error);
    toastr.error('切换开局失败: ' + (error as Error).message);
  }
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@300;400;500;700&display=swap');

.ark-startup-container {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  --ui-bg: #fafafa;
  --ui-text-main: #1a1a1a;
  --ui-text-secondary: #2a2a2a;
  --ui-border-primary: #e8e8e8;
  --ui-accent: #1a1a1a;
  --warning-accent: #ffa726;
  --panel-width: 300px;
}

.ark-startup-container.dark-theme {
  --ui-bg: rgba(20, 20, 20, 0.85);
  --ui-text-main: #e0e0e0;
  --ui-text-secondary: #b0b0b0;
  --ui-border-primary: #444;
  --ui-accent: #4fc3f7;
}

.main-container {
  width: 100%;
  max-width: 900px;
  background: var(--ui-bg);
  backdrop-filter: blur(10px);
  border-radius: 4px;
  border: 1px solid var(--ui-border-primary);
  position: relative;
  overflow: hidden;
  transition:
    background-color 0.3s,
    border-color 0.3s;
  font-family: 'Noto Serif SC', serif;
}

.content-wrapper {
  padding: 50px 40px;
  position: relative;
  z-index: 3;
}

.header-section {
  text-align: center;
  margin-bottom: 50px;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--ui-border-primary);
}

.arknights-logo {
  width: 300px;
  height: auto;
  transition: filter 0.3s;
}

.dark-theme .arknights-logo {
  filter: invert(1) brightness(0.8);
}

.author-info {
  font-size: 1em;
  color: var(--ui-text-secondary);
  margin-bottom: 5px;
  font-weight: 300;
}

.copyright-notice,
.usage-instructions,
.warning-box {
  background: rgba(128, 128, 128, 0.1);
  padding: 20px;
  margin: 30px 0;
  border-left: 3px solid var(--ui-accent);
  font-size: 0.9em;
  line-height: 1.8;
  color: var(--ui-text-secondary);
}

.usage-instructions {
  background: rgba(255, 167, 38, 0.1);
  margin: 20px 0 30px 0;
  border-left: 3px solid var(--warning-accent);
}

.warning-box {
  background-color: rgba(255, 165, 0, 0.1);
  border-left-color: var(--warning-accent);
  margin-bottom: 20px;
  border: 1px solid rgba(255, 165, 0, 0.5);
  border-radius: 4px;
}

.section-title {
  font-size: 1.5em;
  font-weight: 500;
  color: var(--ui-text-main);
  margin: 40px 0 20px 0;
  padding-bottom: 10px;
  border-bottom: 2px solid var(--ui-accent);
  letter-spacing: 2px;
}

.intro-desc {
  font-size: 1em;
  color: var(--ui-text-secondary);
  line-height: 1.8;
  margin-bottom: 30px;
}

.opening-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 30px;
}

.opening-card {
  background: transparent;
  border: 1px solid var(--ui-border-primary);
  padding: 25px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.opening-card:hover {
  transform: translateY(-3px);
  border-color: var(--ui-accent);
  background-color: rgba(128, 128, 128, 0.05);
}

.opening-title {
  font-size: 1.2em;
  font-weight: 500;
  color: var(--ui-text-main);
}

.opening-info {
  font-size: 0.85em;
  color: var(--ui-text-secondary);
  margin-top: 4px;
  opacity: 0.8;
}

.info-label {
  font-weight: bold;
  opacity: 0.7;
}

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

.settings-tab {
  position: absolute;
  top: 20px;
  right: 0px;
  width: 50px;
  height: 50px;
  background-color: var(--ui-bg);
  border: 1px solid var(--ui-border-primary);
  border-right: none;
  border-top-left-radius: 6px;
  border-bottom-left-radius: 6px;
  cursor: pointer;
  z-index: 1001;
  display: flex;
  justify-content: center;
  align-items: center;
  color: var(--ui-text-secondary);
  transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.settings-tab.is-open {
  right: var(--panel-width);
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

/* Arknights Buttons */
.wb-actions {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.ark-btn {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border: 1px solid var(--ui-border-primary);
  background: var(--ui-bg);
  transition: all 0.2s ease;
  overflow: hidden;
}

.ark-btn .btn-content {
  display: flex;
  align-items: center;
  gap: 10px;
  z-index: 2;
  transition: all 0.2s;
}

.ark-btn .btn-text {
  font-weight: bold;
  letter-spacing: 1px;
  text-transform: uppercase;
  font-size: 0.9em;
}

/* Warning Button (Close Single Char) */
.ark-btn.warning {
  border-color: #ff9800;
  color: #ff9800;
}
.ark-btn.warning:hover {
  background: #ff9800;
  color: #fff;
}

/* Danger Button (Restore) */
.ark-btn.danger {
  border-color: #f44336;
  color: #f44336;
}
.ark-btn.danger:hover {
  background: #f44336;
  color: #fff;
}

/* Decor Elements */
.ark-btn::after {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 0 10px 10px 0;
  border-color: transparent currentColor transparent transparent;
  opacity: 0.5;
}

.ark-btn:active {
  transform: scale(0.98);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .ark-startup-container {
    /*
      Compress sidebar width to 210px (Final Polish).
      On a 360px screen, this leaves 150px (50px button + 100px overlay),
      providing a very comfortable interaction zone.
    */
    --panel-width: 210px;
  }

  /* Reduce panel internal padding to maximize space in the narrower sidebar */
  .settings-panel {
    padding: 12px;
  }

  .wb-status-display {
    padding: 10px;
  }

  /* Adjust font sizes for narrower panel */
  .wb-status-display .status-value {
    font-size: 1em; /* Slightly smaller for 210px */
  }

  .ark-btn .btn-text {
    font-size: 0.8em; /* Ensure text fits in 210px */
  }

  /* Main Content Adjustments */
  .content-wrapper {
    padding: 30px 15px; /* Reduce padding to prevent overflow */
  }

  .arknights-logo {
    width: 80%; /* Responsive logo width */
    max-width: 300px;
  }

  .opening-grid {
    grid-template-columns: 1fr; /* Single column on mobile */
  }

  /* Fix button text wrapping */
  .ark-btn {
    height: auto;
    min-height: 48px;
    padding: 10px;
  }

  .ark-btn .btn-content {
    flex-wrap: wrap;
    justify-content: center;
    text-align: center;
  }
}
</style>
