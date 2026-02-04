# 开发日志 041: Phase 3 集成测试反馈与修复计划

**日期**: 2026-01-25
**状态**: **规划中 (Planning)**
**执行者**: Agent (Kilo Code)

---

## 1. 背景与目的 (Context & Objective)

在完成 Phase 3 的核心 EJS 模板和后端逻辑编码后，项目进入了初步的集成测试阶段。根据用户的反馈，测试暴露了从构建流程到核心变量注入逻辑的一系列问题。

本文档旨在对所有已知问题进行一次全面的代码审查 (Code Review)，系统性地分析问题根源，并制定一套详尽、可审查、可执行的修复计划。此计划将作为后续所有修复工作的指导蓝图。

---

## 2. 已知问题与解决方案 (Issues & Solutions)

### 问题 1: (未解决) LLM 角色档案注入失败 (已确认)

*   **现象**: 在额外模型解析阶段，模型正确地生成了更新角色档案的 JSON Patch，但该操作未能成功更新至 MVU 变量中。
*   **根本原因分析 (已确认)**: 这是一个由三个核心文件中的设计缺陷共同导致的连锁问题：
    1.  **[根源] Schema 结构性缺陷**: `src/ARK_STATUSBAR/mvu/schemas/character.ts` 中，通过 `z.discriminatedUnion` 和一个多余的 `data` 字段，人为地创造了一个不必要的嵌套层级 (`characters.角色名.data.profile`)。这使得正确的 JSON Patch 路径变得复杂且反直觉。
    2.  **[误导] 规则描述不当**: `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` 在定义 `characters` 的更新规则时，不仅没有清晰地展平结构，反而通过 `data.profile`、`data.status` 等示例路径，**强化和固化**了 LLM 对这个错误 `data` 层级的认知，起到了严重的误导作用。
    3.  **[执行] 任务模板错误**: `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` 在处理 `init_profile` 和 `summarize_memory` 任务时，其提供的 JSON Patch 指令模板的 `value` 部分，**直接包含了错误的 `data` 嵌套结构**。这导致 LLM 生成的最终产物必定是无效的。

*   **涉及文件**:
    *   `src/ARK_STATUSBAR/mvu/schemas/character.ts` (**根源**)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]变量更新规则.ejs` (**误导**)
    *   `src/ARK_STATUSBAR/prompts/dynamic/[mvu_update]任务执行器.ejs` (**执行**)

*   **解决方案 (最终整合方案)**:
    1.  **[核心思想] 将复杂性从 LLM 转移至后端**: LLM 的任务被简化为只生成结构统一的、包含完整 `profile` 和 `skills` 的角色档案。由后端脚本在接收到新档案后，自动判断该角色是“静态”（有世界书条目）还是“动态”，并为其附加正确的 `has_static_profile` 标志。
    2.  **[Schema] 结构扁平化 (最终形态)**:
        *   **重构 `src/ARK_STATUSBAR/mvu/schemas/character.ts`**，移除 `data` 嵌套层级，同时保持 `profile` 和 `skills` 字段为**必需项**，以保证动态角色档案的完整性校验。
        *   **新增 `has_static_profile`**: 在 `CharacterSchema` 中直接加入 `has_static_profile: z.boolean().default(false)` 字段，后续由后端逻辑进行维护。
    3.  **[Backend] 实现世界书检查与后处理逻辑**:
        *   **补全缺失设计**: 在 `src/ARK_STATUSBAR/logic/updaters/character.ts` 中，必须**实现**在 [`.kilocode/development_logs/029_Design_DynamicContext_v2.md`](./029_Design_DynamicContext_v2.md) 中规划的 `buildStaticCharacterCache` 缓存构建逻辑。
        *   **实现后处理**: 在 `character.ts` 的 `VARIABLE_UPDATE_ENDED` 事件监听器中，当检测到一个新角色被创建时（即 `!oldChar && newChar`），立刻执行：
            *   调用 `buildStaticCharacterCache` (或从缓存) 中检查该角色是否存在于世界书。
            *   如果存在，则通过 `Mvu.replaceMvuData` 将该角色的 `has_static_profile` 字段更新为 `true`。
        *   **修复逻辑扩展**: `repair_profile` 任务的执行逻辑未来需要扩展，使其能够读取 `has_static_profile` 标志，并根据其值决定是从世界书模板比对修复还是直接请求 LLM 修复。
    4.  **[EJS] 统一任务模板**:
        *   `任务执行器.ejs` 中的 `init_profile` 任务模板保持不变（因为它生成的已是完整档案），只需在后续步骤中移除 `.data` 嵌套。
        *   `变量更新规则.ejs` 和 `变量列表.ejs` 将基于扁平化的、包含 `has_static_profile` 的新 Schema 进行修改。
    
*   **潜在问题与规避**:
    *   **连锁反应 (已确认)**: `character.ts` 的 Schema 变更将影响 `变量列表.ejs`, `任务执行器.ejs`, `变量更新规则.ejs`, `logic/updaters/character.ts`。所有这些都必须同步修改。
    *   **世界书API依赖**: `buildStaticCharacterCache` 的实现依赖于 `@types/function/worldbook.d.ts` 中的 `getEnabledWorldInfoEntries` API。

### 问题 2: (潜在) 后端逻辑未与主入口关联 (已确认)

*   **现象**: 所有 `src/ARK_STATUSBAR/logic/updaters/` 下的后端逻辑（如任务清理、生命周期管理）均未被调用，处于“沉睡”状态。
*   **根本原因分析 (已确认)**: 后端逻辑模块是“孤岛”。`src/ARK_STATUSBAR/index.ts` 作为脚本的唯一主入口，只负责前端UI的挂载，完全没有 `import` 任何 `logic/updaters/` 目录下的文件。因此，这些文件内的代码（包括 `VARIABLE_UPDATE_ENDED` 事件监听器）从未被执行。

*   **涉及文件**:
    *   `src/ARK_STATUSBAR/index.ts` (**入口**)
    *   `src/ARK_STATUSBAR/logic/updaters/global.ts` (**孤岛逻辑**)
    *   `src/ARK_STATUSBAR/mvu/schemas/global.ts` (**缺少开关**)

*   **解决方案 (最终重构方案)**:
    1.  **[核心思想] 统一事件入口，解耦业务逻辑**: 当前多个 `updater` 文件内均有独立的 `VARIABLE_UPDATE_ENDED` 事件监听器，这会导致触发顺序不可控和管理困难。必须重构为唯一的事件入口，统一调度所有后端逻辑。
    2.  **[解耦] 各模块逻辑导出**:
        *   在 `character.ts`, `chronicle.ts`, `player.ts` 和 `global.ts` 中，移除匿名的 `eventOn(...)` 包装。
        *   将原监听器内的所有业务逻辑分别重构为可导出的函数，如 `export async function processCharacterUpdates(newVariables, oldVariables)`。
    3.  **[集中控制] 创建唯一主循环**:
        *   在 `src/ARK_STATUSBAR/logic/updaters/global.ts` 中，创建一个 `export function initializeBackendLogic()`。
        *   此函数将是系统中**唯一**监听 `Mvu.events.VARIABLE_UPDATE_ENDED` 的地方。
        *   在该事件的回调中，将按预定顺序 (`character` -> `player` -> `chronicle` -> `global`) `await` 调用从各模块导入的 `process...Updates` 函数。
        *   所有模块逻辑执行完毕后，调用一次 `Mvu.replaceMvuData()` 将所有变更一次性写入。
    4.  **[关联] 连接主入口**:
        *   `src/ARK_STATUSBAR/index.ts` 将导入并调用 `initializeBackendLogic()`，从而启动整个后端逻辑循环。
        *   **执行**: 此方案将涉及对 `index.ts` 以及 `logic/updaters/` 目录下所有四个 `ts` 文件的修改。

*   **潜在问题与规避**:
    *   **循环触发**: 必须确保后端逻辑对变量的修改不会再次触发 `VARIABLE_UPDATE_ENDED` 事件从而导致无限循环。
    *   **规避**: `global.ts` 中现有的逻辑是在所有处理完成后进行一次性的 `Mvu.replaceMvuData(mutableVariables)`，这本身是安全的，因为 `replaceMvuData` 不会再次触发当前正在执行的 `ENDED` 事件。但在后续开发中，任何在回调函数内直接调用 `Mvu.replaceMvuData` 的行为都需要谨慎审查。

### 问题 3: (潜在) 角色初始化逻辑缺失 (已确认)

*   **现象**: `character.ts` 的设计要求“开局1-2轮内，无论有无新角色都要推送角色初始化指令”，该逻辑在后端实现中缺失。
*   **根本原因分析 (已确认)**: `src/ARK_STATUSBAR/logic/updaters/character.ts` 中的 `initializeNewCharacters` 函数只在新角色出现时被动触发 `init_profile` 任务。完全缺失一个在游戏开局阶段，主动检查所有在场角色的档案完整性并强制推送初始化任务的机制。

*   **涉及文件**:
    *   `src/ARK_STATUSBAR/logic/updaters/character.ts` (**逻辑缺失**)
    *   `src/ARK_STATUSBAR/logic/updaters/global.ts` (**需要集成新逻辑**)
    *   `src/ARK_STATUSBAR/mvu/schemas/global.ts` (**缺少标志位**)

*   **解决方案 (最终计划)**:
    1.  **[Backend] 整合初始化逻辑**:
        *   修改 `src/ARK_STATUSBAR/logic/updaters/character.ts` 中的 `initializeNewCharacters` 函数。
        *   在该函数内部，除了检测 `newChars` (新出现的角色) 之外，再增加一个条件判断：`if (get(variables, 'stat_data.global.game_progress.total_turns', 0) <= 2)`。
        *   如果该条件成立，则将 `allPresentChars` (所有在场角色) 视为需要检查并可能推送 `init_profile` 任务的目标。
        *   通过这种方式，将两种初始化触发条件（“新角色出现时”和“开局前两轮时”）合并在一个函数内处理，逻辑清晰且无需新增函数。
        *   **执行**: 修改 `src/ARK_STATUSBAR/logic/updaters/character.ts`。

*   **潜在问题与规避**:
    *   **任务重复推送**: 合并后的逻辑必须确保在开局阶段，一个新出现的角色不会被重复添加两次 `init_profile` 任务。
    *   **规避**: 在函数末尾，对所有待初始化的角色列表进行去重处理，然后再遍历推送任务。
    *   **轮次判断的可靠性**: 使用 `total_turns` 判断开局阶段的前提是后端逻辑已正常运行。这是一个可接受的风险。

---

## 3. 总体修复步骤枚举 (Overall Fix Workflow)

1.  **阶段一：Schema 修正与后端入口打通 (最优先)**
    1.  `[Schema]` 修改 `src/ARK_STATUSBAR/mvu/schemas/character.ts`，移除 `data` 层级。
    2.  `[Schema]` 修改 `src/ARK_STATUSBAR/mvu/schemas/global.ts`，添加 `backend_logic_enabled` 和 `initialization_phase` 开关。
    3.  `[Backend]` 修改 `src/ARK_STATUSBAR/logic/updaters/global.ts`，创建 `initializeBackendLogic` 函数并实现事件监听和总开关逻辑。
    4.  `[Backend]` 修改 `src/ARK_STATUSBAR/index.ts`，调用 `initializeBackendLogic`。

2.  **阶段二：修复角色初始化逻辑**
    1.  `[Backend]` 修改 `src/ARK_STATUSBAR/logic/updaters/character.ts`，实现 `manageInitialProfileTasks` 函数。
    2.  `[Backend]` 将 `manageInitialProfileTasks` 的调用逻辑集成到 `global.ts` 的事件回调中。
    3.  `[Backend]` 在 `global.ts` 中实现 `initialization_phase` 的退出机制。

3.  **阶段三：修复 EJS 模板与规则**
    1.  `[EJS]` 全局审查并修改所有受 `character.ts` Schema 变更影响的 EJS 文件，主要是 `变量列表.ejs` 和 `任务执行器.ejs`。
    2.  `[EJS]` 重写 `[mvu_update]变量更新规则.ejs` 中关于 `characters` 的部分，使其与新的 Schema 结构严格对应。

---

## 4. 额外问题与备注 (Additional Notes)

*   **技术债务记录**: 当前的 `validateAndRepairCharacter` 修复逻辑过于依赖 LLM 的自觉性。它仅能检测到缺失字段并请求 LLM 填充，但并未实现更健壮的“与世界书模板进行比对，优先从模板恢复数据，仅将模板中不存在的字段交由 LLM 填充”的高级修复逻辑。此缺陷已记录，将在后续迭代中进行返工优化。
*   本次修复工作将严格遵循新建立的 SOP，即“方案先行，批准后执行”。在执行上述每一个阶段的修复前，我都会向您提供具体的代码修改方案（伪代码或 diff 格式），待您批准后再进行操作。
*   修复完成后，需要进行一轮更全面的回归测试，以确保旧问题已解决且未引入新问题。

此计划已准备好供您审查。