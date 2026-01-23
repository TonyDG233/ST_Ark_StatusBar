# Stage 3: 世界书条目与提示词工程最终规划 (V3)

本规划基于对您所有反馈的深度整合与反思，旨在成为 Stage 3 开发阶段的唯一、最终的指导蓝图。

---

## **第一部分：核心架构与职责再定义**

### **1.1 `变量列表.ejs` (The Context Provider)**
*   **职责**: 它的唯一职责是为**额外解析LLM**提供一个**干净、有序、高度可读的当前世界状态快照**。
*   **核心逻辑**:
    1.  **分门别类**: 必须将 `stat_data` 中的变量按照 `Global`, `Player`, `Characters`, `Chronicle` 四大模块进行清晰的组织和展示。
    2.  **优先级排序**: 在每个模块内部，重要的、高频变化的变量（如 `global.time`, `player.status`）应该被置于顶部。
    3.  **垃圾信息过滤**: **必须**过滤掉对LLM无用的运行时变量，特别是 `task_queue` 和所有 `_internal` 字段。
    4.  **三阶段上下文展示**: 在 `Characters` 模块下，严格按照 `Active` > `Nearby` > `Unloaded` 的顺序和层级展示角色信息：
        *   `Active`: 展示角色的**完整动态数据** (`CharacterDynamicSchema` 或 `CharacterFullSchema`)。
        *   `Nearby`: 只展示角色的**基础状态** (`name`, `location`, `action`)。
        *   `Unloaded`: 只展示**角色名字列表**，作为存在性提醒。
    5.  **编年史渲染**: 在 `Chronicle` 模块下，不能只罗列缓冲区，而是要将最新的几条总结（如 `round_buffer` 的最后5条）清晰地展示出来，为LLM提供近期历史上下文。
*   **结论**: `变量列表.ejs` 是一个纯粹的、复杂的**视图渲染模板**，**不与任何后端注入逻辑挂钩**。

### **1.2 `[mvu_update]任务执行器.ejs` (The Task Director)**
*   **职责**: 它的唯一职责是将 `task_queue` 中的任务，翻译成**额外解析LLM**可以理解和执行的、**包含完整中文指令和上下文**的行动手册。
*   **核心逻辑**:
    1.  **中文指令**: 所有指令必须是**中文**，以便您后续修改。
    2.  **完整上下文**: 必须像 `[SYSTEM] 核心指令.md` 的范例一样，为每个任务提供其执行所需的**全部信息**。例如，`repair_profile` 任务必须同时展示**缺失字段**和**已有档案**，`summarize_memory` 任务必须展示**待总结的短期记忆原文**。
    3.  **执行范围**: 本文件只负责忠实地渲染出 `task_queue` 中**存在的所有任务**。每次处理多少任务的控制逻辑在后端实现。

### **1.3 `[mvu_update]变量更新规则.ejs` (The Physics Engine)**
*   **职责**: 它的唯一职责是定义**通用的、不与特定任务挂钩的**世界状态变化规律。
*   **核心逻辑**: 定义诸如“时间流逝”、“地点变更”、“关系变化”等普适性规则。**所有与特定任务相关的动态规则，都在 `任务执行器.ejs` 中以指令的形式给出**。

### **1.4 动态世界书注入机制 (The Context Injector - 后端功能)**
*   **职责**: 这是**唯一**一个服务于**主剧情LLM**的机制。它的唯一职责是在生成前，**临时地**将角色的动态信息“嫁接”到其静态世界书条目上。
*   **核心逻辑 (V3)**:
    1.  **性能优化 (UID缓存)**: 在角色首次初始化时 (`initializeNewCharacters` in `character.ts`)，脚本会查找其对应的、`disable: false` 的世界书条目。如果找到，就获取该条目的 `uid`，并将这个 `uid` 存入该角色的MVU变量中（`characters[charName]._internal.static_profile_uid`）。
    2.  **注入阶段**: `injectContextForPlotLLM` 函数不再需要实时查找，而是直接从MVU变量中读取缓存的 `uid`。
    3.  **更新与恢复**: 使用 `uid` 进行精确的 `updateWorldEntry` 和恢复操作。
    4.  **触发时机**: 由 `global.ts` 中的事件钩子（`CHAT_GENERATING`）触发注入，由 `MESSAGE_RENDERED` 触发清理。
    5.  **插入点**: 使用**正则表达式**查找 `阿米娅.yaml` 中类似 `\n人际关系：` 的结构化锚点进行插入，无需手动预埋标签。

---

## **第二部分：最终实现步骤 (V3)**

1.  **规划文档**: 将本规划更新到 `.kilocode/development_logs/017_Phase3_Prompt_Engineering_Plan.md`。(当前步骤)
2.  **Schema扩展**:
    *   为 `CharacterSchema` 的 `_internal` 对象添加 `static_profile_uid: z.number().optional()` 字段。
3.  **提示词工程 (EJS)**:
    *   **A. `变量列表.ejs`**: 按照 **V3** 的要求，创建一个全新的、复杂的视图渲染模板。
    *   **B. `[mvu_update]变量更新规则.ejs`**: 创建一个纯静态的通用规则YAML文件。
    *   **C. `[mvu_update]任务执行器.ejs`**: 为**所有**已定义的任务类型，编写详尽的、带上下文的**中文**指令渲染逻辑。
    *   **D. `[mvu_update]变量输出格式.ejs`**: 在官方模板基础上，微调 `Analysis` 部分的引导语。
4.  **动态注入机制 (后端TS)**:
    *   **A.** 在 `character.ts` 中，修改 `initializeNewCharacters` 函数，增加查找并缓存 `uid` 的逻辑。
    *   **B.** 在 `character.ts` 中，实现 **V3** 版本的 `injectContextForPlotLLM` 和 `cleanupInjectedContext` 函数。
    *   **C.** 在 `global.ts` 中，实现事件监听，并在正确的时机调用上述注入和清理函数。
5.  **后端闭环**:
    *   在 `global.ts` 的 `postProcessCompletedTasks` 中，为所有任务类型补全清理逻辑。
6.  **全链路测试**。

---
---

## **V4 修正与增补**

本章节是基于 V3 规划的增补和修正，旨在包含所有已讨论的细节、风险规避方案和更精确的逻辑定义。

### **第一部分：核心架构与职责 (修正与增补)**

#### **1.1 `变量列表.ejs` (The Context Provider)**
*   **核心逻辑 (修正)**:
    *   **三阶段上下文展示 (细节增补)**: 在 `Characters` 模块下，展示逻辑必须区分角色的静/动态类型。
        *   `Active`:
            *   **静态角色** (`_internal.static_profile_uid` 存在): 只展示其**动态数据** (`CharacterDynamicSchema` 部分)，并明确标记 `(静态档案已由世界书提供)`。
            *   **动态角色** (`_internal.static_profile_uid` 不存在): 展示其**完整数据** (`CharacterFullSchema`)。
        *   `Nearby`: (逻辑不变) 只展示基础状态。
        *   `Unloaded`: (逻辑不变) 只展示名字列表。

#### **1.2 动态世界书注入机制 (The Context Injector)**
*   **核心逻辑 (修正与增补)**:
    *   **Plan A: 动态修改 (主方案)**
        *   **触发**: `global.ts` 监听 `CHAT_GENERATING` 事件，调用 `character.ts` 的注入函数。
        *   **清理**: `global.ts` 监听 `MESSAGE_RENDERED` 事件，调用 `character.ts` 的清理函数。
        *   **注入逻辑**: (V3逻辑不变) 使用 UID 缓存和正则进行精确、高效的注入和恢复。
    *   **Plan B: 独立世界书条目 (备用方案)**
        *   **触发**: 如果 Plan A 经测试发现不稳定，则切换到此方案。
        *   **实现**:
            1.  创建一个名为 `[mvu_plot]动态角色上下文` 的**高优先级、高深度**的世界书条目。
            2.  `injectContextForPlotLLM` 函数的逻辑将**完全改变**：它不再调用 `updateWorldEntry` 去修改**别的**条目，而是改为调用 `updateWorldEntry` 来覆写**这一个** `[mvu_plot]动态角色上下文` 条目的内容。
            3.  其内容将是所有 Active 角色的动态信息自然语言描述的**集合**。
            4.  `cleanupInjectedContext` 函数的逻辑则变为将这个条目的内容清空。
        *   **风险**: 此方案牺牲了上下文与静态档案的“无缝感”，但保证了系统的稳定性。

### **第二部分：最终实现步骤 (V4)**

1.  **Schema扩展**:
    *   为 `CharacterSchema` 的 `_internal` 对象添加 `static_profile_uid: z.number().optional()` 字段。
2.  **提示词工程 (EJS)**:
    *   **A. `变量列表.ejs`**: 严格按照 **V4** 中增补的逻辑，实现区分静/动态角色的三阶段上下文渲染。
    *   **B. `[mvu_update]变量更新规则.ejs`**: (逻辑不变) 创建通用的静态规则。
    *   **C. `[mvu_update]任务执行器.ejs`**: (逻辑不变) 为所有任务类型编写详尽的中文指令。
    *   **D. `[mvu_update]变量输出格式.ejs`**: (逻辑不变) 微调引导语。
3.  **动态注入机制 (后端TS)**:
    *   **A. (Plan A)** 在 `character.ts` 中实现基于 UID 缓存和正则替换的注入/清理函数。
    *   **B. (Plan A)** 在 `global.ts` 中实现基于 `CHAT_GENERATING` 和 `MESSAGE_RENDERED` 事件的调用逻辑。
    *   **C. (测试)** 对 Plan A 进行严格的稳定性测试。
    *   **D. (Plan B)** 如果 Plan A 失败，则快速切换到 Plan B 的实现。
4.  **后端闭环**:
    *   在 `global.ts` 的 `postProcessCompletedTasks` 中，为所有任务类型补全清理逻辑。
