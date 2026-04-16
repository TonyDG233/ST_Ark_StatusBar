# 世界书与条目：批量操作与新建删除功能规划

## 核心目标
完善世界书管理器的功能，支持独立的新建/删除世界书和条目，并引入高效的批量管理操作。同时，确保这些修改（尤其是新建和删除）能够被无缝纳入历史记录与回滚机制（Commit History）中。

## 阶段一：UI 结构重组与按钮布局优化
1. **清理当前冗余**：清理之前留下的调试 TODO。
2. **样式精简 (Symbol 化)**：
   - 将 `WorldbookTab.vue` 中原有的部分中文操作按钮替换为图标（如用 📌 代替“置顶”汉字，用 ➕ ➖ 🗑️ 代表其他操作），释放宽度空间。
   - 这不仅让界面更紧凑，也为后续加入的复选框（Checkbox）腾出视觉焦点。
3. **新增控制点**：
   - 顶部搜索栏旁边：增加 `[➕世界书]` 和 `[批量操作]` 图标。
   - 每本书的内部搜索栏旁边：增加 `[➕条目]` 和 `[批量操作]` 图标。

## 阶段二：底层支持与“新建/删除”基础功能
**难点**：需要将新建和删除纳入 `CommitHistoryPanel.vue` 的撤销恢复逻辑中。
1. **扩展 Commit 结构支持 (`system_config.ts`)**：
   - 定义特定的 `path` 标识。
   - 对于条目：`path: 'create_entry'` (from: null, to: 条目数据)；`path: 'delete_entry'` (from: 旧条目数据, to: null)。
   - 对于世界书：`path: 'create_worldbook'` (from: null)；`path: 'delete_worldbook'` (from: 整个世界书备份内容)。由于世界书维度没有确切的 uid，`changes[0].uid` 可以设为 -1。
2. **实现逆向回滚 (`CommitHistoryPanel.vue`)**：
   - 在 `applyInverseChanges` 中处理这些特殊 `path`：
     - 若 `path === 'create_entry'`，执行 `deleteWorldbookEntries`。
     - 若 `path === 'delete_entry'`，执行 `createWorldbookEntries` 恢复。
     - 若 `path === 'create_worldbook'`，执行 `deleteWorldbook`。
     - 若 `path === 'delete_worldbook'`，执行 `createWorldbook` 并将备份的条目恢复。
3. **UI 侧执行**：
   - 新建：弹窗或 JS `prompt` 输入名称，调用 API 并提交 commit。
   - 删除：加上浏览器自带的 `confirm()` 防误触机制。

## 阶段三：条目维度的批量操作
1. **状态控制**：在每个展开的世界书中，维护一个布尔值 `isBatchEntries`，和一个 `selectedEntryUids: number[]` 数组。
2. **批量工具栏**：
   - 当点击“批量操作”时，原本的单独操作按钮被隐藏，显示出每行的 Checkbox。
   - 搜索栏下方浮现悬浮动作栏，按钮采用紧凑图标堆叠或缩写排布：`[全选/取消全选] [统一置顶] [统一常驻/条件] [统一开启/关闭] [批量删除] [取消批量]`。
3. **提交与更新**：
   - 点击动作后，对所有选中的 UID 调用 `updateWorldbookWith` 或 `deleteWorldbookEntries`。
   - 将这批操作汇总为一个 `ArkCommit` 提交。

## 阶段四：世界书维度的批量操作
1. **状态控制**：维护全局 `isBatchWorldbooks` 状态和 `selectedWorldbooks: string[]`。
2. **批量工具栏**：
   - 在顶层出现悬浮或固定栏，提供功能：`[全选/取消全选] [统一挂载/卸载] [统一置顶/取消置顶] [批量删除]`。
3. **提交与更新**：
   - `toggleGlobalMount` 是酒馆 API。置顶是配置本地修改。删除则调用 `deleteWorldbook`。
   - 同样将状态封装入 `CommitHistory` 并触发全量刷新。
