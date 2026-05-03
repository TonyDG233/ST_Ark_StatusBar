<template>
  <div class="wb-editor-panel">
    <div class="editor-header">
      <h4>编辑条目: {{ localEntry.name }}</h4>
      <button class="icon-btn tiny close-btn" @click="$emit('cancel')" title="取消编辑">✖</button>
    </div>

    <div class="editor-body">
      <!-- 1. 基本信息 (标题, 蓝绿灯) -->
      <div class="form-group row">
        <div class="form-item flex-2">
          <label>标题/备注 (Title)</label>
          <input type="text" v-model="localEntry.name" class="editor-input" />
        </div>
        <div class="form-item flex-1">
          <label>触发类型 (Type)</label>
          <select v-model="localEntry.strategy.type" class="editor-select">
            <option value="selective">条件 (🟢 绿灯)</option>
            <option value="constant">常驻 (🔵 蓝灯)</option>
          </select>
        </div>
      </div>

      <!-- 2. 绿灯专属：关键词与逻辑 -->
      <div class="form-group" v-if="localEntry.strategy.type === 'selective'">
        <label>主关键词 (逗号分隔)</label>
        <input
          type="text"
          :value="joinKeys(localEntry.strategy.keys)"
          @input="updateKeys($event, 'keys')"
          class="editor-input"
          placeholder="例如: 阿米娅, 罗德岛"
        />

        <div class="row" style="margin-top: 8px">
          <div class="form-item flex-1">
            <label>可选逻辑 (Logic)</label>
            <select v-model="localEntry.strategy.keys_secondary.logic" class="editor-select">
              <option value="and_any">与任意 (AND ANY)</option>
              <option value="and_all">与所有 (AND ALL)</option>
              <option value="not_any">非任意 (NOT ANY)</option>
              <option value="not_all">非所有 (NOT ALL)</option>
            </select>
          </div>
          <div class="form-item flex-2">
            <label>可选过滤器/次要关键词 (逗号分隔)</label>
            <input
              type="text"
              :value="joinKeys(localEntry.strategy.keys_secondary.keys)"
              @input="updateKeys($event, 'keys_secondary')"
              class="editor-input"
              placeholder="需要结合可选逻辑生效..."
            />
          </div>
        </div>
      </div>

      <!-- 3. 插入位置与顺序 -->
      <div class="form-group row">
        <div class="form-item flex-1">
          <label>插入位置 (Position)</label>
          <select v-model="localEntry.position.type" class="editor-select">
            <option value="before_character_definition">角色定义前</option>
            <option value="after_character_definition">角色定义后</option>
            <option value="before_example_messages">示例消息前</option>
            <option value="after_example_messages">示例消息后</option>
            <option value="before_author_note">作者注释前</option>
            <option value="after_author_note">作者注释后</option>
            <option value="at_depth">指定深度 (@ Depth)</option>
          </select>
        </div>
        <div class="form-item flex-1">
          <label>顺序 (Order)</label>
          <input type="number" v-model.number="localEntry.position.order" class="editor-input" />
        </div>
        <div class="form-item flex-1">
          <label>触发概率% (Prob)</label>
          <input type="number" v-model.number="localEntry.probability" min="0" max="100" class="editor-input" />
        </div>
      </div>

      <!-- 指定深度专属设置 -->
      <div class="form-group row" v-if="localEntry.position.type === 'at_depth'">
        <div class="form-item flex-1">
          <label>角色身份 (Role)</label>
          <select v-model="localEntry.position.role" class="editor-select">
            <option value="system">System</option>
            <option value="user">User</option>
            <option value="assistant">Assistant</option>
          </select>
        </div>
        <div class="form-item flex-1">
          <label>深度 (Depth)</label>
          <input type="number" v-model.number="localEntry.position.depth" min="0" class="editor-input" />
        </div>
      </div>

      <!-- 4. 递归与特殊选项 -->
      <div class="form-group check-group">
        <label class="check-label">
          <input type="checkbox" v-model="localEntry.recursion.prevent_incoming" />
          不可递归 (防止被其他激活)
        </label>
        <label class="check-label">
          <input type="checkbox" v-model="localEntry.recursion.prevent_outgoing" />
          防止进一步递归 (不激活其他)
        </label>
        <label class="check-label">
          <input type="checkbox" :checked="localEntry.recursion.delay_until !== null" @change="toggleDelayUntil" />
          延迟到递归
        </label>
      </div>

      <!-- 5. 正文内容 -->
      <div class="form-group">
        <label>内容 (Content)</label>
        <textarea v-model="localEntry.content" class="editor-textarea" rows="6"></textarea>
      </div>
    </div>

    <div class="editor-footer">
      <button class="btn-secondary" @click="$emit('cancel')">取消</button>
      <button class="btn-primary" @click="saveChanges">保存更改</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { cloneDeep, isEqual } from 'lodash';
import { onMounted, ref } from 'vue';
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
.wb-editor-panel {
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.15));
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.editor-header h4 {
  margin: 0;
  font-size: 1.05em;
  color: var(--SmartThemeBodyColor, #fff);
}

.close-btn {
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
}
.close-btn:hover {
  color: #ff6b6b;
}

.editor-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-group.row {
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flex-1 {
  flex: 1;
}
.flex-2 {
  flex: 2;
}

label {
  font-size: 0.85em;
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
}

.editor-input,
.editor-select {
  width: 100%;
  padding: 6px 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-size: 0.9em;
  outline: none;
  transition: border-color 0.2s;
}

.editor-input:focus,
.editor-select:focus {
  border-color: #1e90ff;
}

.editor-textarea {
  width: 100%;
  padding: 8px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  font-family: monospace;
  font-size: 0.9em;
  resize: vertical;
  outline: none;
}

.check-group {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 15px;
  padding: 6px 0;
}

.check-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85em;
  color: #ccc;
  cursor: pointer;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.btn-primary {
  background: #1e90ff;
  color: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}
.btn-primary:hover {
  background: #187bcd;
}

.btn-secondary {
  background: transparent;
  color: #ccc;
  border: 1px solid #555;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
