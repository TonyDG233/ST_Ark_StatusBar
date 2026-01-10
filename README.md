# ARK_STATUSBAR Project

> 这是一个基于 SillyTavern（酒馆）和 Tavern Helper（酒馆助手）的高级扩展项目，旨在深度还原《明日方舟》的 UI 体验与世界观交互。

## 📅 项目背景
本项目起源于对“明日方舟”世界观在酒馆中沉浸式体验的追求。经过数月的探索与迭代，我们决定废弃旧有的复杂架构，回归本源，打造一个**视觉惊艳、交互流畅、数据智能**的“罗德岛终端”。

## 🚀 核心目标
1.  **PRTS 风格 UI**：复刻 PRTS 终端的视觉风格，提供一个包含时间、理智、干员状态等信息的常驻状态栏。
2.  **世界线管控**：通过简单的 UI 交互（开局选项/按钮），智能控制世界书条目的激活与关闭，实现“异格/幼年”状态的快速切换。
3.  **沉浸式通讯**：独立的私聊终端，模拟干员发来的短信与书信。
4.  **智能数据源**：利用爬虫技术从 PRTS Wiki 动态获取干员立绘与档案，解决本地资源包过大的问题。

## 🛠️ 技术栈
*   **Core**: TypeScript, Vue 3, Pinia
*   **Build**: Webpack (Single JS Bundle)
*   **Logic**: MVU (MagVarUpdate) + Zod
*   **Runtime**: SillyTavern + Tavern Helper + Prompt Template Plugin

## 🗺️ 开发路线 (Roadmap)
*   **Phase 1: Manager (进行中)** - 开场 UI 移植、世界书条目控制、单字干员屏蔽。
*   **Phase 2: Terminal** - MVU 变量接入、状态栏实时数据同步。
*   **Phase 3: Communicator** - 私聊系统、Wiki 爬虫、高级上下文优化。

## 📂 目录结构
*   `src/ARK_STATUSBAR/`: **[核心]** 本项目的所有源代码。
*   `.kilocode/`: Agent 规则与工作流配置。


## 📝 贡献与维护
本项目由 **Kilo Code** (AI Agent) 协助开发。
所有 Agent 在参与开发前，**必须** 阅读根目录下的 `AGENTS_README.md`。

---
*Last Updated: 2026-01-07*