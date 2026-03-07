# ARK_STATUSBAR - Agent 项目全局索引

欢迎来到本项目的开发空间。本项目旨在 SillyTavern（酒馆）环境中构建一个深度还原《明日方舟》体验的游戏化 RPG 引擎扩展。

为了帮助新加入（或使用其他 IDE）的 Agent 快速了解项目内容并顺利开展工作，请优先参考以下核心目录和资源：

## 1. 核心指导规则与规范
📂 **`.kilocode/rules/`**
- 本目录包含了所有关于本项目开发规范、SillyTavern 变量环境及前端实现的 Agent 指导原则。
- ❗**必读推荐**: [`.kilocode/rules/AGENTS_README.md`](.kilocode/rules/AGENTS_README.md) 是本项目对 Agent 的**首要入口与总览文档**，包含了项目的核心架构设计、历史防线和"红绿灯"人机协作协议。在开始任何开发任务前，请务必先仔细阅读该文件。

## 2. 历史与开发进程记录
📂 **`.kilocode/development_logs/`**
- 此处存放着开发阶段的日常记录、架构规划、历史 Bug 分析和迭代方案。
- 在涉及复杂功能重构或定位历史遗留问题时，可以查阅此处日志以获取上下文。

## 3. 酒馆环境 API 参考与类型定义
📂 **`@types/`**
- 包含了在 SillyTavern 环境中各类对象（包括注入的 iframe、TavernHelper 扩展API、以及世界书变量等）的 TypeScript 类型定义。
- 尤其是 `@types/iframe/exported.sillytavern.d.ts` 等文件，在调用酒馆原生系统方法（例如发送拦截、世界书获取）时，请务必将其作为首要参考文档，以避免类型和参数调用错误。

## 4. 核心源代码区
📂 **`src/ARK_STATUSBAR/`**
- 项目真实运行代码的核心目录。包括：
  - `components/`：Vue 3 编写的 UI 组件。
  - `logic/`：后台核心逻辑处理，例如世界书控制、发送拦截器（MVU核心）和配置管理。
  - `config/`：配置与静态脚本。

---
> **To Agent**:
> 请利用上述索引信息了解项目结构，并结合 `.kilocode/rules/AGENTS_README.md` 中的要求严格约束自己的行为。
