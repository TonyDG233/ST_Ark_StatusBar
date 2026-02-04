# 开发日志 047 (修订版): 统一化即时开局初始化逻辑

**日期**: 2026-01-27
**作者**: Kilo Code
**状态**: 方案设计 - 待审批

---

## 1. 问题背景

根据您的反馈，当前系统存在两个核心问题：
1.  **初始化延迟**: 玩家档案和角色档案的创建都依赖后端任务队列，导致在游戏的第一回合，LLM 无法获得初始化指令，体验割裂。
2.  **结构混乱**: 在 EJS 模板顶部直接添加大块逻辑，破坏了原有的“行动指令”队列式结构。

同时，我也收到了关于 `var` 关键字的重要提醒：由于 MVU 的特殊机制，必须使用 `var` 而非 `const` 或 `let` 来声明 EJS 变量，以避免潜在的解析错误。

## 2. 根本原因

问题根源在于**执行时机过迟**。后端逻辑的触发点（`VARIABLE_UPDATE_ENDED`）是在一轮完整的“用户输入 -> LLM 生成 -> 变量更新”流程**之后**，而我们需要的是在 LLM 生成**之前**就注入初始化指令。

## 3. 统一化解决方案

本方案旨在优雅地将“即时初始化”逻辑融入现有的 `任务执行器.ejs` 结构中，并同步移除后端的冗余逻辑。

### 3.1 核心原则

-   **结构统一**: 所有向 LLM 发出的指令，无论是即时的还是队列中的，都统一放在 `### 本轮行动指令` 的标题之下，形成一个清晰的任务列表。
-   **逻辑前置**: 将玩家和角色的开局初始化逻辑完全前置到 EJS 层，利用其在 LLM 生成前的执行时机。
-   **状态同步**: 使用一个 EJS 内部的旗标 (`var hasPrintedTask`) 来跟踪是否已有任务被打印，以智能判断是否需要显示“常规任务”的提示。
-   **后端清理**: 移除后端 `character.ts` 和 `player.ts` 中与开局初始化相关的冗余代码。

### 3.2 EJS 层修改 (`[mvu_update]任务执行器.ejs`)

**目标**: 将整个文件重构为一个四段式结构：1. 预计算 -> 2. 即时任务 -> 3. 队列任务 -> 4. 默认动作。

**建议重构内容**:
```ejs
<%
    // ========================================================================
    // [Part 1: Pre-computation & Flag Initialization]
    // ========================================================================
    // 使用 var 以兼容 MVU 解析器
    var hasPrintedTask = false;

    // --- 防御性编程：检查核心对象是否存在 ---
    if (typeof worldState === 'undefined') {
        var worldState = getvar('stat_data');
    }
    
    // --- 任务队列读取 ---
    var taskQueue = (worldState && worldState.task_queue) ? worldState.task_queue : [];
    // 兼容旧版，如果 config 不存在则使用默认值
    var MAX_TASKS_PER_TURN = (worldState && worldState.global && worldState.global.config) ? worldState.global.config.max_tasks_per_turn : 3;
    var tasksToProcess = taskQueue.slice(0, MAX_TASKS_PER_TURN);
%>
---
特殊变量更新规则：
### **本轮行动指令**
*你必须严格按照以下任务指令行动，并在最终的 `<JSONPatch>` 块中完成所有要求。*

<%
    // ========================================================================
    // [Part 2: Instant Initialization Logic (Hotfix)]
    // ========================================================================
    // 此部分负责在游戏开局时，绕过任务队列，直接注入初始化指令。
    try {
        var userMessageCount = SillyTavern.chat.filter(m => m.is_user).length;

        // --- A. 玩家档案即时初始化 ---
        // 检查条件: 1. 用户第一条消息 2. 常规生成 3. 玩家数据不存在
        if (userMessageCount === 1 && generateType === 'normal' && (!worldState || !worldState.player)) {
            hasPrintedTask = true;
%>
---
#### **[最高优先级任务: 玩家档案初始化]**
**任务**: 系统检测到玩家档案为空，请根据开场白和用户的初始输入，创建玩家档案。
**核心要求**: 档案必须信息详实、逻辑自洽。请避免使用“未知”或空泛的描述，尽量根据侧面信息进行合理的推断和补全。
**指令模板 (必须严格按照此结构填充所有字段):**
```json
{
  "op": "replace", "path": "/player",
  "value": {
    "profile": { "name": "【代号/姓名】", "gender": "【性别】", "age": "【年龄】", "race": "【种族】", "appearance": "【请详细描述外貌特征，至少20字】", "background": "【请概括玩家的背景，至少20字】", "personality": "【请描述性格特点，至少15字】", "infection_status": "【非感染者/感染者/未公开】" },
    "attributes": { "physical_strength": "标准", "mobility": "标准", "physiological_endurance": "标准", "tactical_planning": "标准", "combat_skill": "标准", "originium_arts_adaptability": "标准", "power_level_desc": "未评估" }, "skills": {}, "inventory": { "items": {}, "equipment": { "main_hand": "无", "off_hand": "无", "outerwear": "无", "innerwear": "日常便服", "accessories": [] } }, "social": {}, "status": { "mood": 0, "physiological_state": ["健康"], "current_action": "开始行动" }
  }
}
```
<%
        }

        // --- B. 角色档案即时初始化 ---
        // 检查条件: 1. 用户第一条消息 2. 常规生成
        if (userMessageCount === 1 && generateType === 'normal') {
            hasPrintedTask = true;
%>
---
#### **[最高优先级任务: 开局角色档案初始化]**
**任务**: 这是游戏的开局阶段。请仔细分析当前的对话上下文，识别出所有在场或被提及的核心角色，并为他们创建完整的、明日方舟风格的档案。
**注意**: 你需要为每一个识别出的角色生成一个独立的 JSON Patch 操作。
**指令模板 (必须严格按照此结构为每个角色填充所有字段):**
```json
{
  "op": "add", "path": "/characters/【角色名】",
  "value": {
    "profile": { "name": "【角色名】", "gender": "【性别】", "race": "【种族】", "appearance": "【请提供一段详尽的外貌描述，至少25个字】", "background": "【请提供一段客观的角色背景履历，至少25个字】", "personality": "【请提供一段关于角色性格的详细描述，至少25个字】", "infection_status": "【非感染者/感染者/未公开】" },
    "skills": { "【技能1】": "【技能1的详细描述】", "【技能2】": "【技能2的详细描述】" }, "status": { "location": "【当前所在精确位置】", "posture": "【姿势】", "action": "【正在进行的动作】", "mood": 0, "attire": "【当前着装的详细描述】" }, "cognition": { "towards_player": { "trust": 50, "attitude": "中立", "known_facts": [], "unknown_facts": [], "misconceptions": [] }, "from_player": { "unlocked_secrets": [], "misconceptions": [] } }, "memory": { "short_term_buffer": [], "long_term": [] }, "combat": { "power_level_desc": "【基于《战力分级标准》给出一个明确的战力层级评估】" }, "notes": {}, "has_static_profile": false, "_internal": { "turns_since_last_update": 0 }
  }
}
```
<%
        }
    } catch (e) {
        print(`[EJS Hotfix Error] An error occurred during instant character init: ${e.message}`);
    }
%>
<%
    // ========================================================================
    // [Part 3: Queued Task Execution]
    // ========================================================================
    // 此部分渲染后端推送到任务队列中的任务。
    if (tasksToProcess.length > 0) {
        hasPrintedTask = true;
        var chronicleSummaryCount = 0; // 确保使用 var
        tasksToProcess.forEach((task, index) => {
%>
<%# (此处将粘贴原文件中 `tasksToProcess.forEach` 的全部内部渲染逻辑) %>
<%
        });
    }
%>

<%
    // ========================================================================
    // [Part 4: Default Action (If No Tasks Printed)]
    // ========================================================================
    // 只有在以上所有即时任务和队列任务都未触发时，才显示此默认提示。
    if (!hasPrintedTask) {
%>
---
[常规任务：状态更新]
*当前无高优先级任务。请根据你的`<Analysis>`分析，在`<JSONPatch>`中更新相关变量。*
<%
    }
%>
```

### 3.3 后端协同优化

**目标**: 移除与 EJS 层功能重复的后端开局初始化逻辑。

1.  **`character.ts`**
    -   **修改**: 在 `initializeNewCharacters` 函数中，完全删除 `if (get(..., 'total_turns', 0) <= 2)` 的代码块。
    -   **理由**: EJS 已接管开局初始化。该函数现在只负责处理**游戏中途**新登场的角色。

2.  **`player.ts`**
    -   **修改**: 在 `processPlayerUpdates` 函数中，删除对 `initializePlayer` 函数的调用以及相关的 `if (wasInitialized)` 判断逻辑。
    -   **理由**: EJS 已接管玩家的首次创建，后端不再需要检查和推送初始化任务。

## 4. 审批请求

请求您审阅此份修订后的方案。它整合了您的所有反馈，旨在提供一个结构清晰、逻辑严谨且符合您工作流的解决方案。如果批准，我将立即切换到 `code` 模式进行代码实现。
