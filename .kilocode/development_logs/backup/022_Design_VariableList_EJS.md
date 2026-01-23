# 详细设计: `变量列表.ejs` (Detailed Design)

**日期**: 2026-01-22
**状态**: V2 - 根据反馈迭代

---

## 1. 核心目标 (Core Objectives)

本文件的唯一目标是，为**额外/分析LLM**提供一个**全面、干净、有序、高度可读**的世界状态快照，并**定义一个全局数据源**供其他 EJS 模板使用。

---

## 2. 功能需求与设计思路 (V2)

*   **2.1 数据源中枢 (Data Hub)**
    *   **需求**: 避免多个 EJS 文件重复获取数据，并防止 `const` 重复定义错误。
    *   **思路**: 在本文件（作为数据处理的入口）的顶部，使用 EJS 插件提供的 `define()` 函数，将从 `getvar('stat_data')` 获取的完整状态树定义为一个**全局变量** `worldState`。其他 EJS 条目（如 `任务执行器`）可以直接使用 `worldState` 变量，无需再次获取或导入。

*   **2.2 全面性 (Comprehensiveness)**
    *   **需求**: LLM 需要尽可能多的历史信息来理解剧情发展。
    *   **思路**: `Chronicle` 模块下的所有缓冲区将**完整渲染**。

*   **2.3 干净与有序 (Cleanliness & Orderliness)**
    *   **需求**: 上下文应结构清晰，剔除无效信息。
    *   **思路**: 严格按照 `Global` -> `Player` -> `Characters` -> `Chronicle` 的顺序渲染。在渲染 `characters` 对象前，明确剔除 `_TEMPLATE_*` 模板。

*   **2.4 可读性与引导 (Readability & Guidance)**
    *   **需求**: LLM 需要理解复杂变量的含义和结构。
    *   **思路**:
        1.  在每个模块标题处，明确标注其在变量树中的路径。
        2.  在关键变量（如 `combat.power_level_desc`）下方，添加解释性注释，引导 LLM 如何理解和使用该变量。
        3.  完整显示 `_internal` 字段，为档案修复等任务提供元数据上下文。

---

## 3. 伪代码与实现细节 (V2)

```ejs
<%# 
  ===============================================================
  [维护指引 (Maintenance Guide)]
  
  本文件是所有动态提示词的“数据源中枢”和“世界状态快照”。
  
  - 核心职责: 
    1. 使用 define() 定义一个全局可用的 'worldState' 对象。
    2. 将 'worldState' 渲染成一个结构化的、人类可读的文本。
  - 其他EJS文件可以直接使用 'worldState' 变量，无需再次 getvar。
  ===============================================================

  // 定义全局数据源
  define('worldState', getvar('stat_data'));
%>

# ========= 世界状态快照 =========

## 1. 全局状态 (Path: `worldState.global`)
- **说明**: 描述当前世界的宏观状态。
<%- JSON.stringify(worldState.global, null, 2) %>

## 2. 玩家档案 (Path: `worldState.player`)
- **说明**: 玩家角色的详细数据。
- **战力评估 (`power_level_desc`) 指引**: 此描述性文本应严格参考《战力分级标准》世界书条目生成。
<%- JSON.stringify(worldState.player, null, 2) %>

## 3. 角色档案 (Path: `worldState.characters`)
<% 
  const characters = _.omit(worldState.characters, ['_TEMPLATE_STATIC_', '_TEMPLATE_DYNAMIC_']);
  const active_chars = worldState.global.presence.active_chars || [];
  const nearby_chars = worldState.global.presence.nearby_chars || [];
  
  const active_char_data = _.pick(characters, active_chars);
  const nearby_char_data = _.pick(characters, nearby_chars);
  const unloaded_char_names = _.keys(_.omit(characters, ...active_chars, ...nearby_chars));
%>

### 3.1 在场角色 (Active Characters)
- **说明**: 当前场景的核心互动角色。包含完整的动态信息。
<%- JSON.stringify(active_char_data, null, 2) %>

### 3.2 邻近角色 (Nearby Characters)
- **说明**: 在场景附近，可被感知但未直接参与核心互动的角色。
<%- JSON.stringify(nearby_char_data, null, 2) %>

### 3.3 已知但未在场角色 (Unloaded Characters)
- **说明**: 这些角色已归档，但AI应知晓其存在，并可根据剧情需要随时让其入场。
- [<%= unloaded_char_names.join(', ') %>]

## 4. 历史提要 (Path: `worldState.chronicle`)
- **说明**: 游戏至今的所有历史事件总结，按时间层级归档。
<%- JSON.stringify(worldState.chronicle, null, 2) %>

# ========= 快照结束 =========
```

---

## 4. 关联信息与风险规避 (V2)

*   **4.1 关联 Schema**: (无变化)
*   **4.2 核心参考**:
    *   `reference_cn.md`: 确认了 `define()` 和 `getvar()` 的正确用法。
    *   `020_User_Feedback_Summary.md`: 确认了 `Chronicle` 需完整显示，并需为LLM提供额外引导。
*   **4.3 角色档案修复联动问题**:
    *   **状态**: 此问题已记录。
    *   **下一步**: 将在 `.kilocode/development_logs/021_Phase3_Master_Plan.md` 中添加对此问题的追踪，并在后续的 `Character` 模块专属设计文档中进行详细讨论和方案设计。

---

## 5. 迭代与反馈机制 (V2)

*   **5.1 我的理解与思路**:
    *   我已将本文件重新定位为“数据源定义”和“状态快照渲染”两大职责的结合体，并通过 `define()` 实现了您所期望的全局数据共享模式。
    *   通过添加路径标注和解释性提示词，增强了上下文对 LLM 的引导性。

*   **5.2 向您提问**:
    1.  V2 版本的伪代码和设计思路是否解决了您在上一轮反馈中指出的所有问题？
    2.  将“角色档案修复联动”问题分离出去，留待 `Character` 模块设计时再详细讨论，这个安排是否合理？

我已完成此设计文档的第二次迭代。请您审阅。
