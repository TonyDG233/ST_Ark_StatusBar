<template>
  <LoreDataCard 
    :entry="transformedEntry"
    :batchMode="isBatchMode"
    :selected="isSelected"
    @toggle-select="isSelected = !isSelected"
    @toggle-type="toggleType"
    @toggle-state="toggleEnabled"
    @toggle-pin="togglePin"
    @edit="toggleEdit"
    @delete="deleteEntry"
  />

  <!-- 内联展开的完整编辑器 -->
  <WorldbookEntryEditor v-if="isEditing" :entry="entry" :wbName="wbName" @save="onSave" @cancel="isEditing = false" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import LoreDataCard, { LoreEntryData } from '../../../components/worldbook/LoreDataCard.vue';
import { UIWorldbookEntry } from '../../../store/ui_state_store';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryEditor from './WorldbookEntryEditor.vue';

const props = defineProps<{
  entry: UIWorldbookEntry & { _isPinned?: boolean; _computedType?: string };
  wbName: string;
  isBatchMode: boolean;
  selectedEntries: number[];
}>();

const emit = defineEmits<{
  (e: 'update:selectedEntries', v: number[]): void;
}>();

const actions = useWorldbookActions();
const isEditing = ref(false);

const isSelected = computed({
  get: () => props.selectedEntries.includes(props.entry.uid),
  set: val => {
    let newList = [...props.selectedEntries];
    if (val) newList.push(props.entry.uid);
    else newList = newList.filter(u => u !== props.entry.uid);
    emit('update:selectedEntries', newList);
  },
});

const transformedEntry = computed<LoreEntryData>(() => ({
  uid: props.entry.uid,
  name: String(props.entry.name || (props.entry.strategy?.keys ? props.entry.strategy.keys[0] : '未知')),
  keys: (props.entry.strategy?.keys || []).map(String),
  type: (props.entry._computedType as 'constant' | 'selective') || 'selective',
  enabled: props.entry.enabled,
  isPinned: props.entry._isPinned || false
}));

const toggleEdit = () => {
  isEditing.value = !isEditing.value;
};

const togglePin = () => {
  actions.togglePinEntry(props.entry.uid);
};

const toggleType = () => {
  actions.toggleEntryType(props.entry, props.wbName);
};

const toggleEnabled = () => {
  const localEntry = { ...props.entry, enabled: !props.entry.enabled };
  actions.toggleEntryEnabled(localEntry, props.wbName);
};

const deleteEntry = () => {
  actions.deleteEntryUI(props.entry, props.wbName);
};

const onSave = (changes: any[], newEntry: UIWorldbookEntry) => {
  actions.handleSaveEntry(changes, newEntry, props.wbName);
  isEditing.value = false;
};
</script>

<style scoped>
/* 移除旧样式 */
</style>
