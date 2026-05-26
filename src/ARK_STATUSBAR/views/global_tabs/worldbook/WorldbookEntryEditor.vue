<template>
  <LoreEntryEditor v-model="localEntry" :tokenCount="tokenCount" @save="saveChanges" @cancel="$emit('cancel')" />
</template>

<script setup lang="ts">
import { cloneDeep, isEqual } from 'lodash';
import { onMounted, ref, watch } from 'vue';
import LoreEntryEditor from '../../../components/worldbook/LoreEntryEditor.vue';
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
watch(
  () => localEntry.value.content,
  async newVal => {
    if (newVal && typeof SillyTavern !== 'undefined' && SillyTavern.getTokenCountAsync) {
      try {
        tokenCount.value = await SillyTavern.getTokenCountAsync(newVal);
      } catch (e) {
        tokenCount.value = null;
      }
    } else {
      tokenCount.value = null;
    }
  },
  { immediate: true },
);

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
