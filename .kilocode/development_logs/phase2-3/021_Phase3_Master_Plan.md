# Phase 3: 提示词工程总括规划 (Master Plan)

**日期**: 2026-01-22

**目的**: 本文档是 Stage 3 提示词工程的顶层设计与任务索引。它基于对 `.kilocode/development_logs/020_User_Feedback_Summary.md` 中所有原始反馈的分析，旨在将您的需求与具体的技术实现路径清晰地关联起来。

---

## 3.1 待编辑文件清单 (Files to Be Edited)

*   **Schema 定义**:
    *   `src/ARK_STATUSBAR/mvu/schemas/character.ts`
*   **后端逻辑**:
    *   `src/ARK_STATUSBAR/logic/updaters/character.ts`
    *   `src/ARK_STATUSBAR/logic/updaters/global.ts`
*   **提示词工程 (EJS 模板)**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量输出格式.ejs` (新建)

---

## 3.2 文件功能实现清单 (Feature Implementation by File)

*   **`character.ts` (Schema)**:
    *   重构 `CharacterSchema`，统一数据结构，将元数据 (`has_static_profile`, `static_profile_uid`) 整合到 `_internal` 对象中。
*   **`character.ts` (Updater)**:
    *   实现 `initializeNewCharacters` 逻辑，增加查找并缓存世界书 `uid` 的功能。
    *   实现 `injectContextForPlotLLM` 函数，用于将静态角色的完整动态数据 (`CharacterDynamicSchema`) 渲染为自然语言并注入世界书。
    *   实现 `cleanupInjectedContext` 函数，用于在生成结束后恢复世界书的原始内容。
*   **`global.ts` (Updater)**:
    *   实现事件监听逻辑，使用 `tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS` 和 `tavern_events.GENERATION_ENDED` 分别调用注入和清理函数。
    *   补全 `postProcessCompletedTasks` 逻辑，确保所有类型的任务在完成后都能被正确地从 `task_queue` 中移除。
*   **`变量列表.ejs`**:
    *   为分析 LLM 渲染一个全面、干净的世界状态快照。
    *   **必须**完整显示所有 `chronicle` 缓冲区。
    *   **必须**过滤掉 `_TEMPLATE_*` 模板角色。
*   **`[mvu_update]任务执行器.ejs`**:
    *   将 `task_queue` 中的任务翻译成带上下文的、可执行的中文指令。
    *   对于需要生成大型对象的任务，**必须**提供带注释的 YAML 结构模板作为输出引导。
*   **`[mvu_update]变量更新规则.ejs`**:
    *   定义通用的、不与特定任务挂钩的世界状态变化规律。
*   **`[mvu_update]变量输出格式.ejs`**:
    *   定义分析 LLM 输出 JSON Patch 的固定格式。

---

## 3.3 参考文档与技术栈 (References & Tech Stack)

| 文件/模块 | 核心技术/参考 | 关联设计文档 |
|---|---|---|
| **EJS 模板 (全部)** | `EJS`, `lodash` | `.kilocode/development_logs/022_Design_VariableList_EJS.md` (及后续) |
| | `references/doc_ST-Prompt-Template/*.md` | |
| | `references/参考_旧剧情模块前端项目_学习挂载逻辑/[SYSTEM] 核心指令.md` | |
| **Schema (全部)** | `zod` | `.kilocode/development_logs/010-013_*_Design.md` |
| **后端逻辑 (全部)** | `TypeScript` | `.kilocode/development_logs/010-013_*_Design.md` |
| | `@types/iframe/event.d.ts` | |
| | `@types/function/worldbook.d.ts` | |
| | `@types/iframe/exported.mvu.d.ts` | |

---

## 3.4 原始反馈对应关系 (Mapping to Original Feedback)

| 模块/功能点 | 对应的核心反馈 (来自 `020_...Summary.md`) |
|---|---|
| **`变量列表.ejs`** | `反馈 1`: 历史提要必须完整显示。 |
| **`任务执行器.ejs`** | `反馈 1`: 必须为复杂任务提供输出结构引导。 |
| **动态注入机制** | `反馈 1`: 必须使用正确的事件钩子 (`GENERATE_BEFORE_COMBINE_PROMPTS`)。 |
| **`CharacterSchema` 重构** | `反馈 1`: 必须解决 `uid` 和 `has_static_profile` 的逻辑混乱问题，统一数据结构。 |
| **所有 EJS 文件** | `反馈 1`: 设计必须基于 EJS 参考文档，并添加维护指引注释。 |

---

## 3.5 具体开发顺序步骤 (Development Steps)

1.  **[规划]** 创建并迭代 `022_Design_VariableList_EJS.md`，直到您完全满意。
2.  **[规划]** 逐一为其他核心文件创建并迭代专属的设计文档。
3.  **[编码]** **(在所有设计文档通过后)** 开始 `character.ts` Schema 的重构工作。
4.  **[编码]** 实现 `变量列表.ejs`。
5.  **[编码]** 实现 `任务执行器.ejs`。
6.  **[编码]** 实现 `变量更新规则.ejs` 和 `变量输出格式.ejs`。
7.  **[编码]** 实现后端的动态注入和清理逻辑 (`character.ts` & `global.ts`)。
8.  **[编码]** 实现后端的任务清理逻辑 (`global.ts`)。
9.  **[测试]** 进行全链路集成测试。
10. **[总结]** 制作最终的总结文档。
