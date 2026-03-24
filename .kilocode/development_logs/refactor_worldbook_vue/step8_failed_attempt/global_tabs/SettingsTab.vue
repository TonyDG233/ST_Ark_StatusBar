<template>
  <div class="tab-panel">
    <div class="setting-item">
      <label>UI 主题</label>
      <div class="theme-buttons">
        <button :class="{ active: config?.theme === 'light' }" @click="updateTheme('light')">默认(白)</button>
        <button :class="{ active: config?.theme === 'dark' }" @click="updateTheme('dark')">夜间(黑)</button>
        <button :class="{ active: config?.theme === 'transparent' }" @click="updateTheme('transparent')">透明</button>
      </div>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>发送预检拦截</label>
        <label class="switch">
          <input type="checkbox" :checked="config?.isInterceptorEnabled" @change="toggleInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint">
        开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>回车键拦截预警</label>
        <label class="switch">
          <input type="checkbox" :checked="config?.enableEnterToIntercept" @change="toggleEnterInterceptor" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint">
        开启后，按下回车键发送也将被拦截预览。默认关闭，以方便习惯回车换行或原生发送的用户。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label>显示常驻(蓝灯)条目</label>
        <label class="switch">
          <input type="checkbox" :checked="config?.showConstantEntries" @change="toggleShowConstantEntries" />
          <span class="slider round"></span>
        </label>
      </div>
      <p class="hint">
        开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
      </p>
    </div>

    <div class="setting-item">
      <div style="display: flex; align-items: center; gap: 10px">
        <label style="color: #dc3545; font-weight: bold">🔧 开启调试日志导出</label>
        <label class="switch">
          <input type="checkbox" :checked="config?.isDebugMode" @change="toggleDebugMode" />
          <span class="slider round" :style="config?.isDebugMode ? 'background-color: #dc3545;' : ''"></span>
        </label>
      </div>
      <p class="hint" style="color: #dc3545">
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
        <p class="hint warning">取消全部条目的置顶状态。</p>
      </div>

      <div style="border-top: 1px dashed rgba(128, 128, 128, 0.3); padding-top: 15px">
        <button class="btn-danger" @click="factoryReset">恢复初始设置</button>
        <p class="hint danger">将清除本插件的所有配置、手动修改记录和快照，彻底恢复至初始状态。此操作不可逆！</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ArkConfig } from '../../config/system_config';

const props = defineProps<{ config: ArkConfig | null }>();
const emit = defineEmits<{
  (e: 'update-config', update: Partial<ArkConfig>): void;
  (e: 'preview-ui-width', val: number): void;
  (e: 'preview-ui-font-size', val: number): void;
}>();

const updateTheme = (theme: 'light' | 'dark' | 'transparent') => emit('update-config', { theme });
const toggleInterceptor = (e: Event) => emit('update-config', { isInterceptorEnabled: (e.target as HTMLInputElement).checked });
const toggleEnterInterceptor = (e: Event) => emit('update-config', { enableEnterToIntercept: (e.target as HTMLInputElement).checked });
const toggleShowConstantEntries = (e: Event) => emit('update-config', { showConstantEntries: (e.target as HTMLInputElement).checked });
const toggleDebugMode = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  emit('update-config', { isDebugMode: checked });
  if (checked && typeof toastr !== 'undefined') {
    toastr.warning('调试日志已开启！', 'ARK_DEBUG');
  }
};

const localUiWidth = ref<number | null>(null);
const displayWidth = computed(() => localUiWidth.value ?? props.config?.uiWidth ?? 400);
const updateUiWidth = (e: Event) => { 
  const val = Number((e.target as HTMLInputElement).value);
  localUiWidth.value = val; 
  emit('preview-ui-width', val);
};
const commitUiWidth = () => { if (localUiWidth.value !== null) emit('update-config', { uiWidth: localUiWidth.value }); };

const localUiFontSize = ref<number | null>(null);
const displayFontSize = computed(() => localUiFontSize.value ?? props.config?.uiFontSize ?? 14);
const updateUiFontSize = (e: Event) => { 
  const val = Number((e.target as HTMLInputElement).value);
  localUiFontSize.value = val; 
  emit('preview-ui-font-size', val);
  document.dispatchEvent(new CustomEvent('ark-preview-ui-font-size', { detail: val }));
};
const commitUiFontSize = () => { if (localUiFontSize.value !== null) emit('update-config', { uiFontSize: localUiFontSize.value }); };

const clearPins = () => {
  if (confirm('确定要清空所有置顶的偏好条目吗？')) {
    emit('update-config', { pinnedEntries: [] });
  }
};

const factoryReset = () => {
  if (confirm('确定要清除本插件的所有配置、快照和修改记录吗？此操作不可逆！')) {
    emit('update-config', {
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
    setTimeout(() => { window.location.reload(); }, 1500);
  }
};
</script>

<style scoped>
@import '../styles/theme.scss';

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
  color: white;
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
  border-top: 1px dashed rgba(128, 128, 128, 0.3);
  padding-top: 15px;
}

.hint {
  font-size: 0.85em;
  opacity: 0.8;
  margin-top: 5px;
}

.warning {
  color: orange;
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
