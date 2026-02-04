# Phase 3 业务逻辑规划：世界与编年史系统 (World & Chronicle System Logic)

**日期**: 2026-01-30
**状态**: 逻辑复原
**关联文档**: 
*   `.kilocode/development_logs/phase2-3/010_Phase2.2_GlobalState_Design.md`
*   `.kilocode/development_logs/phase2-3/013_Phase2.2_Chronicle_Design.md`

---

## 1. 核心定义

本模块负责构建游戏的“物理舞台”与“历史维度”。它不仅记录当前发生了什么（Global），还负责将这些发生沉淀为历史（Chronicle），确保世界的连贯性。

### 1.1 全局状态 (Global State)
*   **Time**: 格式 `YYYY-MM-DD HH:mm:ss`。这是世界的脉搏。
*   **Location**: 4维坐标 `Region/City/Area/Spot`。
*   **Environment**: `weather` (天气) 和 `environment_status` (环境描述)。
*   **Presence**: `active_chars` (在场且交互) / `nearby_chars` (在场未交互)。

### 1.2 编年史 (Chronicle)
*   **Round Buffer**: 最近 30 轮的详细记录。
*   **Small Summary**: 每 10 轮生成的阶段性回顾。
*   **Daily Summary**: 每日结束时生成的宏观总结。（还有往后的周-月-年总结）

---

## 2. 业务流程逻辑 (Business Logic Flows)

### 2.1 时空演变 (Spacetime Evolution)

**Time: 时间流逝**
*   **触发**: 每一轮 LLM 回复。
*   **逻辑**:
    *   LLM 在回复中隐含了时间流逝（如“十分钟后”）。
    *   LLM 通过 JSON Patch 更新 `global.time`。
    *   **后端校验**: 后端脚本需要解析时间字符串，计算 `time_delta`。如果时间倒流或格式错误，应进行修正。
    *   **跨日检测**: 如果 `oldTime.day != newTime.day`，触发“每日总结”逻辑。

**Location: 地点变迁**
*   **触发**: 剧情描述角色移动。
*   **逻辑**:
    *   必须同时更新 4 个层级。例如从“切尔诺伯格-广场”移动到“罗德岛-舰桥”，Region/City/Area/Spot 都变了。
    *   **联动**: 地点变化通常伴随着 `active_chars` 和 `nearby_chars` 的剧烈刷新（旧地点的角色离场，新地点的角色入场）。

**Presence: 实体注册**
*   **触发**: 每一轮回复。
*   **逻辑**:
    *   LLM 负责分析谁在场。
    *   **后端同步**: `global.presence` 的变化直接驱动 `Character` 系统的生命周期（Stage 1: 感知与入场）。

### 2.2 历史编纂 (Chronicle Compiling)

**Stage 1: 轮次记录 (Round Logging)**
*   **触发**: 每一轮回复结束。
*   **逻辑**:
    *   LLM **必须**生成一条 `RoundSummary`（包含 Time, Location, Summary）。
    *   该记录被 `push` 到 `chronicle.round_buffer`。
    *   **缓冲区管理**: 如果 Buffer 超过 30 条，最早的记录将被丢弃（但在那之前应该已经被总结过了）。

**Stage 2: 阶段总结 (Small Summary)**
*   **触发**: `round_buffer` 中未被总结的条目数达到 **10** 条。
*   **逻辑**:
    1.  后端锁定这 10 条记录。
    2.  推送 `ten_round_summary` 任务。
    3.  LLM 生成总结，存入 `chronicle.small_summary_buffer`。
    4.  **注意**: `round_buffer` 中的原始记录**保留**（直到被 Daily Summary 消化或自然溢出），因为短期内可能还需要查阅细节。

**Stage 3: 每日总结 (Daily Summary)**
*   **触发**: `global.time` 发生日期变更。
*   **逻辑**:
    1.  收集昨日所有的 `small_summary_buffer` 和剩余的 `round_buffer`。
    2.  推送 `daily_summary` 任务。
    3.  生成一条宏观的“昨日史”，存入 `daily_summary_buffer`。
    4.  **归档**: 此时可以安全地清理昨日的 Small Summary 和 Round Buffer。

---

## 3. 异常处理逻辑 (Exception Logic)（agent设想）

### 3.1 时间格式纠错
*   **场景**: LLM 输出了 `1097-13-45` 这种非法日期。
*   **逻辑**:
    *   后端使用 `Date.parse` 校验。
    *   若非法，回退到上一轮的时间 + 1分钟（默认流逝）。

### 3.2 总结任务堆积
*   **场景**: 玩家疯狂推进剧情，导致 `ten_round_summary` 任务还没做完，又触发了下一个 10 轮。
*   **逻辑**:
    *   任务队列应具备**合并能力**（Merge Capability）。
    *   或者：暂停生成新的总结任务，直到队列清空。这需要后端具备复杂的队列状态感知能力。

---

## 4. 待验证技术点 (Technical Uncertainties)

1.  **时间解析库**: 在 TavernHelper 环境中，我们能用 `Date` 对象处理 `1096年` 这种虚构年份吗？（JS Date 通常处理 1970+，但也支持 ISO 格式的旧年份，需验证边界）。
2.  **跨日检测**: 如何准确捕捉 LLM 输出的“第二天”？是否完全依赖 LLM 修改 `global.time` 字段？（重要性低）
3.  **缓冲区同步**: 当后端根据 `round_buffer.length` 推送任务时，如果 LLM 同时在 Patch 中向 Buffer 写入新数据，是否存在并发读写导致索引错乱的风险？
