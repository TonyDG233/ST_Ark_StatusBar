# 重构安全执行步骤图谱 (04_refactor_execution_steps.md)

## 核心反思与防线提示 (给接手的 Agent)

**历史教训：** 前一次重构尝试失败，原因是**步子迈得太大，一次性修改了过多逻辑和 UI 文件，导致 Vue 响应式断链、CSS 作用域泄露（字体变为巨大的宋体），且业务逻辑存在疏漏**。
为了确保本次重构的绝对安全，**严禁一次性完成整个 03 规划**。必须严格按照以下微小步骤（Micro-Steps）逐个执行。每一个 Step 完成后，必须经过联调测试，确保无视觉回归（Visual Regression）和响应式断层（Reactivity Break），方可进入下一步。

**⚠️ 全局日志规范 (Global Logging Rule)：**
在整个重构和后续剧情模块的开发过程中，必须对所有 `console.log/info/warn/error` 进行**标头与语言的统一化**：
1. **统一中文**：日志内容必须全部统一为中文，方便查阅。
2. **模块标头**：必须使用 `[ARK_模块名]` 作为日志前缀，例如：`[ARK_StatusBar]`（状态栏逻辑）, `[ARK_Worldbook]`（世界书管理）, `[ARK_UI]`（前端界面渲染）等，严禁随意乱起八糟的输出。

---

## 执行步骤拆解 (共 7 步)

### 🐾 Step 0: 清理 1 月份旧重构代码与备份 (已完成)
**目标文件：**
- `src/ARK_STATUSBAR/logic/updaters/` (已移至 `references/2025_jan_failed_backup/`)
- `src/ARK_STATUSBAR/mvu/` (已移至 `references/2025_jan_failed_backup/`)
- `src/ARK_STATUSBAR/prompts/` (已移至 `references/2025_jan_failed_backup/`，并重建空目录)
- `src/ARK_STATUSBAR/index.ts` (已移除旧的 `initializeBackendLogic` 挂载逻辑)

**核心动作：**
1. 将1月份开发失败的残留目录备份至 `references`。
2. 保留空的 `prompts/` 目录以备后续剧情模块使用。
3. 清理主入口文件。

---

### 🐾 Step 1: 拆分系统配置 (解耦 statusbar_manager.ts)
**目标文件：**
- 新建 `src/ARK_STATUSBAR/config/system_config.ts`
- 修改 `src/ARK_STATUSBAR/logic/statusbar_manager.ts`

**核心动作：**
1. 将 `statusbar_manager.ts` 中超过百行的配置接口定义（`ArkConfig`, `ArkCommit`, `DEFAULT_CONFIG` 等常量）完整抽离至 `system_config.ts`。
2. 这样做的目的是缓解 `statusbar_manager.ts` 文件过长（目前700多行）的压力，为接下来的存储逻辑修改铺平道路。

**验收标准：** 联调编译通过，拆分后运行无报错。

---

### 🐾 Step 2: 存储引擎平滑迁移 (纯后端逻辑)
**目标文件：** 
- `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- `src/ARK_STATUSBAR/logic/worldbook_manager.ts`

**核心动作：**
1. 扩展 `ArkConfig` 接口，增加 `worldbookInitialStates` 字段（用于保存快照）。
2. 重写 `StatusBarManager.loadOrInitConfig()`：
   - 优先读取 `SillyTavern.extensionSettings['ark_statusbar_settings']`。
   - **平滑迁移机制：** 如果 `extensionSettings` 为空，去旧的世界书 `[SYS_CONFIG]` 查找。如果找到，则读取旧配置并覆盖保存到 `extensionSettings`，然后**关闭并清空**旧的世界书条目。
3. 重写 `StatusBarManager.saveConfig()`，改用 `SillyTavern.saveSettingsDebounced()`。
4. 在 `WorldbookManager` 中新增 `saveCurrentAsInitialState(worldbookName)` 方法，将当前状态保存到 `ArkConfig.worldbookInitialStates` 中。修改 `resetToBaseline` 优先读取此快照。

**验收标准：** UI 不做任何修改。重启酒馆，验证旧配置被成功迁移，且新配置正确保存在后端的 `settings.json` 中。

---

### 🐾 Step 3: 跨世界书检测放开 (逻辑 + 微量 UI)
**目标文件：**
- `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`

**核心动作：**
1. 修改 `getWorldInfoPrompt` 拦截器中的 `raw.filter(e => e.world === targetWb)`，移除该限制，捕获所有 `world` 的条目。
2. 扩展抛出给 UI 的警告数据结构，包含 `sourceWorld` 字段。
3. 在 `GlobalStatusBar.vue` 的 Tab 1 (拦截列表) 中，为每个渲染的绿灯条目下方增加一个小字号的来源世界书标识。

**验收标准：** 触发附加世界书的条目时，状态栏能够正确拦截，并在列表中显示来源。

---

### 🐾 Step 4: 提取全局公共样式与字体防线 (防止宋体灾难)
**目标文件：**
- 新建 `src/ARK_STATUSBAR/components/styles/theme.scss`
- `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
- `src/ARK_STATUSBAR/components/StartupNavigator.vue`

**核心动作：**
1. 在 `theme.scss` 中定义全局 CSS 变量（颜色、间距）。
2. **字体防线：** 明确设定 `.ark-statusbar-root` 和 `.ark-startup-root` 的 `font-family`（如 `sans-serif` 或继承宿主），以及 `font-size: 14px`（或更小，适配移动端）。**绝不可丢失字体定义。**
3. 将两者的通用按钮样式（如 `btn-primary`, `btn-danger`）抽离。
4. 在 Vue 文件中引入 `theme.scss`，并清理冗余的 `<style scoped>`。

**验收标准：** 视觉自查，界面必须保持原样，字体大小适中，**绝对不能变成巨大的宋体**。

---

### 🐾 Step 5: 拆分 StartupNavigator.vue
**目标文件：**
- `src/ARK_STATUSBAR/components/StartupNavigator.vue`
- 新建 `src/ARK_STATUSBAR/components/startup_tabs/StartupSettingsPanel.vue`

**核心动作：**
1. 将右侧滑出的设置面板 UI 抽离为 `StartupSettingsPanel.vue`。
2. **响应式防线：** 新组件必须通过 `defineProps<{ config: ArkConfig }>()` 接收状态，通过 `defineEmits<{ (e: 'update:config', val: Partial<ArkConfig>): void }>()` 修改状态。**严禁在子组件内直接调用 `StatusBarManager.getInstance().currentConfig` 破坏单向数据流。**

**验收标准：** 侧边栏可以正常滑出，点击设置项时，主界面的响应能够实时同步，且修改能被持久化。

---

### 🐾 Step 6: 拆分 GlobalStatusBar.vue 为容器
**目标文件：**
- `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
- 新建 `components/global_tabs/InterceptorTab.vue`
- 新建 `components/global_tabs/WorldbookManagerTab.vue`
- 新建 `components/global_tabs/HistoryAndManageTab.vue` (原 Tab 3，加入快照管理)
- 新建 `components/global_tabs/SettingsTab.vue`

**核心动作：**
1. 保持 `GlobalStatusBar.vue` 的拖拽、Tabs 切换逻辑和整体 `ArkConfig` 的响应式绑定。
2. 将每个 `<div v-if="activeTab === X">` 的内容原封不动地移动到对应的子组件中。
3. 使用 Props 和 Emits 传递状态与事件（如明确定义 `defineProps<{ config: ArkConfig, worldbookEntries: any[] }>()`）。

**验收标准：** 各个 Tab 切换流畅，修改任意 Tab 内的状态（如开启/关闭某个世界书条目，或修改设置），数据流能正常运作。

---

### 🐾 Step 7: 实现世界书抽屉 UI (Accordion) 及全局世界书挂载管理
**目标文件：**
- `src/ARK_STATUSBAR/logic/worldbook_manager.ts`
- `src/ARK_STATUSBAR/components/global_tabs/WorldbookManagerTab.vue`

**核心动作：**
1. **核心逻辑需求补充（绝不混淆概念）：** 严格区分“角色绑定”和“全局挂载”。在 `worldbook_manager.ts` 中新增获取世界书列表的方法，并提供**全局挂载（Global Mount）**和取消挂载的功能。这与修改角色本身绑定的世界书是两回事，必须调用酒馆环境中的全局/聊天级世界书挂载接口。
2. 彻底重构 UI，使用 `v-for="(entries, worldName) in groupedWorldbooks"` 渲染外层抽屉。
3. 实现折叠/展开动画。
4. **顶层世界书管理：** 显示当前已挂载和已绑定的世界书，并提供界面浏览所有未挂载的世界书，允许用户通过按钮直接进行**全局挂载（Global Mount）**和取消挂载。
5. 点击展开某个世界书后，显示其内部具体的 `[SYS_...]` 条目或其他普通条目，并允许开关条目状态。

**验收标准：** 用户能够在新界面中看到全局世界书列表，并能正确执行全局挂载/取消挂载世界书的操作，跨世界书管理界面清晰易用，不显得拥挤。

---
>> **To Next Agent**: 请在接手任务时，严格按照此文档的 Step 1 至 Step 6 顺序逐项执行。**每一次只执行一个 Step，并请求 User 的审查。**