<template>
  <div
    class="ark-startup-container"
    :class="{ 'dark-theme': theme === 'dark', 'transparent-theme': theme === 'transparent' }"
    :style="{ '--ui-font-size': displayFontSize + 'px' }"
  >
    <div class="main-container">
      <div class="content-wrapper">
        <!-- Header Section -->
        <div class="header-section">
          <div class="arknights-logo-container">
            <img :src="ASSETS.LOGO_URL" alt="Arknights Logo" class="arknights-logo" />
          </div>
          <p class="author-info">初版作者：打不准的豌豆射手 | v版核心作者：F.o.x.i.o</p>
          <p class="author-info">
            项目贡献者：TonyDG233(UI), 晚鸢尾(UI), 暗中观察信长(剧情), 政委x(剧情), Rylan(剧情), rdq9909(剧情),
            "你"(剧情)
          </p>
          <p class="author-info">UI重构项目：ARK_STATUSBAR</p>
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
          若需管理单字干员/重置世界书状态，或管理悬浮窗UI，请点击右下角按钮打开侧边栏进行操作。
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

      <StartupSettingsPanel
        :is-open="isSettingsOpen"
        :config="currentConfig"
        :wb-status="wbStatus"
        @close="isSettingsOpen = false"
        @update:config="updateConfig"
        @close-single-char="handleCloseSingleChar"
        @restore-worldbook="handleRestoreWorldbook"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { configStore, useArkConfig } from '../core/config_store';
import { ASSETS } from '../data/assets';
import { STARTUP_SCENARIOS, type Scenario } from '../data/scenarios';
import { StatusBarManager, type WorldbookStatus } from '../logic/statusbar_manager';
import StartupSettingsPanel from './startup_tabs/StartupSettingsPanel.vue';

// --- 状态与变量定义 ---

// 开局剧本数据源
const scenarios = ref(STARTUP_SCENARIOS);
// 控制侧边栏设置面板的展开/收起状态
const isSettingsOpen = ref(false);
// 记录当前世界书状态 (初始/被修改/单字关闭等)
const wbStatus = ref<WorldbookStatus>('original');

import { type ArkConfig } from '../types/system_config';

const currentConfig = useArkConfig();

// 响应式的当前主题和系统总开关计算属性
const theme = computed(() => currentConfig.value?.theme || 'dark');
const displayFontSize = computed(() => currentConfig.value?.uiFontSize ?? 14);

// --- 方法 ---

const updateConfig = (val: Partial<ArkConfig>) => {
  configStore.updateConfig(val);
};

/**
 * 切换设置面板的显示隐藏状态
 */
const toggleSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value;
  // 打开设置面板时，自动重新检查一次世界书状态
  if (isSettingsOpen.value) {
    checkWbStatus();
  }
};

/**
 * 获取并更新当前世界书是否偏离了基准线配置的状态
 */
const checkWbStatus = async () => {
  wbStatus.value = (await StatusBarManager.getInstance().worldbook.getStatus()) as WorldbookStatus;
};

/**
 * 一键屏蔽所有单字干员（防止日常用语误触发）
 */
const handleCloseSingleChar = async () => {
  await StatusBarManager.getInstance().worldbook.closeSingleCharEntries();
  await checkWbStatus();
};

/**
 * 还原世界书到初始基准线状态，并清空 Commit 修改历史
 */
const handleRestoreWorldbook = async () => {
  if (confirm('确定要将世界书重置为初始状态吗？这将丢失所有自定义修改。')) {
    await StatusBarManager.getInstance().worldbook.resetToBaseline();
    await configStore.updateConfig({ commits: [] });
    await checkWbStatus();
  }
};

// --- 生命周期钩子 ---

onMounted(() => {
  checkWbStatus();
});

/**
 * 点击开局剧本（Scenario）卡片时的核心处理逻辑
 * @param scenario 用户选择的开局配置数据
 */
const handleScenarioClick = async (scenario: Scenario) => {
  try {
    // 1. 世界书逻辑应用阶段
    try {
      await StatusBarManager.getInstance().worldbook.applyScenario(scenario.swipeId);
    } catch (e) {
      // 捕获 STATUS_MODIFIED 异常，提示用户当前世界书存在非标准修改
      if ((e as Error).message === 'STATUS_MODIFIED') {
        if (
          confirm(
            '检测到世界书包含非标准修改（可能是您手动开启了某些条目）。\n直接跳转开局可能会在当前基础上叠加设置，导致状态混乱。\n\n是否继续？',
          )
        ) {
          // 用户确认继续，强制(force)应用该剧本
          await StatusBarManager.getInstance().worldbook.applyScenario(scenario.swipeId, true);
        } else {
          return; // 用户取消，终止流程
        }
      } else {
        throw e; // 其它未知错误继续向上抛出
      }
    }

    // 更新世界书状态显示
    await checkWbStatus();

    // 2. 切换酒馆开局语（Swipe）阶段
    // 确保当前环境确实是在 SillyTavern 中且存在 chat 数据
    if (typeof SillyTavern === 'undefined' || !SillyTavern.chat) {
      throw new Error('SillyTavern environment not found.');
    }

    // 酒馆的第 0 条消息通常是开场白（Greeting）
    const firstMessage = SillyTavern.chat[0];
    if (!firstMessage || !firstMessage.swipes || typeof firstMessage.swipes[scenario.swipeId] !== 'string') {
      throw new Error(`Swipe #${scenario.swipeId} content not found.`);
    }

    console.info(`[Startup] Switching to Swipe #${scenario.swipeId}`);

    // 将首条消息的内容(mes)替换为对应 swipeId 的开局文本
    firstMessage.swipe_id = scenario.swipeId;
    firstMessage.mes = firstMessage.swipes[scenario.swipeId];

    // 因为切换了开局语可能会导致 CHAT_CHANGED 事件触发从而引起 Baseline 变化告警，因此主动屏蔽下一次警告
    await configStore.updateConfig({ suppressNextDiffWarning: true });

    // 保存聊天记录并强制重载当前聊天以刷新前端 UI
    await SillyTavern.saveChat();
    await SillyTavern.reloadCurrentChat();
  } catch (error) {
    console.error('[Startup] Failed to apply scenario:', error);
    toastr.error('切换开局失败: ' + (error as Error).message);
  }
};
</script>

<style scoped>
@import './styles/theme.scss';
@import './styles/startup_navigator.scss';
</style>
