# Phase 3 业务逻辑规划：角色系统 (Character System Logic)

**日期**: 2026-01-30
**状态**: 逻辑复原 (Revised)
**关联文档**: 
*   `.kilocode/development_logs/phase2-3/011_Phase2.2_Character_Design.md`
*   `src/ARK_STATUSBAR/mvu/schemas/character.ts`

---

## 1. 核心定义与数据结构

角色系统是罗德岛终端的灵魂。本设计旨在还原一个拥有**动态生命周期**、**分层记忆**和**复杂认知**的实体系统。

### 1.1 数据结构映射 (Schema Mapping)
基于 `CharacterSchema`，角色数据分为以下核心模块：

| 模块 | 字段 | 逻辑职能 |
| :--- | :--- | :--- |
| **Profile** | `name`, `race`, `appearance`, etc. | **身份锚点**。即使没有 Wiki 注入，系统也必须维护一份完整的基础档案以防止幻觉。 |
| **Status** | `mood`, `location`, `action` | **实时状态**。随每一轮交互实时更新，用于驱动 EJS 的状态栏显示。 |
| **Cognition** | `trust`, `attitude`, `known_facts` | **双向认知**。记录角色对博士的看法(towards)及博士已解锁的情报(from)。 |
| **Memory** | `short_term_buffer`, `long_term` | **记忆新陈代谢**。短期记忆积累 -> 长期记忆结晶。 |
| **Combat** | `power_level_desc` | **战力评估**。必须基于《战力分级标准》进行文本描述，而非简单数值。 |
| **Skills** | `skills` (Record) | **技能库**。记录角色掌握的源石技艺或特殊能力。 |

---

## 2. 业务流程逻辑 (Business Logic Flows)

### 2.1 角色生命周期 (Lifecycle)

**Stage 1: 感知与入场 (Detection & Entry)**
*   **触发**: `Global.presence` 更新，发现新角色出现在 `active_chars` 或 `nearby_chars` 中。
*   **逻辑**:
    1.  **存在性检查**: 检查 `stat_data.characters[charName]` 是否存在。
    2.  **骨架注入 (Skeleton Injection)**:
        *   若不存在，后端脚本**立即**写入一个仅包含 `name` 和 `_internal` 默认值的骨架对象。
        *   **目的**: 防止 EJS 渲染时因读取 `undefined` 而崩溃，同时避免 EJS 重复报告“角色缺失”。
    3.  **任务发布**:
        *   后端推送 `init_profile` 任务到队列。
        *   **关联逻辑**: 检查该角色是否有对应的世界书条目 (`has_static_profile`)，如有，提示 LLM 参考世界书内容生成档案。

**Stage 2: 交互与演变 (Interaction & Evolution)**
*   **触发**: 每一轮对话交互。
*   **逻辑**:
    *   **情绪波动**: 根据对话内容调整 `mood` (-100~100)。
    *   **认知更新**: 
        *   如果玩家做出特定行为（如赠送礼物、做出承诺），更新 `trust`。
        *   如果玩家透露了新信息，更新 `known_facts`。
    *   **技能习得**: 如果剧情描述角色展现了新能力，向 `skills` 字典添加条目。

**Stage 3: 记忆消化 (Memory Digestion) —— 核心新陈代谢**
*   **触发**: `short_term_buffer` 长度达到 **12** 条。
*   **逻辑**:
    1.  **切片**: 后端提取最早的 **6** 条记忆。
    2.  **任务发布**: 推送 `summarize_memory` 任务，载荷包含这 6 条记忆。
    3.  **LLM 执行**: 
        *   将 6 条短记忆压缩为 1 条 `long_term_memory` 对象（含 `summary`, `impact`, `time_span`）。
        *   从 `short_term_buffer` 中物理移除这 6 条记忆（后端执行或 JSON Patch 执行）。
    4.  **结果**: Buffer 腾出空间，LongTerm 增加条目。

**Stage 4: 离场与休眠 (Exit & Hibernation)**
*   **触发**: 角色连续 N 轮（如 10 轮）未出现在 `active_chars`。
*   **逻辑**:
    *   系统更新 `_internal.turns_since_last_update`。
    *   EJS 渲染层根据此计数器，将角色移至“不在场”列表，不再渲染其详细状态，节省 Token。
    *   **注意**: 数据**持久保留**，不会被删除。

---

## 3. 异常处理逻辑 (Exception Logic)

### 3.1 档案自愈 (Self-Healing)
*   **场景**: LLM 生成的 JSON 缺少关键字段（如 `trust` 或 `_internal`）。
*   **逻辑**:
    *   **Backend Guard**: `validateAndRepairCharacter` 函数周期性扫描。
    *   **Action**: 发现缺失字段 -> 推送 `repair_profile` 任务 -> 指定缺失路径。
    *   **Fallback**: 在修复前，EJS 读取时应提供默认值（如 trust=50），避免渲染报错。

---

## 4. 待验证技术点 (Technical Uncertainties)

*(此部分仅列出逻辑所需的支撑需求，具体验证方案见 Research Guide)*

1.  **骨架注入时机**: 必须验证在 `VARIABLE_UPDATE_ENDED` 中直接写入骨架数据，是否能在下一轮 EJS 渲染前生效？（如何保证当前于该时机写入的变量可以正常注入，而非被旧变量覆盖或出现其他状况）
2.  **Patch 原子性**: `summarize_memory` 需要同时“添加 LongTerm”和“删除 ShortTerm”。需验证 JSON Patch 是否支持原子操作，或者是否需要分两步？（同样是变量注入稳定性问题，需翻阅参考文档与rule中新添加的
.kilocode\rules\mvu开发核心指南.md寻求稳定方案）
