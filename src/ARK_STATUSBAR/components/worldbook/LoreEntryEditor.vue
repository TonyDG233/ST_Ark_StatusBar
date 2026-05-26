<template>
  <div
    class="bg-surface-container-highest border-b border-outline-variant p-2 flex flex-col gap-3 box-border w-full min-w-0"
  >
    <!-- Header -->
    <div class="flex justify-between items-center border-b border-outline-variant/50 pb-1.5 min-w-0 w-full gap-2">
      <h4
        class="font-display font-bold text-on-surface text-[calc(11em/14)] uppercase flex items-center gap-1.5 min-w-0 flex-1"
      >
        <span class="material-symbols-outlined text-primary-text text-[calc(14em/14)] flex-shrink-0"
          >edit_document</span
        >
        <span class="min-w-0 break-words whitespace-normal leading-tight">编辑: {{ modelValue.name }}</span>
      </h4>
      <button
        class="text-on-surface-variant hover:text-error transition-colors flex-shrink-0 cursor-pointer outline-none w-6 h-6 flex items-center justify-center rounded hover:bg-error-container/20"
        title="取消编辑"
        @click="$emit('cancel')"
      >
        <span class="material-symbols-outlined text-[calc(16em/14)]">close</span>
      </button>
    </div>

    <!-- Fluid Body -->
    <div class="flex flex-col gap-2 min-w-0 w-full">
      <div class="flex flex-col gap-0.5 min-w-0 w-full">
        <label class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase">标题/备注 (TITLE)</label>
        <input
          type="text"
          class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border"
          v-model="modelValue.name"
        />
      </div>

      <!-- Trigger Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase">类型 (TYPE)</label>
          <select
            v-model="modelValue.strategy.type"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[calc(10em/14)] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer"
          >
            <option value="selective">条件 (🟢 绿灯)</option>
            <option value="constant">常驻 (🔵 蓝灯)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >主关键词 (KEYS)</label
          >
          <input
            type="text"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border"
            :value="joinKeys(modelValue.strategy.keys)"
            @input="updateKeys($event, 'keys')"
            placeholder="例如: 阿米娅, 罗德岛"
          />
        </div>
      </div>

      <!-- Conditional Row: Logic (v-if type === selective) -->
      <div v-if="modelValue.strategy.type === 'selective'" class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >可选逻辑</label
          >
          <select
            v-model="modelValue.strategy.keys_secondary.logic"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[calc(10em/14)] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer"
          >
            <option value="and_any">与任意 (AND ANY)</option>
            <option value="and_all">与所有 (AND ALL)</option>
            <option value="not_any">非任意 (NOT ANY)</option>
            <option value="not_all">非所有 (NOT ALL)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >次要关键词</label
          >
          <input
            type="text"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border"
            :value="joinKeys(modelValue.strategy.keys_secondary.keys)"
            @input="updateKeys($event, 'keys_secondary')"
            placeholder="需要结合可选逻辑生效..."
          />
        </div>
      </div>

      <!-- Position Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[120px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >插入位置 (POSITION)</label
          >
          <select
            v-model="modelValue.position.type"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[calc(10em/14)] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer"
          >
            <option value="before_character_definition">角色定义前</option>
            <option value="after_character_definition">角色定义后</option>
            <option value="before_example_messages">示例消息前</option>
            <option value="after_example_messages">示例消息后</option>
            <option value="before_author_note">作者注释前</option>
            <option value="after_author_note">作者注释后</option>
            <option value="at_depth">指定深度 (@ Depth)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-[60px] max-w-[80px]">
          <label class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase truncate">顺序</label>
          <input
            type="number"
            v-model.number="modelValue.position.order"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-center w-full min-w-0 box-border"
          />
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-[60px] max-w-[80px]">
          <label class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase truncate">概率%</label>
          <input
            type="number"
            v-model.number="modelValue.probability"
            min="0"
            max="100"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-center w-full min-w-0 box-border"
          />
        </div>
      </div>

      <!-- Conditional Row: Depth (v-if position === at_depth) -->
      <div v-if="modelValue.position.type === 'at_depth'" class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >角色身份</label
          >
          <select
            v-model="modelValue.position.role"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[calc(10em/14)] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer"
          >
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[80px] max-w-full">
          <label
            class="font-mono text-[calc(9em/14)] text-on-surface-variant uppercase break-words whitespace-normal leading-tight"
            >深度 (Depth)</label
          >
          <input
            type="number"
            v-model.number="modelValue.position.depth"
            min="0"
            class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border"
          />
        </div>
      </div>

      <!-- Advanced Rules (Wrap) -->
      <div class="flex flex-col gap-1 mt-1 border-t border-outline-variant/30 pt-1 min-w-0 w-full">
        <div class="flex flex-wrap gap-2">
          <label
            class="flex items-center gap-1.5 cursor-pointer text-[calc(10em/14)] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full"
          >
            <input
              type="checkbox"
              v-model="modelValue.recursion.prevent_incoming"
              class="accent-primary flex-shrink-0"
            />
            <span class="font-mono break-words whitespace-normal leading-tight">不可递归被触发 (PREV_IN)</span>
          </label>
          <label
            class="flex items-center gap-1.5 cursor-pointer text-[calc(10em/14)] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full"
          >
            <input
              type="checkbox"
              v-model="modelValue.recursion.prevent_outgoing"
              class="accent-primary flex-shrink-0"
            />
            <span class="font-mono break-words whitespace-normal leading-tight">不触发其他条目 (PREV_OUT)</span>
          </label>
          <label
            class="flex items-center gap-1.5 cursor-pointer text-[calc(10em/14)] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full"
          >
            <input
              type="checkbox"
              :checked="modelValue.recursion.delay_until !== null"
              @change="toggleDelayUntil"
              class="accent-primary flex-shrink-0"
            />
            <span class="font-mono break-words whitespace-normal leading-tight">延迟递归 (DELAY)</span>
          </label>
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col gap-0.5 mt-1 min-w-0 w-full">
        <label class="font-mono text-[calc(9em/14)] text-primary-text uppercase flex justify-between min-w-0">
          <span class="truncate">正文 (CONTENT)</span>
          <span class="text-on-surface-variant flex-shrink-0 ml-2" v-if="tokenCount !== null"
            >~{{ tokenCount }} TOKENS</span
          >
        </label>
        <textarea
          v-model="modelValue.content"
          class="bg-surface border border-outline-variant hover:border-outline px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono resize-y min-h-[60px] w-full min-w-0 box-border"
          placeholder="输入世界书正文..."
        ></textarea>
      </div>
    </div>

    <!-- Footer Actions -->
    <div class="flex flex-wrap justify-end items-center gap-2 mt-1 flex-shrink-0 w-full">
      <button
        class="px-3 py-1 bg-surface border border-outline text-on-surface-variant font-display font-bold text-[calc(10em/14)] hover:text-on-surface hover:bg-surface-variant transition-colors outline-none cursor-pointer"
        @click="$emit('cancel')"
      >
        取消
      </button>
      <button
        class="px-3 py-1 bg-primary-container text-on-primary border border-primary-container font-display font-bold text-[calc(10em/14)] hover:bg-primary transition-colors flex items-center gap-1 outline-none cursor-pointer"
        @click="$emit('save')"
      >
        <span class="material-symbols-outlined text-[calc(12em/14)]">save</span>
        保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UIWorldbookEntry } from '../../store/ui_state_store';

const props = defineProps<{
  modelValue: UIWorldbookEntry;
  tokenCount: number | null;
}>();

defineEmits<{
  (e: 'update:modelValue', value: UIWorldbookEntry): void;
  (e: 'save'): void;
  (e: 'cancel'): void;
}>();

// 字符串转数组工具
const joinKeys = (keys: (string | RegExp)[] | undefined) => {
  return (keys || []).map(k => String(k)).join(', ');
};

const updateKeys = (event: Event, target: 'keys' | 'keys_secondary') => {
  const val = (event.target as HTMLInputElement).value;
  const arr = val
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '');
  if (target === 'keys') {
    props.modelValue.strategy.keys = arr;
  } else {
    props.modelValue.strategy.keys_secondary.keys = arr;
  }
};

const toggleDelayUntil = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  props.modelValue.recursion.delay_until = checked ? 1 : null;
};
</script>

<style scoped></style>
