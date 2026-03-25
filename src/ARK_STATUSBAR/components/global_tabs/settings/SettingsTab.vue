<template>
  <div class="tab-panel">
    <div class="setting-item">
      <label>UI 主题</label>
      <div class="theme-buttons">
        <button :class="{ active: currentConfig?.theme === 'light' }" @click="updateTheme('light')">
          默认(白)
        </button>
        <button :class="{ active: currentConfig?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
        <button :class="{ active: currentConfig?.theme === 'transparent' }" @click="updateTheme('transparent')">
          透明
        </button>
      </div>
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
          <input
            type="checkbox"
            :checked="currentConfig?.enableEnterToIntercept"
            @change="toggleEnterInterceptor"
          />
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
          <input
            type="checkbox"
            :checked="currentConfig?.showConstantEntries"
            @change="toggleShowConstantEntries"
          />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint" style="margin-top: 5px; font-size: 0.85em; opacity: 0.8">
        开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
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

    <div class="setting-item flex-col-align-start">
      <label>UI 宽度 ({{ displayWidth }}px)</label>
      <input
        type="range"
        min="200"
        max="600"
        step="10"
        :value="displayWidth"
        @input="updateUiWidth"
        @change="commitUiWidth"
        class="slider-input"
      />
    </div>

    <div class="setting-item flex-col-align-start">
      <label>字体大小 (<span class="mobile-scale-hint">移动端自动 -2px / </span>当前基准: {{ displayFontSize }}px)</label>
      <input
        type="range"
        min="10"
        max="24"
        step="1"
        :value="displayFontSize"
        @input="updateUiFontSize"
        @change="commitUiFontSize"
        class="slider-input"
      />
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
import { ref, computed } from 'vue';
import { useArkConfig, configStore } from '../../../logic/core/config_store';
import { previewUiWidth, previewUiFontSize } from '../shared_ui_state';

const currentConfig = useArkConfig();

const displayWidth = computed(() => previewUiWidth.value ?? currentConfig.value?.uiWidth ?? 400);
const displayFontSize = computed(() => previewUiFontSize.value ?? currentConfig.value?.uiFontSize ?? 14);

const updateUiWidth = (e: Event) => {
  previewUiWidth.value = Number((e.target as HTMLInputElement).value);
};

const commitUiWidth = () => {
  if (previewUiWidth.value !== null) {
    configStore.updateConfig({ uiWidth: previewUiWidth.value });
    previewUiWidth.value = null; // 清空本地预览，让 Config 的值接管
  }
};

const updateUiFontSize = (e: Event) => {
  previewUiFontSize.value = Number((e.target as HTMLInputElement).value);
};

const commitUiFontSize = () => {
  if (previewUiFontSize.value !== null) {
    configStore.updateConfig({ uiFontSize: previewUiFontSize.value });
    previewUiFontSize.value = null;
  }
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
const clearPins = () => {
  if (confirm('确定要清空所有置顶的偏好条目吗？')) {
    configStore.updateConfig({ pinnedEntries: [] });
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
      enableEnterToIntercept: false,
      showConstantEntries: false,
      theme: 'light',
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
