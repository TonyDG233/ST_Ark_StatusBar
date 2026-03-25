# 05 前端微后端与垂直切片架构总纲 (05_frontend_architecture_master_plan.md)

## 1. 架构愿景与核心哲学 (The Micro-Backend Philosophy)

在经历了数次失败的重构尝试后，我们彻底抛弃了传统的“巨石 Vue 容器 (Monolith)”与“哑组件+Emit瀑布流”的陈旧前端模式。
本项目的 UI 复杂度（如状态栏的拖拽、多面板管理、开局向导的剧情树渲染）已远超简单的静态页面。因此，我们正式确立**“前端也需要微后端 (Frontend Micro-Backend)”**的核心哲学：

*   **垂直切片 (Vertical Slicing)**：不再按技术类型（如把所有样式放一个文件夹，所有 API 放另一个文件夹）去划分目录。而是严格按**业务领域 (Domain)** 划分。
*   **高内聚与微逻辑**：每一个独立的业务分页（如“拦截器 Tab”、“世界书 Tab”），必须拥有自己的 `View` (UI 骨架)、`ViewModel` (微逻辑专属 TS 脚本) 和 `Scope` (专属 SCSS)。
*   **状态直通防撕裂**：抛弃深层的 Props 透传和繁琐的 Emit 事件冒泡，使用基于 Vue 3 响应式的组合式 API (Composables) 作为跨页面的“状态胶水”。

---

## 2. 物理目录结构规范 (Physical Directory Structure)

未来的前端文件必须严格遵循以下结构，做到“一个功能，一个聚落”：

```text
src/ARK_STATUSBAR/components/
├── styles/                     # 全局与共用样式库（样式抽象层）
│   ├── theme.scss              # Level 1: 最底层变量（颜色基准、字号、Z-Index）
│   └── shared_ui.scss          # Level 2: 共用UI组件（按钮宏、空状态、手风琴外壳等）
│
├── global_tabs/                # 状态栏业务分页领域
│   ├── shared_ui_state.ts      # 【跨页胶水】仅存放跨Tab共享的响应式状态（如 pendingEntries）
│   │
│   ├── interceptor/            # 拦截器子领域
│   │   ├── InterceptorTab.vue  # 纯渲染视图，极度清爽
│   │   ├── logic.ts            # 专属微后端逻辑（提供 confirmSend 等方法）
│   │   └── style.scss          # 专属样式 (内部需显式 @import '../../styles/theme.scss')
│   │
│   └── worldbook/              # 世界书子领域
│       ├── WorldbookTab.vue
│       ├── logic.ts
│       └── style.scss
│
├── startup_tabs/               # 开局向导业务分页领域
│   └── ...                     # (结构同上)
│
├── GlobalStatusBar.vue         # 外壳退化层（仅保留拖拽、挂载和最小化/最大化的物理逻辑）
└── StartupNavigator.vue        # 外壳退化层
```

---

## 3. 逻辑的三级抽象防线 (TS Logic Abstraction)

任何前端功能在开发前，其对应的 TypeScript 逻辑必须明确归属于以下三个层级之一：

### 3.1 Level 1 (底层基座与数据大闸)
*   **代表文件**：`src/ARK_STATUSBAR/logic/statusbar_manager.ts` 及底下的 `core/` 等。
*   **职责**：与 SillyTavern 宿主原生 API 交互，执行 `extensionSettings` 读写、发起网络请求、计算 Token。
*   **访问限制**：这是绝对的黑盒，前端组件**绝对禁止**越过它去直接操作 `SillyTavern.getContext()` 或修改底层配置。

### 3.2 Level 2 (跨页状态胶水)
*   **代表文件**：`components/global_tabs/shared_ui_state.ts`
*   **职责**：基于 Vue 的 `ref` 和 `reactive`，充当轻量级 Store。用于接管全局环境事件监听（如 `document.addEventListener('ark-interceptor-triggered')`）并将数据分发给不同的 Tab。
*   **核心价值**：例如父外壳 `GlobalStatusBar` 需要预警数量，子组件 `InterceptorTab` 需要预警列表，双方同时 `import { pendingEntries }` 即可实现完美内存同频，彻底终结 Emit 地狱。

### 3.3 Level 3 (分页微后端)
*   **代表文件**：`components/global_tabs/interceptor/logic.ts`
*   **职责**：每个 Tab 专属的 ViewModel 层。处理纯属该分页的交互（如文本搜索过滤 `filterText`、临时阻断条目 `toggleTempDisable`）。
*   **访问规则**：该层的逻辑脚本内部可以直接 `import { StatusBarManager }` 调用底层基座（Level 1）的方法，实现组件真正的“自治”。

---

## 4. 样式的三级抽象防线 (CSS Abstraction)

为了彻底解决“作用域锁死”和“宋体灾难”，所有 CSS 必须按层级抽象并显式引用：

### 4.1 Level 1 (主题变量)
*   **文件**：`styles/theme.scss`
*   **内容**：全局 CSS 变量（`--ui-text-primary`, `--ui-bg-color` 等）。这是所有样式的根基。

### 4.2 Level 2 (主线共用)
*   **文件**：`styles/shared_ui.scss`
*   **内容**：提取自两大顶层应用（状态栏和开局向导）中高度重合的结构样式。例如 `.btn-success`, `.empty-state`, `.warning-box`, `.action-bar`。
*   **原则**：这个文件可以直接挂载在顶层组件的 `<style>`（非 scoped）中，带上 `.ark-global-statusbar` 命名空间前缀；或者被各个子页面按需导入，避免代码冗余。

### 4.3 Level 3 (分页私有)
*   **文件**：如 `worldbook/style.scss`
*   **内容**：完全抛弃强依赖父级 `scoped` 的错觉！子组件如果需要独有样式（如特定的手风琴展开动效），必须在此文件中编写，且必须在文件顶部通过 `@import` 引入基础变量。

---

## 5. 开发执行纪律 (Execution Code of Conduct)

1.  **禁止代码压缩作弊**：任何为了满足文件行数指标而进行的“缩减换行符、强行内联”的行为都是严厉禁止的。行数的降低必须且只能来源于架构级别的物理切割（将逻辑转移至 Level 3，将样式转移至 Level 2）。
2.  **Vue 文件极简主义**：未来编写的 `.vue` 文件，其 `<script setup>` 应当极度清爽，主要职责仅为引入 `logic.ts` 暴露的方法和状态并绑定到模板上。
3.  **零幻觉原则**：在剥离原始庞大组件时，必须使用手术刀级的 `1:1` 代码剪切。绝不可自作聪明地补充原生不存在的类名，或者凭空捏造 `declare function`。

>> 本《前端微后端架构总纲》作为最高级别的防线规范，在任何对 `GlobalStatusBar.vue` 或 `StartupNavigator.vue` 动刀前，都必须以此为法度。