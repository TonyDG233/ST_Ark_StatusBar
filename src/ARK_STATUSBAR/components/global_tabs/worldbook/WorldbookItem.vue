<template>
  <div class="wb-accordion-item">
    <div class="wb-accordion-header" @click="!isGlobalBatchMode && toggleAccordion()">
      <div class="wb-accordion-title">
        <input v-if="isGlobalBatchMode" type="checkbox" :value="wb.name" v-model="isSelected" @click.stop />
        <span v-if="wb.isPinned" class="pin-icon">📌</span>
        <span class="wb-type-badge" :class="wb.type">
          {{ wb.type === 'char' ? '角色绑定' : wb.type === 'global' ? '已挂载' : '未挂载' }}
        </span>
        <span class="wb-name-text">{{ wb.name }}</span>
      </div>
      <div class="wb-accordion-actions">
        <button
          class="icon-btn tiny pin-btn"
          @click.stop="toggleWorldbookPin"
          :title="wb.isPinned ? '取消置顶' : '置顶世界书'"
          :class="{ pinned: wb.isPinned }"
        >
          {{ wb.isPinned ? '📌' : '📍' }}
        </button>
        <button
          v-if="wb.type !== 'char'"
          class="icon-btn tiny"
          @click.stop="toggleGlobalMountUI"
          :title="wb.type === 'global' ? '卸载' : '挂载'"
        >
          {{ wb.type === 'global' ? '⛓️' : '🔗' }}
        </button>
        <button class="icon-btn tiny" style="color: #ff6b6b" @click.stop="deleteWorldbookUI" title="删除世界书">
          🗑️
        </button>
        <span class="accordion-arrow" v-if="!isGlobalBatchMode">{{ isExpanded ? '▼' : '▶' }}</span>
      </div>
    </div>

    <WorldbookEntryList v-if="isExpanded" :wbName="wb.name" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  CONFIG_ENTRY_PREFIX,
  expandedWorldbooks,
  isLoadingWb,
  UIWorldbookEntry,
  worldbookEntriesCache,
} from '../shared_ui_state';
import { useWorldbookActions } from './useWorldbookActions';
import WorldbookEntryList from './WorldbookEntryList.vue';

const props = defineProps<{
  wb: { name: string; type: string; isPinned: boolean };
  isGlobalBatchMode: boolean;
  selectedWorldbooks: string[];
}>();

const emit = defineEmits<{
  (e: 'update:selectedWorldbooks', v: string[]): void;
}>();

const actions = useWorldbookActions();

const isSelected = computed({
  get: () => props.selectedWorldbooks.includes(props.wb.name),
  set: val => {
    let newList = [...props.selectedWorldbooks];
    if (val) newList.push(props.wb.name);
    else newList = newList.filter(u => u !== props.wb.name);
    emit('update:selectedWorldbooks', newList);
  },
});

const isExpanded = computed(() => expandedWorldbooks.value.includes(props.wb.name));

const toggleAccordion = async () => {
  const idx = expandedWorldbooks.value.indexOf(props.wb.name);
  if (idx > -1) {
    expandedWorldbooks.value.splice(idx, 1);
  } else {
    expandedWorldbooks.value = [props.wb.name];

    if (!worldbookEntriesCache.value[props.wb.name]) {
      isLoadingWb.value = props.wb.name;
      try {
        const entries = (await getWorldbook(props.wb.name)) as unknown as UIWorldbookEntry[];
        worldbookEntriesCache.value[props.wb.name] = entries.filter(
          (e: UIWorldbookEntry) => !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)),
        );
      } catch (e) {
        console.error(`[ARK_UI] 无法加载世界书 ${props.wb.name}`, e);
        worldbookEntriesCache.value[props.wb.name] = [];
      } finally {
        isLoadingWb.value = null;
      }
    }
  }
};

const toggleWorldbookPin = () => {
  actions.toggleWorldbookPin(props.wb.name);
};

const toggleGlobalMountUI = () => {
  actions.toggleGlobalMount(props.wb.name, props.wb.type !== 'global');
};

const deleteWorldbookUI = () => {
  actions.deleteWorldbookUI(props.wb.name);
};
</script>

<style scoped>
@import '../../styles/theme.scss';
@import '../../styles/shared_ui.scss';
@import './worldbook_shared.scss';
</style>
