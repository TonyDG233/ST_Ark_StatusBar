<template>
  <div class="dashboard-tab relative flex flex-col p-4 gap-4 @container scrollbar-none overflow-y-auto">
    <!-- 开发标签 -->
    <div class="absolute top-0 right-0 bg-error/90 text-on-error text-[10px] px-1 font-mono z-50 pointer-events-none opacity-50">
      [DashboardTab]
    </div>

    <!-- 顶部状态面板 (Top Status) -->
    <Panel class="p-4 gap-4 flex-shrink-0">
      <div class="flex flex-col @[300px]:flex-row justify-between items-start gap-4">
        <SectionHeader title="12-1" subtitle="当前剧情节点" showDecoration class="w-full @[300px]:w-auto" />
        <SectionHeader title="14:00" subtitle="游戏内时间" class="w-full @[300px]:w-auto @[300px]:text-right" />
      </div>
      <ProgressBar label="理智 / HP" :current="120" :max="135" class="mt-2" />
    </Panel>

    <!-- 中部活动日志 (Recent Activity) -->
    <Panel class="flex-col flex-shrink-0">
      <div class="p-3 border-b border-outline-variant flex justify-between items-center bg-surface-container-low flex-shrink-0">
        <span class="font-bold tracking-widest text-[11px] uppercase text-on-surface">近期触发记录</span>
        <div class="w-1.5 h-1.5 bg-secondary"></div>
      </div>
      
      <!--
        TODO: [Phase 2] 持久化缓存近20次触发记录
        - 需引入浏览器持久化缓存（如 localStorage 或酒馆的自定义变量）来记录最近触发的 20 条记录。
        - 主页面板应只展示“总记录概览”，点击后才展开完整的 20 次触发详细列表（包含条目内容与 Token 数）。
        - 当前阶段仅作 UI 占位，需在实际应用至工程项目中做出对应功能。
      -->
      <div class="p-3 flex flex-col gap-3">
        <div v-for="i in 3" :key="i" class="flex gap-2 items-start border-b border-outline-variant/50 pb-3 last:border-0 last:pb-0 cursor-pointer hover:bg-surface-variant/30 transition-colors -mx-3 px-3">
          <span class="material-symbols-outlined text-on-surface-variant mt-0.5 flex-shrink-0 text-[14px]">memory</span>
          <div class="flex-1 min-w-0 flex flex-col">
            <span class="text-on-surface text-[12px] font-bold tracking-wide truncate">Entry [Amiya] triggered</span>
            <span class="text-on-surface-variant text-[10px] font-mono mt-1 tracking-wider truncate">LOG_ID: A83-B</span>
          </div>
          <span class="text-on-surface-variant text-[10px] font-mono mt-0.5 flex-shrink-0">13:58</span>
        </div>
      </div>
    </Panel>

    <!-- 底部快捷操作网格 (Quick Access) -->
    <div class="grid grid-cols-1 @[400px]:grid-cols-2 gap-3 flex-shrink-0">
      <!-- 大按键跨列 -->
      <Button variant="primary" icon="menu_book" class="h-16 @[400px]:col-span-2 text-sm font-bold tracking-widest uppercase">
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
