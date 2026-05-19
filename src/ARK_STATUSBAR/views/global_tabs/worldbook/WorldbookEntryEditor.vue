<template>
  <div class="bg-surface-container-highest border-b border-outline-variant p-2 flex flex-col gap-3 box-border w-full min-w-0">
    <!-- Header -->
    <div class="flex justify-between items-center border-b border-outline-variant/50 pb-1.5 min-w-0 w-full gap-2">
      <h4 class="font-display font-bold text-on-surface text-[11px] uppercase flex items-center gap-1.5 min-w-0 flex-1">
        <span class="material-symbols-outlined text-primary-text text-[14px] flex-shrink-0">edit_document</span>
        <span class="min-w-0 break-words whitespace-normal leading-tight">编辑: {{ localEntry.name }}</span>
      </h4>
      <button class="text-on-surface-variant hover:text-error transition-colors flex-shrink-0 cursor-pointer outline-none w-6 h-6 flex items-center justify-center rounded hover:bg-error-container/20" title="取消编辑" @click="$emit('cancel')">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>

    <!-- Fluid Body -->
    <div class="flex flex-col gap-2 min-w-0 w-full">
      
      <div class="flex flex-col gap-0.5 min-w-0 w-full">
        <label class="font-mono text-[9px] text-on-surface-variant uppercase">标题/备注 (TITLE)</label>
        <input type="text" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" v-model="localEntry.name" />
      </div>

      <!-- Trigger Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase">类型 (TYPE)</label>
          <select v-model="localEntry.strategy.type" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option value="selective">条件 (🟢 绿灯)</option>
            <option value="constant">常驻 (🔵 蓝灯)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">主关键词 (KEYS)</label>
          <input type="text" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" :value="joinKeys(localEntry.strategy.keys)" @input="updateKeys($event, 'keys')" placeholder="例如: 阿米娅, 罗德岛" />
        </div>
      </div>

      <!-- Conditional Row: Logic (v-if type === selective) -->
      <div v-if="localEntry.strategy.type === 'selective'" class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">可选逻辑</label>
          <select v-model="localEntry.strategy.keys_secondary.logic" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option value="and_any">与任意 (AND ANY)</option>
            <option value="and_all">与所有 (AND ALL)</option>
            <option value="not_any">非任意 (NOT ANY)</option>
            <option value="not_all">非所有 (NOT ALL)</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">次要关键词</label>
          <input type="text" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" :value="joinKeys(localEntry.strategy.keys_secondary.keys)" @input="updateKeys($event, 'keys_secondary')" placeholder="需要结合可选逻辑生效..." />
        </div>
      </div>

      <!-- Position Row -->
      <div class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[120px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">插入位置 (POSITION)</label>
          <select v-model="localEntry.position.type" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
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
          <label class="font-mono text-[9px] text-on-surface-variant uppercase truncate">顺序</label>
          <input type="number" v-model.number="localEntry.position.order" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-center w-full min-w-0 box-border" />
        </div>
        <div class="flex flex-col gap-0.5 flex-1 min-w-[60px] max-w-[80px]">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase truncate">概率%</label>
          <input type="number" v-model.number="localEntry.probability" min="0" max="100" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-center w-full min-w-0 box-border" />
        </div>
      </div>

      <!-- Conditional Row: Depth (v-if position === at_depth) -->
      <div v-if="localEntry.position.type === 'at_depth'" class="flex flex-wrap gap-2 min-w-0 w-full mt-1">
        <div class="flex flex-col gap-0.5 flex-1 min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">角色身份</label>
          <select v-model="localEntry.position.role" class="bg-surface border-b border-outline-variant hover:border-outline px-1 py-1 text-[10px] text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border outline-none cursor-pointer">
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div class="flex flex-col gap-0.5 flex-[2] min-w-[80px] max-w-full">
          <label class="font-mono text-[9px] text-on-surface-variant uppercase break-words whitespace-normal leading-tight">深度 (Depth)</label>
          <input type="number" v-model.number="localEntry.position.depth" min="0" class="bg-transparent border-b border-outline-variant hover:border-outline px-1 py-1 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono w-full min-w-0 box-border" />
        </div>
      </div>

      <!-- Advanced Rules (Wrap) -->
      <div class="flex flex-col gap-1 mt-1 border-t border-outline-variant/30 pt-1 min-w-0 w-full">
        <div class="flex flex-wrap gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer text-[10px] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full">
            <input type="checkbox" v-model="localEntry.recursion.prevent_incoming" class="accent-primary flex-shrink-0" />
            <span class="font-mono break-words whitespace-normal leading-tight">不可递归被触发 (PREV_IN)</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-[10px] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full">
            <input type="checkbox" v-model="localEntry.recursion.prevent_outgoing" class="accent-primary flex-shrink-0" />
            <span class="font-mono break-words whitespace-normal leading-tight">不触发其他条目 (PREV_OUT)</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer text-[10px] text-on-surface-variant hover:text-on-surface transition-colors min-w-0 max-w-full">
            <input type="checkbox" :checked="localEntry.recursion.delay_until !== null" @change="toggleDelayUntil" class="accent-primary flex-shrink-0" />
            <span class="font-mono break-words whitespace-normal leading-tight">延迟递归 (DELAY)</span>
          </label>
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col gap-0.5 mt-1 min-w-0 w-full">
        <label class="font-mono text-[9px] text-primary-text uppercase flex justify-between min-w-0">
          <span class="truncate">正文 (CONTENT)</span>
          <span class="text-on-surface-variant flex-shrink-0 ml-2" v-if="tokenCount !== null">~{{ tokenCount }} TOKENS</span>
        </label>
        <textarea v-model="localEntry.content" class="bg-transparent border border-outline-variant hover:border-outline px-2 py-1.5 text-xs text-on-surface focus:outline-none focus:border-primary transition-colors font-mono resize-y min-h-[60px] w-full min-w-0 box-border" placeholder="输入世界书正文..."></textarea>
      </div>

    </div>

    <!-- Footer Actions -->
    <div class="flex flex-wrap justify-end items-center gap-2 mt-1 flex-shrink-0 w-full">
      <button class="px-3 py-1 bg-surface border border-outline text-on-surface-variant font-display font-bold text-[10px] hover:text-on-surface hover:bg-surface-variant transition-colors outline-none cursor-pointer" @click="$emit('cancel')">
        取消
      </button>
      <button class="px-3 py-1 bg-primary-container text-on-primary border border-primary-container font-display font-bold text-[10px] hover:bg-primary transition-colors flex items-center gap-1 outline-none cursor-pointer" @click="saveChanges">
        <span class="material-symbols-outlined text-[12px]">save</span>
        保存
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cloneDeep, isEqual } from 'lodash';
import { onMounted, ref, watch } from 'vue';
import { UIWorldbookEntry } from '../../../store/ui_state_store';
import { ArkCommitChange } from '../../../types/system_config';

const props = defineProps<{
  entry: UIWorldbookEntry;
}>();

const emit = defineEmits<{
  (e: 'save', changes: ArkCommitChange[], updatedEntry: UIWorldbookEntry): void;
  (e: 'cancel'): void;
}>();

// 使用 cloneDeep 确保不污染原数据
const localEntry = ref<UIWorldbookEntry>(cloneDeep(props.entry));
const tokenCount = ref<number | null>(null);

// 初始化防护：确保所有被用到的嵌套对象都存在，防止 v-model 报错
onMounted(() => {
  if (!localEntry.value.strategy) {
    localEntry.value.strategy = {
      type: 'selective',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    };
  }
  if (!localEntry.value.strategy.keys_secondary) {
    localEntry.value.strategy.keys_secondary = { logic: 'and_any', keys: [] };
  }
  if (!localEntry.value.position) {
    localEntry.value.position = { type: 'before_character_definition', role: 'system', depth: 0, order: 100 };
  }
  if (!localEntry.value.recursion) {
    localEntry.value.recursion = { prevent_incoming: false, prevent_outgoing: false, delay_until: null };
  }
  if (!localEntry.value.extra) {
    localEntry.value.extra = {};
  }
});

// 动态计算 Token (调用 SillyTavern API)
watch(() => localEntry.value.content, async (newVal) => {
  if (newVal && typeof SillyTavern !== 'undefined' && SillyTavern.getTokenCountAsync) {
    try {
      tokenCount.value = await SillyTavern.getTokenCountAsync(newVal);
    } catch (e) {
      tokenCount.value = null;
    }
  } else {
    tokenCount.value = null;
  }
}, { immediate: true });

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
    localEntry.value.strategy.keys = arr;
  } else {
    localEntry.value.strategy.keys_secondary.keys = arr;
  }
};

const toggleDelayUntil = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  localEntry.value.recursion.delay_until = checked ? 1 : null;
};

// --- 核心逻辑：差异比对 (Diffing) ---
const saveChanges = () => {
  const changes: ArkCommitChange[] = [];
  const orig = props.entry;
  const curr = localEntry.value;
  const uid = orig.uid;
  const comment = orig.name || '未命名条目';

  // 1. 检查标题
  if (orig.name !== curr.name) {
    changes.push({ uid, comment, path: 'name', from: orig.name, to: curr.name });
  }

  // 2. 检查策略类型
  if (orig.strategy?.type !== curr.strategy.type) {
    changes.push({ uid, comment, path: 'strategy.type', from: orig.strategy?.type, to: curr.strategy.type });
  }

  // 3. 检查主关键词
  if (!isEqual(orig.strategy?.keys, curr.strategy.keys)) {
    changes.push({
      uid,
      comment,
      path: 'strategy.keys',
      from: cloneDeep(orig.strategy?.keys || []),
      to: cloneDeep(curr.strategy.keys),
    });
  }

  // 4. 检查次要关键词与逻辑
  if (orig.strategy?.keys_secondary?.logic !== curr.strategy.keys_secondary.logic) {
    changes.push({
      uid,
      comment,
      path: 'strategy.keys_secondary.logic',
      from: orig.strategy?.keys_secondary?.logic,
      to: curr.strategy.keys_secondary.logic,
    });
  }
  if (!isEqual(orig.strategy?.keys_secondary?.keys, curr.strategy.keys_secondary.keys)) {
    changes.push({
      uid,
      comment,
      path: 'strategy.keys_secondary.keys',
      from: cloneDeep(orig.strategy?.keys_secondary?.keys || []),
      to: cloneDeep(curr.strategy.keys_secondary.keys),
    });
  }

  // 5. 检查插入位置相关
  if (orig.position?.type !== curr.position.type) {
    changes.push({ uid, comment, path: 'position.type', from: orig.position?.type, to: curr.position.type });
  }
  if (orig.position?.order !== curr.position.order) {
    changes.push({ uid, comment, path: 'position.order', from: orig.position?.order, to: curr.position.order });
  }
  if (orig.position?.role !== curr.position.role) {
    changes.push({ uid, comment, path: 'position.role', from: orig.position?.role, to: curr.position.role });
  }
  if (orig.position?.depth !== curr.position.depth) {
    changes.push({ uid, comment, path: 'position.depth', from: orig.position?.depth, to: curr.position.depth });
  }

  // 6. 检查概率
  if (orig.probability !== curr.probability) {
    changes.push({ uid, comment, path: 'probability', from: orig.probability, to: curr.probability });
  }

  // 7. 检查递归选项
  if (orig.recursion?.prevent_incoming !== curr.recursion.prevent_incoming) {
    changes.push({
      uid,
      comment,
      path: 'recursion.prevent_incoming',
      from: !!orig.recursion?.prevent_incoming,
      to: curr.recursion.prevent_incoming,
    });
  }
  if (orig.recursion?.prevent_outgoing !== curr.recursion.prevent_outgoing) {
    changes.push({
      uid,
      comment,
      path: 'recursion.prevent_outgoing',
      from: !!orig.recursion?.prevent_outgoing,
      to: curr.recursion.prevent_outgoing,
    });
  }
  if (orig.recursion?.delay_until !== curr.recursion.delay_until) {
    changes.push({
      uid,
      comment,
      path: 'recursion.delay_until',
      from: orig.recursion?.delay_until,
      to: curr.recursion.delay_until,
    });
  }

  // 8. 检查内容 (Content)
  if (orig.content !== curr.content) {
    changes.push({ uid, comment, path: 'content', from: orig.content, to: curr.content });
  }

  // 如果没有变化，直接取消
  if (changes.length === 0) {
    emit('cancel');
    return;
  }

  emit('save', changes, curr);
};
</script>

<style scoped>
/* 旧的样式已全部移除，使用 Tailwind 原子类 */
</style>
