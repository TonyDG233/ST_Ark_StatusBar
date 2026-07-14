# SillyTavern 逆向与架构迁移笔记 (Reverse Engineering Notes)

> **创建目的**：此文档作为长期逆向探索的“活文档（Living Document）”。用于梳理 SillyTavern / TauriTavern 中庞大且混乱的核心上下文组装、宏替换、世界书触发等逻辑。
> **协作红线**：每次深入逆向后，必须更新此文档，清晰标注“哪些必须完整迁移”、“哪些可以取舍或用新框架能力替代”、“哪些可以直接忽略”。绝不允许在核心机制上偷懒跳过。

---

## 1. 核心生命周期中枢：上帝函数 `GenerateInternal`
在原版酒馆中，几乎所有生成生命周期被硬塞在一个极度臃肿的“上帝函数”中。

- **📍 位置**: `src/script.js` -> `GenerateInternal`
- **📊 骇人数据**: 约 1404 行代码，圈复杂度 170，直接调用了 115 个子函数。
- **⚙️ 内部串行逻辑（原版流转过程）**:
  1. **前置处理**: `processCommands()` (查斜杠命令) -> `substituteParams()` (初步宏替换)。
  2. **Token 预算**: `getMaxPromptTokens()` -> `parseTokenCounts()` (计算历史消息占用，决定截断深度)。
  3. **上下文拼接**: `getCombinedPrompt()` (拼接角色卡与前缀) -> `getWorldInfoPrompt()` (扫描并插入世界书)。
  4. **清洗与正则**: `runGenerationInterceptors()` (执行酒馆正则库 Regex Extension)。
  5. **API 分发**: 进入庞大的 `switch/case` 路由，例如 OpenAI 走 `prepareOpenAIMessages()`。

✅ **【Pi 框架迁移策略: 手术式提取】**
**坚决不复刻该上帝函数**。它的整个生命周期控制已经被 `pi-agent-core` 的原生 Agent Loop 取代。
我们的策略是**切片提取**：只从中挖出 **Token 算法**、**宏/正则引擎公式** 和 **角色卡拼接公式**，将其转化为纯函数，挂载到 `pi` 的 `transformContext` 拦截器中。

---

## 2. 提示词与预设引擎 (Prompt & Preset Assembly)
决定了酒馆如何把角色设定、世界书、聊天记录按照**深度 (Depth)** 拼接，以及如何应用 Instruct Mode（指令模式，如 `[INST]` 前后缀）。

- **📍 核心文件**: `src/scripts/openai.js`
  - 🎯 **`preparePromptsForChatCompletion()`**: **【绝密级，必须完整迁移】** 酒馆排兵布阵的总指挥。提取了 `worldInfoBefore/After`、`charDescription`、`scenario`、`authorsNote` 等，并根据 Context Template (上下文模板) 决定最终插入数组的顺序。
  - 🎯 **`populateChatCompletion()`**: **【必须完整提取逻辑】** 负责把 Message History 追加进 Prompt 数组，并在超载时执行 Truncation (历史截断)。
- **📍 核心文件**: `src/scripts/instruct-mode.js`
  - 🎯 **`formatInstructModeStoryString()`**: **【需完整迁移】** 负责给组装好的文本套上模型专属的 Prompt 模板（如 `<|system|>`）。

✅ **【Pi 框架迁移策略】**
在无头核心中，构建独立的 `PresetParser` 读取预设 JSON，然后利用 `pi` 的 `transformContext`，在请求发给模型前的一瞬间，执行这些重组逻辑，输出符合标准的 `AgentMessage[]`。

---

## 3. 世界书触发引擎 (Worldbook Trigger Engine)
决定酒馆如何扫描聊天记录的关键字，判定触发哪个条目，以及解决条目间的递归触发和互斥排斥。

- **📍 核心文件**: `src/scripts/world-info.js`
  - 🎯 **`getWorldInfoPrompt()`**: 对外的顶层接口。
  - 🎯 **`checkWorldInfo()`**: **【绝密级，必须完整理解并迁移】** 提取对话上下文，驱动扫描机制的核心。
  - 🎯 **`WorldInfoBuffer` (类)**: **【极高优先级】** 包含了原版最核心的算法：`matchKeys` (找关键字)、`addRecurse` (处理递归触发)、`filterByInclusionGroups` (处理互斥组与排除)。

✅ **【Pi 框架迁移策略】**
重写为一个纯数据驱动的 `Worldbook Activator` (世界书激活器)。输入为原始 `AgentMessage[]` 和 `Worldbook[]` 字典，输出为触发设定的文本块，最后在 `transformContext` 阶段按预设深度插入到大模型上下文中。

---

## 4. 宏引擎 (Macro Engine)
处理大名鼎鼎的 `{{char}}`, `{{user}}`, `{{getvar}}`，以及带逻辑的复杂宏。

- **📍 核心文件**: 
  - `src/script.js` 里的 **`substituteParams()`**: **【需提取】** 早期基于正则的简单无脑字符串替换。
  - `src/scripts/macros/engine/MacroEngine.js` 里的 **`MacroEngine.evaluate()`**: **【需深入评估】** 新版处理带逻辑控制流的宏 AST 引擎。

✅ **【Pi 框架迁移策略: 绝对向下兼容】**
必须 100% 完美向下兼容酒馆现有的资产，包括包含 `{{setvar}}`, `{{getvar}}`, `{{#if}}` 等极其复杂的宏的预设和角色卡。

- **📍 数据来源**: 真实的导出预设 JSON（如 `【小猫之神】3.10.json`）。
- **📊 核心发现**:
  - 真正的**上下文模板 (Context Template)** 是由 `entries` 字典定义的。每个 entry 拥有 `content`, `position`, `role`, 和 `depth`。`depth` 是排序的唯一标准。
  - **宏 (Macros)** 是直接写在 `content` 字符串里的花括号语法。
  - **外置正则插件** 是预设中的 `regex_scripts` 数组，负责文本清洗。

在 `pi` 框架的 `transformContext` 拦截器中，构建向下兼容的流水线：
1. **Worldbook Scanner**：纯文本比对，选出被激活的世界书条目。
2. **Macro & Regex Engine**：完整移植 `substituteParams`，对角色设定和系统提示词进行宏和正则替换。大模型接收到的将是被宏引擎“洗”过的纯净文本。
3. **Prompt Assembler**：严格读取预设中的 `entries`，将其映射为 `AgentMessage[]`，并**严格按照 `depth` 重新排序 (sort)**。
4. **Tool Calling 融合**：对于改变环境状态的宏（如 `{{setvar}}`），在拦截阶段进行解析并注入 System Prompt。同时引入原生 `AgentTool`，实现新旧机制的完美共存。

## 6. 从酒馆助手 API 反推的底层基建缺失 (Infrastructure Gaps)
通过侧面观察酒馆助手 (@types/function) 暴露的便捷 API，我们明确了：由于 Headless Core 必须**完全脱离酒馆独立运行**，酒馆助手封装的黑盒功能全部转化为我们必须从零重建的底层基建。

为了跑通 导入数据 -> (pi接管上下文) -> 发送消息 -> 更新状态 -> 循环 的基础业务闭环，必须在 src/sandbox_headless_core 中重构以下三大模块：

1. **彻底独立的数据解析层 (Data Ingestion)**
   - *观察*: 原版依赖 importRawCharacter 等 API 隐藏了文件解码过程。
   - *重构目标*: 必须手写底层解析器（对应阶段2），直接读取磁盘上的 PNG (	EXt 数据块) 和 JSON 预设文件，并使用 Zod 进行强类型反序列化，转化为标准的 TypeScript 内存实体。
2. **会话状态与持久化层的重建 (State & Persistence)**
   - *观察*: 原版依赖 getChatMessages 和 getVariables 维护对话历史和状态。
   - *重构目标*: 必须实现一个独立于浏览器的内存级“运行时上下文管理器 (Runtime Context Manager)”，自己维护 AgentMessage[] 的对话树流转，并管理 {{getvar}} 及 Tool Calling 所需的全局/角色变量字典。
3. **主生成管线的全盘接管 (Core Generation Pipeline)**
   - *观察*: 原版助手用一个黑盒 generate() 包揽了一切，这会绕过 pi 框架，导致我们无法使用现代原生的 Tool Calling。
   - *重构目标*: 坚决弃用原版 generate。将上文提到的“预设深度排序”、“世界书扫描”和“宏清洗”彻底解耦为纯算法函数，全部塞进 pi 的 	ransformContext 钩子中，让 pi-agent-core 完全接管大模型通信。


## 7. 预设反序列化与核心组装管线 (Preset Ingestion & Assembly Pipeline)
通过交叉比对不同流派预设 (如小猫之神、Izumi) 与原生 API Payload 的抓包数据，我们推翻了早期的主观猜测，得出了预设解析与组装的终极客观法则：

1. **数据契约的真实面貌 (Flattened Schema)**：
   真实导出的 JSON 预设中，生成参数 (temperature 等开关配置) 是在首层扁平化的，并没有嵌套在 `settings` 内。此外，特殊的占位符提示词可能根本没有 `depth` 和 `order`。解析器必须能无损容错吞吐这 50+ 个复杂属性。
2. **组装蓝图：prompt_order**：
   提示词块并非单纯依靠 `depth` 乱飞，预设的基底是一个绝对线性的数组 `prompt_order`。
   - `injection_position: 0` (相对)：严格遵从此线性顺序拼装。
   - `injection_position: 1` (in_chat/绝对)：脱离主干，沉入 `chatHistory` 内部，此时 `depth` 和 `order` 才开始起作用并重新排队。
3. **降级与合并 (Strict Mode & Squash) —— 解决 API 洁癖的核心魔法**：
   为兼容不支持在历史对话中间穿插 `system` 消息的模型 (如 Gemini/Claude)，原版引擎 (Rust 后端 `prompt_post_processing.rs`) 会在发包前执行“严格模式”洗牌：
   - **降级**：把除首条消息外的所有 `system` 消息强制改写为 `user` 角色。
   - **合并 (Squash)**：全盘扫描数组，将连续出现的同角色消息（如被降级的规则文本与玩家的真实输入）使用 `\n\n` 暴力粘合在一起。
   - *这完美解释了原版为何能将上千字的约束规则无缝缝合在最后一条 User 消息中。*
4. **引擎中立性法则 (Dumb Pipe)**：
   引擎从不凭空发明 `<system_context>`、`<interaction_record>` 或 pseudo-roles (如 `=<role>user`) 这样的 XML 格式标签。它们全部是作者手动写死在提示词 `content` 里的纯文本。引擎只需做好“毫无感情的搬运与合并 Squash”工作，禁止强加预设。

---
*上次更新时间：2026-07-14 17:05*
*当前逆向进度：已彻底打通了 数据读取 -> 线性骨架映射 -> 深度插队 -> 压榨合并 的预设大盘管线。接下来需攻克基于正则表达式和占位符的 Macro (宏) 解析引擎。*