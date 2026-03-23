# 开发计划与架构调整 (03_refactor_and_storage_plan.md)

## 1. 核心需求解析与应对策略

### 1.1 全局存储方案迁移 (从世界书到 `extensionSettings`)
*   **痛点**：当前全局配置（含 UI 状态、拦截器开关、提交历史）被序列化存入了世界书的 `[SYS_CONFIG]` 隐藏条目。这种做法会占用世界书名额，容易被用户误删，且读写效率低下。
*   **解决方案**：
    *   利用 PoC 中验证过的 `SillyTavern.extensionSettings` 机制。
    *   在 `StatusBarManager` 中，将 `loadOrInitConfig` 改写为直接读取 `SillyTavern.extensionSettings['ark_statusbar_settings']`。
    *   将 `saveConfig` 改为使用原生的 `SillyTavern.saveSettingsDebounced()`。
    *   **平滑迁移**：第一次读取时，如果发现 `extensionSettings` 为空，则去原世界书扫描 `[SYS_CONFIG]`，如果有旧数据则读取并将其无缝迁移到新的存储空间中，并关闭/清理旧的世界书条目。

### 1.2 支持跨世界书检测绿色条目与溯源
*   **痛点**：拦截器代码写死了 `raw.filter((e: any) => e.world === targetWb)`，只预警当前主世界书内的条目。且用户无法得知触发的条目到底来自哪个附加世界书。
*   **解决方案**：
    *   移除 `e.world === targetWb` 的强限制，允许拦截器捕获所有被触发的绿灯条目。
    *   **UI 升级 (Tab 1 预警)**：在拦截列表中展示触发条目时，下方用更小的字号明确标注其所属的 `world` 名称，方便溯源。
    *   **UI 升级 (Tab 2 管理)**：彻底重构“全部条目”页签的 UI 逻辑为**抽屉式 (Accordion/Drawer) 结构**。最顶层置顶展示“当前角色绑定的世界书”与“被用户标记(置顶)的世界书”。点击展开某个世界书后，才会显示原先的条目列表。此页面也将支持世界书的挂载/卸载管理。

### 1.3 世界书初始状态 (快照) 持久化与管理面板
*   **痛点**：目前的基准线 `BASELINE_STATE` 是硬编码在代码中的，用户无法为其他的世界书保存一个“干净的初始状态”用于日后还原。同时 UI 上的全局操作按钮占用了过多展示空间。
*   **解决方案**：
    *   在 `ArkConfig` 中新增字段：`worldbookInitialStates: Record<string, Record<string, { enabled: boolean, type: string }>>`。
    *   在 `WorldbookManager` 中增加 `saveCurrentAsInitialState(worldbookName)` 方法，允许用户一键拍摄当前世界书的状态快照，作为未来的“还原点”。
    *   修改原有的 `resetToBaseline` 和状态判定逻辑：优先读取新机制保存的快照，若没有则回退使用代码里的 `BASELINE_STATE`。
    *   **UI 整合 (Tab 3 记录与管理)**：由于快照逻辑需要 UI 支撑，且 Tab 2 的世界书层级已经被重构，将原 Tab 2 顶部的“恢复初始状态”与“关闭单字干员”两个重量级按钮，连同新的“保存/恢复快照”管理功能，统一迁移至 Tab 3（将其重命名为 `记录与管理`），设立专属的“环境操作专区”。

### 1.4 Vue 组件拆分与全局样式收缩 (突破行数限制与移动端适配)
*   **痛点**：算上 `template` 和巨量的 `style scoped`，`GlobalStatusBar.vue` 达到 1707 行，`StartupNavigator.vue` 达到 866 行，违背模块化防线。且当前的全局 UI 文本字体远大于聊天文本，浪费空间且在移动端显得过于臃肿。
*   **解决方案**：
    *   **提取与收缩全局公共样式**：创建 `src/ARK_STATUSBAR/components/styles/theme.css` (或 .scss)。除了抽离颜色变量和通用组件类，**必须将 UI 的整体默认字体大小进一步缩小**（与聊天文本保持一致或更小一圈），以提高信息密度，完美适配移动端。
    *   **拆分 `GlobalStatusBar.vue`**：将庞大的四个 Tab 拆分为独立组件存放在 `src/ARK_STATUSBAR/components/tabs/` 目录下（如 `InterceptorTab.vue`, `WorldbookManagerTab.vue`, `HistoryAndManageTab.vue`, `SettingsTab.vue`）。主文件仅作为容器负责拖拽和状态派发。
    *   **拆分 `StartupNavigator.vue`**：将其右侧滑出的“设置面板”抽离为独立的 `StartupSettingsPanel.vue`。

## 2. 实施步骤与防线确认 (红绿灯协议)
1.  **第一步 (基础层)**：编写 `poc_settings.js` 验证 `SillyTavern.extensionSettings` 存取机制。
2.  **第二步 (重构层)**：新建 `components/styles/theme.css`，提取两者的公共样式并统一主题变量。
3.  **第三步 (拆分层)**：创建 `tabs` 目录，将 `GlobalStatusBar.vue` 和 `StartupNavigator.vue` 按照规划拆分出子组件。确保通信无误。
4.  **第四步 (业务逻辑)**：修改 `statusbar_manager.ts` 和 `worldbook_manager.ts`，完成存储引擎迁移和多世界书检测放开。
5.  **第五步 (UI 迭代)**：在拆分后的 `WorldbookManagerTab.vue` 和 `InterceptorTab.vue` 中实装“跨世界书溯源”、“多世界书管理挂载”以及“保存初始快照”等新特性。

>> 等待您的绿灯确认。如果您同意此规划，请下发绿灯指令，我将开始从第一步执行。