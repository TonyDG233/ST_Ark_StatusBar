# WorldbookTab.vue 重构与样式优化规划

## 问题背景
当前 `WorldbookTab.vue` 的代码行数已接近 1000 行。
其中混杂了：
1. 全局状态栏（搜索、全局批量操作）。
2. 单本世界书的外壳展示、展开与折叠。
3. 世界书内部的条目搜索、过滤与分页计算。
4. 单条条目的详情展示、内联编辑、各类单独操作开关。
5. 所有的 API 增删改查交互与生成 `ArkCommit` 历史记录的冗长逻辑。
此外，批量模式开启时，复选框与操作按钮的插入导致原本排版拥挤错乱，按钮样式突兀缺乏美感。

## 重构目标：纵向拆解 UI + 横向抽离 Logic

### 一、 逻辑层抽离 (Logic Separation)
新建 `src/ARK_STATUSBAR/components/global_tabs/worldbook/useWorldbookActions.ts`：
将原本写在 `WorldbookTab.vue` 的超过 300 行关于“创建世界书/条目”、“删除世界书/条目”、“批量切换开关、蓝绿灯”、“批量挂载”等含有业务副作用的函数，以及构造 `ArkCommit` 的逻辑全部抽离为 Vue Composable。
各组件只需调用 `const actions = useWorldbookActions()` 即可触发行为，以此保证视图组件纯净。

### 二、 UI 组件拆分 (Component Breakdown)
将现有的巨型组件拆分为 4 个颗粒度清晰的子组件：

1. **`WorldbookTab.vue` (主容器)**
   - 负责全局状态栏（顶部搜索、新建/批量世界书按钮、全局批量动作栏）。
   - 读取 `filteredWorldbooks` 计算属性。
   - `v-for` 渲染 `<WorldbookItem>` 组件。

2. **`WorldbookItem.vue` (单本世界书外壳)**
   - 接收 `wb` 对象作为 Props。
   - 渲染自己的 Header（置顶、挂载、删除按钮、复选框、类型角标）。
   - 管理自身的展开/折叠状态。
   - 展开时，渲染内嵌的 `<WorldbookEntryList>` 组件。

3. **`WorldbookEntryList.vue` (条目过滤与列表容器)**
   - 接收 `wbName` 作为 Props。
   - 管理当前世界书内的条目搜索文本、分类筛选、分页 `displayLimits`。
   - 渲染内部工具栏（新建条目、批量管理条目按钮，及批量操作悬浮栏）。
   - 计算得出分页后的 `visibleEntries` 列表。
   - `v-for` 渲染 `<WorldbookEntryItem>` 组件。

4. **`WorldbookEntryItem.vue` (单条条目渲染)**
   - 接收 `entry` 对象作为 Props。
   - 渲染条目标题、触发词，以及该行的独立操作组（编辑、置顶、常驻条件切换、开关、删除）。
   - 控制自身 `<WorldbookEntryEditor>` 面板的挂载与通信。

### 三、 样式优化 (Styling Polishing)
- **批量动作条改造**：将 `batch-toolbar` 修改为带圆角背景框的“操作岛（Action Island）”，按钮赋予带有 `gap` 的 `flex` 排版，统一使用 `pill` 样式的胶囊外观或纯图标。
- **列表对齐**：使用稳定的 `grid` 或 `flex: 1` 占位，防止复选框出现时文字内容发生偏移。
- **按钮一致性**：收敛各类 `icon-btn` 的内外边距，确保触控和点击热区合理且不对齐感。

## 实施步骤
1. 创建 `useWorldbookActions.ts` 并移植逻辑。
2. 创建 `WorldbookEntryItem.vue` 并梳理它的单行样式与编辑器通信。
3. 创建 `WorldbookEntryList.vue` 并接管复杂的过滤与分页。
4. 创建 `WorldbookItem.vue` 梳理外壳逻辑。
5. 重写精简后的 `WorldbookTab.vue` 主文件。
6. 统一调整子组件中关于“批量操作动作栏”的 CSS，修复挤压问题。