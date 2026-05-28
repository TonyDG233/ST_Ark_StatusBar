# ARK_STATUSBAR 重启规划：视觉小说 (VN) 播放器演进

## 1. 重启背景 (The Reboot Context)

在之前长达两个月的开发中，我们致力于打造一套复杂且先进的“V2 变量引擎”（试图平替 MVU），并且围绕这套变量引擎设计了全新的现代化 UI。
但最近的负面反馈（“两个月的全新设计还不如以前 Agent 随便拼凑的”）让我们意识到：**当前的 UI 改造过于受制于酒馆宿主环境现有的排版逻辑，这成了一个极重的历史包袱，导致开发体验和最终效果都难以让人满意。**

因此，我们决定**战略性放弃原本“改造酒馆内置 UI”的思路**，直接朝着一个长久以来的宏大目标进发：**从头打造一个纯粹的、类似于明日方舟剧情播放器（VN Player）的前端，底层配合一个能完全脱离酒馆宿主独立发包的模型引擎。**

为避免步子迈得太大，我们将采用**绞杀者榕树模式（Strangler Fig Pattern）**：
先在酒馆生态内获取数据（借用已有的世界书、预设、角色卡），用纯净的 VN UI 进行展示；待其强壮后，再将其连根拔起，剥离酒馆环境，最终形成独立应用。

## 2. 刚刚取得的战略突破 (What We've Done Just Now)

在我们感到迷茫、缺乏灵感时，我们通过自动化浏览器探针 (`agent-browser`) **成功抓取并逆向了 PRTS Wiki 的明日方舟剧情模拟器核心源码**！

存放在 `src/poc/` 下的截获文件：
- `src/poc/prts_parser.js`: 这是整个方舟剧情播放器的核心解析引擎（包含 `txt_analyze(txt)` 状态机）。
- `src/poc/krliov.toolbox.js`: 配套的渲染动画与工具库。

**重大意义：**
我们现在彻底了解了成熟的方舟剧情文本格式（如 `[Character(name="amiya")]`），以及前端到底是如何通过分析这套文本来操纵 DOM 进行剧情演出的！**我们不再需要从零闭门造车地去设计演出数据结构，直接站在了巨人的肩膀上。**

## 3. 阶段演进规划 (Phased Roadmap)

### Phase 1: 酒馆内的独立剧情播放器 (Native ST Player & Parser Refactor)
- **1.1 剧本引擎剥离与重构 (Parser Redesign)**
  - PRTS 的源码基于陈旧的 jQuery，且将解析与 DOM 渲染重度耦合。
  - **任务**：阅读 `prts_parser.js`，将解析正则表达式（State Machine）剥离出来，使其成为一个纯 TypeScript 数据引擎。输入 TXT 剧本流，输出结构化的 Action 数组 `{ action: 'show_char', name: 'amiya', pos: 'left' }`。
- **1.2 纯视觉无状态 VN UI (Dumb VN UI)**
  - 彻底抛弃之前的 UI 包袱，在 Vue 框架下搭建一个**无状态的“哑播放器组件”**（包含背景层、立绘层、对话框层、震动系统）。
  - 该 UI 组件完全与酒馆业务解耦，只负责响应 1.1 中输出的动作指令进行渲染（打字机、立绘淡入淡出等）。
- **1.3 上下文数据桥接与发包 (The Adapter)**
  - **探明发包组装逻辑**：分析酒馆预设、角色卡和聊天记录是如何被拼合成一段完整的 Prompt 发送的（利用之前的 `send_interceptor.ts` 经验）。
  - **拦截与注入**：借助 Tavern Helper 的 API (`generateRaw`) 或直接拦截 `safeGenerate`，接管大模型的返回流，将文本送入 1.1 解析器，再由 1.2 播放器进行演出展示。

### Phase 2: JS 单例引擎独立 (Singleton Engine Independence)
- 随着 1.3 的成熟，将核心发包逻辑、变量管理（我们之前在 `V2_ENGINE_ARCHITECTURE_PLAN.md` 设想的心跳捕获、Zod 防腐管道等）从酒馆 UI 层剥离，封装为一个纯粹的全局 JS 单例包。
- 该单例以黑盒形式存在于酒馆中，仅通过读取“存档元数据（Metadata/Variables）”提供数据支撑。此时，VN 播放器完全独立于该单例运行，不再关心外部是否是“酒馆”。

### Phase 3: 独立客户端架构 (Standalone VN App / App Development)
- 当“单例引擎 + VN 播放器”完全自洽后，引入 Tauri / Electron 或移动端框架。
- 直接读取用户硬盘上导出的 JSON 配置文件（原酒馆的世界书、卡片），彻底抛弃 SillyTavern，实现从“插件”到“独立引擎客户端”的完美蜕变！

---
**本计划意味着我们不再内耗于旧 UI 的修修补补，而是拿着刚刚缴获的核心武器（PRTS 源码），开启新纪元！**