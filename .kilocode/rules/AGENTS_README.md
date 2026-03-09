# Agent 统一协作指南 (AGENTS_README)

**目的**: 本文档作为项目的**核心索引与总览**，应当长期纳入 Agent 的上下文。它提供了项目概览、技术栈介绍、当前状态、重要规则文件索引，以及人机协作的最高优先级规范（“红绿灯”工作流）。

---

## 1. 项目概览与技术栈 (Project Overview & Tech Stack)

### 1.1 项目定义
*   **项目名称**: ARK_STATUSBAR
*   **核心目标**: 在 SillyTavern (酒馆) 中构建一个深度还原《明日方舟》体验的“游戏化” RPG 引擎。不仅是 UI 美化，更包含复杂的剧情控制、变量管理和沉浸式交互。

### 1.2 核心技术栈与运行环境
*   **宿主环境**: SillyTavern (酒馆)
*   **加载器**: Tavern Helper (酒馆助手)
*   **前端 UI**: Vue 3 (结合 TailwindCSS)，以无沙盒 iframe 形式在消息楼层中挂载。
*   **状态与变量管理**: 
    *   **Zod**: 定义和校验变量结构 (`schema.ts`)。
    *   **MVU (Magical Variable Update)**: 通过自然语言输出和 JSON Patch 实现变量更新的框架。
*   **核心依赖**: Prompt Template Plugin (提示词模板插件)，用于处理世界书 (Worldbook) 与 EJS 动态提示词逻辑。

### 1.3 核心目录结构
```text
src/ARK_STATUSBAR/          # 核心开发目录
├── index.ts            # 入口文件 (挂载UI及后端初始化)
├── components/         # Vue UI 组件 (如 StartupNavigator, ReturnButton)
├── logic/              # 业务逻辑 (如 updaters, worldbook_manager)
├── mvu/                # MVU 相关结构与入口 (schemas)
├── prompts/            # EJS 提示词模板与世界书 YAML 配置
```

---

## 2. 核心索引 (Core Indexes)

**在处理任何新任务前，请务必查阅相关资料：**

### 2.1 规则文档 (`.kilocode/rules/`)
*   **`项目基本概念.md`**: 项目基本结构、第三方库、交互方式。
*   **`mvu开发核心指南.md`**: MVU 变量框架的开发规范、提示词设计和工作流。
*   **`mvu变量框架.md` & `mvu角色卡.md`**: 具体 MVU 相关接口使用和结构定义参考。
*   **`前端界面.md` & `脚本.md`**: 编写 UI 和后台逻辑的规范（含 iframe 挂载、teleport style 等）。
*   **`酒馆变量.md`**: 全局、角色卡、聊天、楼层变量的区分与使用。

### 2.2 API 与参考 (`@types/` & `references/`)
*   **`@types/`**: 所有可用酒馆内部及助手 JS 函数的类型定义。
*   **`references/doc_ST-Prompt-Template/`**: EJS 提示词模板插件官方文档。

### 2.3 开发日志 (`.kilocode/development_logs/`)
*   存储当前正在进行的开发日志、讨论和决策。
*   *(注：既往历史与失败教训备份于 `references/development_logs_backup/`)*

---

## 3. 项目当前状态与历史 (Current Status & History)

### 3.1 开发阶段回顾
*   **Phase 1-2**: 实现了基础架构和世界书控制。
*   **Phase 3 尝试**: 试图实现完整的“后端控制、任务队列、双模型路由”的罗德岛终端。
*   **重大重构与隔离**: 在 Phase 3 中，遭遇了“初始化风暴”(Initialization Storm) 问题（由于每次 Swipe 都加载脚本，导致第 0 轮时 MVU 初始化与后端逻辑竞态碰撞，引发循环触发与崩溃）。
    *   **当前状态**: 原 Phase 3 的后端逻辑 (在 `src/ARK_STATUSBAR/index.ts` 中的 `initializeBackendLogic` 调用) **已被注释并逻辑隔离**，保留在原位供后续参考。
    *   **修复防线**: 在 `src/ARK_STATUSBAR/logic/updaters/global.ts` 中添加了 `turn === 0` 的保护锁，避免“初始化风暴”。

---

## 4. 人机协作协议：SOP与红绿灯 (Collaboration Protocol)

### 4.1 "红绿灯"工作流 (最高优先级)
*   **🔴 红灯 (默认状态 - 绝对静默)**: 仅执行**只读**操作 (`read_file`, `list_files`, `search_files`) 收集信息。**严禁**执行任何写入操作或提出建议。
*   **🟡 黄灯 (提问与澄清)**: 发现指令模糊时，仅使用 `ask_followup_question` 客观提问，绝不猜测。
*   **🟢 绿灯 (精确执行)**: 只有在 User 下达了**具体的、明确的、可执行的写入指令**后才执行。执行完一次写入操作后，**必须立即**回归“红灯”状态。

### 4.2 核心 SOP 原则
1.  **环境勘探 (PoC) 优先**: 涉及酒馆宿主环境的新功能，必须先写独立的 `poc_*.ts` (或 `.js`) 进行验证并出具勘探报告。POC 文件统一存放在已经存在的 **`src/poc/`** 目录中。
    *   **🔴 绝对红线**: PoC 不只是项目测试，如果测试没有留下任何可供后人学习的项目经验和详细日志报告，那么测试就是完全没有任何意义的，禁止无报告、无结论的盲目测试！
2.  **强制性代码考古**: 动工前必须搜索并阅读现有文档与实现，提交“考古报告”。
3.  **伪代码优先**: 进行复杂写入前，先提供详细的伪代码供审查。
4.  **日志驱动**: 关键逻辑必须包含前缀日志（例：`[ARK_Logic_Global] ...`）。
5.  **总分规划 (Master-Detail)**: 复杂任务先写宏观的 Master Plan，确认后再写 Detail Design。

### 4.3 “指令结构体”示例
建议 User 下发复杂任务时使用以下格式，Agent 也会引导使用此格式聚合零散思路：
```markdown
**[任务名称]**: ...
**[背景上下文]**: (起因、相关设计文档链接)
**[明确的指令清单 (Do's)]**: (做什么、怎么做、约束条件)
**[明确的禁止清单 (Don'ts)]**: (严禁的做法)
**[验收标准 (Acceptance Criteria)]**: (判断任务完成的标志)
