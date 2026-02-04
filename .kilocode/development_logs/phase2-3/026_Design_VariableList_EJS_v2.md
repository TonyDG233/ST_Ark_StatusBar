# Phase 3: `变量列表.ejs` 详细设计文档 v2

**日期**: 2026-01-22

**目的**: 本文档是 `变量列表.ejs` 文件的详细设计规划，旨在作为个人能力验证的核心产出。其内容必须饱满、逻辑严密，足以证明本人已完全理解并吸取了先前所有失败的教训。

---

## 1. 核心职责与定位 (Core Responsibility)

`变量列表.ejs` 是 **分析师 LLM** 的“眼睛”，其唯一职责是提供一个全面、有序、上下文清晰的世界状态快照。它扮演着 **数据源中枢** 和 **信息预处理器** 的双重角色。

*   **数据源中枢**: 本文件将是**唯一**通过 `getvar()` 获取原始 `stat_data` 的地方。它将使用 `define()` 函数创建一个名为 `worldState` 的全局 EJS 变量，供所有后续的 `[mvu_update]` 系列条目直接、安全地使用。
*   **信息预处理器**: 本文件负责在将数据显示给 LLM 之前，进行必要的筛选、排序和格式化，确保 LLM 看到的是最相关、最易于理解的信息，而不是原始的、混杂的数据结构。

---

## 2. 参考与依赖 (References & Dependencies)

| 类型 | 文件/链接 | 学习要点 |
|---|---|---|
| **API 文档** | `references/doc_ST-Prompt-Template/reference_cn.md` | `define()` 和 `getvar()` 的正确用法，`_` (lodash) 的可用性。 |
| **核心反馈** | `.kilocode/development_logs/020_User_Feedback_Summary.md` | 所有历史错误的根源，特别是关于 `define()`、`chronicle` 显示、信息过滤和解释性提示词的要求。 |
| **设计文档** | `.kilocode/development_logs/011_Phase2.2_Character_Design.md` | 三阶段角色状态（Active/Nearby/Unload）的判断逻辑和显示规则。 |
| **Schema** | `src/ARK_STATUSBAR/mvu/schemas/*.ts` | `worldState` 的完整数据结构，是进行数据遍历和筛选的基础。 |

---

## 3. 实现思路与伪代码 (Implementation & Pseudocode)

**文件路径**: `src/ARK_STATUSBAR/prompts/dynamic/变量列表.ejs`

### 3.1 结构总览

本 EJS 文件将严格遵循以下结构顺序，以确保输出的提示词稳定、有序：

1.  **数据源定义 (代码块)**: 在文件顶部，使用**可执行 EJS 标签 (`<% ... %>`)** 定义 `worldState` 全局变量。
2.  **全局状态渲染 (输出块)**: 渲染 `global` 变量区块。
3.  **玩家档案渲染 (输出块)**: 渲染 `player` 变量区块。
4.  **角色档案渲染 (代码+输出块)**: 实现复杂的三阶段显示逻辑，并按状态分别渲染角色。
5.  **历史回顾渲染 (输出块)**: 完整渲染 `chronicle` 区块。

### 3.2 详细伪代码

```ejs
<%#
======================================================================
 EJS 模板: 变量列表 (variables_list.ejs)
 职责: 作为数据源中枢，并为分析师LLM渲染格式化的世界状态。
======================================================================
%>

<%# [步骤 1: 数据源定义] 
    这是本模板的核心架构。使用 define() 将从酒馆变量中获取的 stat_data 注册为全局可访问的 worldState 对象。
    后续所有 EJS 模板（如任务执行器）将直接使用 worldState，无需重复获取。
    !!! 关键错误规避：必须使用 <% ... %> 可执行标签，而不是 <%# ... %> 注释标签。
%>
<%
    define('worldState', getvar('stat_data'));
%>

<%-/* [步骤 2: 全局状态渲染] 
    直接、清晰地渲染全局状态。
    - 关键信息（时间、地点）前置。
    - 过滤掉对 LLM 无用的内部变量（如 _internal）。
    - 为关键概念（如 total_turns）提供简短注释。
*/-%>
[全局状态]
当前时间: <%- worldState.global.time %>
当前地点: <%- `${worldState.global.location.region}, ${worldState.global.location.city}, ${worldState.global.location.district}, ${worldState.global.location.specific}` %>
游戏总轮次 (total_turns): <%- worldState.global.game_progress.total_turns %>  <%# 这个值是判断角色是否活跃的时间戳 %>
在场角色 (active_chars): <%- _.map(worldState.global.presence.active_chars, c => c.name).join(', ') || '无' %>
附近角色 (nearby_chars): <%- _.map(worldState.global.presence.nearby_chars, c => c.name).join(', ') || '无' %>

<%-/* [步骤 3: 玩家档案渲染] 
    渲染玩家的核心档案信息。
*/-%>
[玩家档案: <%- worldState.player.profile.name %>]
<%-
    // 使用 lodash 的 omit 来过滤掉不需要展示给 LLM 的内部字段
    const cleanedPlayer = _.omit(worldState.player, ['_internal']);
    // 此处可以进一步处理，比如将 profile 和 attributes 展开，使其更易读
    // 为简化，这里直接输出清理后的对象字符串
    print(JSON.stringify(cleanedPlayer, null, 2));
%>

<%# [步骤 4: 角色档案渲染] 
    这是本模板最复杂的逻辑部分。
    1. 准备数据：遍历所有角色，根据 `last_update_turn` 计算其状态。
    2. 分类角色：将角色存入 active, nearby, unload 三个数组。
    3. 依次渲染：按照 Active -> Nearby -> Unload 的顺序渲染，确保最重要的信息在前。
%>
<%
    const allCharacters = worldState.characters || {};
    const globalTurn = worldState.global.game_progress.total_turns;
    const activeChars = [];
    const nearbyChars = [];
    const unloadedChars = [];

    // 4.1. 遍历与分类
    for (const charName in allCharacters) {
        if (charName.startsWith('_TEMPLATE_')) continue; // 过滤掉模板角色
        
        const character = allCharacters[charName];
        const turnsSinceUpdate = globalTurn - (character._internal.last_update_turn || 0);
        
        if (turnsSinceUpdate <= 5) {
            activeChars.push(character);
        } else if (turnsSinceUpdate <= 10) {
            nearbyChars.push(character);
        } else {
            unloadedChars.push(character);
        }
    }
%>

[角色档案]

<%-/* 4.2.1. 渲染 Active 角色 */-%>
<% if (activeChars.length > 0) { %>
--- 在场角色 (显示完整动态信息) ---
<% activeChars.forEach(char => { %>
角色: <%- char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char) %>
    状态: <%- char.data.status.action %> at <%- char.data.status.location %>
    情绪: <%- char.data.status.mood %>
    着装: <%- char.data.status.attire %>
    战力评估: <%- char.data.combat.power_level_desc %> <%# 指令：此评估基于《战力分级标准》，请结合此描述进行演绎。 %>
    记忆 (最近3条):
    <%- char.data.memory.short_term_buffer.slice(-3).map(m => `- (T${m.turn}) ${m.content}`).join('\\n    ') || '无' %>
<% }); %>
<% } %>

<%-/* 4.2.2. 渲染 Nearby 角色 */-%>
<% if (nearbyChars.length > 0) { %>
--- 附近角色 (仅显示基础状态) ---
<% nearbyChars.forEach(char => { %>
角色: <%- char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char) %>
    状态: <%- char.data.status.action %> at <%- char.data.status.location %>
<% }); %>
<% } %>

<%-/* 4.2.3. 渲染 Unloaded 角色 */-%>
<% if (unloadedChars.length > 0) { %>
--- 已不在场的角色 (仅供参考) ---
<%- unloadedChars.map(char => (char.data.profile ? char.data.profile.name : Object.keys(worldState.characters).find(key => worldState.characters[key] === char))).join(', ') %> <%# 指令：这些角色当前不在场，但他们的档案依然存在，可根据剧情需要让他们重新入场。 %>
<% } %>

<%-/* [步骤 5: 历史回顾渲染] 
    完整渲染所有编年史（历史提要）缓冲区，不进行任何删减。
    !!! 关键错误规避：绝不对其进行 slice 或其他形式的截断。
*/-%>
[历史回顾 (Chronicle)]
近期轮次记忆 (最多20轮):
<%- 
    (worldState.chronicle.round_buffer || []).map(r => 
        `- [${r.time}] 在 ${r.location}: ${r.summary}`
    ).join('\\n') || '无'
%>

十轮总结:
<%-
    (worldState.chronicle.small_summary_buffer || []).map(s =>
        `- [${s.time_span.join(' to ')}] 关键事件: ${s.key_events.join(', ')}`
    ).join('\\n') || '无'
%>

每日总结:
<%-
    worldState.chronicle.last_daily ? `- [${worldState.chronicle.last_daily.date}] 标题: ${worldState.chronicle.last_daily.headline}` : '无'
%>

<%#
每周总结......注意实际撰写文件时应当排列完全所有总结信息，并确保历史总结内容按照实际数据结构完全展示出来。
%>
```

---

## 4. 已知问题规避 (Known Issues & Mitigation)

1.  **EJS 语法错误**:
    *   **问题**: 之前将代码写入 `<%# %>` 导致不执行。
    *   **规避**: 本设计中，所有需要执行的逻辑（如 `define`, `for` 循环）都明确使用 `<% ... %>` 标签。所有需要输出内容的都使用 `<%- ... %>` (转义) 或 `<%= ... %>` (不转义)。
2.  **`define` 的作用域**:
    *   **问题**: 之前不理解 `define` 的全局性。
    *   **规避**: 本设计将其置于文件顶部，并明确注释其作为“数据源中枢”的作用，供所有后续条目消费。
3.  **信息过载 vs. 不足**:
    *   **问题**: 之前错误地限制了 `chronicle` 的输出。
    *   **规避**: 本设计严格遵守“完整显示 `chronicle`”的要求。同时，通过三阶段角色显示和过滤 `_internal` 字段来控制其他部分的复杂度，在信息完整性和 LLM 的可读性之间取得平衡。

---

## 5. 迭代与反馈机制 (Iteration & Feedback)

我将基于此设计文档，等待您的审核。您提出的任何问题，我都会在此文档中以**追问-解答**的形式进行记录和迭代，直到您完全满意为止。

### 待办问题与讨论缓存区

*   **[问题 1] 编年史显示细节**:
    *   **用户反馈**: 当前伪代码中，历史回顾部分的标题和结构可能不够清晰，未能完全反映 `chronicle` schema 的多层级结构（如周报、月报）。
    *   **解决方案**: 在实际编码时，将严格按照 `ChronicleSchema` 的结构进行渲染，确保为 `small_summary_buffer`, `last_daily`, `last_weekly` 等每个层级的总结都提供清晰的标题和一致的格式。

*   **[问题 2] 档案渲染策略**:
    *   **用户反馈**: 需要明确哪些变量可以直接输出，哪些需要“翻译”成更自然的语言。
    *   **解决方案**:
        *   **直接输出**: 大部分 `profile` 字段（name, gender, race）、`status` 字段（location, action）等，其 key 和 value 本身已足够清晰。
        *   **需要翻译/补充提示词**: 抽象的数值或枚举值。例如 `mood: 80` 应渲染为 `情绪: 80/100 (积极)`；`cognition.towards_player.trust: 150` 应渲染为 `对玩家的信任度: 150/200 (高度信任)`。战力评估 `power_level_desc` 旁边需补充注释，提醒 LLM 该描述基于《战力分级标准》。

*   **[关联问题 3] 每轮任务处理数**:
    *   **用户反馈**: 后端并未实现控制每轮处理多少任务的逻辑，而 EJS 环境无法直接与 TS 脚本通信来获取这个配置。
    *   **记录**: 此问题主要影响 `任务执行器.ejs` 的设计，但在此处记录以备忘。解决方案可能是在 `global` schema 中增加一个可配置的 `max_tasks_per_turn` 字段，由后端脚本维护，EJS 模板仅负责读取该值。此问题将在《任务执行器设计文档》中详细讨论。

---
**此文档即为我的“试卷”，请您审阅。**
