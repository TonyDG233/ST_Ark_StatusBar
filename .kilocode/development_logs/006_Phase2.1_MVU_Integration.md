# Phase 2.1: MVU 集成与变量规划 (MVU Integration)

**日期**: 2026-01-16
**状态**: 规划中 - 任务拆解阶段

## 1. 核心目标 (Core Objectives)
构建一个基于 Zod + Dual-LLM 的高可控变量管理系统。不仅要满足 MVU 插件的基础要求，还要结合“罗德岛终端”的特性，实现：
*   **高精度变量解析**：通过专用破限预设，让额外 LLM 准确提取剧情状态。
*   **无缝上下文注入**：通过动态修改世界书，将变量状态优雅地反馈给主剧情 LLM。
*   **结构化数据存储**：设计一套既符合剧情逻辑又利于代码维护的 Zod 变量结构。

---

## 2. 任务分解大纲 (Task Breakdown)

### 2.1 基础合规性任务 (MVU Requirements)
基于 `.kilocode/workflows/` 中的插件作者规范，我们需要完成以下基础构建：

*   **变量结构脚本 (`src/.../脚本/变量结构/index.ts`)**:
    *   必须使用 Zod 4.x 定义 `export const Schema`。
    *   核心原则：幂等性 (`Schema.parse(Schema.parse(input)) === Schema.parse(input)`)。
    *   推荐使用 `z.record` 替代 `z.array` 以便于更新。
    *   数值类型推荐使用 `z.coerce.number()`。
*   **世界书条目配置**:
    *   **[mvu_update]变量更新规则**: 定义每个变量在什么剧情下触发更新 (D0 深度)。
    *   **[mvu_update]变量输出格式**: 强制 AI 输出 `<UpdateVariable>` 块和 JSON Patch。
    *   **变量列表**: 动态显示当前变量值（`{{format_message_variable::stat_data}}`）。
    *   **[initvar]变量初始设置**: 定义默认值。

### 2.2 架构增强任务 (Architecture Enhancements)
结合您的核心点子，我们需要在基础合规性之上构建更强大的控制层：

*   **破限与解析控制 (Breaking & Parsing Control)**:
    *   **独立破限预设**: 不依赖主剧情的预设，为额外 LLM 设计一套专用的 System Prompt，使其成为纯粹的“状态分析员”。
    *   **工具参考**: 分析 `references/tools/【小猫之神】3.10.json` 提取破限技巧。
*   **上下文注入策略 (Context Injection Strategy)**:
    *   **动态世界书生成器**: 编写后端脚本，将 JSON 状态转换为自然语言描述（如“博士现在的精神状态极差，无法集中注意力”）。
    *   **无缝插入逻辑**: 实现“通过临时变更世界书条目内容”将上述描述注入到主 LLM 的上下文中。
*   **数据源整合 (Data Source Integration)**:
    *   **外部数据参考**: 分析 `references/tools/粥粥数据库导入模板.json`，吸取其记忆存储和上下文管理的经验。

---

## 3. 下一步讨论 (Next Steps)
我们将逐一深入讨论上述板块。请您针对 **2.2 架构增强任务** 中的每个点，分享您的具体设计思路或参考资料，我们将以此填充详细设计文档。