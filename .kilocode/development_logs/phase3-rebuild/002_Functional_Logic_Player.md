# Phase 3 业务逻辑规划：玩家系统 (Player System Logic)

**日期**: 2026-01-30
**状态**: 逻辑复原
**关联文档**: 
*   `.kilocode/development_logs/phase2-3/012_Phase2.2_Player_Design.md`
*   `src/ARK_STATUSBAR/mvu/schemas/player.ts`

---

## 1. 核心定义与数据结构

玩家系统旨在构建一个高度可定制、具备成长性的 RPG 化身。不同于传统 Galgame 的“透明人”主角，本系统中的博士是一个拥有实体属性、物品和社会关系的“泰拉人”。

### 1.1 数据结构映射 (Schema Mapping)
基于 `PlayerSchema`，玩家数据分为以下核心模块：

| 模块 | 字段 | 逻辑职能 |
| :--- | :--- | :--- |
| **Profile** | `name`, `gender`, `race`, `infection_status` | **基础档案**。通常在开局通过问卷或侧面描写确定。 |
| **Attributes** | `physical_strength`, `tactical_planning` ... | **六维属性**。使用标准评级（缺陷~卓越），随剧情事件（如战斗胜利、体能训练）动态调整。 |
| **Skills** | `skills` (Record) | **技能树**。记录博士掌握的指挥技艺、源石技艺或生活技能。 |
| **Inventory** | `items` (Record), `equipment` | **物资管理**。物品有数量 (`count`) 和状态 (`status`)；装备分部位管理。 |
| **Social** | `social` (Record) | **社交网络**。记录博士对其他角色的看法（区别于角色对博士的看法）。 |
| **Status** | `mood`, `physiological_state` | **实时状态**。记录健康状况（如“轻伤”、“感染抑制中”）。 |

---

## 2. 业务流程逻辑 (Business Logic Flows)

### 2.1 玩家档案初始化 (Initialization)

**Stage 1: 空白检测**
*   **触发**: 游戏开局 (Turn 0-2)。
*   **逻辑**:
    1.  后端检测 `stat_data.player.profile.name` 是否为空。
    2.  **骨架注入**: 若为空，立即写入 `name: ""` (默认，不要默认角色为博士谢谢) 等基础骨架，防止 EJS 报错。
    3.  **任务发布**: 推送 `init_player_profile` 任务。

**Stage 2: 档案生成**
*   **执行**: LLM 根据开场白的上下文（如“阿米娅握住你的手”->种族未知；“你感到喉咙灼痛”->感染者）推断并填充档案。
*   **逻辑**: 必须填满所有基础字段。对于无法推断的（如具体身高），允许使用模糊描述或留白待定，但字段本身不能缺失。

### 2.2 动态成长与交互 (Growth & Interaction)（agent设想）

**Inventory: 物品流转**
*   **触发**: 剧情中获得或消耗物品。
*   **逻辑**:
    *   **获得**: 检查 `items` 中是否存在该 Key。
        *   存在 -> `count + N`。
        *   不存在 -> 新建条目 `{ count: N, description: "..." }`。
    *   **消耗**: `count - N`。
    *   **耗尽**: 当 `count <= 0` 时，系统应当（通过 Update Rules 指导 LLM）移除该 Key 或标记为“已耗尽”。

**Attributes: 属性变动**
*   **触发**: 重大剧情事件（如 boss 战、特训）。
*   **逻辑**:
    *   LLM 评估当前行为表现。
    *   **升级**: 如“指挥干员完美撤退” -> `tactical_planning` 提升至“优良”。
    *   **降级**: 如“身受重伤” -> `physical_strength` 临时下降。

**Social: 社交构建**
*   **触发**: 与特定角色互动。
*   **逻辑**:
    *   系统记录博士对该角色的单向看法（如“值得信赖的副手”）。
    *   这与 `Character.cognition.towards_player` 形成互文（双向关系）。

---

## 3. 异常处理逻辑 (Exception Logic)

### 3.1 字段缺失修复
*   **场景**: LLM 在更新 Inventory 时不小心删除了 `profile`。
*   **逻辑**:
    *   `validateAndRepairPlayer` 函数检测核心字段缺失。
    *   推送 `repair_player_profile` 任务。
    *   在此期间，EJS 使用默认值渲染，保证 UI 不崩。

---

## 4. 待验证技术点 (Technical Uncertainties)

1.  **Inventory 原子性**: 如何确保 LLM 在一次 Patch 中正确处理“消耗 1 个源石虫，获得 1 个至纯源石”这种复合操作？（重要性低）
2.  **属性枚举校验**: 六维属性必须严格符合 `['缺陷', '普通', '标准', '优良', '卓越']` 枚举。如果 LLM 输出了 "S级"，Zod 会报错。如何配置 Zod 或 Prompt 引导 LLM 进行自动修正（如 `catch` 或 `transform`）？（重要性低）
