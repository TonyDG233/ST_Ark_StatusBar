<template>
  <div class="bg-surface-container-highest border-b border-outline-variant p-2 flex flex-col gap-3 box-border w-full min-w-0">
    <!-- Header -->
    <div class="flex justify-between items-center border-b border-outline-variant/50 pb-1.5 min-w-0 w-full gap-2">
      <h4 class="font-display font-bold text-on-surface text-[11px] uppercase flex items-center gap-1.5 min-w-0 flex-1">
        <span class="material-symbols-outlined text-primary-text text-[14px] flex-shrink-0">edit_document</span>
        <span class="min-w-0 break-words whitespace-normal leading-tight">编辑: {{ entry.name }}</span>
      </h4>
      <button class="text-on-surface-variant hover:text-error transition-colors flex-shrink-0 cursor-pointer outline-none w-6 h-6 flex items-center justify-center rounded hover:bg-error-container/20" title="取消编辑" @click="$emit('cancel')">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>

    <!-- Fluid Body -->
    <div class="flex flex-col gap-2 min-w-0 w-full">
      
      <div class="flex flex-col gap-0.5 min-w-0 w-full">
        <label class="font-mono text-[9px] text-on-surface-variant uppercase">标题/备注 (TITLE)</label>
        <input type="text" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" :value="entry.name" />
      </div>

      <!-- Trigger Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase">类型 (TYPE)</label>
          <select class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option>条件</option>
            <option>常驻</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">主关键词 (KEYS)</label>
          <input type="text" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" :value="entry.keys.join(', ')" />
        </div>
      </div>

      <!-- Conditional Row: Logic (v-if type === selective) -->
      <div v-if="entry.type === 'selective'" class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">可选逻辑</label>
          <select class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option>与任意 (AND ANY)</option>
            <option>与所有 (AND ALL)</option>
            <option>非任意 (NOT ANY)</option>
            <option>非所有 (NOT ALL)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">次要关键词</label>
          <input type="text" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" placeholder="需要结合可选逻辑生效..." />
        </div>
      </div>

      <!-- Position Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">插入位置 (POSITION)</label>
          <select class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option>角色定义前</option>
            <option>角色定义后</option>
            <option>示例消息前</option>
            <option>指定深度 (@ Depth)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-[60px] max-w-[80px]">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase truncate">顺序</label>
          <input type="number" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-center w-full min-w-0 box-border" value="100" />
        </div>
      </div>

      <!-- Conditional Row: Depth (v-if position === at_depth) -->
      <!-- 这里用硬编码模拟选择"指定深度"时的展现，实际中用 v-model 绑定。由于是 sandbox 纯展示，我们暂时用 true 模拟 -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">角色身份</label>
          <select class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option>System</option>
            <option>User</option>
            <option>Assistant</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">深度 (Depth)</label>
          <input type="number" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" value="0" />
        </div>
      </div>

      <!-- Advanced Rules (Wrap) -->
      <div class="flex flex-col gap-1 mt-1 border-t border-outline-variant/30 pt-1 min-w-0 w-full">
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer text-[10px] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full">
            <input type="checkbox" class="accent-primary flex-shrink-0" />
            <span class="font-mono break-words whitespace-normal leading-tight">不可递归被触发 (PREV_IN)</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-[10px] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full">
            <input type="checkbox" class="accent-primary flex-shrink-0" />
            <span class="font-mono break-words whitespace-normal leading-tight">不触发其他条目 (PREV_OUT)</span>
          </label>
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col gap-0.5 mt-1 min-w-0 w-full">
        <label class="font-mono text-[9px] text-primary-text uppercase flex justify-between min-w-0">
          <span class="truncate">正文 (CONTENT)</span>
          <!-- TODO: [Phase 2] 探索 SillyTavern 实时文本 Token 估算 API，若无则整块移除 -->
          <span class="text-on-surface-variant flex-shrink-0 ml-2">~25 TOKENS</span>
        </label>
        <textarea class="bg-surface border border-outline-variant hover:border-outline px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono resize-y min-h-[60px] w-full min-w-0 box-border" placeholder="输入世界书正文..."></textarea>
      </div>

    </div>

    <!-- Footer Actions -->
    <div class="flex flex-wrap justify-end items-center gap-2 mt-1 flex-shrink-0 w-full">
      <button class="px-3 py-1 bg-surface border border-outline text-on-surface-variant font-display font-bold text-[10px] hover:text-on-surface hover:bg-surface-variant transition-colors outline-none cursor-pointer" @click="$emit('cancel')">
        取消
      </button>
      <button class="px-3 py-1 bg-primary-container text-on-primary border border-primary-container font-display font-bold text-[10px] hover:bg-primary transition-colors flex items-center gap-1 outline-none cursor-pointer">
        <span class="material-symbols-outlined text-[12px]">save</span>
        保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LoreEntryData } from './LoreDataCard.vue';

defineProps<{
  entry: LoreEntryData;
}>();

defineEmits<{
  (e: 'cancel'): void;
  (e: 'save'): void;
}>();
</script>

<style scoped>
</style>
