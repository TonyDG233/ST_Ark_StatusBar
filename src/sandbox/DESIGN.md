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

*   [ ] **盒子模型污染预警 (Box-Sizing)**：由于我们在项目中选择性地移除了 Tailwind 的 Preflight 以防止污染宿主（SillyTavern）环境，组件默认会退化为 `box-sizing: content-box`。这会导致 `w-full px-4` 的实际宽度变成 `100% + 32px`，从而撑破外层 `overflow-hidden`。**在独立开发组件时，一定要意识到脱离了 Preflight 的危险，必要时需要在顶层恢复 `@import "tailwindcss/preflight"`，或者在组件根节点强制 `box-border`。**
*   [ ] **文本与容器双重防撑爆 (Flex Blowout)**：在极窄屏幕下（如 200px），长英文或长标题会撑破 Flex 布局。**仅仅在文本上加 `truncate` 是不够的**！你必须在文本父级 Flex 容器上也加上 `min-w-0`，否则 Flex 的 `min-width: auto` 机制会强制容器保持文本原本的巨大宽度，从而把相邻的按钮挤出屏幕。
*   [ ] **微小尺寸的光学校正 (Optical Alignment)**：在极小尺寸（如 10px-14px）下，图标（`material-symbols-outlined`）和文本（汉字/数字）的基线往往不同。单独依赖 `items-center` 会导致上下不对齐。必须辅以 `leading-none` 并且手动加入视觉位移（如 `-translate-y-[0.5px]` 或 `translate-y-[0.5px]`）才能做到像素级居中完美。
*   [ ] **悬浮窗的自适应魔法单位 (`em`)**：对于 MINI 等悬浮状态，不要写死 `width: 200px`。最优雅的做法是使用相对单位（例如原版的 `width: 13em`）。这样当用户改变整体界面的字号时，悬浮窗的物理宽度和内部间距都会等比例完美缩放。
*   [ ] **避免绝对宽度**：永远不要使用固定的 `w-[200px]`。使用 `w-full` 或 `flex-1` 让其自适应。
*   [ ] **不要使用 `md:` 做内容断点**：除非是全局级别的边距切换（如 `p-4 md:p-6`）。如果是组件内部的左右排列切换，请使用 `@container` 搭配 `@[300px]:` 以响应组件自身的物理宽度，而非屏幕宽度。
*   [ ] **背景与色彩依赖**：禁止在 Vue 文件中写死任何十六进制颜色（如 `#121212`），必须且只能使用 `var(--color-surface)` 或 Tailwind 类名（如 `bg-surface-container-low`）。

---

## 4. 后续页面开发计划 (Roadmap)

我们将在 `src/sandbox/App.vue` 中依次挂载并完善以下页面。在所有页面都在沙盒中通过极端宽高拉伸测试后，再统一并入真实环境：

1.  [x] 主页仪表面板 (`DashboardTab`)
2.  [ ] 世界书管理器 (`WorldbookTab` - 原有的三个复杂列表需重构为 App 滚动形式)
3.  [ ] 拦截预警弹窗 (`InterceptorTab` - 需强化警告样式与放行操作区)
4.  [ ] Git式历史记录 (`HistoryTab` - 需缝合垂直时间线与快照详情)
5.  [ ] 系统设置 (`SettingsTab` - 需应用方舟风格的 Toggle 开关和滑块)