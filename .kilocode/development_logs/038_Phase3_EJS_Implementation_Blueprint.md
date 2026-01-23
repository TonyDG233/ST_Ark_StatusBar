# Phase 3: EJS 实施蓝图 (Implementation Blueprint)

**日期**: 2026-01-23

**目的**: 本文档是 Phase 3 (提示词工程) 所有规划工作的最终产物，旨在将纵向的功能设计与横向的数据域规划相结合，为下一阶段的编码实现提供一个统一、清晰、可执行的指导手册。

---

## 1. 最终文件清单与结构

**提示词仓库**: `src/ARK_STATUSBAR/prompts/dynamic/`

*   `变量列表.ejs`
*   `[mvu_update]变量更新规则.ejs`
*   `[mvu_update]任务执行器.ejs`
*   `[mvu_update]变量输出格式.ejs`

---

## 2. EJS 模板核心职责与实现要点

### 2.1 `变量列表.ejs`

*   **核心职责**: 作为数据源中枢，并为分析师 LLM 渲染一个全面、有序、上下文清晰的世界状态快照。
*   **关联纵向设计**: [`.kilocode/development_logs/026_Design_VariableList_EJS_v2.md`](.kilocode/development_logs/026_Design_VariableList_EJS_v2.md)
*   **实现要点**:
    1.  **数据源定义**: 在文件顶部使用 `<% define('worldState', getvar('stat_data')); %>` 建立全局 EJS 变量。
    2.  **分模块渲染**: 严格按照 `Global` -> `Player` -> `Character` -> `Chronicle` 的顺序渲染，确保最重要的宏观信息在前。
    3.  **信息过滤**: 必须过滤掉所有对 LLM 无用的内部变量（如 `_internal`）和不应在此处显示的数据（如 `task_queue`）。
    4.  **横向规划链接**:
        *   [Global 渲染逻辑](.kilocode/development_logs/037_EJS_Plan_Global.md#2-在-变量列表ejs-中的表现)
        *   [Player 渲染逻辑](.kilocode/development_logs/035_EJS_Plan_Player.md#2-在-变量列表ejs-中的表现)
        *   [Character 渲染逻辑 (三阶段)](.kilocode/development_logs/034_EJS_Plan_Character.md#2-在-变量列表ejs-中的表现)
        *   [Chronicle 渲染逻辑](.kilocode/development_logs/036_EJS_Plan_Chronicle.md#2-在-变量列表ejs-中的表现)

### 2.2 `[mvu_update]变量更新规则.ejs`

*   **核心职责**: 定义通用的、不与特定任务挂钩的世界状态变化规律，即“世界物理定律”。
*   **关联纵向设计**: [`.kilocode/development_logs/028_Design_RuleAndFormat_EJS_v2.md`](.kilocode/development_logs/028_Design_RuleAndFormat_EJS_v2.md)
*   **实现要点**:
    1.  **YAML 格式**: 文件最终应生成一个结构化的 YAML 提示词。
    2.  **分模块定义**: 以 `global`, `player`, `characters`, `chronicle` 作为顶级键，分别定义其下的规则。
    3.  **精确 `type`**: 所有 `type` 定义必须严格、完整地反映其对应的 Zod Schema 结构。
    4.  **横向规划链接**:
        *   [Global 规则](.kilocode/development_logs/037_EJS_Plan_Global.md#3-在-mvu_update变量更新规则ejs-中的规则)
        *   [Player 规则](.kilocode/development_logs/035_EJS_Plan_Player.md#3-在-mvu_update变量更新规则ejs-中的规则)
        *   [Character 规则](.kilocode/development_logs/034_EJS_Plan_Character.md#3-在-mvu_update变量更新规则ejs-中的规则)
        *   [Chronicle 规则](.kilocode/development_logs/036_EJS_Plan_Chronicle.md#3-在-mvu_update变量更新规则ejs-中的规则)

### 2.3 `[mvu_update]任务执行器.ejs`

*   **核心职责**: 将 `global.task_queue` 中的机器可读任务，翻译成 LLM 能理解的、带上下文和输出模板的行动指令。
*   **关联纵向设计**: [`.kilocode/development_logs/027_Design_TaskExecutor_EJS_v2.md`](.kilocode/development_logs/027_Design_TaskExecutor_EJS_v2.md)
*   **实现要点**:
    1.  **统一任务调度**: 在文件顶部，实现统一的任务读取、切片（根据 `MAX_TASKS_PER_TURN`）和分类逻辑。
    2.  **独立任务处理**: 使用独立的 `if` 或 `forEach` 块，根据任务的 `type`，分别渲染其指令。
    3.  **渲染策略**: 遵循 `REPEATED` (如 `summarize_memory`), `EXCLUSIVE` (如 `summarize_chronicle`) 等渲染策略，确保多任务处理的正确性。
    4.  **完整模板**: 为所有需要生成复杂对象的任务（如 `init_profile`），提供完整、无省略的 JSON/YAML 指令模板。
    5.  **横向规划链接**:
        *   [Player 任务逻辑](.kilocode/development_logs/035_EJS_Plan_Player.md#4-在-mvu_update任务执行器ejs-中的逻辑)
        *   [Character 任务逻辑](.kilocode/development_logs/034_EJS_Plan_Character.md#4-在-mvu_update任务执行器ejs-中的逻辑)
        *   [Chronicle 任务逻辑](.kilocode/development_logs/036_EJS_Plan_Chronicle.md#4-在-mvu_update任务执行器ejs-中的逻辑)
        *   (Global 模块无专属任务)

### 2.4 `[mvu_update]变量输出格式.ejs`

*   **核心职责**: 严格定义分析师 LLM 必须遵守的最终输出协议。
*   **关联纵向设计**: [`.kilocode/development_logs/028_Design_RuleAndFormat_EJS_v2.md`](.kilocode/development_logs/028_Design_RuleAndFormat_EJS_v2.md)
*   **实现要点**:
    1.  **直接复制**: 内容应严格复制 `.kilocode/workflows/✅变量输出格式.md` 中的规范。
    2.  **动态任务检查**: 在 `<Analysis>` 思维链中，必须插入检查动态任务的步骤，如 `${CHECK AND PLAN FOR TASKS: ...}`。

---

## 3. 开发路线图

1.  **[编码] Stage 1: 规则与格式**
    *   创建 `[mvu_update]变量输出格式.ejs`。
    *   创建 `[mvu_update]变量更新规则.ejs`，并根据横向规划填充所有模块的规则。
2.  **[编码] Stage 2: 数据展示**
    *   创建 `变量列表.ejs`，并根据横向规划实现所有模块的渲染逻辑。
3.  **[编码] Stage 3: 任务执行**
    *   创建 `[mvu_update]任务执行器.ejs`，实现统一的任务调度逻辑，并根据横向规划逐一添加 `Player`, `Character`, `Chronicle` 的任务处理模块。
4.  **[测试] Stage 4: 集成测试**
    *   在本地 SillyTavern 环境中，进行全链路集成测试，验证 EJS 渲染是否符合预期，LLM 是否能根据规则和任务正确更新变量。

---

## 4. 统一待办与风险点

*   **[待办] Schema 重构**:
    *   **核心问题**: `chronicle.ts` 中各层级总结的 Schema 结构不统一。
    *   **行动**: 在开始编码前，必须先重构 `chronicle.ts`，统一所有总结层级的 Schema 结构。
*   **[待办] `time` vs `turn`**:
    *   **核心问题**: 时间戳字段在 `character.ts` 和 `chronicle.ts` 中不统一。
    *   **行动**: 在开始编码前，必须进行全局代码审查，将所有时间戳字段统一为 `time: string`。
*   **[风险] LLM 依从性**:
    *   **核心问题**: 系统的健壮性高度依赖额外解析 LLM 对规则（特别是 `presence` 分析和 `round_buffer` 生成）的遵守程度。
    *   **规避**: 需要为额外解析 LLM 编写一个高度优化的、带有强制性规则和示例的专属破限提示词。
*   **[警告] 规划与实现的最终一致性**:
    *   **强制要求**: 本文档及所有链接的规划文档中的伪代码和省略号，在最终的 `.ejs` 文件实现中，必须被替换为完整的、与 Schema 一致的代码和结构。**这是最后一次提醒，也是最终的验收标准。**
