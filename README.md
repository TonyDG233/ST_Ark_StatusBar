# ARK_STATUSBAR Project

> 这是一个基于 SillyTavern（酒馆）和 Tavern Helper（酒馆助手）的高级前端扩展项目，旨在深度还原《明日方舟》的 UI 体验与世界观交互。

## 📅 项目背景
本项目起源于对“明日方舟”世界观在酒馆中沉浸式体验的追求。经过数月的探索与迭代，我们在极度复杂的黑盒宿主环境（SillyTavern + 插件生态）中，逐步确立了以**防御性开发**和**精确事件拦截**为核心的稳定架构，打造一个视觉惊艳且数据可控的“罗德岛终端”。

## 🚀 核心功能与特性
1.  **PRTS 风格 UI**：复刻 PRTS 终端的视觉风格，提供包含全局世界书状态、开局切换等信息的常驻动态状态栏。
2.  **精确的世界线管控**：通过 UI 交互实现对世界书 (Worldbook) 条目的精确控制，支持**永久屏蔽**与无竞态死锁的**临时单次阻断**。
3.  **多相物理拦截与 Token 预估**：挂载底层 `keydown/keypress/keyup` 劫持回车事件，并在发送前通过“双轨并行”方案实现精准的 Token 消耗预估。

## 🛠️ 技术栈
*   **Core**: TypeScript, Vue 3, TailwindCSS
*   **Build**: Webpack (打包为酒馆助手可直接加载的脚本与界面)
*   **Logic**: MVU (Magical Variable Update) + Zod (严格类型校验)
*   **Runtime**: SillyTavern + Tavern Helper + Prompt Template Plugin

## 🗺️ 项目进度 (Project Status)
*   **Phase 1-2 (已完成)**: 基础架构搭建、Vue UI 挂载机制、基础世界书条目管控。
*   **Phase 3 (隔离重构中)**: 尝试实现后端控制与任务队列，因遭遇“初始化风暴”目前处于逻辑隔离状态，以确保主线稳定性。
*   **v4-v5 迭代 (当前稳定版)**: 成功攻克真实 Token 预估、世界书防错位匹配、临时单次阻断（配合 `GENERATION_ENDED` 恢复）以及安全的回车键拦截体系。

## 📂 目录结构
```text
src/
├── ARK_STATUSBAR/          # 项目核心业务代码 (Vue UI, 逻辑拦截, 世界书控制)
├── poc/                    # 概念验证 (PoC) 脚本区，用于测试环境黑盒 API
└── util/                   # 共享工具箱

.kilocode/                  # 工程化管理与 AI 协作边界
├── rules/                  # 项目协作规则 (含 AGENTS_README.md)
├── state/                  # 项目状态同步文件 (PRD, ARCH, PROJECT_STATE)
└── development_logs/       # 历史开发迭代记录与测试报告
```

## 📝 贡献与维护
本项目由 **Kilo Code** (AI Agent) 协助开发。
所有 Agent 在参与开发前，**必须** 阅读根目录下的 `AGENTS_README.md`。

---
*Last Updated: 2026-03-19*