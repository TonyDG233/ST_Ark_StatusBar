# Phase 3, Day 2: 架构重构与 Stage 3 规划

**日期**: 2026-01-21
**状态**: Stage 2 基本完成，Stage 3 规划中

## 1. 今日核心进展

今天的开发工作核心是完成了一次重要的架构重构，并将 Stage 2 的后端逻辑开发基本完成。

### 1.1 统一任务队列重构

*   **动机**: 您的反馈指出，为 `Character`, `Player`, `Chronicle` 各自维护任务队列会导致逻辑分散，不易管理。
*   **决策**: 我们决定将所有独立的任务队列合并为一个位于 `stat_data.task_queue` 的**全局统一任务队列**。
*   **实施**:
    1.  在 `mvu/schemas/global.ts` 中定义了新的、包含所有任务类型的 `TaskQueueSchema`。
    2.  移除了 `character.ts` 和 `chronicle.ts` schema 中的旧队列定义。
    3.  更新了 `mvu/index.ts` 以正确链接新的全局队列 schema。
    4.  重构了 `logic/updaters/character.ts`, `player.ts`, `chronicle.ts` 中的所有任务推送函数，使其全部指向 `stat_data.task_queue`。

### 1.2 引入“后处理中心”设计模式

*   **动机**: 您进一步指出，任务的产生、消费和清理应该有明确的职责划分。
*   **决策**: 我们确立了“生产者-消费者-后处理器” (Producer-Consumer-PostProcessor) 的新设计模式。
    *   **生产者 (Producers)**: 各 updater 脚本 (`character.ts` 等) 负责检测状态变化并**生成**任务。
    *   **消费者 (Consumer)**: EJS 模板 (`[mvu_update]任务执行器.ejs`) 负责**读取**任务队列，并将其渲染为 LLM 指令。
    *   **后处理器 (Post-Processor)**: `logic/updaters/global.ts` 将作为唯一的**后处理中心**，负责在 `VARIABLE_UPDATE_ENDED` 事件中检测已完成的任务，并调用相应模块的清理函数来完成数据整理和任务移除。
*   **实施**:
    1.  在 `global.ts` 中创建了 `postProcessCompletedTasks` 函数的框架，为后续实现清理逻辑奠定了基础。

### 1.3 Zod Schema 优化

*   **动机**: 您提醒我，档案修复机制不应将“合理为空”的字段视为错误。
*   **实施**:
    1.  全面审查了 `player.ts` 和 `character.ts` 的 schema。
    2.  为 `skills`, `inventory.items`, `social`, `notes` 等 `z.record` 类型的字段，以及各种数组类型的字段（如 `known_facts`, `long_term`）添加了 `.default({})` 或 `.default([])`，确保它们在初始状态下是有效的空值。

## 2. Stage 3 详细规划 (增补)

根据您的最新指示，Stage 3 的核心——提示词工程，将围绕以下四个世界书条目展开，并且必须严格参考相关规范文档。

1.  **`[mvu_update]变量更新规则.ejs`**:
    *   **目标**: 创建一个通用的检查单，指导额外解析 LLM 判断何时以及如何更新变量。
    *   **核心参考**: `.kilocode/workflows/✅变量更新规则.md`。

2.  **`[mvu_update]变量输出格式.ejs`**:
    *   **目标**: 强制 LLM 在其思维链中输出 `<UpdateVariable>` 块和 JSON Patch，并为我们的动态任务等特殊功能注入必要的引导。
    *   **核心参考**: `.kilocode/workflows/✅变量输出格式.md`。

3.  **`变量列表.ejs`**:
    *   **目标**: 动态、选择性地向 LLM 展示相关的变量内容，以节省 Token 并聚焦 LLM 的注意力。
    *   **关键挑战**: 实现“静态/动态分离”逻辑，即当角色有静态世界书条目时，仅注入动态变化的数据。这需要 EJS 与后端脚本逻辑联动。
    *   **核心参考**: `.kilocode/workflows/✅变量列表.md`。

4.  **`[initvar]变量初始化.yaml`**:
    *   **目标**: 更新此文件，使其内容与我们最新重构后的 Zod Schema (特别是全局 `task_queue` 的引入和 `_internal` 的移除) 保持完全一致。

**通用 EJS 参考**:
*   `references/doc_ST-Prompt-Template/features_cn.md`
*   `references/doc_ST-Prompt-Template/reference_cn.md`

## 3. 下一步计划

1.  **完成 Stage 2**:
    *   实现 `global.ts` 中的 `postProcessCompletedTasks` 的具体逻辑，并从各模块导入清理函数（目前可以是空函数）。
2.  **启动 Stage 3**:
    *   从 **`[initvar]变量初始化.yaml`** 的更新开始，确保我们的基础数据结构正确无误。
    *   依次完成上述规划中的四个核心 EJS 世界书条目。
3.  **闭环开发**:
    *   在完成 EJS 消费端逻辑后，回头补全 `global.ts` 中各个任务类型的清理函数，形成完整的开发闭环。
