# PHASE 1.1: Worldbook 模块深度重构与拆分规划 (Master Plan)

## 1. 架构演进背景与核心痛点
当前的 `WorldbookTab` 及其相关组件在代码组织和样式实现上需要一次向前的演进：
1.  **解除模块间的强关联**：原版的 `WorldbookTab` 仅负责世界书管理，拦截和历史分别由其他组件负责。这原本是非常好的解耦设计！但随着业务复杂化，这些模块在前端视图层需要被平行管理。引入 `SubNav` 的根本目的，是在 UI 视图层面彻底将这三个平级的核心模块组织起来，防止任何单一组件膨胀。
2.  **样式脆弱与重度耦合**：大量使用了原生的 Flex 布局、固定像素 Gap 以及不安全的 `box-sizing: content-box`。这在接入方舟主题的新版“严格边界防挤压”布局（如 `DESIGN.md` 所述）时，极易发生雪崩式溃败（Flex Blowout）。
3.  **UI 表现与设计稿脱节及移动端适配**：设计稿中的 UI（例如带 Tags 和状态的 Data Card）非常具有战术美感，但原设计稿是一个“定宽且破损”的 Web 端网页，存在明显的移动端不适配问题。我们的重构并不是简单地“照抄设计稿”，而是要**在吸收其视觉风格的基础上，结合实际 400px 移动端容器的物理限制进行转换和调整**。

## 2. 目标架构蓝图与依赖关系规范

为了解决上述问题，我们将采取**沙盒纯净设计 -> 数据打桩 -> 业务替换**的三步走策略。

### 2.1 路由降维与解耦 (已完成)
将原先嵌套在 `WorldbookTab` 概念下的导航结构拍平，交由 App/Global 级状态管理。
*   `activeTab === 'worldbook'` 仅作为开启“世界书领域”的钥匙。
*   引入 `SubNav.vue` 作为该领域的平行路由分发器，分别挂载：
    *   `InterceptorTab` (预警)
    *   `LoreEntriesTab` (也就是重构后的 WorldbookTab)
    *   `HistoryTab` (历史)

### 2.2 组件归类与隔离沙盒设计模式 (Sandbox-Only Design)
**绝对红线：在视觉验证 100% 通过前，绝不触碰生产环境的业务代码！**

1.  **组件归类原则**：任何专属于“世界书管理”的内部组件，将被统一归类到 `src/ARK_STATUSBAR/components/worldbook/`（或类似专属目录）中；只有可能被全局复用的组件才放在 `components/` 根目录下。
2.  **沙盒驱动**：我们将在 `src/sandbox/` 下开辟临时设计区，通过 Mock 数据驱动组件表现：
```text
src/sandbox/
├── App.vue  (已接入 SubNav，作为整体预览壳子)
└── design_mocks/worldbook/
    ├── LoreEntriesTab_Design.vue       (总页面：头部标题 + 顶栏工具 + 列表容器)
    ├── LoreFolderItem_Design.vue       (手风琴头部：文件夹图标 + 折叠控制)
    ├── LoreEntryList_Design.vue        (展开内容：搜索 + Category/Type 筛选 + 批量吸顶工具条)
    ├── LoreDataCard_Design.vue         (单条数据卡片：UID + Tags + 状态 Toggle + 操作图标)
    └── LoreEntryEditor_Design.vue      (内联表单：使用 Grid 布局的全新暗色调表单)
```

**【致后继 Agent 的强指引】**
> 如果你接手了这项工作，请牢记：
> 1. 我们目前的 UI 风格是《明日方舟》硬派工业风。严格使用 `theme.scss` 中的 `bg-surface-container-*` 作为背景色系，使用 `text-primary` 作为高亮。
> 2. 原版设计稿 `references/.../code.html` 中的定宽和溢出写法是错误的，必须用 Tailwind 的 Flex/Grid 自适应体系，配合 `min-w-0` 防挤压。
> 3. 所有状态操作（开启/关闭）必须使用已经统一的 `ActionToggle.vue` 或其变体。

## 3. 功能扩展协作规范与核心重构点

### 3.1 极简响应式与容器防御
*   所有弹性列表必须严格遵循 `flex-1 min-h-0 overflow-y-auto ark-scrollbar` 的嵌套法则。
*   所有固定头部（如批量操作栏、标题栏）必须添加 `flex-shrink-0` 防止被挤压变形。
*   对于“悬浮窗”、“弹窗”等脱离标准流的组件，废弃固定 `px` 宽度，改用 `em` 作为单位（如 `width: 20em`），以便在未来能够通过改变基准 `font-size` 实现优雅的全局等比缩放。

### 3.2 UI 元素与设计稿对齐
*   **Data Card 改造**：使用全新的双层 Flex 结构，彻底复刻设计稿中 `[Leader] [Caster]` 等极具工业感的方形 Tag。
*   **状态开关进化**：引入方舟风格的 `STATE [ON/OFF]` 拨动开关组件，替换原生 `<input type="checkbox">`。
*   **原子组件复用**：所有按钮操作必须使用已经建立好防御性 Reset 的 `Button.vue` 或 `ActionToggle.vue`。

## 4. 实施重构的工作流 (SOP) 与风险预案

### 步骤 1：沙盒内纯视觉重构 (Visual Mockup)
*   **动作**：在 `src/sandbox/design_mocks/` 中编写上述五个 `_Design.vue` 组件，使用纯静态 JSON 数据，使用 Tailwind 堆砌出符合设计稿 100% 还原度的 UI 骨架。
*   **风险**：暗色模式的层级阴影（Elevation）难以区分。
*   **预案**：严格使用 `bg-surface`, `bg-surface-container-low`, `bg-surface-container-high` 来体现物理层级。

### 步骤 2：响应式与抗压测试 (Stress Test)
*   **动作**：在 `App.vue` 的 Sandbox 预览区，疯狂拖动宽度和高度拉杆，测试新设计的 Data Card 是否会产生 Flex Blowout，是否能正确换行或截断。
*   **风险**：嵌套过深导致某一层 `min-w-0` 遗漏。
*   **预案**：一旦发现横向滚动条或被切断的边框，利用 DevTools 的盒模型立刻定位并补充 `min-w-0` 或 `box-border`。

### 步骤 3：数据挂载与生产文件替换 (Integration)
*   **动作**：视觉验收通过后，将 `_Design.vue` 的 `<template>` 和 `<style scoped>` 复制回 `src/ARK_STATUSBAR/views/global_tabs/worldbook/` 下的对应生产文件，并小心地将原本的 Pinia 状态 (`ui_state_store`)、业务逻辑函数 (`useWorldbookActions`) 重新绑定到新的 UI 元素上。
*   **风险**：新旧数据结构不匹配（例如新卡片需要 Tags，但旧数据没有）。
*   **预案**：由业务逻辑层 (`mapper`) 负责提供默认占位符或解析逻辑，UI 层保持“只读呈现”。
