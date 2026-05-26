# Ark Statusbar - App-like UI Design System & SOP

本指南基于最初的 `DESIGN.md` 与我们在 `DashboardTab` 中摸索出的真实踩坑经验，定义了未来所有新页面（世界书、历史、设置等）的**统一布局规范**。

在将任何新页面接入 `GlobalStatusBar.vue` 之前，必须在沙盒中按照本指南完成结构验证。

## 1. 核心架构哲学：App 级体验

我们的 UI 目标不是一个“自适应的网页”，而是一个**“尺寸受限但永远不会布局崩溃的移动端 App 界面”**。

### 1.1 滚动条的铁律
*   **全局无痕滚动**：外层屏幕壳子允许因为空间极度不足而发生整体纵向滚动，但**绝对禁止出现全局的滚动条轨道**。
*   **局部显式滚动**：只有在包含大量数据列表（如“近期触发记录”、“世界书条目列表”）的内部区块，才允许出现且必须使用我们定制的细长滚动条（`ark-scrollbar`）。

### 1.2 高度弹性防御（防挤压塌陷）
在极度受限的高度下，组件的行为必须可控：
*   **系统固件（头、尾、标题）**：必须加上 `flex-shrink-0`。无论屏幕多小，它们绝对不能变形或被压缩。
*   **弹性数据区（列表）**：必须使用 `flex-1 min-h-0`。这是为了在父容器被压缩时，子元素能心甘情愿地被压缩，而不是强行撑破父容器。

---

## 2. 页面开发模板 (Template SOP)

开发一个新的 Tab（如 `HistoryTab.vue`）时，必须遵循以下结构嵌套法则：

### 层级 1：页面外壳 (Tab Root)
页面根节点不需要设置 100% 高度，让它作为一个自然的 Flex 容器，依靠内容的多少自然撑开。
```html
<!-- 必须包含: relative, flex-col, 统一边距, 隐藏横向溢出 -->
<div class="history-tab relative flex flex-col p-4 md:p-6 gap-4 md:gap-6 overflow-hidden">
  <!-- 意图标签 (开发期使用) -->
  <div class="absolute top-0 right-0 bg-error/90 text-[10px] px-1 ...">[HistoryTab]</div>
  
  <!-- 内部组件... -->
</div>
```

### 层级 2：固定高度面板 (如顶栏/底栏)
这类面板的内容固定，不可压缩。
```html
<!-- 必须包含: flex-shrink-0 -->
<ArkPanel class="p-4 md:p-6 flex-shrink-0">
  <!-- 内容 -->
</ArkPanel>
```

### 层级 3：弹性滚动面板 (如长列表区)
这是最容易翻车的地方，必须按以下嵌套书写：
```html
<!-- 1. 外层面板：允许压缩 (flex-1 min-h-0) -->
<ArkPanel class="flex-col flex-1 min-h-0">
  
  <!-- 2. 面板的标题栏：死锁高度 (flex-shrink-0) -->
  <div class="p-4 border-b border-outline-variant flex-shrink-0">列表标题</div>
  
  <!-- 3. 面板的内容区：接管剩余空间，限高，内部滚动 (flex-1 min-h-0 overflow-y-auto ark-scrollbar) -->
  <div class="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto ark-scrollbar max-h-[300px]">
    <!-- 这里的条目过多时，会在内部出现方舟风格的滚动条 -->
    <div class="item">...</div>
  </div>
  
</ArkPanel>
```

---

## 3. 防崩坏细节速查表 (Checklist)

*   [ ] **盒子模型污染预警 (Box-Sizing)**：由于我们在项目中选择性地移除了 Tailwind 的 Preflight 以防止污染宿主（SillyTavern）环境，组件默认会退化为 `box-sizing: content-box`。这会导致 `w-full px-4` 的实际宽度变成 `100% + 32px`，从而撑破外层 `overflow-hidden`。**在独立开发组件时，一定要意识到脱离了 Preflight 的危险，必要时需要在顶层恢复 `@import "tailwindcss/preflight"`，或者在组件根节点强制 `box-border w-full`。**
*   [ ] **文本与容器双重防撑爆 (Flex Blowout)**：在极窄屏幕下（如 200px），长英文或长标题会撑破 Flex 布局。**仅仅在文本上加 `truncate` 是不够的**！你必须在文本父级 Flex 容器上也加上 `min-w-0`，否则 Flex 的 `min-width: auto` 机制会强制容器保持文本原本的巨大宽度，从而把相邻的按钮挤出屏幕。
*   [ ] **警惕视口媒体查询的陷阱 (Viewport Media Query Trap)**：在侧边栏或沙盒挂载的组件中，**绝对禁止使用 `sm:flex-nowrap` 等基于视口宽度的响应式断点控制内部排列**！哪怕侧边栏被挤压到 200px，只要用户浏览器视口大于 640px，`sm:` 就会强制生效并阻止换行，从而产生毁灭性的撑爆。请依靠物理 `flex-wrap` 搭配元素的 `min-w-[xxx]` 来实现纯粹的容器自适应换行。
*   [ ] **警惕“边距黑洞” (Padding Blackhole)**：在嵌套层级极深的列表（Tab -> List -> Card -> Editor）中，如果在每一层都加上标准的 `p-4`，会在窄屏幕下吃掉超过 50px 的横向空间，导致最内层编辑区变成一条缝。**仅在最外层 Tab 保留与主页对齐的全局边距（如 `p-2`），内部组件应极限压缩 Padding (`px-1`, `p-2`) 并依靠背景色阶 (Elevation) 区分层级。**
*   [ ] **拒绝粗暴截断，拥抱自然换行**：对于涉及业务核心信息（如世界书的标题、触发词 KEYS），禁止为了“排版好看”而滥用 `truncate` 导致信息丢失。必须使用 `min-w-0 break-words whitespace-normal leading-tight` 让长文本在极窄容器下自然向下折行。
*   [ ] **微小尺寸的光学校正 (Optical Alignment)**：在极小尺寸（如 10px-14px）下，图标（`material-symbols-outlined`）和文本（汉字/数字）的基线往往不同。单独依赖 `items-center` 会导致上下不对齐。必须辅以 `leading-none` 并且手动加入视觉位移（如 `-translate-y-[0.5px]` 或 `translate-y-[0.5px]`）才能做到像素级居中完美。
*   [ ] **悬浮导航的安全避让 (Safe Area Insets)**：在设计绝对定位的悬浮底栏（如 SubNav）时，**绝对禁止在外层内容容器上使用 padding 粗暴地“割裂”空间**。正确的工程解法是：让滚动容器 100% 贴合物理底部以保证背景通透，而是在页面内部数据列表的最末端（或滚动视图的末尾），插入一个高度等同于悬浮导航栏的空 `<div class="h-16 flex-shrink-0 w-full pointer-events-none"></div>` 作为占位符，从而让内容既能滚入悬浮窗背后，又保证末尾数据不被遮盖。
*   [ ] **极细滚动条空间释放**：所有方舟组件应当且仅当使用统一的 `.ark-scrollbar` 全局样式。请避免在局部组件内反复编写 `::-webkit-scrollbar` 私有伪类。全局配置已存放在 `src/ARK_STATUSBAR/styles/tailwind.scss`。对于完全不需要显示轨迹的暗盒滚动区，可配合 `.scrollbar-none` 使用。
*   [ ] **悬浮窗的自适应魔法单位 (`em`)**：对于 MINI 等悬浮状态，不要写死 `width: 200px`。最优雅的做法是使用相对单位（例如原版的 `width: 13em`）。这样当用户改变整体界面的字号时，悬浮窗的物理宽度和内部间距都会等比例完美缩放。
*   [ ] **避免绝对宽度**：永远不要使用固定的 `w-[200px]`。使用 `w-full` 或 `flex-1` 让其自适应。
*   [ ] **不要使用 `md:` 做内容断点**：除非是全局级别的边距切换（如 `p-4 md:p-6`）。如果是组件内部的左右排列切换，请使用 `@container` 搭配 `@[300px]:` 以响应组件自身的物理宽度，而非屏幕宽度。
*   [ ] **背景与色彩依赖**：禁止在 Vue 文件中写死任何十六进制颜色（如 `#121212`），必须且只能使用 `var(--color-surface)` 或 Tailwind 类名（如 `bg-surface-container-low`）。
*   [ ] **全局组件边框与色彩统一规范**：全站所有页面的容器/卡片统一使用 `border-outline-variant` 描边配合 `bg-surface` 底色。**严禁**为了视觉冲击力滥用 `border-white` 加粗或直接使用非法且未经配置注册的 Tailwind 伪类色（如 `rhodes-red` 等未在 `theme.scss` 映射的色号）。需高亮之处统一使用 `border-t-[2px] bg-primary/error` 顶线实现。
*   [ ] **避免嵌套滚动陷阱 (Nested Scroll Trap)**：对于基于 Tab 标签页的大视窗结构，应确保所有内容（包含 Header 标头、警告横幅、列表内容和底部按钮）处于最外层的**唯一滚动文档流**中（由外壳提供 `overflow-y-auto min-h-0`）。绝不可在子组件内使用 `max-h-xxx overflow-y-auto` 或 `sticky bottom-0` 从而剥夺用户的全局拖动体验与挤压容器的高度自适应。
*   [ ] **警惕 Flex 的 `min-h-0` 物理蒸发 Bug**：当在 App 外壳或大布局中使用 `flex flex-col` 让中间的 `flex-1` 占据剩余空间并滚动时，**必须且一定**要在该 `flex-1` 节点挂上 `min-h-0`（允许高度被挤压到底）。如果不加，当整个 App 高度被压缩到极端（如 < 300px）时，`flex-1` 会拒绝收缩，直接导致其下方的所有 BottomNav、SubNav 被顶出视口外“物理消失”。

---

## 4. 后续页面开发计划 (Roadmap)

我们将在 `src/sandbox/App.vue` 中依次挂载并完善以下页面。在所有页面都在沙盒中通过极端宽高拉伸测试后，再统一并入真实环境：

1.  [x] 主页仪表面板 (`DashboardTab` - 统一全局细线框及字体规范，单向滚动)
2.  [x] 世界书管理器 (`WorldbookTab` - 原有的三个复杂列表需重构为 App 滚动形式，已拆分为 LoreEntriesTab 且解决撑爆边距等缺陷)
3.  [x] 拦截预警弹窗 (`InterceptorTab` - 强化警告样式与放行操作区，已抽离 Alert 和 QueueItem 积木)
4.  [x] Git式历史记录 (`HistoryTab` - 需缝合垂直时间线与快照详情)
5.  [ ] 系统设置 (`SettingsTab` - 需应用方舟风格的 Toggle 开关和滑块)