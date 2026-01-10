# 第一阶段：世界线管控者 (Manager) - 开场与返回系统

**状态**: [规划中 - 已更新 V2]
**日期**: 2026-01-08

## 1. 项目概览
本阶段专注于将“开场导航器 (Startup Navigator)”和“返回按钮 (Return Button)”从旧版 EJS 实现移植到 `src/ARK_STATUSBAR` 项目中的现代 Vue/TypeScript 架构。
**重要提示**: `ARK_STATUSBAR` 是一个**复合型项目**。它包含多个相互独立的 UI（开场界面、返回按钮，以及未来的状态栏），它们共存但拥有各自独立的挂载逻辑。

## 2. 架构与模块

### 2.1. 开场导航器 (Startup Navigator - UI)
*   **本质**: 嵌入在第一条消息气泡内的全屏覆盖层/菜单。
*   **挂载点**: `#chat > .mes[mesid="0"] .mes_text` (遵循旧版逻辑)。
*   **功能**:
    *   从 `config/scenarios.ts` 读取并显示开局列表。
    *   处理用户点击选择。
    *   通过逻辑核心触发“世界书 (WI) 开关”。
    *   更新 `swipe_id` 以切换视图。
*   **资源**: 从 `config/assets.ts` 加载 Logo 等图片 URL。

### 2.2. 返回按钮 (Return Button - UI)
*   **本质**: 一个常驻的导航按钮。
*   **挂载点**: 第一条消息的 `.mes_text` (当 `swipe_id != 0` 时)。
*   **功能**: 将用户带回开场界面 (Swipe #0)。

### 2.3. 场记板核心 (Clapperboard Core - Logic)
*   **本质**: TypeScript 逻辑模块 (无 UI)。
*   **核心策略**: **增量控制 (Delta Control)**。
    *   **基准态**: 世界书拥有一个默认的“初始开关状态”（由用户提供的导出数据定义）。
    *   **增量操作**: 每个开局仅定义它**必须开启**和**必须关闭**的条目。
    *   **流程**:
        1.  (可选) **重置**: 先将世界书恢复到“基准态”。
        2.  **应用增量**: 遍历开局配置，开启 `linkedWorldInfo` 中的条目，关闭 `disabledWorldInfo` 中的条目。
*   **额外功能**:
    *   **一键重置**: 恢复到基准态。
    *   **批量操作**: “关闭所有单字干员条目”预设。

### 2.4. 数据与配置
*   **`config/scenarios.ts`**: 存储开局列表。
    *   新增字段 `disabledWorldInfo`: 明确列出该开局需要关闭的条目。
*   **`config/baseline.ts` (待定)**: 存储世界书的“基准态”数据（等待用户提供）。
*   **`config/assets.ts`**: 存储图片 URL (Logo 等)。
*   **`config/schema.ts`**: 定义 MVU 变量结构。

## 3. 实施步骤

- [x] **步骤 1: 项目骨架**
    - 创建 `src/ARK_STATUSBAR` 目录结构。
    - 建立 `config/` 文件夹并创建 `scenarios.ts` 和 `assets.ts`。
    - 建立 `logic/` 文件夹。

- [x] **步骤 2: 数据结构完善 (V2)**
    - 更新 `scenarios.ts` 接口，增加 `disabledWorldInfo`。
    - 创建 `baseline.ts` 并填入用户导出的数据（通过 `generate_baseline.mjs` 实现）。
    - 创建“单字干员过滤列表”（通过 `generate_baseline.mjs` 实现）。

- [x] **步骤 3: 逻辑核心实现**
    - 实现 `logic/worldbook_manager.ts`。
    - 核心函数 `applyScenario(scenarioId)`: 执行“重置 -> 开启 -> 关闭”流程。
    - 核心函数 `resetToBaseline()`: 恢复基准态。

- [x] **步骤 4: 开场导航器组件**
    - 创建 `components/StartupNavigator.vue`。
    - 复刻旧版设计的网格布局。
    - 绑定点击事件到逻辑核心。

- [x] **步骤 5: 返回按钮组件**
    - 创建 `components/ReturnButton.vue`。
    - 实现简单的导航逻辑 (`swipe_id = 0`)。

- [x] **步骤 6: 挂载系统 (`index.ts`)**
    - 实现“旧版挂载逻辑” (扫描 Message #0)。
    - 条件: 若 `swipe_id == 0` -> 挂载开场组件。
    - 条件: 若 `swipe_id != 0` -> 挂载返回按钮。

- [x] **步骤 7: 验证**
    - [x] 验证 UI 渲染是否正确 (编译通过，样式问题已修复，内容已对齐)。
    - [x] 验证 WI 开关功能 (代码逻辑已复查)。
    - [x] 验证设置持久化 (已通过 localStorage 实现)。