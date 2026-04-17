<template>
  <div class="tab-panel">
    <div class="setting-item">
      <label>UI 主题</label>
      <div class="theme-buttons">
        <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">默认(白)</button>
        <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
        <button :class="{ active: currentConfig?.theme === 'transparent' }" @click="updateTheme('transparent')">
          透明
        </button>
      </div>
    </div>

    <!-- 增加一个固定宽度的内部容器，防止拖动滑块时因为整体UI实时缩放导致鼠标相对位置产生巨大偏移（“发抖”、“极度灵敏”现象） -->
    <div style="width: 100%; max-width: 300px">
      <div class="setting-item flex-col-align-start">
        <label>UI 宽度 ({{ displayWidth }}px)</label>
        <!-- 将实时 @input 修改为 @change，仅在松开鼠标时应用变化，彻底根治拉条与页面宽度耦合带来的鬼畜抖动问题 -->
        <input
          type="range"
          min="200"
          max="1000"
          step="10"
          :value="displayWidth"
          @change="commitUiWidth"
          class="slider-input"
        />
      </div>

      <div class="setting-item flex-col-align-start">
        <label>
          UI 内容高度: ({{ displayHeight ? displayHeight + 'px' : '默认 (400px)' }})
          <span class="mobile-scale-hint">/ 仅在电脑端等宽屏生效</span>
        </label>
        <input
          type="range"
          min="200"
          max="1200"
          step="20"
          :value="displayHeight"
          @change="commitUiHeight"
          class="slider-input"
        />
      </div>

      <div class="setting-item flex-col-align-start">
        <label
          >字体大小 (<span class="mobile-scale-hint">移动端自动 -2px / </span>当前基准: {{ displayFontSize }}px)</label
        >
        <!-- 字体大小虽然影响较小，但也改为 @change，统一体验 -->
        <input
          type="range"
          min="10"
          max="24"
          step="1"
          :value="displayFontSize"
          @change="commitUiFontSize"
          class="slider-input"
        />
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">松开滑块后应用宽度变化。</p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>回车键拦截预警</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.enableEnterToIntercept" @change="toggleEnterInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，按下回车键发送也将被拦截预览。默认关闭，以方便习惯回车换行或原生发送的用户。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>显示常驻(蓝灯)条目</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.showConstantEntries" @change="toggleShowConstantEntries" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>Token 计算器 (性能选项)</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.enableTokenCalculator" @change="toggleTokenCalculator" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        预检拦截时，同时估算即将发送的 Token 消耗。<strong style="color: #ff9800"
          >如果遇到拦截严重卡顿或超时，请关闭此项。</strong
        >
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label style="color: #dc3545; font-weight: bold">🔧 开启调试日志导出</label>
        <label class="switch">
          <input type="checkbox" :checked="currentConfig?.isDebugMode" @change="toggleDebugMode" />
          <span class="slider round" :style="currentConfig?.isDebugMode ? 'background-color: #dc3545;' : ''"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8; color: #dc3545">
        开启后将记录所有底层检测流。当遇到检测失效等 Bug 时，请开启此项，进行一次检测，然后检查名为
        "[SYS_DEBUG]系统调试日志导出" 的世界书条目内容并反馈给开发者。
      </p>
    </div>

    <div class="setting-action">
      <div style="margin-bottom: 15px">
        <button class="btn-warning" @click="clearPins">清空所有偏好置顶</button>
        <p class="hint">取消全部条目的置顶状态。</p>
      </div>

      <div style="border-top: 1px dashed rgba(128, 128, 128, 0.3); padding-top: 15px">
        <button class="btn-danger" @click="factoryReset">恢复初始设置</button>
        <p class="hint warning">将清除本插件的所有配置、手动修改记录和快照，彻底恢复至初始状态。此操作不可逆！</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { configStore, useArkConfig } from '../../../core/config_store';
import { currentPrimaryWorldbook, previewUiFontSize, previewUiWidth, refreshWorldbookCache } from '../shared_ui_state';

const currentConfig = useArkConfig();

const displayWidth = computed(() => previewUiWidth.value ?? currentConfig.value?.uiWidth ?? 400);
const displayHeight = computed(() => currentConfig.value?.uiHeight || 400);
const displayFontSize = computed(() => previewUiFontSize.value ?? currentConfig.value?.uiFontSize ?? 14);

// 【BugFix】：由于去除了实时的 @input 监听（为了防止滑块随着页面变宽而位移导致的抖动反馈回路）
// 我们直接在 @change 中提取最终数值并向系统配置提交。
const commitUiWidth = (e: Event) => {
  const finalVal = Number((e.target as HTMLInputElement).value);
  configStore.updateConfig({ uiWidth: finalVal });
};

const commitUiHeight = (e: Event) => {
  const finalVal = Number((e.target as HTMLInputElement).value);
  configStore.updateConfig({ uiHeight: finalVal });
};

const commitUiFontSize = (e: Event) => {
  const finalVal = Number((e.target as HTMLInputElement).value);
  configStore.updateConfig({ uiFontSize: finalVal });
};

/**
 * 切换系统 UI 主题
 */
const updateTheme = (theme: 'light' | 'dark' | 'transparent') => {
  configStore.updateConfig({ theme });
};

/**
 * 切换拦截器功能的总开关
 */
const toggleInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ isInterceptorEnabled: checked });
};

const toggleEnterInterceptor = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ enableEnterToIntercept: checked });
};

const toggleShowConstantEntries = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ showConstantEntries: checked });
};

const toggleTokenCalculator = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ enableTokenCalculator: checked });
};

const toggleDebugMode = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  configStore.updateConfig({ isDebugMode: checked });
  if (checked && typeof toastr !== 'undefined') {
    toastr.warning('调试日志已开启！将在下一次拦截或检测后写入世界书。', 'ARK_DEBUG');
  }
};

/**
 * 一键清空所有的置顶设置
 */
const clearPins = async () => {
  if (confirm('确定要清空所有置顶的偏好条目吗？')) {
    configStore.updateConfig({ pinnedEntries: [] });
    // 强行刷新当前主书，确保取消置顶后排序立刻生效
    if (currentPrimaryWorldbook.value) {
      await refreshWorldbookCache(currentPrimaryWorldbook.value);
    }
  }
};

/**
 * 将整个状态栏插件恢复至出厂设置（清空所有配置、记录、快照）
 */
const factoryReset = async () => {
  if (confirm('确定要清除本插件的所有配置、快照和修改记录吗？此操作不可逆！')) {
    configStore.updateConfig({
      commits: [],
      snapshots: [],
      pinnedEntries: [],
      pinnedWorldbooks: [],
      isSystemEnabled: true,
      isInterceptorEnabled: true,
      enableTokenCalculator: true,
      enableEnterToIntercept: false,
      showConstantEntries: false,
      theme: 'light',
      uiWidth: 400,
      uiFontSize: 14,
      isDebugMode: false,
    });
    if (typeof toastr !== 'undefined') toastr.success('已恢复初始设置，页面即将刷新');
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';

.setting-item {
  margin-bottom: 15px;
}
.theme-buttons {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}
.theme-buttons button {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--SmartThemeBorderColor, #444);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.theme-buttons button.active {
  background: #007bff;
  border-color: #007bff;
}

.flex-col-align-start {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.slider-input {
  width: 100%;
  cursor: pointer;
}

.setting-action {
  margin-top: 25px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: 15px;
}

.mobile-scale-hint {
  display: none;
}

@media (max-width: 768px) {
  .mobile-scale-hint {
    display: inline;
    color: #ff9800;
  }
}
</style>
