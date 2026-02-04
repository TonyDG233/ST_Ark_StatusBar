# Phase 3: 最终实现蓝图 (Final Implementation Blueprint)

**日期**: 2026-01-22

**目的**: 本文档是 Phase 3 (提示词工程 & 动态上下文) 所有规划工作的最终总结。它将作为下一阶段——**编码实现**——的直接指导。本文档假定所有链接的设计文档均已获得最终批准。

---

## 1. 最终文件清单 (Final File Checklist)

### 1.1 新建 EJS 模板

以下文件将被创建于 `src/ARK_STATUSBAR/prompts/dynamic/` 目录下：

*   `变量列表.ejs`
*   `[mvu_update]任务执行器.ejs`
*   `[mvu_update]变量更新规则.ejs`
*   `[mvu_update]变量输出格式.ejs`

### 1.2 修改后端逻辑

以下文件将被修改以支持动态上下文注入：

*   `src/ARK_STATUSBAR/logic/updaters/character.ts`
*   `src/ARK_STATUSBAR/logic/updaters/global.ts` (用于注册事件)
*   `src/ARK_STATUSBAR/mvu/schemas/global.ts` (用于添加缓存哈希字段)

---

## 2. 核心实现摘要 (Core Implementation Summary)

### 2.1 EJS 模板核心逻辑

*   **`变量列表.ejs`**:
    *   **职责**: 数据中枢与预处理器。
    *   **实现**: 使用 `<% define('worldState', getvar('stat_data')); %>` 初始化全局数据源。严格遵循三阶段角色显示逻辑，并完整、清晰地渲染所有其他变量，同时过滤掉无用信息。
*   **`[mvu_update]任务执行器.ejs`**:
    *   **职责**: 任务解析与指令生成。
    *   **实现**: 遍历 `worldState.global.task_queue`，使用**独立 `if` 块**根据任务类型（`GROUPED`, `REPEATED`, `EXCLUSIVE`）生成带有上下文和 `JSONPatch` 模板的结构化指令。
*   **`[mvu_update]变量更新规则.ejs`**:
    *   **职责**: 定义通用世界规律。
    *   **实现**: 生成一个结构化的 **YAML 提示词**，为关键变量（如 `mood`, `trust`）提供细粒度的 `check` 规则（含数值范围）。
*   **`[mvu_update]变量输出格式.ejs`**:
    *   **职责**: 提供最终输出协议。
    *   **实现**: 严格复制工作流规范（含 `rule` 和 `format`），并在 `<Analysis>` 思维链中插入了检查动态任务的步骤。

### 2.2 动态上下文注入核心逻辑

*   **职责**: 将静态角色的动态数据临时注入世界书。
*   **实现**:
    1.  **缓存**: 启动时，基于世界书条目的 `enabled` 状态构建并持久化一个 `角色名 -> { uid, worldbookName }` 的映射表 (`static_char_cache`) 到 `global._internal` 变量中，并记录一个哈希值用于失效判断。**特别注意过滤禁用条目以支持同名异格干员。**
    2.  **监听**: 使用 `eventOn` 监听 `GENERATE_BEFORE_COMBINE_PROMPTS` 和 `GENERATION_ENDED` 事件。
    3.  **注入**: 在 `..._BEFORE_...` 事件中，对每个 `has_static_profile: true` 的在场角色，从缓存中查找其条目信息，然后使用 `updateWorldbookWith` API。**先清理可能残留的旧块（幂等性）**，再将渲染好的动态数据块（`<-- DYNAMIC_ARK_CONTEXT_START --> ...`）追加到条目末尾。
    4.  **清理**: 在 `..._ENDED` 事件中，使用 `updateWorldbookWith` 和之前备份的原始内容，将所有被修改的条目恢复原状。

---

## 3. 开发路线图 (Implementation Roadmap)

1.  **[编码]** **EJS 模板**:
    a. 创建 `src/ARK_STATUSBAR/prompts/dynamic/` 目录。
    b. 按照设计文档，依次创建并填充 `变量输出格式.ejs` 和 `变量更新规则.ejs` 这两个静态规则文件。
    c. 实现 `变量列表.ejs`。
    d. 实现 `[mvu_update]任务执行器.ejs`。
2.  **[编码]** **后端逻辑**:
    a. 修改 `src/ARK_STATUSBAR/mvu/schemas/global.ts`，在 `_internal` 中添加 `static_char_cache` 和 `static_char_cache_hash` 字段。
    b. 在 `src/ARK_STATUSBAR/logic/updaters/character.ts` 中，实现 `initializeInjector`, `buildStaticCharacterCache`, `injectContextForCharacter`, 和 `cleanupInjectedContexts` 四个核心函数。
    c. 在 `src/ARK_STATUSBAR/logic/updaters/global.ts` 或主入口文件中，调用 `initializeInjector()` 来激活整个机制。
3.  **[测试]** 进行全链路集成测试。

---

## 4. 待解决的关联问题 (Known Issues for Phase 4)

以下问题在 Phase 3 的规划中被识别出来，但需要在后续（如 Phase 4 UI设计）阶段统一解决：

*   **[P0] 任务队列并发控制**:
    *   **问题**: `任务执行器.ejs` 目前硬编码了每轮最大处理任务数（如 3）。这应该是一个用户可配置的参数。
    *   **规划解决方案**:
        1.  **后端**: 在 `global.config` 中增加 `max_tasks_per_turn` 字段。
        2.  **前端**: 设计一个设置 UI（如滑块），允许用户调整此数值，并通过事件通知后端更新变量。
        3.  **EJS**: 渲染时读取 `worldState.global.config.max_tasks_per_turn`。
        4.  **清理逻辑**: 后端脚本需要实现真正的任务清理逻辑（检查 `VARIABLE_UPDATE_ENDED` 的结果），确保 LLM 完成任务后，任务被从 `task_queue` 中移除。

---

## 5. 设计文档索引 (Design Document Index)

*   [**总规划** - 025_Phase3_Prompt_Engineering_Master_Plan_v2.md](.kilocode/development_logs/025_Phase3_Prompt_Engineering_Master_Plan_v2.md)
*   [**变量列表** - 026_Design_VariableList_EJS_v2.md](.kilocode/development_logs/026_Design_VariableList_EJS_v2.md)
*   [**任务执行器** - 027_Design_TaskExecutor_EJS_v2.md](.kilocode/development_logs/027_Design_TaskExecutor_EJS_v2.md)
*   [**规则与格式** - 028_Design_RuleAndFormat_EJS_v2.md](.kilocode/development_logs/028_Design_RuleAndFormat_EJS_v2.md)
*   [**动态上下文注入** - 029_Design_DynamicContext_v2.md](.kilocode/development_logs/029_Design_DynamicContext_v2.md)

**Phase 3 规划阶段到此结束。**
