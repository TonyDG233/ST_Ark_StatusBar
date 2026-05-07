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
- **操作**：新建 `src/sandbox/sandbox.html` 和入口脚本。在其中挂载一个空白的 Vue 实例。配置 `pnpm run sandbox` 命令启动本地简易服务器（如 Webpack Dev Server 或 Vite）。

### Step 2: 底层基建与样式变量防雷 (Infrastructure & Tokens)
- **目标**：安全注入双主题颜色，绝不污染全局。
- **操作**：
  1. 在 `src/ARK_STATUSBAR/index.ts` 挂载期注入 `Space Grotesk` 与 `Material Symbols` 字体外链。
  2. 修改 `theme.scss`，严格遵守 `DESIGN.md` 建立 `.dark-theme` (罗德岛) 和 `.light-theme` (终末地) 变量体系。
  3. 修改 `tailwind.scss`，只引入 `theme` 和 `utilities`，严格剔除 `preflight`。

### Step 3: 基础 UI 积木库开发 (Base Components)
- **目标**：在沙盒中写好未来的通用扩展组件。
- **操作**：
  1. 新建 `<ArkPanel>`：带 1px 极细边框与等高线背景的底层容器。
  2. 新建 `<ArkProgressBar>`：接收 `current` 和 `max` 的纯展示理智条。
  3. 新建 `<ArkWipMask>`：绝对定位的半透明“敬请期待”遮罩。
  - *验证点：在沙盒中显示完美，无报错。*

### Step 4: 业务骨架组装 (View Assembly)
- **目标**：拼装主面板，隔离繁杂的 HTML。
- **操作**：
  1. 新建 `src/ARK_STATUSBAR/views/global_tabs/dashboard/DashboardTab.vue`。
  2. 引入 Step 3 的组件，用假数据画出顶部系统状态、中部日志列表、底部“一大两小”快捷网格。
  3. 使用 `@container` 容器查询，确保拖拽缩小时排版不崩。
  - *验证点：在沙盒中拉伸窗口，UI 完美自适应。*

### Step 5: 顶层外壳缝合与数据连通 (Top-Level Integration)
- **目标**：完成 MVP 替换，对接真实物理引擎与数据。
- **操作**：修改 `src/ARK_STATUSBAR/views/GlobalStatusBar.vue`：
  1. **绝对保留**：原封不动保留 `useDraggablePhysics.ts` 的 `startDrag`。
  2. **双击容错**：在气泡把手上追加 `@dblclick` 用于防误触展开。
  3. **路由替换**：删掉 `<main>` 里冗余的 `v-show` 面条代码，用 `v-if` 安全挂载写好的 `<DashboardTab />`。
  4. **真数据接入**：将 `DashboardTab` 里的假日志替换为 `uiStore.lastTriggeredEntries` 循环。
  - *验证点：丢入酒馆真实环境，一切丝滑运转。*