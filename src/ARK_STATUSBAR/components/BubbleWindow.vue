<template>
  <div
    class="ark-bubble-wrapper relative"
    :class="[position === 'left' ? 'flex-row' : 'flex-row-reverse']"
    style="display: flex"
  >
    <!-- 气泡本体 -->
    <div
      class="ark-bubble-window relative flex items-center justify-center h-[60px] bg-surface-container-high/90 backdrop-blur-md border border-outline-variant cursor-grab active:cursor-grabbing select-none transition-colors hover:bg-primary/20"
      :class="[position === 'left' ? 'rounded-r-3xl border-l-0' : 'rounded-l-3xl border-r-0']"
      :style="{ width: width + 'px' }"
      @click="emit('click-bubble')"
    >
      <div
        class="flex items-center gap-1.5 px-2 overflow-hidden w-full"
        :class="position === 'left' ? 'justify-end' : 'justify-start'"
      >
        <!-- 书本图标 -->
        <span class="material-symbols-outlined text-primary-text text-[calc(20em/14)] flex-shrink-0">menu_book</span>
        <!-- 压缩文案：仅在宽度允许时显示 -->
        <span
          v-if="width > 60 && triggerCount > 0"
          class="text-[calc(10em/14)] font-code-data text-primary-text whitespace-nowrap truncate font-bold"
        >
          拦截: {{ triggerCount }}
        </span>
        <!-- 如果宽度窄，用红点/徽章代替文本 -->
        <div
          v-else-if="triggerCount > 0"
          class="absolute top-2 bg-primary rounded-full min-w-[14px] h-[14px] px-[3px] flex items-center justify-center border border-surface shadow-sm"
          :class="position === 'left' ? 'right-1' : 'left-1'"
        >
          <span class="text-[calc(8em/14)] text-on-primary font-bold leading-none translate-y-[0.5px]">{{
            triggerCount > 99 ? '99+' : triggerCount
          }}</span>
        </div>
      </div>
    </div>

    <!-- 战术引出弹窗 (Popover Sub-menu) -->
    <div
      v-if="showPopover && triggerCount > 0"
      class="absolute top-0 w-[200px] bg-surface border-y border-outline-variant shadow-[0_10px_30px_rgba(0,0,0,0.8)] flex flex-col p-1.5 gap-1.5 z-50"
      :class="[
        position === 'left'
          ? 'left-[calc(100%+8px)] border-r border-r-primary'
          : 'right-[calc(100%+8px)] border-l border-l-primary',
        'before:absolute before:top-6 before:w-2 before:h-[1px] before:bg-primary',
        position === 'left' ? 'before:-left-2' : 'before:-right-2',
      ]"
    >
      <div class="flex justify-between items-center border-b border-outline-variant/50 pb-1 px-1">
        <span class="text-[calc(10em/14)] font-display text-primary-text tracking-widest uppercase">
          拦截面板 {{ typeof totalTokens === 'string' ? totalTokens : '~' + totalTokens + ' tok' }} |
          {{ entries.length }}
        </span>
        <button
          class="reset-btn text-on-surface-variant hover:text-on-surface flex items-center justify-center p-0"
          @click="emit('close-popover')"
        >
          <span class="material-symbols-outlined text-[calc(12em/14)]">close</span>
        </button>
      </div>

      <!--
        TODO: [Phase 2] 行为逻辑分离
        - 当该气泡由被动拦截触发时，点击面板应触发事件展开为全屏拦截页。
        - 当处于主动点击气泡窗状态时，在此展开小拦截面板，且点击“发送”按钮后应自动收缩回气泡形态。
      -->

      <!-- 最简拦截列表 (集成单次/彻底逻辑) -->
      <ul
        class="flex flex-col gap-1 max-h-[140px] overflow-y-auto scrollbar-thin scrollbar-thumb-outline-variant/50 scrollbar-track-transparent pl-0 m-0 list-none"
      >
        <li
          v-for="(entry, idx) in entries"
          :key="idx"
          class="flex-shrink-0 flex flex-col gap-1 p-1 rounded-sm border border-transparent overflow-hidden relative group"
          :class="[
            entry.enabled === false && !entry.tempDisabled
              ? 'ark-stripe-error bg-error/5 border-error/30'
              : entry.tempDisabled
                ? 'ark-stripe-warning bg-outline-variant/10 border-outline-variant'
                : 'bg-surface-container-low border-outline-variant/50',
          ]"
        >
          <div class="flex justify-between items-start gap-1 relative z-10">
            <div class="flex-1 flex gap-1.5 items-start min-w-0">
              <div
                v-if="showTypeIndicator"
                class="w-1.5 h-1.5 mt-[3px] flex-shrink-0 border-none p-0 m-0 rounded-none shadow-sm"
                :class="
                  entry.type === 'constant'
                    ? 'bg-[#4ed5ff] shadow-[0_0_4px_#4ed5ff88]'
                    : 'bg-[#afd439] shadow-[0_0_4px_#afd43988]'
                "
                :title="entry.type === 'constant' ? '蓝灯(常驻)' : '绿灯(条件)'"
              ></div>
              <span
                class="text-[calc(11em/14)] font-body flex-1 min-w-0 break-words whitespace-normal leading-tight"
                :class="[
                  entry.enabled === false && !entry.tempDisabled
                    ? 'text-on-surface line-through opacity-70'
                    : entry.tempDisabled
                      ? 'text-on-surface-variant'
                      : 'text-on-surface',
                ]"
              >
                {{ entry.name }}
              </span>
            </div>
            <span
              class="text-[calc(9em/14)] font-mono text-on-surface-variant whitespace-nowrap flex-shrink-0 opacity-70 mt-0.5"
            >
              ~{{ entry.tokens || 0 }}
            </span>
          </div>
          <div class="flex justify-end gap-1">
            <!-- 已彻底阻断，仅提供恢复 -->
            <ActionToggle
              v-if="entry.enabled === false && !entry.tempDisabled"
              type="enable"
              size="sm"
              @click="emit('toggle-entry', entry, 'enable')"
            />
            <template v-else>
              <!-- 临时阻断恢复 -->
              <ActionToggle
                v-if="entry.tempDisabled"
                type="resume"
                size="sm"
                @click="emit('toggle-entry', entry, 'resume')"
              />
              <!-- 单次临时阻断 -->
              <ActionToggle v-else type="temp" size="sm" @click="emit('toggle-entry', entry, 'temp')" />
              <!-- 彻底禁用 -->
              <ActionToggle type="disable" size="sm" @click="emit('toggle-entry', entry, 'disable')" />
            </template>
          </div>
        </li>
      </ul>

      <!-- 发送/取消 动作区 -->
      <div class="flex gap-1.5 pt-1.5 border-t border-outline-variant/50">
        <button
          class="reset-btn flex-1 py-1 hover:bg-surface-variant text-on-surface-variant hover:text-on-surface text-[calc(11em/14)] font-display border border-outline-variant transition-colors rounded-sm"
          @click="emit('action', 'cancel')"
        >
          取消
        </button>
        <button
          class="reset-btn flex-1 py-1 hover:bg-primary/20 text-primary-text text-[calc(11em/14)] font-display border border-primary/50 transition-colors font-bold rounded-sm bg-primary/10"
          style="background-color: rgb(var(--color-primary-rgb) / 0.1)"
          @click="emit('action', 'send')"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import ActionToggle from './ActionToggle.vue';

// BubbleWindow: 贴边气泡态及战术副屏
const props = withDefaults(
  defineProps<{
    position?: 'left' | 'right';
    width?: number;
    triggerCount?: number;
    showPopover?: boolean;
    totalTokens?: number | string;
    showTypeIndicator?: boolean;
    entries?: {
      name: string;
      enabled?: boolean;
      tempDisabled?: boolean;
      tokens?: number;
      type?: 'constant' | 'selective';
    }[];
  }>(),
  {
    position: 'right',
    width: 32,
    triggerCount: 0,
    showPopover: false,
    totalTokens: 0,
    showTypeIndicator: false,
    entries: () => [],
  },
);

const emit = defineEmits<{
  (e: 'click-bubble'): void;
  (e: 'close-popover'): void;
  (e: 'toggle-entry', entry: any, action: 'enable' | 'temp' | 'resume' | 'disable'): void;
  (e: 'action', type: 'send' | 'cancel'): void;
}>();
</script>
