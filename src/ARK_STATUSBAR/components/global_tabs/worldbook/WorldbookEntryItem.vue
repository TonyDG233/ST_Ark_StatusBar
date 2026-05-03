<template>
  <div class="wb-item" :class="{ 'disabled-entry': !entry.enabled }">
    <div class="wb-info">
      <!-- Checkbox for batch mode -->
      <label v-if="isBatchMode" class="batch-checkbox-container">
        <input type="checkbox" :value="entry.uid" v-model="isSelected" />
      </label>

      <!-- Entry Basic Info -->
      <div class="wb-info-text">
        <div class="wb-name">
          <span v-if="entry._isPinned" class="pin-icon">📌</span>
          {{ entry.name || (entry.strategy?.keys ? entry.strategy.keys[0] : '未知') }}
        </div>
        <div class="wb-keys" v-if="entry.strategy?.keys && entry.strategy.keys.length">
          触发词: {{ entry.strategy.keys.join(', ') }}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="wb-action">
      <button class="icon-btn tiny" @click="toggleEdit" title="编辑完整属性">✏️</button>
      <button
        class="icon-btn tiny pin-btn"
        @click="togglePin"
        :title="entry._isPinned ? '取消置顶' : '偏好置顶'"
        :class="{ pinned: entry._isPinned }"
      >
        {{ entry._isPinned ? '📌' : '📍' }}
      </button>
      <button
        class="icon-btn tiny"
        @click="toggleType"
        :title="entry._computedType === 'constant' ? '当前：蓝灯(常驻)，点击切换' : '当前：绿灯(条件)，点击切换'"
      >
        {{ entry._computedType === 'constant' ? '🔵' : '🟢' }}
      </button>
      <label class="switch" title="开启/关闭">
        <input type="checkbox" :checked="entry.enabled" @change="toggleEnabled" />
        <span class="slider round"></span>
      </label>
      <button class="icon-btn tiny" style="color: #ff6b6b" @click="deleteEntry" title="删除条目">🗑️</button>
    </div>
  </div>

  <!-- 内联展开的完整编辑器 -->
  <WorldbookEntryEditor v-if="isEditing" :entry="entry" @save="onSave" @cancel="isEditing = false" />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { UIWorldbookEntry } from '../../../store/ui_state_store';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryEditor from './WorldbookEntryEditor.vue';

const props = defineProps<{
  entry: UIWorldbookEntry;
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

const toggleEdit = () => {
  isEditing.value = !isEditing.value;
};

const togglePin = () => {
  actions.togglePinEntry(props.entry.uid);
};

const toggleType = () => {
  actions.toggleEntryType(props.entry, props.wbName);
};

const toggleEnabled = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  // Create a localized clone so UI can preemptively update, although underlying state is shared
  const localEntry = { ...props.entry, enabled: checked };
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
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';
@import './worldbook_shared.scss';
</style>
