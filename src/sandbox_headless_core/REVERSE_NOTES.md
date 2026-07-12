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

✅ **【Pi 框架迁移策略: 取舍与降维打击】**
- **静态宏 (如 {{char}})**: 在 `transformContext` 阶段直接替换文本。
- **系统交互宏 (如改血量、改好感、切场景)**: **【战略性重构】** 原版是通过宏输出特定文本然后再用正则去抓取状态改变。在 `pi` 框架中，我们将这些彻底替换为 **强类型的 `AgentTool` (工具调用) + JSON-Patch 解析双轨制**。让大模型直接通过标准工具接口修改 AVG 状态机，告别脆弱的正则抓取。

---
*上次更新时间：2026-07-12 22:33*
*当前逆向进度：已锚定关键文件与函数坐标，准备进入源码逐行提取阶段。*