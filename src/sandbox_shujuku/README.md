# 明日方舟剧情与数据库模块 - 逆向沙盒 (sandbox_shujuku)

本目录是针对 SillyTavern 外部数据库插件 `shujuku` 的逆向工程分析、核心机制技术规格书，以及剧情自动化引擎与数据库底座整合的总体规划方案。

---

## 📂 目录结构与文档指引

为了让目录结构一目了然、防范代码和逻辑陷入黑盒状态，所有分析报告、核心设计以及整合方案均已物理重整，按照**逆向事实、技术规格设计以及总体整合规划**分层存放：

### 1. 📂 `1_逆向工程与底层事实/`
本目录记录了对外部 `shujuku` 插件物理代码和提示词机制的真实逆向分析，是底座搭建的事实源。
*   **[1_1_shujuku插件三层架构剖析.md](./1_逆向工程与底层事实/1_1_shujuku插件三层架构剖析.md)**：分析其 Data/Service/Presentation 层级职责，定位 `ITableStorageProvider` 存储策略接缝（Seam）。
*   **[1_2_核心业务逻辑与不变量约束.md](./1_逆向工程与底层事实/1_2_核心业务逻辑与不变量约束.md)**：记录其双重调用、事务原子性、表名/列名映射器 `NameMapper` 的租约所有权，以及 Null-to-RowID 的历史数据兼容迁移逻辑。
*   **[1_3_无头解耦实施方案.md](./1_逆向工程与底层事实/1_3_无头解耦实施方案.md)**：详述如何剥离 `toastr` 和 `window.parent` 等宿主 DOM/UI 强依赖，提炼纯 TypeScript 无头（Headless）核心引擎。
*   **[1_4_shujuku提示词管线与三大业务环逆向分析.md](./1_逆向工程与底层事实/1_4_shujuku提示词管线与三大业务环逆向分析.md)**：**【核心事实解密】**。深入逆向 `defaults-json.js`、`merge-logic.ts` 和 `plot-logic.ts` 的物理代码，揭秘 SQL DML 填表约束、时间线“天之音”记忆召回，以及美杜莎 CoAT（分析-草稿-策略选择-扩写-审计-自评-SQL输出）后台主动收缩抗熵业务闭环的真实运作机制。
*   **[1_5_shujuku深层高级子系统逆向分析.md](./1_逆向工程与底层事实/1_5_shujuku深层高级子系统逆向分析.md)**：**【黑盘高阶模块事实】**。逆向 `vector/`、`agent-worldbook-takeover.ts` 等高难度代码，深入还原自制中文滑动 Bigram 分词 BM25 检索、RRF 重排算法、世界书绿灯接管（Greenlight Takeover）、Token 预算自动裁切以及 Schema 字段列更名自动调和平滑迁移（`renamePhysicalColumn_ACU`）的底层机制。
*   **[1_6_shujuku自动填表计划器与高阶Agent决策引擎逆向分析.md](./1_逆向工程与底层事实/1_6_shujuku自动填表计划器与高阶Agent决策引擎逆向分析.md)**：**【自动决策与调度事实】**。逆向 `update-scheduler.ts`、`agent-decision-engine.ts` 等代码，深度还原基于表格元数据 `updateConfig` 自适应构建 **UpdateGroup** 并行填表计划、高阶 Agent 决策拓扑任务排序与 DFS 依赖死锁检测、以及超大世界书 Sharded Concurrency 分片并发决策的物理代码机制。

### 2. 📂 `2_技术规格与核心设计/`
本目录记录了本插件要达到的具体技术指标和场景机制的详细设计规格书。
*   **[2_1_数据库与聊天文件优化方案.md](./2_技术规格与核心设计/2_1_数据库与聊天文件优化方案.md)**：阐述如何在不使 `.jsonl` 聊天文件膨胀的前提下，通过 **“全量 ChatMetadata 压缩快照 + 楼层增量 WAL (sql_delta)”** 机制实现极致的冷启动速度与撤回（Undo）/分叉（Swipe）状态强一致性。
*   **[2_2_剧情自动化双轨加载模式规格书.md](./2_技术规格与核心设计/2_2_剧情自动化双轨加载模式规格书.md)**：定义“幕级全量开关控制（模式一）”与“基于 AST 节点滑动窗口单点 Hook 注入（模式二）”两套加载模式，并提供三色剧情运行监控面板（Story Visualizer）的 UI 规格设计。

### 3. 📂 `3_剧情与数据整合/`
本目录记录了剧情自动化引擎与数据库底座进行全闭环拼装的总体蓝图。
*   **[3_1_剧情与数据库旁路API整合总体规划.md](./3_剧情与数据整合/3_1_剧情与数据库旁路API整合总体规划.md)**：**本项目的总体规划与技术蓝图（ speculative 草案）**。详述了未来可能进行的 SQLite 作为单一数据源（SSOT）的决策、双重调用管线中前置侦察兵与后置异步填表人的咬合逻辑，以及脱离酒馆宿主 UI 的 Bypass 旁路 API 架构设计。

---

## 🗺️ 阶段开发路线图 (Roadmap)

剧情与数据模块的落地将严格分为四个物理阶段递进：

### 阶段一：数据库核心解耦与纯净离线验证
*   **开发重心**：关系型数据库底座（WASM/asm.js、`SqliteEngine`、`SchemaMapper`、`SyncBridge`）。
*   **动作**：在 `src/sandbox_shujuku/core/` 下提取无宿主依赖的 `sqlite-engine.ts`，彻底消除 window/DOM 引用，建立 `sqlite_decouple_poc.ts` 作为物理沙盒测试。
*   **物理断言**：
    *   `ASSERT_DDL_GENERATION`：输入 Sheet 二维数组，测试成功生成 DDL 并在内存中自动创建物理表、插入数据。
    *   `ASSERT_TRANSACTION_ROLLBACK`：模拟 DML 批处理中注入语法错误 SQL，断言数据库必须物理触发 `ROLLBACK`，数据无损。

### 阶段二：剧情自动化离线编译与世界书 DAG 逻辑验证
*   **开发重心**：社区剧情世界书资产解析、JSON-DAG 编译器、滑动视窗计算逻辑。
*   **动作**：编写独立脚本 `tools/compile_lorebook.ts` 正则读取世界书大 JSON，解离出 `# 剧情节点...` 结构，输出并保存 `scenario_dag.json` 静态资产。编写纯 TS 滑动视口计算类。
*   **物理断言**：
    *   `ASSERT_SLIDING_WINDOW_COMPASS`：给定当前节点 `RI5`，断言计算出的滑动文本中必须精确包含 `RI3`、`RI4` 的 summary 梗概和 `RI5` 的全量内容，不包含超出视口的节点。
    *   `ASSERT_MACRO_EXPANSION`：断言拼装后的场景切片文本能正确替换至唯一的 `{{ark_story_hook}}` 占位符。

### 阶段三：双轴合并沙盒测试与极轻化 WAL 一致性验证
*   **开发重心**：合并冷热状态、WAL 增量重播、删除自愈机制、双重调用拦截。
*   **动作**：建立 `StoryDataManager` 门面整合剧情网络与 SQLite。实现 WAL Checkpoint 双向水合与删除拦截重构（在删除动作前一瞬间，对当前最新一楼物理写入全量 checkpoint 建立新起点）。
*   **物理断言**：
    *   `ASSERT_REPLAY_PERFORMANCE`：模拟连续生成 50 楼并在内存中执行 50 条 WAL 增量 SQL 重播，断言整体耗时必须在 **5ms** 以内。
    *   `ASSERT_DELETE_HEALING`：删除中间消息后，断言数据库状态重组现场，与当前的最新床头楼层 100% 物理对齐。

### 阶段四：主项目合并点火与线上实机联调
*   **开发重心**：UI 监控面板渲染、Tavern Helper 真实事件挂载、流式发包拦截与线上实机测试。
*   **动作**：将 `StoryDataManager` 运行时并入生产代码，开发 `StoryVisualizer.vue` 三色监控面板，连接真实浏览器控制台进行线上点火联调。
*   **物理断言**：
    *   `ASSERT_ZERO_COMPILE_ERROR`：执行本地 `npx tsc` 与 `pnpm run build`，断言编译期类型检验 100% 通过。
    *   `ASSERT_JSONL_LIGHTWEIGHT`：实机连续交互 10 轮，断言每轮消息实体物理增加大小不超过 **1KB**。
