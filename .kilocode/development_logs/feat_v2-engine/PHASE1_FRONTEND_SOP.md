# 阶段一：现代前端重构标准作业程序 (Phase 1 Frontend SOP)

这份文档抛弃了之前所有基于“盲目蛮干”和“大爆炸重构”的错误推导。我们重新出发，建立一套真正符合现代前端工程化、可拆解、可验证的安全开发管线。

---

## 〇、 先前开发失败的根本阻碍分析

在过去的三天里，导致项目频繁失控、开发者心力交瘁的核心阻碍有三个：

1. **缺乏隔离的测试环境（肉身踩雷）**
   - 过去，每次修改一个按钮的颜色，都必须打包丢进 SillyTavern（酒馆）的真实环境中看效果。这导致 UI 样式、宿主原生 CSS 污染、甚至后台拦截器的 Bug 混杂在一起，根本无法定位问题。
2. **“大爆炸式”的黑盒重构（违背组件化初衷）**
   - 企图在一个几百行的 `GlobalStatusBar.vue` 里同时完成：注入颜色、排版 HTML、对接 Pinia 真实数据、维持物理引擎。这种不分层级的“面条式”堆砌，一旦出错，就只能全盘回滚。
3. **环境上下文丢失（宿主依赖污染）**
   - 忽视了宿主环境的特殊性。例如强行引入 Tailwind 的 `preflight` 导致酒馆原生 UI 崩坏；或者忘记注入 `Material Symbols` 导致图标变成巨大文本撑爆布局。

---

## 一、 前端工程化流转工作流 (The Workflow)

*从原型设计到逐步实现的宏观方法论：*

1. **设计稿阅读与 Token 提取 (Design Reading)**
   - 绝不直接复制 HTML。只从 `DESIGN.md` 中提取核心的颜色值（Hex）、字体、边距，将其转化为系统的 CSS 原生变量（Design Tokens）。
2. **原子组件拆分 (Component Splitting)**
   - 剥离出没有任何业务逻辑的“笨蛋组件（Dumb Components）”，如 `<ArkButton>`、`<ArkPanel>`。它们只负责“长得好看”，只接受传入的 `props`。
3. **独立测试微调 (Local Sandbox Tuning)**
   - **绝不进酒馆测试**。在本地搭建的“UI 练兵场（Sandbox）”中，单独渲染这些原子组件，调整切角、边框、悬浮效果，直到 100% 完美。
4. **组合测试 (Combined Testing)**
   - 将原子组件像乐高一样拼装成**静态的页面骨架**（如 `DashboardTab.vue`）。此时只注入假数据（Mock Data），在沙盒中测试极端宽度拉伸（容器查询）是否会穿模。
5. **逐步替换测试 (Gradual Replacement Testing)**
   - 最后一步，才将完美无瑕的静态页面挂载到真实的 `GlobalStatusBar.vue` 壳子中，将假数据替换为真实的 Pinia 状态，放入酒馆环境进行最终的宿主融合测试。

---

## 二、 实际开发执行步骤 (The Development Steps)

*从搭建底层基建到实现顶层任务的实操步骤：*

### Step 1: 搭建本地测试环境 (UI 练兵场)
- **目标**：建立一个脱离酒馆的纯白板环境，实现修改代码 0.1 秒极速热更新预览。
- **操作**：新建 `src/sandbox/sandbox.html` 和入口脚本。在其中挂载一个空白的 Vue 实例。

### Step 2: 底层基建与样式变量防雷 (Infrastructure & Tokens)
- **目标**：安全注入双主题颜色，绝不污染全局。
- **操作**：修改 `theme.scss`，建立 `.dark-theme` (罗德岛) 和 `.light-theme` (终末地) 变量体系。

### Step 3: 基础 UI 积木库开发 (Base Components)
- **目标**：在沙盒中写好未来的通用扩展组件。
- **操作**：新建 `<ArkPanel>`, `<ArkProgressBar>`, `<ArkWipMask>`, `<ArkBottomNav>` 等。

### Step 4: 业务骨架组装 (View Assembly)
- **目标**：拼装主面板，隔离繁杂的 HTML。
- **操作**：新建 `DashboardTab.vue`，用假数据画出顶部系统状态、中部日志列表、底部快捷网格。

### Step 5: 顶层外壳缝合与数据连通 (Top-Level Integration)
- **目标**：完成 MVP 替换，对接真实物理引擎与数据。
- **操作**：修改 `GlobalStatusBar.vue`，保留 `useDraggablePhysics.ts`，用 `v-if` 挂载 `<DashboardTab />`。

---

## 三、 任务交接与当前进度 (Task Handover)

**当前进度 (截至 2026-05-07)**：
我们完成了 **Step 1 到 Step 3** 的基建与原子组件提取，但 **Step 4 (主页拼装与沙盒微调)** 尚未彻底完成！

**已完成的核心成果**：
1. `src/sandbox/`：本地练兵场已搭建完毕，运行 `npm run build` 后打开 `dist/sandbox/index.html` 即可独立预览组件。
2. `src/ARK_STATUSBAR/styles/`：`theme.scss` 已提取两套设计稿的颜色；`tailwind.scss` 已安全剥离 preflight。
3. `src/ARK_STATUSBAR/components/`：成功拆分出基础原子组件，并加上了可视化意图标签。

**尚未解决的遗留问题 (下任 AI 接手后首要任务)**：
*   **Step 4 的 UI 极限微调仍未达标**：在 `DashboardTab.vue` 中，元素溢出（文字截断挤压）和多余的滚动条嵌套问题**尚未彻底解决**。在极窄宽度下，排版依然会崩坏。必须在沙盒里对着 `DashboardTab.vue` 和 `ArkBottomNav.vue` 进行精准的 CSS 修复，彻底消灭不符合预期的横竖滚动条。

**未触发破坏的防线**：
绝对没有改动 `GlobalStatusBar.vue` 与入口文件，核心物理拖拽引擎依然完好无损地封存在旧代码中。

**下一任 AI 的执行指令 (Next Steps)**：
请先完成 **Step 4 的尾巴**，再进入 **Step 5**：
1. **清理 UI 顽疾**：在本地沙盒环境中，单独查阅并修改 `DashboardTab.vue`、`ArkBottomNav.vue` 以及对应的基础组件。重点修复 280px 宽度下的容器查询排版、清除多余的滚动条，确保 UI 完美自适应。
2. **切入 Step 5 顶层缝合**：待沙盒 UI 完美后，打开 `GlobalStatusBar.vue`，将原本混杂在 `<main>` 里的各个 Tab 替换为引入 `<DashboardTab />`。
3. **真实数据连通**：对齐 Pinia Store 数据（如 `uiStore.lastTriggeredEntries`）至 DashboardTab。
4. **气泡行为增强**：为气泡把手追加 `@dblclick`。
5. **真机演练**：将代码打包丢入 SillyTavern 真实环境，进行最终的物理挂载与真数据测试。