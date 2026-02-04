# Phase 2.2: 规划总结与交接 (Summary & Handover)

**日期**: 2026-01-20
**状态**: 规划完成

本次任务成功将开发模式从纵向（按组件）转变为横向（按数据域），为 `Global`, `Character`, `Player`, `Chronicle` 四大核心模块制定了详尽的“变量-逻辑-提示词”闭环设计。

---

## 1. 核心成果索引 (Deliverables)

以下文件构成了 Phase 2.2 的完整设计蓝图，也是后续开发必须严格遵守的“法律”：

1.  **全局状态**: [`.kilocode/development_logs/010_Phase2.2_GlobalState_Design.md`](./010_Phase2.2_GlobalState_Design.md)
    *   *核心*: 时间/地点管理，额外解析LLM的职责定义。
    *   *亮点*: **三阶段角色上下文管理** (Active -> Nearby -> Unload)。

2.  **角色档案**: [`.kilocode/development_logs/011_Phase2.2_Character_Design.md`](./011_Phase2.2_Character_Design.md)
    *   *核心*: 混合数据流（静态Worldbook + 动态MVU），FIFO记忆机制。
    *   *亮点*: **档案修复闭环** (Check -> Fill Null -> Push Task)。

3.  **玩家档案**: [`.kilocode/development_logs/012_Phase2.2_Player_Design.md`](./012_Phase2.2_Player_Design.md)
    *   *核心*: 去特化、高通用的主角模板，战力系统标准化。
    *   *亮点*: **常态化检测规则**，移除不稳定的关键词触发。

4.  **编年史**: [`.kilocode/development_logs/013_Phase2.2_Chronicle_Design.md`](./013_Phase2.2_Chronicle_Design.md)
    *   *核心*: 多层级总结 (Round -> TenRound -> Daily)，历史数据归档。
    *   *亮点*: **单线程任务队列** + **优先级调度**，解决多任务并发冲突。

---

## 2. 架构设计亮点 (Key Architectural Decisions)

1.  **后端驱动的任务队列 (Backend-Driven Task Queue)**
    *   摒弃了完全依赖 LLM 自发行为的模式，转而由后端脚本通过 `task_queue` 和 `pending_repairs` 显式地向 LLM 推送任务。
    *   确保了逻辑的确定性和系统的稳定性。

2.  **EJS 提示词动态注入 (Dynamic Prompt Injection)**
    *   利用 `@INJECT` 和 `[GENERATE]` 语法，根据后端状态动态构建 System Prompt。
    *   实现了“只在需要时才注入规则”，极大节省 Token。

3.  **稳健的错误处理 (Robust Error Handling)**
    *   所有数据写入前先经过 Zod 校验。
    *   校验失败不抛错，而是填充默认值并生成修复任务，利用 LLM 的自我修正能力实现自愈。

---

## 3. 后续文件列表 (Next Steps Context)

为了推进下一阶段的实际代码开发，请参考以下核心规则与定义文件：

*   **规范文档**:
    *   `.kilocode/workflows/✅变量初始设置 (initvar).md`
    *   `.kilocode/workflows/✅变量更新规则.md`
    *   `.kilocode/workflows/✅变量结构设计 (脚本).md`
    *   `.kilocode/workflows/✅变量列表.md`
    *   `.kilocode/workflows/✅变量输出格式.md`
    *   *`.kilocode/workflows/✅变量输出格式强调.md` (需新建/确认)*
    *   *`@types` (所有可用api定义文件)*
    *   `references\doc_ST-Prompt-Template\features_cn.md`
    *   `references\doc_ST-Prompt-Template\reference_cn.md`    

*   **设计文档**:
    *   `.kilocode/development_logs/005_Phase2_Terminal_Architecture.md` (总体架构)
    *   `.kilocode/development_logs/006_Phase2.1_MVU_Integration.md` (MVU基础)
    *   `.kilocode/development_logs/010_Phase2.2_GlobalState_Design.md` (Global)
    *   `.kilocode/development_logs/011_Phase2.2_Character_Design.md` (Character)
    *   `.kilocode/development_logs/012_Phase2.2_Player_Design.md` (Player)
    *   `.kilocode/development_logs/013_Phase2.2_Chronicle_Design.md` (Chronicle)

---

**Ready for context summarization.**

## 4. Phase 3: 开发实施规划 (Development Implementation Plan)

本章节为 **Phase 3** 的详细执行手册，旨在将上述所有设计转化为实际可运行的代码与配置。

### 4.1 目标文件结构 (Target File Structure)

项目将严格区分**源码目录** (src) 与**产物目录** (dist/artifacts)，并设立独立的**提示词仓库**。

**关键约束**: `prompts/` 下的文件名必须严格包含 `[mvu_plot]` 或 `[mvu_update]` 标签。这两个标签具有**实际的功能意义**，决定了该条目会被路由给哪个模型（剧情模型 vs 逻辑模型）。

```text
src/ARK_STATUSBAR/
├── logic/                      # [核心] 后端逻辑中心
│   ├── updaters/               # 变量更新逻辑 (后端脚本)
│   │   ├── global.ts           # 对应 010_Phase2.2_GlobalState_Design.md
│   │   ├── character.ts        # 对应 011_Phase2.2_Character_Design.md (档案修复/三阶段管理)
│   │   ├── player.ts           # 对应 012_Phase2.2_Player_Design.md (初始化/状态检查)
│   │   └── chronicle.ts        # 对应 013_Phase2.2_Chronicle_Design.md (单线程任务队列)
│   └── utils/                  # 工具函数
├── mvu/                        # [核心] 变量定义 (MVU Schema)
│   ├── schemas/                # 分模块定义 (源码，用于脚本引用)
│   │   ├── global.ts
│   │   ├── character.ts
│   │   ├── player.ts
│   │   └── chronicle.ts
│   └── index.ts                # [入口] 导出所有 Schemas，用于构建 bundle
├── components/                 # [UI] 前端组件 (Vue)
│   ├── status_bar/             # 状态栏核心组件
│   └── ...
├── prompts/                    # [资源] 提示词仓库 (对应世界书条目)
│   ├── static/                 # 纯文本条目 (YAML - 无动态逻辑)
│   │   ├── [initvar]变量初始化.yaml        # 发送给双模型 (无特殊标签)
│   │   └── ...
│   └── dynamic/                # 动态条目 (EJS - 包含显隐/渲染逻辑)
│       ├── [mvu_update]变量更新规则.ejs    # 仅发送给更新模型
│       ├── [mvu_update]任务执行器.ejs      # 仅发送给更新模型 (逻辑指令)
│       └── ...
└── tools/                      # [构建] 构建脚本
    └── build_schema.ts         # 将 mvu/schemas 打包为单一脚本的工具
```

### 4.2 模块开发内容详解 (Module Development Details)

#### A. 变量定义模块 (Schema Definition)
*   **开发内容**:
    1.  按照 `.kilocode/workflows/✅变量结构设计 (脚本).md` 规范，编写各模块的 Zod Definition。
    2.  编写 `tools/build_schema.ts`，利用 `esbuild` 或简单的文件拼接逻辑，将 `src/ARK_STATUSBAR/mvu/schemas/*.ts` 打包成一个独立的 JS 文件。
    3.  **关键约束**: 打包文件的头部必须包含指定的 URL 导入：
        `import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';`
    4.  **产物**: `dist/artifacts/mvu_schema_bundle.js` (可直接导入 MVU 插件)。
*   **关键参考**:
    *   `node_modules/zod/lib/index.d.ts` (Zod API)
    *   `.kilocode/workflows/✅变量结构设计 (脚本).md` (结构规范)

#### B. 后端逻辑模块 (Backend Logic)
*   **开发内容**:
    1.  **Global**: 实现 `time` 格式校验与 `presence` (Active/Nearby/Unload) 三阶段管理。
    2.  **Character/Player**: 实现 `pending_repairs` 队列管理，以及 "Check -> Fill -> Push Task" 的自愈循环。
    3.  **Chronicle**: 实现 `task_queue` 的优先级调度器 (`scheduleTasks`)，处理递归的任务生成逻辑。
*   **核心机制**: 后端脚本**仅负责修改 MVU 变量** (如 `task_queue` 或 `pending_repairs`)，**不进行文本注入**。实际的指令注入由 `[mvu_update]任务执行器.ejs` 检测到变量变化后自动渲染。
*   **API 关键索引**:
    *   **MVU 变量读写**: 参考 `@types/iframe/exported.mvu.d.ts`
        *   `Mvu.getMvuData(...)`
        *   `Mvu.replaceMvuData(...)`
        *   `Mvu.events.VARIABLE_UPDATE_ENDED` (核心触发时机)
    *   **世界书操作**: 参考 `@types/function/worldbook.d.ts`
        *   `updateWorldEntry(...)` (用于脚本侧动态开关条目，虽主要依赖EJS，但此API仍可能用于高级控制)
    *   **通用工具**: 参考 `@types/function/util.d.ts`

#### C. 提示词工程模块 (Prompt Engineering)
*   **核心机制 (Dual LLM Routing)**:
    *   **[mvu_plot]**: 仅发送给 **Main LLM** (负责剧情演绎)。用于：世界观设定、战力标准、剧情回顾。
    *   **[mvu_update]**: 仅发送给 **Extra LLM** (负责逻辑/变量)。用于：变量更新规则、任务指令、JSON Patch 生成。
    *   **无标签**: 发送给 **双模型**。用于：初始变量 `[initvar]`，确保两个模型都有基础状态。
*   **开发内容**:
    1.  **[mvu_update]变量更新规则.ejs**: 编写包含完整 `check` 逻辑的更新规则 EJS。
    2.  **[mvu_update]任务执行器.ejs**: 监听 `chronicle.task_queue` 变量，利用 EJS 条件渲染 (`<% if %>`) 生成系统指令 (System Prompt)。
*   **关键参考**:
    *   **EJS 语法**: `references/doc_ST-Prompt-Template/reference_cn.md`
    *   **Update Rule 规范**: `.kilocode/workflows/✅变量更新规则.md`

### 4.3 任务阶段规划 (Task Phasing)

#### Stage 1: 基础设施搭建 (Infrastructure)
1.  [ ] **Schema 构建流**: 编写并测试 `tools/build_schema.ts`，确保能正确生成符合规范的 MVU 脚本。
2.  [ ] **基础 Schema 实现**: 完成 Global, Character, Player, Chronicle 的 Zod 定义并打包测试。
3.  [ ] **InitVar 配置**: 编写 `[initvar].yaml`，包含所有模块的初始状态。

#### Stage 2: 核心逻辑实现 (Core Logic)
1.  [ ] **Chronicle 调度器**: 实现单线程任务队列逻辑，仅更新变量状态。
2.  [ ] **档案修复机制**: 实现 Character/Player 的空值检测，仅更新 `pending_repairs` 变量。
3.  [ ] **全局状态同步**: 实现 Global 模块的时间推进与三阶段上下文管理。

#### Stage 3: 提示词与集成 (Prompt & Integration)
1.  [ ] **Task EJS**: 编写 `[mvu_update]任务执行器.ejs`，实现从变量到 Prompt 的渲染转换。
2.  [ ] **Update Rules**: 编写完整的 `[mvu_update]变量更新规则.ejs`，适配额外解析模型。
3.  [ ] **集成测试**: 在本地 SillyTavern 环境中进行全链路测试（UI -> 变量 -> 后端 -> EJS渲染 -> LLM -> 变量更新）。

#### Stage 4: 反馈与优化 (Feedback & Polish)
1.  [ ] **Token 消耗分析**: 检查 EJS 渲染出的内容是否过于臃肿，优化 Prompt 模板。
2.  [ ] **稳定性测试**: 模拟长对话，检查任务队列是否能被 EJS 正确消费并由后端脚本清理。
3.  [ ] **错误日志**: 完善后端脚本的 `console.log` 输出。

### 4.4 反思与风险点 (Reflections & Risks)
*   **EJS 逻辑分离**: 必须严格界定“后端脚本只管数据”和“EJS只管渲染”的边界。避免逻辑泄露（例如 EJS 里写复杂计算，或后端脚本里尝试拼接字符串）。
*   **额外模型延迟**: 依赖额外模型解析变量会增加响应延迟。需评估用户体验影响。
*   **循环触发**: 确保 LLM 响应后的变量更新不会导致 EJS 死循环渲染。
