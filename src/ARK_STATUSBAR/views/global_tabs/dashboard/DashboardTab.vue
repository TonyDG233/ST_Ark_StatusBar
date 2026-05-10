<template>
  <div class="dashboard-tab relative flex flex-col p-4 @[400px]:p-6 gap-4 @[400px]:gap-6 @container">
    <!-- 开发标签 -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[10px] px-1 font-mono z-50 pointer-events-none opacity-50">
      [DashboardTab]
    </div>

    <!-- 顶部状态面板 (Top Status) -->
    <Panel class="p-4 @[300px]:p-6 gap-4 flex-shrink-0">
      <div class="flex flex-col @[300px]:flex-row justify-between items-start gap-4">
        <SectionHeader title="12-1" subtitle="当前剧情节点" showDecoration class="w-full @[300px]:w-auto" />
        <SectionHeader title="14:00" subtitle="游戏内时间" class="w-full @[300px]:w-auto @[300px]:text-right" />
      </div>
      <ProgressBar label="理智 / HP" :current="120" :max="135" class="mt-2" />
    </Panel>

    <!-- 中部活动日志 (Recent Activity) -->
    <Panel class="flex-col">
      <div class="p-4 border-b border-outline-variant flex justify-between items-center bg-surface-container-low flex-shrink-0">
        <span class="font-display font-bold tracking-widest text-on-surface">近期触发记录</span>
        <div class="w-2 h-2 bg-secondary"></div>
      </div>
      
      <!-- 内部独立滚动区域: 有最大高度且有滚动条 -->
      <div class="p-4 flex flex-col gap-4 overflow-y-auto ark-scrollbar max-h-[250px]">
        <div v-for="i in 3" :key="i" class="flex gap-2 @[300px]:gap-3 items-start border-b border-outline-variant/50 pb-4 last:border-0 last:pb-0">
          <span class="material-symbols-outlined text-on-surface-variant mt-0.5 flex-shrink-0 text-sm @[300px]:text-base">memory</span>
          <!-- 使用 min-w-0 确保 flex 子元素内的文本可以被正确截断 (truncate) 而不挤压布局 -->
          <div class="flex-1 min-w-0 flex flex-col">
            <span class="text-on-surface font-display text-sm tracking-wide truncate">Entry [Amiya] triggered</span>
            <span class="text-on-surface-variant text-label-caps mt-1 truncate">LOG_ID: A83-B</span>
          </div>
          <span class="text-on-surface-variant text-xs mt-0.5 flex-shrink-0">13:58</span>
        </div>
      </div>
    </Panel>

    <!-- 底部快捷操作网格 (Quick Access) -->
    <div class="grid grid-cols-1 @[400px]:grid-cols-2 gap-4 flex-shrink-0">
      <!-- 大按键跨列 -->
      <Button variant="primary" icon="menu_book" class="h-24 @[400px]:col-span-2 text-lg">
        世界书管理器
      </Button>
      
      <!-- 小按键加遮罩 -->
      <div class="relative h-12">
        <Button class="w-full h-full" icon="group">干员列表</Button>
        <WipMask text="开发中" />
      </div>
      
      <div class="relative h-12">
        <Button class="w-full h-full" icon="map">部署视图</Button>
        <WipMask text="开发中" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '../../../components/Button.vue';
import Panel from '../../../components/Panel.vue';
import ProgressBar from '../../../components/ProgressBar.vue';
import SectionHeader from '../../../components/SectionHeader.vue';
import WipMask from '../../../components/WipMask.vue';

// 页面级组件：DashboardTab 主页
</script>
