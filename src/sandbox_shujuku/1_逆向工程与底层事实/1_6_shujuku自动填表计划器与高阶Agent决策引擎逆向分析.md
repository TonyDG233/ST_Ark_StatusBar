# shujuku 自动填表计划器与高阶 Agent 决策引擎逆向分析报告 (1_6_shujuku自动填表计划器与高阶Agent决策引擎逆向分析.md)

> **逆向对象**: `D:\LLM\self_programming\shujuku`  
> **核心源码**: `src/service/table/update-scheduler.ts` (自动计划器)、`src/service/agent/agent-decision-engine.ts` (决策智能体)、`src/shared/stable-row-id-allocator.ts` (主键分配)  
> **分析目的**: 揭示 `shujuku` 插件如何通过“表格维度配置（DDL Note元数据）”自动构建合并填表计划，以及在超大型 RP 剧情线中，如何通过 Agent 决策引擎执行拓扑任务排序与世界书多并发分片调度，揭开其终极自动化面纱。

---

## 一、 自动填表计划器（Update Scheduler & UpdateGroup）逆向

在真实的 RP 游戏流程中，玩家不会频繁去点击“开始填表”，所有的属性/物品变动必须由系统自动静默检查、自适应触发。`shujuku` 物理实现了基于**“多频度阶梯”与“并发分组”**的自动更新调度系统。

### 1.1 表格维度的自适应更新配置 (`updateConfig`)
每张表在建表时，都会在元数据（`_acu_sheet_meta` 系统表或 DDL DQL 设定）中注入独立的自动触发配置：
*   `updateFrequency`：更新频次。指每产生 $N$ 楼 AI 消息，强制触发一次该表的 AI 填表变异（如果为 0，代表此表不参与自动更新）。
*   `skipFloors`：延迟过滤楼层。指示更新时忽略最新的 $M$ 楼（例如设置为 3 楼，代表大模型正在对话的最前线，数据尚未尘埃落定，不应当高频填表，等对话推进 3 楼之后再回填，保持数据稳定性）。
*   `contextDepth`：上下文深度。规定触发填表时，大模型能够读取的最近消息上下文数，控制 Token 损耗。

### 1.2 自动填表计划编排逻辑 (`buildAutoUpdatePlan_ACU`)
1.  **AI 消息索引计算**：系统首先过滤出当前聊天记录中所有非 user 消息的物理索引组 `allAiMessageIndices`，计算出总 AI 楼层数 `totalAiMessages`。
2.  **未记录楼层测算**：
    对每一张活跃表格，获取其最后一次更新在 Chat 历史中驻留的 AI 消息楼号 `lastUpdatedAiFloor`。系统结合 `skipFloors` 计算未记录更新的“累积脏楼层数”：
    $$\text{effectiveUnrecordedFloors} = \max(0, (\text{totalAiMessages} - \text{skipFloors}) - \text{lastUpdatedAiFloor})$$
3.  **触发判定与区间提取**：
    当 $\text{effectiveUnrecordedFloors} \ge \text{updateFrequency}$ 且 `threshold (contextDepth) > 0` 时，判定该表已“脏”，立即拉取上一次更新楼层到当前剔除 `skipFloors` 之后的历史消息，作为填表 AI 的推理上下文。

### 1.3 核心性能杠杆：并发计划分组 (`UpdateGroup`)
如果 10 张表同时变脏触发更新，会产生 10 次独立的 API 慢请求，直接卡死浏览器。
*   `buildAutoUpdatePlan_ACU` 通过 **Schedule Signature 分组算法**一举消除了这个开销：
    对所有待更新表格，提取其调度特征码：
    $$\text{Signature} = [\text{groupId}, \text{threshold}, \text{frequency}, \text{skipFloors}, \text{batchSize}].\text{join}('|')$$
*   **物理打包**：所有持有相同 Signature、共享相同未更新楼层区间、且属于同一个 `groupId` 的表格，会被**物理打包合并进同一个 `UpdateGroup`**。
*   **合并发包**：AI 可以在**一次 API 交互中同时针对该 Group 下的所有表执行 SQL 变异**，数据落盘开销和 API 请求次数暴降 90%。

---

## 二、 高阶 Agent 决策引擎与任务规划器（Agent Decision Engine）逆向

在多任务并发的明日方舟等高难度 RP 关卡下，多个剧情规划任务（Plot Tasks）可能在同一轮次中被触发。它们之间存在严格的“前置因果依赖（DependsOn）”与“后置阻塞（Blocks）”。

### 2.1 依赖拓扑排序与死锁环检测
在 `agent-decision-engine.ts` 中，决策智能体运行了深层图论算法：
*   **死锁环检测 (`hasDependencyCycle_ACU`)**：
    基于深度优先遍历（DFS）及染色回溯算法，对当前活跃任务的依赖网络进行动态遍历。若检测到任务 A 依赖任务 B，而任务 B 又间接依赖任务 A 的逻辑，抛出异常，优雅回退到默认顺序执行，杜绝死锁引发发包死循环。
*   **拓扑排序规划 (`sortEffectiveTasks_ACU`)**：
    通过死锁检测后，决策智能体对所有需要执行的子任务进行**拓扑排序（Topological Sort）**，编排出一条串并行结合、因果时间线绝对正确的 `AgentTaskPlanItem_ACU` 执行流，交由后台流式执行。

### 2.2 超大世界书上下文分片并发调度 (`Context Sharding`)
当角色的世界书候选条目极度庞大（几万字）时，一个 Prompt 无法塞下。
*   **分片计算 (`createAgentDecisionShards_ACU`)**：
    决策引擎根据 $\text{greenlightMinTkBudget} \sim \text{greenlightMaxTkBudget}$，将庞大的世界书条目提炼拆分为多个独立的子候选分片（Shards）。
*   **并行决策与 RRF 融合**：
    引擎以极高并发向多个 `runAgentDecisionShard_ACU` 发包。最后利用 RRF 倒数排名融合算法，对各个分片返回的世界书候选条目和剧情决策（`plotGreenlights`、`finalGenerationGreenlights`）进行综合打分排序，按预算上限物理截断，只召回决策分最高的记忆，完美兼顾了“大海捞针的高召回率”与“低 Token 消耗”。

---

## 三、 主键稳定性保障机制（Stable Row ID Allocator）

在 SQLite 与 Chat 历史的频繁水合、撤回、美杜莎精简（Chronicle Merge）中，如果使用数据库默认的自增主键（Auto-increment ID），一旦原始行被物理删除，新添加的行可能会复用旧行号，导致历史消息中已记录的 `sql_delta` 回放时定位错乱，发生“张冠李戴”的致命 BUG。

### 3.1 稳定主键分配器 (`stable-row-id-allocator.ts` / `allocateStableRowId_ACU`)
为了解决自增键重用引发的回放灾难，`shujuku` 物理手写了一套**全生命周期主键保护锁**：
1.  **占位保留（Reservation）**：水合和插入时，首先提取该表所有已用、曾用和临时占位的 row_id，形成一个强类型的 `reserved` Set。
2.  **安全提取算法**：
    遍历 `reserved` 集合，采用正则严格验证 `^[1-9]\d*$` 是否为正整数。过滤出曾用过的最大行号 `maxRowId`。
3.  **物理分配**：
    *   主键值分配为 `String(maxRowId + 1)`，并**物理强制加入 `reserved` Set 中强行锁定**。
    *   即便旧行（如行号 5）已被 DELETE，由于 `reserved` 依然在当前生命周期中锁定，新行必须从 `6` 开始分配，物理切断了 row_id 重用的可能性。
4.  **安全上限控制**：当 `maxRowId` 逼近 `Number.MAX_SAFE_INTEGER` 时，物理抛出异常防止数值溢出引发的解析死锁。
