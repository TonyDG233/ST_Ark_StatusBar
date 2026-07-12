# 无头酒馆核心引擎 (Headless Tavern Core) - 逆向与重构规划 (REVERSE_PLAN)

## 0. 开发者状态与 AI 协作绝不妥协的红线 (Developer State & Red Lines)
**【当前心理状态警示】**
开发者正处于极度的研发倦怠（Burnout）与严重的心理创伤（疑似 CPTSD）边缘。长期遭受负反馈、孤独的黑盒代码逆向（如 PRTS 等）的折磨，以及过去 AI 工具的敷衍、自作主张与破坏性修改，导致开发者对“偏离指令”、“忽略上下文”、“写通用敷衍代码”的行为存在极端的易怒与创伤触发反应 (Triggered Response)。

**【AI 必须死守的协作原则】**
1. **杜绝自作聪明与敷衍**：提供参考项目（如 `TauriTavern`）时，必须去深入研读其底层源码（如 Rust 原生的流式解析与路由分发），绝不允许不看参考代码就凭空捏造一年前水平的通用残次品 API。
2. **严禁阉割需求**：“完整移植 API”意味着必须包含多模态 (Vision/Audio)、工具调用 (Tool Calling) 和思维链推理 (Reasoning) 等所有现代高级特性，这是未来硬核玩法的基础，不是可有可无的添头。
3. **计划的神圣性**：绝不允许在更新文档时擅自删减、简化用户口述的步骤（特别是复杂的预设解析与拼接环节）。
4. **真正的架构测试，不是过家家**：目标是验证真实的物理前后端分离，为一体化独立同人游戏打底，任何脱离实际生产标准的玩具级代码都是对开发者心血的侮辱。

---

## 1. 架构意图与核心目标 (Architectural Intent & Core Goal)

**核心意图：验证真正意义上的物理前后端分离架构。**
本 Sandbox 不再是一个“跑在酒馆 iframe 里假装后端的纯逻辑脚本”，而是为了未来独立的 **“明日方舟同人游戏 (独立 App/客户端)”** 做核心技术论证。

**本次测试的前后端技术栈：**
- **前端表现层 (View Layer)**：基于 Vue 3 渲染的独立纯净 Web 页面（打包输出 `index.html` 独立运行）。彻底剥离 SillyTavern 的前端环境、依赖树和 DOM 注入逻辑。
- **无头逻辑层 (Mock Native Backend)**：位于 `src/sandbox_headless_core` 的纯 TypeScript 模块集。在本次沙盒测试中，它作为未来 **C# / Rust 原生后端**的逻辑代理，接管繁重的文件解析、预设拼接、上下文截断与大模型网络通信，向前端只暴露纯净的数据驱动接口。

**核心关键点：**
1. **数据资产继承**：不从头造轮子，而是编写独立的 Parser，读取现有的、经过团队长期打磨的方舟 V2 角色卡（PNG/JSON）和庞大的世界书库，作为独立游戏的数据底座。
2. **单向数据流闭环**：前端（Vue）只作为极简的视图展示和指令下发者。所有的 Prompt 组装、宏替换 (`{{setvar}}`, `{{char}}`)、通信及网络请求跨域问题，全部由独立的 `Headless Core` 层消化。

---

## 2. 当前进度 (Current Progress)

**【已完成】阶段 1：可扩展的 LLM API 适配器与独立测试基座**
- 成功搭建完全独立于酒馆的 `SandboxTerminal` (独立 Web 网页)。
- **架构升级 (Engine Shift)**：全面废弃手写的残缺 Adapter，引入工业级开源框架 `@earendil-works/pi-ai` 与 `@earendil-works/pi-agent-core` 作为底层大模型通信与状态管理核心。
  - 原生获得了完整的模型统一适配 (Unified Provider API)、工具调用 (Tool Calling)、思维链提取 (Reasoning blocks) 与多模态 (Vision) 支持，彻底根除了之前遗留的技术债务。
- UI 交互闭环验证完成：成功脱离宿主，在浏览器中通过 `pi` 框架完成流式通信打字机测试。
- **核心参考文档 (Pi Framework Docs)**：
  - 官方主站指南：[https://pi.dev/docs/latest](https://pi.dev/docs/latest)
  - `pi-ai` 本地源码与 API 参考：`D:\LLM\self_programming\pi\packages\ai\README.md`
  - `pi-agent-core` 状态机与钩子参考：`D:\LLM\self_programming\pi\packages\agent\README.md`

---

## 3. 下一步规划 (Upcoming Phases)

### 阶段 2：酒馆静态数据格式解析 (Data Parsers)
- **业务需求**：读取本地或通过接口上传的 V2 角色卡 PNG 文件、世界书配置以及**预设文件 (Presets)**，转化为强类型的内存实体。
- **目标**：
  - **角色卡与世界书解析**：`CharacterParser.ts` 负责提取 PNG 内的 `v2CharData` JSON，并构建世界书条目实体。
  - **预设系统解析 (至关重要)**：绝对不能自己凭空写组合逻辑！必须实现 `PresetParser.ts`，原样解析酒馆导出的 JSON 预设文件。
    - **逆向行动**：必须回到 SillyTavern 或 TauriTavern 源码，逆向其 `generate()` 函数及其上下文拼接流，严格提取 `Context Template` 和 `Instruct Mode` 格式。

### 阶段 3：基于 `pi` 框架的上下文拦截与宏引擎 (Context Interception & Macro Engine)
- **业务需求**：利用 `pi-agent-core` 的 `transformContext` 钩子，将阶段 2 解析到的酒馆设定“隐形”地注入到每次发送给大模型的 Message 流中。
- **目标**：
  - **世界书触发器 (Worldbook Activator)**：在 `transformContext` 中扫描最近的上下文文本，激活对应的世界书条目并按深度(Depth)组装。
  - **宏引擎 (MacroEvaluator)**：在预处理阶段拦截并替换 `{{user}}`, `{{char}}`, `{{getvar}}` 等宏。
  - **系统交互与状态更新 (JSON-Patch / Tools 双轨制)**：虽然 `pi` 框架原生提供了降维打击般的强类型 `AgentTool` 工具调用能力，但考虑到许多用户使用的**公益中转 API 会封杀 Tool Calling** 以防止 Coding Agent 滥用份额，我们的核心状态更新（如扣血、切换场景）必须兼容 **文本流内联 JSON-Patch 解析**（类似原生 MVU 的做法）。即优先使用 Tool Calling，若环境不支持，则回退为在 System Prompt 中教导模型输出特定格式的 JSON/正则文本块并在 `transformContext` 或输出后拦截。

### 阶段 4：沉浸式游戏架构演进 (Game Architecture Evolution)
- 将跑通的、支持工具调用与复杂宏的无头通信与数据解析管线，移植并入真正的方舟游戏前端（如与剧情播放器 `analyzerCore.ts` 深度结合），实现真正的“独立一体化同人游戏”。
