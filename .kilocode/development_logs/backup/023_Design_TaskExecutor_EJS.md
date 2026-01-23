# 详细设计: `[mvu_update]任务执行器.ejs` (Detailed Design)

**日期**: 2026-01-22
**状态**: 初稿

---

## 1. 核心目标 (Core Objectives)

本文件的唯一目标是，将全局 `task_queue` 中待处理的任务，**翻译**成额外/分析LLM可以清晰理解并能准确执行的、**包含完整中文指令和精确输出格式引导**的行动手册。

---

## 2. 功能需求与设计思路

*   **2.1 任务消费 (Task Consumption)**
    *   **需求**: EJS 模板需要能读取 `task_queue` 数组，并为其中的每一个任务生成对应的指令块。
    *   **思路**: 使用 `<% worldState.task_queue.forEach(task => { ... }); %>` 循环遍历 `worldState.task_queue`。`worldState` 变量由 `变量列表.ejs` 通过 `define()` 提供。

*   **2.2 指令清晰性 (Instruction Clarity)**
    *   **需求**: 所有指令必须是明确的、无歧义的中文，便于您理解和未来修改。
    *   **思路**: 每个任务的渲染块都将包含一个“**指令**”部分，用自然语言清晰地描述LLM需要完成的目标。

*   **2.3 上下文供给 (Context Provision)**
    *   **需求**: LLM 执行任务需要必要的上下文。
    *   **思路**: 对于每个任务，除了指令，还将提供一个“**任务专属上下文**”部分，只包含与该任务直接相关的数据。例如，`summarize_memory` 任务将提供待总结的短期记忆原文。

*   **2.4 输出格式引导 (Output Formatting Guidance)**
    *   **需求**: 对于需要生成大型、复杂对象的任务（如 `init_profile`），必须严格约束LLM的输出格式，以确保其能被系统正确解析。
    *   **思路**: 在这类任务的指令中，将硬编码一个**完整的、带注释的YAML结构模板**。LLM被要求严格按照此模板填充内容。这对应了您的反馈：“你想想看为什么会在初始变量中留这么一个完整的结构？”。

*   **2.5 可维护性 (Maintainability)**
    *   **需求**: 文件本身应易于未来的开发者为新的任务类型添加逻辑。
    *   **思路**:
        1.  在文件顶部添加详细的“维护指引”注释块。
        2.  使用清晰的 `if (task.type === '...')` 逻辑分支，使添加新任务类型变得简单直观。

---

## 3. 伪代码与实现细节

```ejs
<%# 
  ===============================================================
  [维护指引 (Maintenance Guide)]
  
  本文件负责将 `task_queue` 中的任务翻译成LLM指令。
  
  - 数据源: 'worldState' 变量由 `变量列表.ejs` 全局定义，可直接使用。
  - 修改原则:
    1.  新增任务类型时，请在本文件的 `forEach` 循环内，
        添加一个新的 `else if (task.type === '...')` 逻辑块。
    2.  在新的逻辑块中，必须包含 "指令"、"任务专属上下文" 
        和 "输出格式引导" 三个部分。
    3.  对于复杂对象输出，**必须**提供完整的YAML结构模板。
  ===============================================================

  // 导入全局数据源 (由 变量列表.ejs 定义)
  // define('worldState', getvar('stat_data')); 
%>

<% if (worldState.task_queue && worldState.task_queue.length > 0) { %>
[SYSTEM]
作为一个专业的游戏事件处理引擎，请严格按照以下各节独立的任务指令，在`<UpdateVariable>`块中使用对应的指令模板，生成用于更新游戏状态的 JSON Patch。

<% worldState.task_queue.forEach(task => { %>
---
## 任务ID: <%= task.id %> | 类型: <%= task.type %>

**指令**:
<% if (task.type === 'init_profile') { %>
检测到新角色「<%= task.target_char %>」首次登场，档案缺失。请为其创建一份完整的、明日方舟风格的档案。

**任务专属上下文**:
- **当前时间**: <%= worldState.global.time %>
- **当前地点**: <%= `${worldState.global.location.region}-${worldState.global.location.city}-${worldState.global.location.area}` %>
- **相关剧情**: <%= task.payload.context_summary %>

**输出格式引导**:
请在`<UpdateVariable>`块中，使用 `_.assign` 指令，并**严格遵循**以下YAML结构模板来填充内容。注释已解释了每个字段的填写要求。

```yaml
# _.assign('characters', '<%= task.target_char %>',
# --- YAML TEMPLATE START ---
_internal:
  has_static_profile: false # 动态创建的角色此项必为false
  last_update_turn: <%= worldState.global.game_progress.total_turns %>
data:
  profile:
    name: '<%= task.target_char %>'
    # 性别: 字符串 (男/女/其他)
    gender: "..."
    # 种族: 字符串 (例如: 萨卡兹, 菲林, 鲁珀)
    race: "..."
    # ... (其他 profile 字段的注释和占位符)
  skills:
    # 技能名: 技能描述
    "示例技能": "..."
  status:
    # ... (status 字段的注释和占位符)
  # ... (cognition, memory, combat, notes 的注释和占位符)
# --- YAML TEMPLATE END ---
# );
```

<% } else if (task.type === 'summarize_memory') { %>
角色「<%= task.target_char %>」的短期记忆已满，请将其总结为一段长期记忆。

**任务专属上下文**:
- **待总结的短期记忆**:
  <%- JSON.stringify(task.payload.memories, null, 2) %>

**输出格式引导**:
请在`<UpdateVariable>`块中，使用`_.assign`指令，将其总结添加到该角色的长期记忆中。

```yaml
# _.assign('characters.<%= task.target_char %>.data.memory.long_term', {
# --- YAML TEMPLATE START ---
  title: "【你为该角色提炼的记忆主题】",
  summary: "【你为该角色总结的记忆内容】",
  time_span: ["<%= task.payload.memories[0].time %>", "<%= task.payload.memories[task.payload.memories.length - 1].time %>"],
  impact: "【该记忆对角色的影响】"
# --- YAML TEMPLATE END ---
# });
```

<% } else { %>
未知的任务类型: <%= task.type %>
<% } %>

<% }); %>
<% } %>
```

---

## 4. 关联信息与风险规避

*   **4.1 关联 Schema**:
    *   `src/ARK_STATUSBAR/mvu/schemas/global.ts` (特别是 `TaskQueueSchema`)
    *   `src/ARK_STATUSBAR/mvu/schemas/character.ts` (用于 `init_profile` 的结构)
*   **4.2 核心参考**:
    *   `020_User_Feedback_Summary.md` -> `反馈 1`: 确认了必须为复杂任务提供输出结构引导。
    *   `[initvar]变量初始化.yaml`: `_TEMPLATE_DYNAMIC_` 的结构是 `init_profile` 任务YAML模板的核心参考。
*   **4.3 已知问题与规避**:
    *   **问题**: 如果一轮内有多个 `init_profile` 任务，可能会导致上下文过长。
    *   **规避**: 后端逻辑 (`character.ts`) 在推送 `init_profile` 任务时，应考虑每轮的上限（例如，每轮最多初始化2个新角色），但这属于后端逻辑的范畴，本文件只负责渲染所有存在的任务。

---

## 5. 迭代与反馈机制

*   **5.1 我的理解与思路**:
    *   我将 `任务执行器` 定位为一个“翻译器”，它的核心价值在于将结构化的任务数据，转换为LLM易于理解的、带引导的自然语言指令。
    *   我采纳了您关于“案例价值”的观点，将 `[initvar].yaml` 中的模板思想，直接应用到了这里的输出格式引导上，形成了一个闭环。

*   **5.2 向您提问**:
    1.  这种为每种任务类型提供“指令-上下文-格式引导”三段式的设计，是否清晰且可扩展？
    2.  在 `init_profile` 任务中，硬编码YAML模板并要求LLM严格遵循的策略，是否是解决大型对象输出问题的正确方向？

我已完成此设计文档的初稿。请您审阅。
