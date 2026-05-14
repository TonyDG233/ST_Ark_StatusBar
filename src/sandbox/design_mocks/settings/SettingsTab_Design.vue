<template>
  <div class="settings-tab relative flex flex-col p-4 gap-4 @container overflow-y-auto scrollbar-none min-h-0 w-full h-full text-on-surface">
    <!-- 开发意图标签 -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[10px] px-1 font-mono z-50 pointer-events-none opacity-50">
      [SettingsTab_Design]
    </div>

    <!-- 顶部状态面板复用 HistoryTab 风格 -->
    <div class="tab-header flex flex-col gap-2 border-b border-outline-variant pb-3 px-1 pt-1 flex-shrink-0 bg-transparent transition-all mb-2">
      <div class="font-mono text-primary-text mb-0.5 uppercase opacity-80 flex items-center gap-1.5 text-xs tracking-wider">
        <span class="w-1.5 h-1.5 bg-primary"></span>
        SYS_MODULE // SETTINGS
      </div>
      <div class="flex items-center gap-2 text-primary-text">
        <div class="w-1.5 h-6 bg-primary flex-shrink-0"></div>
        <h1 class="font-display text-xl md:text-2xl font-bold text-on-surface tracking-widest uppercase">系统配置</h1>
      </div>
      
      <!-- 重新设计的头部视觉：控制台状态栏 -->
      <div class="mt-2 bg-surface-container-low border border-outline-variant p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px] uppercase tracking-widest shadow-inner">
        <div class="flex justify-between items-center border-b border-outline-variant/50 pb-0.5">
          <span class="text-on-surface-variant">Kernel_Ver</span>
          <!-- TODO: 后续正式整合时可替换为读取 package.json 的真实版本号 -->
          <span class="text-primary-text font-bold">v2.0.0-beta</span>
        </div>
        <div class="flex justify-between items-center border-b border-outline-variant/50 pb-0.5">
          <span class="text-on-surface-variant">Mem_Alloc</span>
          <span class="text-on-surface">64.2%</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-on-surface-variant">Sys_Time</span>
          <span class="text-on-surface">{{ currentTime }}</span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-on-surface-variant">State</span>
          <span class="text-[#afd439] flex items-center gap-1.5 font-bold">
            <span class="w-1.5 h-1.5 bg-[#afd439]"></span>OPTIMAL
          </span>
        </div>
      </div>
    </div>

    <!-- 界面布局 (UI_LAYOUT) -->
    <Panel class="p-4 gap-4 flex-shrink-0">
      <div class="font-bold text-primary-text text-[12px] uppercase border-b border-outline-variant pb-2 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">aspect_ratio</span>
        界面布局
      </div>
      <div class="flex flex-col gap-5">
        <Slider 
          label="视图宽度" 
          :min="200" :max="1000" :step="10" 
          v-model="uiWidth" 
          :valueFormatter="val => val + 'px'" 
        />
        <Slider 
          label="视图高度" 
          :min="200" :max="1200" :step="20" 
          v-model="uiHeight" 
          :valueFormatter="val => val + 'px'" 
        />
        <Slider 
          label="基准字号" 
          :min="10" :max="24" :step="1" 
          v-model="uiFontSize" 
          :valueFormatter="val => val + 'px'" 
        />
      </div>
      <p class="text-[10px] text-on-surface-variant mt-1 leading-tight">
        * 松开滑块后应用尺寸变化。在移动端等小屏设备上，尺寸调整可能受到物理屏幕限制。
      </p>
    </Panel>

    <!-- 视觉表现 (APPEARANCE) -->
    <Panel class="p-4 gap-4 flex-shrink-0">
      <div class="font-bold text-primary-text text-[12px] uppercase border-b border-outline-variant pb-2 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">palette</span>
        视觉表现
      </div>
      <div class="flex flex-col gap-2">
        <label class="font-display text-[11px] font-bold text-on-surface-variant tracking-widest uppercase">主题选择</label>
        <SegmentedControl 
          v-model="theme" 
          :options="themeOptions" 
        />
      </div>
    </Panel>

    <!-- 核心预警系统 (CORE_SYSTEM) -->
    <Panel class="p-4 gap-4 flex-shrink-0">
      <div class="font-bold text-primary-text text-[12px] uppercase border-b border-outline-variant pb-2 flex items-center gap-2">
        <span class="material-symbols-outlined text-[16px]">memory</span>
        核心系统
      </div>
      
      <div class="flex flex-col gap-4">
        <!-- 拦截器开关 -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <label class="font-bold text-[12px] text-on-surface">发送预检拦截</label>
            <Switch v-model="isInterceptorEnabled" />
          </div>
          <p class="text-[10px] text-on-surface-variant leading-tight min-w-0 break-words whitespace-normal">
            开启后，点击发送按钮时将无痕预览即将触发的世界书，防止暴走。
          </p>
        </div>

        <!-- 回车拦截 -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <label class="font-bold text-[12px] text-on-surface">回车键拦截预警</label>
            <Switch v-model="enableEnterToIntercept" />
          </div>
          <p class="text-[10px] text-on-surface-variant leading-tight min-w-0 break-words whitespace-normal">
            开启后，按下回车键发送也将被拦截预览。默认关闭，以方便习惯回车换行的用户。
          </p>
        </div>

        <!-- 常驻条目显示 -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <label class="font-bold text-[12px] text-on-surface">显示常驻(蓝灯)条目</label>
            <Switch v-model="showConstantEntries" />
          </div>
          <p class="text-[10px] text-on-surface-variant leading-tight min-w-0 break-words whitespace-normal">
            开启后，无论是在被动发送拦截还是主动检测中，都将展示被激活的常驻条目（仅供检查调试）。
          </p>
        </div>

        <!-- Token 计算器 -->
        <div class="flex flex-col gap-1.5">
          <div class="flex justify-between items-center">
            <label class="font-bold text-[12px] text-on-surface">Token 消耗估算</label>
            <Switch v-model="enableTokenCalculator" />
          </div>
          <p class="text-[10px] text-on-surface-variant leading-tight min-w-0 break-words whitespace-normal">
            预检拦截时，同时估算即将发送的 Token。 <span class="text-[#ff9800]">如果遇到拦截严重卡顿，请关闭此项。</span>
          </p>
        </div>

        <!-- 调试模式 -->
        <div class="flex flex-col gap-1.5 pt-2 border-t border-outline-variant/50">
          <div class="flex justify-between items-center">
            <label class="font-bold text-[12px] text-error flex items-center gap-1">
              <span class="material-symbols-outlined text-[14px]">bug_report</span>
              导出底层调试日志
            </label>
            <Switch v-model="isDebugMode" />
          </div>
          <p class="text-[10px] text-error/80 leading-tight min-w-0 break-words whitespace-normal">
            开启后将记录所有底层检测流并写入独立的世界书条目，仅供 Bug 反馈时使用。
          </p>
        </div>
      </div>
    </Panel>

    <!-- 危险操作区 (DANGER_ZONE) -->
    <div class="flex-shrink-0 flex flex-col gap-3 mt-2 border-t border-outline-variant pt-4 pb-16">
      <div class="flex flex-col gap-1">
        <Button variant="outline" class="w-full text-on-surface-variant hover:text-on-surface hover:border-on-surface">
          清空偏好置顶
        </Button>
        <p class="text-[10px] text-on-surface-variant text-center">取消全部条目的置顶状态</p>
      </div>

      <div class="flex flex-col gap-1">
        <Button variant="primary" class="w-full bg-error border-error text-white hover:bg-error/80">
          恢复初始设置
        </Button>
        <p class="text-[10px] text-error text-center font-bold">清除所有配置、快照和记录！不可逆转！</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import Button from '../../../ARK_STATUSBAR/components/Button.vue';
import Panel from '../../../ARK_STATUSBAR/components/Panel.vue';
import SegmentedControl from '../../../ARK_STATUSBAR/components/SegmentedControl.vue';
import Slider from '../../../ARK_STATUSBAR/components/Slider.vue';
import Switch from '../../../ARK_STATUSBAR/components/Switch.vue';

// 实时系统时间
const currentTime = ref('');
let timeInterval: ReturnType<typeof setInterval>;

const updateTime = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  currentTime.value = `${hours}:${minutes}:${seconds}`;
};

onMounted(() => {
  updateTime();
  timeInterval = setInterval(updateTime, 1000);
});

onUnmounted(() => {
  clearInterval(timeInterval);
});

// 模拟状态
const uiWidth = ref(400);
const uiHeight = ref(400);
const uiFontSize = ref(14);

const theme = ref('dark');
const themeOptions = [
  { label: '白天', value: 'light', icon: 'light_mode' },
  { label: '夜间', value: 'dark', icon: 'dark_mode' },
  { label: '透明', value: 'transparent', icon: 'opacity' }
];

const isInterceptorEnabled = ref(true);
const enableEnterToIntercept = ref(false);
const showConstantEntries = ref(false);
const enableTokenCalculator = ref(true);
const isDebugMode = ref(false);
</script>

<style scoped>
/* Any required scoped overrides */
</style>
