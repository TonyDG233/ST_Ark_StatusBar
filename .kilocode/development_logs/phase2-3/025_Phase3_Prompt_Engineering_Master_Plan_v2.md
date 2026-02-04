# Phase 3: 提示词工程总括规划 v2 (Master Plan v2)

**日期**: 2026-01-22

**目的**: 本文档是 Stage 3 提示词工程的顶层设计与任务索引。它基于对 `.kilocode/development_logs/020_User_Feedback_Summary.md` 中所有原始反馈的分析，旨在将您的需求与具体的技术实现路径清晰地关联起来。**此版本为净化版，移除了所有已被废弃的设计链接，并重申了“先规划，后验证，再开发”的核心原则。**

---

## 3.1 待办文件清单 (File Checklist)

*   **提示词工程 (EJS 模板)**:
    *   `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` (新建)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量输出格式.ejs` (新建)
*   **后端逻辑 (关联修改)**:
    *   `src/ARK_STATUSBAR/logic/updaters/character.ts`
    *   `src/ARK_STATUSBAR/logic/updaters/global.ts`

---

## 3.2 文件核心功能 (Core Functionality by File)

*   **`变量列表.ejs`**:
    *   **核心职责**: 为分析 LLM 渲染一个全面、干净、易于理解的世界状态快照。
    *   **关键要求**: 
        *   使用 `define()` 建立全局数据源 `worldState`。
        *   实现三阶段角色显示逻辑（在场、可能在场、不在场）。
        *   完整显示所有 `chronicle` 历史摘要。
        *   过滤掉 `_internal` 等对 LLM 无用的技术性变量。
        *   为关键变量（如战力）提供解释性说明。
*   **`[mvu_update]任务执行器.ejs`**:
    *   **核心职责**: 将 `task_queue` 中的任务翻译成带上下文的、可执行的中文指令。
    *   **关键要求**: 
        *   必须使用**独立的 `if` 块**或类似逻辑，确保一轮内可处理多种不同类型的任务。
        *   对于需要生成大型对象的任务（如角色初始化），必须提供带注释的 YAML 结构模板作为输出引导。
        *   对于需要循环处理的任务（如多个角色的记忆总结），必须使用 `for` 循环生成多条指令。
*   **`[mvu_update]变量更新规则.ejs`**:
    *   **核心职责**: 定义通用的、不与特定任务挂钩的世界状态变化规律（例如，时间流逝规则）。
*   **`[mvu_update]变量输出格式.ejs`**:
    *   **核心职责**: 严格按照 `.kilocode/workflows/✅变量输出格式.md` 定义分析 LLM 输出 JSON Patch 的固定格式。
*   **`character.ts` / `global.ts` (后端)**:
    *   **核心职责**: 配合 EJS 实现动态上下文注入。
    *   **关键要求**: 
        *   使用正确的 `tavern_events.GENERATE_BEFORE_COMBINE_PROMPTS` 事件钩子进行注入。
        *   补全任务队列的清理逻辑。

---

## 3.3 参考文档与技术栈 (References & Tech Stack)

| 文件/模块 | 核心技术/参考 | 关联设计文档 (待创建) |
|---|---|---|
| **EJS 模板 (全部)** | `EJS`, `lodash` | `.kilocode/development_logs/026_Design_VariableList_EJS_v2.md` (及后续) |
| | **`references/doc_ST-Prompt-Template/*.md` (必读)** | |
| | **`references/参考_旧剧情模块前端项目_学习挂载逻辑/[SYSTEM] 核心指令.md` (必读)** | |
| **后端逻辑 (全部)** | `TypeScript` | `.kilocode/development_logs/011_Phase2.2_Character_Design.md` |
| | `@types/iframe/event.d.ts` (查找事件) | |
| | `@types/function/worldbook.d.ts` (API) | |

---

## 3.4 开发步骤 (Development Workflow)

**绝对禁止在所有规划阶段完成并获得批准前，进行任何编码工作。**

1.  **[规划]** 创建并迭代 `.kilocode/development_logs/026_Design_VariableList_EJS_v2.md`。**此为能力验证步骤，必须获得您的明确批准。**
2.  **[规划]** (待批准后) 逐一为其他核心 EJS 文件创建并迭代专属的设计文档。
3.  **[规划]** (待批准后) 完成动态上下文注入机制的详细设计。
4.  **[审核]** 提交所有设计文档，进行最终审核。
5.  **[编码]** (待所有设计批准后) 开始按照设计文档，逐一实现 EJS 文件和后端逻辑。
6.  **[测试]** 进行全链路集成测试。
7.  **[总结]** 制作最终的总结文档。
