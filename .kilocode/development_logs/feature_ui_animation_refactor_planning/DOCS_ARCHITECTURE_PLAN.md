# 文档体系架构及实施工作流规划 (Living Documentation Master Plan)

## 1. 核心目标：为什么我们需要一套全新的文档体系？

本项目自立项以来，经历了多次底层架构的推倒重来。目前（3500行代码）已经形成了“平级模块化”、“防腐层（Mapper）”、“基于 MVU 和事件总线的状态流转”等核心防线。
但由于缺乏类似大型工程（如 `erArk`）那样系统化、可视化的“活文档”，导致新成员（或切换上下文的 Agent）接手时：
1. **认知断层**：只能靠全盘通读散落的源码去反推架构。
2. **防线屡次被破**：因为不知道哪条 `document.addEventListener` 是为了绕开什么坑而写的，一旦重构或为了实现小功能（如 UI 动画）就会不自觉地破坏核心的隔离边界（例如“动画撕裂”和“事件地狱”）。

因此，我们需要构建一套**独立于任何特定大模型工具（不仅限 KiloCode）、长久伴随仓库演进的 `docs` 体系**。让开发者能通过阅读文档，瞬间恢复对该模块的“控制感”。

## 2. 关于 `.kilocode/rules` 与工作流的梳理说明

根据前期痛点，明确工作流与目录的职能边界：
- **`docs/`（新设仓库根目录）**：存放所有真实的业务设计、数据流向、避坑说明。随着项目演进，它们是该项目的“灵魂”。即使将来不使用 KiloCode 工具链，这套文档也能直接辅导任何开发者（或其它 Agent 工具）。
- **`.kilocode/rules/`**：仅供 KiloCode Agent 阅读的“短小、硬性的防线法则”。例如 `AGENTS_README.md`，它不应该承载长篇的业务逻辑推导，而只写“不准做什么”。
- **MVU 相关内容移出 Rules**：MVU 是一个具体的代码框架实现，它应该作为技术栈的一种 Skill 或放在 `.kilocode\skills\mvu` 下的开发指南中，不再占据强制全局 Rule 的位置。
- **强制 4 步走工作流重申**：任何新功能开发，**先改文档设计 $\rightarrow$ 再写防腐转译 $\rightarrow$ 建立独立监听器（Automator） $\rightarrow$ 最后才在 Vue 里调门面（Facade）**。如果再次发生盲目上手改 `GlobalStatusBar.vue` 内部逻辑并破坏隔离边界的行为，即为对本规约的最高级别违背。

## 3. 全新 `docs/` 文档目录结构蓝图

参考 `erArk` 的结构设计，新版 `docs` 体系规划如下：

### 📄 `docs/README.md` (总索引导航)
作为全新文档库的主大门。提供：
1. 本项目的业务初衷与架构设计哲学。
2. 开发者快速导读（新手先看什么，找 Bug 看什么）。
3. 到以下各个子领域的绝对路径链接。

### 📂 `docs/1_core_architecture/` (基础架构与流向)
*   **`配置持久化与状态树.md`**：详解 `config_store.ts` 是怎么存的，以及 `shared_ui_state.ts` 是怎么作为一个“单向数据大黑板”向所有 Vue Tab 喂数据的。
*   **`内部事件总线(ArkEventBus).md`**：彻底澄清什么是内部事件、什么是宿主事件。列出当前系统里所有的内部信号通道及其触发时机。
*   **`数据契约与Mapper防腐层.md`**：解答“为什么一定要在读写边界把数据洗成 `types/` 里的结构”。

### 📂 `docs/2_domain_worldbook/` (业务核心：世界书领域)
*   **`StatusBarManager门面系统.md`**：解释为什么要有这个 Facade，以及它的转调逻辑。
*   **`Automator自动化监听工作流.md`**：记录 `worldbook_automator.ts` 监听原生 `CHAT_CHANGED`、`GENERATION_ENDED` 时到底在做哪些同步补偿工作（如检查 baseline 差异）。
*   **`拦截与预警执行链.md`**：剥析 `send_interceptor.ts` 的“Dry Run”（干跑）到底是怎么阻断酒馆原生发送的。

### 📂 `docs/3_ui_and_physics/` (视觉层与物理交互)
*   **`双层DOM物理与动画引擎.md`**：解决拖拽与动画打架的终极指南。阐释 `Physical Shell` (0 延迟、防越界) 和 `Visual Panel` (纯动画) 的设计妥协点。

### 📂 `docs/4_host_redlines/` (宿主黑盒防线)
*   **`酒馆原生生态避坑指南.md`**：记载血泪教训（例如初始化风暴、假死锁、不要污染原生 DOM 等红线防区）。

## 4. 后续实施阶段 (Implementation Phases)

1.  **阶段 1 (文档骨架搭建与根级入口重建)**：
    *   创建 `docs/` 目录以及 `docs/README.md` 作为全项目**人类/开发者**可见的主入口。
    *   清理废弃：删除项目根目录的旧版 `AGENTS.md`。修改项目根目录原有的 `README.md`，让它直接引导人类开发者前往 `docs/README.md`。

2.  **阶段 2 (AGENTS_README 的瘦身与索引剥离)**：
    *   **绝不直接丢弃** `.kilocode/rules/AGENTS_README.md` 里的长篇心血（如红绿灯协议、初始化风暴防线、架构历史），而是**拆分**它！
    *   拆分出来的部分 A（纯粹的系统架构历史、日志结构模板）移动到 `docs/` 下的具体说明文件中。
    *   **清理 `.kilocode/rules/` 目录下的过载规则**：将 `.kilocode/rules/mvu变量框架.md` 和 `.kilocode/rules/mvu角色卡.md` 这两个具体的 MVU 代码框架实现，从全局强制 Rule 中移除，移动到 `.kilocode/skills/mvu/SKILL.md` 作为专项开发技能指导。
    *   留在 `.kilocode/rules/AGENTS_README.md` 里的，只剩极简的“Agent 绝对不准做什么（红线）”，以及告诉 Agent“你需要哪些领域的业务知识，请直接去 `docs/README.md` 寻找主索引”。

3.  **阶段 3 (内容填充)**：依据实际的稳定版代码，逐步完成上述 4 大类子文档的起草，做到代码注释与文档说明能够直接对应。

4.  **阶段 4 (废弃冗余)**：在以上体系建立稳定后，清理以前散落在各个临时文件夹里的零碎的、不再准确的日志与旧版计划。

---

*（本规划文件留存于 `devlogs/feature_ui_animation_refactor_planning/` 作为本次大规模重构迷失后，确立“文档驱动架构”这一核心方针的见证。）*