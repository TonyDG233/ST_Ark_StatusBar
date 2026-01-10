<template>
  <div class="ark-startup-container" :class="{ 'dark-theme': theme === 'dark' }">
    <div class="main-container">
      <div class="content-wrapper">
        <!-- Header Section -->
        <div class="header-section">
          <div class="arknights-logo-container">
            <img :src="ASSETS.LOGO_URL" alt="Arknights Logo" class="arknights-logo">
          </div>
          <p class="author-info">初版作者：打不准的豌豆射手 | v版作者：F.o.x.i.o</p>
          <p class="author-info">UI重构：ARK_STATUSBAR Project</p>
        </div>

        <div class="copyright-notice">
          <strong>版权声明</strong><br>
          本卡完全免费，永远禁止商业化行为，如果您是购买获得，请立即退款并向购买平台举报贩卖者，维护创作者和您自身的权益。
        </div>

        <div class="usage-instructions">
            <strong>使用说明</strong><br>
            请第一次使用本角色卡的用户，务必前往最后一个开局阅读<strong style="color: var(--warning-accent);">“狐の言（在首次游玩前请一定要看！）”</strong>。<br>
            请需要使用“上下文优化插件”的用户自行阅读右侧“设置界面”的“重要提示”。
        </div>

        <div class="section-title">◆ 简介</div>
        <p class="intro-desc">
          从先史文明的终焉开始，到萨卡兹的第一位魔王，再到移动城市的拔地而起……<br>
          如今的泰拉已经历经许多，源石将诅咒与馈赠印刻于这片大地，列国的城邦永无止境地在天灾轨迹中迁徙，感染者的悲鸣与帝国的号角于风雪中交织，仇恨浸染大地，而希望亦如天光。<br>
          现在，你来到于此。<br>
          你将作何抉择？你将行向何方？<br>
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
            </div>
          </div>
        </div>
      </div>

      <!-- Settings Toggle -->
      <div class="settings-tab" :class="{ 'is-open': isSettingsOpen }" @click="toggleSettings">
        <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12-.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
      </div>

      <!-- Settings Panel -->
      <div class="settings-panel" :class="{ 'is-open': isSettingsOpen }">
        <h3>功能开关</h3>
        
        <div class="setting-item">
            <span>上下文优化插件<strong style="color: #4FC3F7;">(实验性功能)</strong></span>
            <label class="toggle-switch">
                <input type="checkbox" v-model="contextEnabled" @change="toggleContextEnabled">
                <span class="slider"></span>
            </label>
        </div>

        <div class="settings-divider"></div>

        <div id="scan-depth-warning" class="warning-box">
          <strong style="color: orange;">[!] 重要提示</strong>
          <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6;">
              为避免冲突，请在使用本插件时，手动将酒馆的“全局世界信息/知识书激活设置”中的“扫描深度”设置为 <strong style="color: #4FC3F7;">0</strong>。
          </p>
          <p style="font-size: 0.85em; margin-top: 5px; line-height: 1.6;">
              在结束本次扮演或切换角色卡时，请记得将该值恢复为您常用的设置（默认为 2）
          </p>
        </div>

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
import { WorldbookManager } from '../logic/worldbook_manager';

// Constants
const STORAGE_KEY_THEME = 'ark_statusbar_theme';
const STORAGE_KEY_CONTEXT_ENABLED = 'ark_statusbar_context_enabled';

// State
const scenarios = ref(STARTUP_SCENARIOS);
const theme = ref<'light' | 'dark'>('dark');
const isSettingsOpen = ref(false);
const contextEnabled = ref(false);

// Methods
const toggleSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value;
};

const setTheme = (newTheme: 'light' | 'dark') => {
  theme.value = newTheme;
  localStorage.setItem(STORAGE_KEY_THEME, newTheme);
};

const toggleContextEnabled = () => {
    localStorage.setItem(STORAGE_KEY_CONTEXT_ENABLED, String(contextEnabled.value));
    if (contextEnabled.value) {
        toastr.success('[UI]上下文优化已启用');
    } else {
        toastr.success('[UI]上下文优化已禁用');
    }
};

// Initialize
onMounted(() => {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme === 'light' || savedTheme === 'dark') {
    theme.value = savedTheme;
  }
  
  const savedContext = localStorage.getItem(STORAGE_KEY_CONTEXT_ENABLED);
  if (savedContext !== null) {
      contextEnabled.value = savedContext === 'true';
  }
});

const handleScenarioClick = async (scenario: Scenario) => {
  try {
    // 1. Apply Worldbook Logic (Reset -> Enable/Disable)
    await WorldbookManager.applyScenario(scenario.swipeId);

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
  --warning-accent: #FFA726;
}

.ark-startup-container.dark-theme {
  --ui-bg: rgba(20, 20, 20, 0.85);
  --ui-text-main: #e0e0e0;
  --ui-text-secondary: #b0b0b0;
  --ui-border-primary: #444;
  --ui-accent: #4FC3F7;
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
  transition: background-color 0.3s, border-color 0.3s;
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

.copyright-notice, .usage-instructions, .warning-box {
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

/* Settings Panel */
.settings-panel {
  position: absolute;
  top: 0;
  right: -300px;
  width: 300px;
  height: 100%;
  background-color: var(--ui-bg);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--ui-border-primary);
  z-index: 1000;
  padding: 20px;
  transition: right 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.settings-panel.is-open {
  right: 0;
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
  right: 300px;
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

.theme-button.light { background-color: #fafafa; color: #1a1a1a; }
.theme-button.dark { background-color: #2a2a2a; color: #e0e0e0; }
.theme-button.active { border-color: var(--ui-accent); }

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

.toggle-switch { position: relative; display: inline-block; width: 50px; height: 28px; }
.toggle-switch input { opacity: 0; width: 0; height: 0; }
.slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #555; transition: .4s; border-radius: 28px; }
.slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 4px; bottom: 4px; background-color: white; transition: .4s; border-radius: 50%; }
input:checked + .slider { background-color: var(--ui-accent); }
input:checked + .slider:before { transform: translateX(22px); }

h3 {
  color: var(--ui-text-main);
  font-weight: 500;
  font-size: 1.2em;
}
</style>