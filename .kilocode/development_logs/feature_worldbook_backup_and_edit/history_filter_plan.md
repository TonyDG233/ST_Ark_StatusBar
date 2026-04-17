# 历史记录属性筛选功能规划 (History Filter Plan)

## 背景
当前 `CommitHistoryPanel.vue` 中按时间倒序显示了所有的历史提交记录（Commits）。随着我们在之前实现了包括内容修改、开关切换、增删条目、甚至批量操作等越来越多的追踪后，历史记录的列表将变得非常冗长且难以寻找特定类型的修改。
用户希望能够通过“属性筛选”的方式，直接挑选出特定属性（如：仅显示触发了“状态开关”的记录，或者仅显示“内容修改”的记录）。

## 分析
1. **现有结构**：
   `CommitHistoryPanel.vue` 直接遍历 `currentConfig?.commits`。
   每个 `commit` 拥有一个 `changes` 数组。每个 `change` 包含 `path` 属性。
   *注意*：历史遗留问题中，单纯的开启/关闭操作（`toggleEnabled`）没有提供 `path`，但在后续重构或我们判断中，如果 `path` 不存在，它实际上代表的是 `enabled`。
2. **筛选策略**：
   - 使用 Vue 的 `computed` 动态扫描并收集现有 `commits` 中出现过的所有 `path` 类型。
   - 过滤时，根据用户选择的 `selectedFilter` (如 `strategy.type`)，去只保留那些 `changes` 中包含该 `path` 的 commit。

## 实施计划

### 1. 提取可用的筛选标签 (Dynamic Filter Extraction)
我们将编写一个 computed 属性 `availableFilters`，用于扫描当前所有的 commits，提取出所有不同的修改路径，并将其翻译为人类可读的标签。
```typescript
const pathLabels: Record<string, string> = {
  'enabled': '状态开关 (Enabled)',
  'strategy.type': '触发类型 (Type)',
  'name': '条目名称 (Name)',
  'content': '条目内容 (Content)',
  'create_entry': '新建条目',
  'delete_entry': '删除条目',
  'create_worldbook': '新建世界书',
  'delete_worldbook': '删除世界书',
  // ...其它未来可能加入的属性
};
```
在提取时，顺便计算每个路径出现的次数，并按次数排序，方便用户选择。

### 2. 构建过滤后的视图数据 (Filtered View Data)
新增一个状态 `selectedFilter` 默认值为 `'all'`。
重构现有的 `v-for="commit in [...(currentConfig?.commits || [])].reverse()"`。
改为使用新的 `filteredCommits` 属性：
```typescript
const filteredCommits = computed(() => {
  const commits = [...(currentConfig.value?.commits || [])].reverse();
  if (selectedFilter.value === 'all') return commits;
  
  return commits.filter(commit => {
    return commit.changes.some(change => {
      const path = (change.path as string) || 'enabled';
      return path === selectedFilter.value;
    });
  });
});
```

### 3. UI 界面的修改 (UI Modifications)
在“操作历史记录”的标题下方，紧跟着插入一个筛选条 `filter-bar`：
```html
<div class="filter-bar" style="display: flex; gap: 10px; align-items: center; margin-bottom: 15px; padding: 5px; background: rgba(0,0,0,0.1); border-radius: 4px;">
  <label style="font-size: 0.9em; opacity: 0.8;">🔍 属性筛选：</label>
  <select v-model="selectedFilter" style="background: var(--SmartThemeChatBackgroundColor); color: var(--SmartThemeBodyColor); border: 1px solid var(--SmartThemeBorderColor); border-radius: 4px; padding: 4px;">
    <option value="all">显示全部 ({{ currentConfig?.commits?.length || 0 }})</option>
    <option v-for="filter in availableFilters" :key="filter.value" :value="filter.value">
      {{ filter.label }} ({{ filter.count }})
    </option>
  </select>
</div>
```
这样不仅支持单属性查找，而且随着未来世界书的修改属性不断扩充，这套动态扫描的方案可以完全免维护自适应。

### 4. 边界处理
如果使用批量选中（`isBatchMode`），我们需要确保选中的和批量操作的是基于过滤后的视图还是全局视图。考虑到安全和直觉，在 `filteredCommits` 视角下点击“全选”，应当**只全选当前筛选出来的 commit**，而不是全部。这需要略微调整一下 `toggleSelectAll` 的逻辑：
```typescript
const toggleSelectAll = (e: Event) => {
  const checked = (e.target as HTMLInputElement).checked;
  if (checked) {
    selectedCommits.value = filteredCommits.value.map(c => c.id);
  } else {
    selectedCommits.value = [];
  }
};
```
同时，切换筛选器时，清空当前已勾选的项目以防冲突。

---

如果觉得上述规划符合预期，我们将在下一阶段直接针对 `CommitHistoryPanel.vue` 进行重构。