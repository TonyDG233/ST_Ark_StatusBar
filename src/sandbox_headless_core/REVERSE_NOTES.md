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

## 8. V2/V3 角色卡 (Character Card) 解析的底层暗坑与结构发现
在编写脱离浏览器 API 的底层 PNG 解析器 (`CharacterParser.ts`) 时，我们使用 `Ark.png` (长达 18000 字的首次对话、56条滑动分支、内嵌 840 条目的世界书) 进行了压力测试。发现了以下与原生接口声明严重不符的数据结构真相：

1. **V3 规范外层包装壳 (The Wrapper Trap)**：
   原生酒馆保存的现代角色卡数据（藏于 PNG 的 `chara` 或 `ccv3` 的 Base64 编码块中），并不是直接暴露 `v2CharData` 的扁平结构，而是将其隐藏在一个**包装壳 (Wrapper)** 中：
   ```json
   {
     "spec": "chara_card_v2", // 或者是 "chara_card_v3"
     "data": { /* 真正的 v2CharData 结构在这里！ */ }
   }
   ```
   **大坑**：包装壳的首层包含了向后兼容的假字段（如简陋的 `name` 和 `description`），如果没有做判断直接解析最外层，就会导致丰富的 V2 扩展数据（特别是 `alternate_greetings` 分支和内嵌的世界书 `character_book`）彻底丢失。
2. **世界书序列化的 Record 转 Array 现象**：
   在 `@types/iframe/exported.sillytavern.d.ts` 中，世界书的 `entries` 被定义为 `Record<string, Entry>` (键值对字典)。但在实际导出落盘到 JSON/PNG 内部时，原版引擎会将其序列化为一个**数组 (`Array<Entry>`)**。这就要求底层解析器的 Zod 契约必须向后兼容这种落盘格式的变化，不能生搬硬套内存接口。
3. **松散的扩展字段类型容错**：
   实战数据证明，像 `talkativeness` 这样的数值字段，以及很多世界书扫描的配置开关 (如 `scan_depth`、`match_whole_words`)，在实际导出时经常会变成字符串 (如 `"0.5"`) 甚至是 `null`。数据防腐层必须使用 `.nullable().optional()` 和 `.union([z.number(), z.string()])` 来提供极高的容错性。

## 9. 世界书激活器 (Worldbook Scanner) 的终极工作流解密
通过对原版 `checkWorldInfo` 及 `WorldInfoBuffer` 类的逐行反编译，我们拆解出了世界书扫描系统的所有微观控制开关与过滤防线。这是一个精巧的过滤管道，绝不能在重构中被阉割或简化。

原版核心代码(`world-info.js`)中的 `checkWorldInfo` 长达 570 行，`WorldInfoTimedEffects` 长达 316 行，`WorldInfoBuffer` 长达 277 行。合计超过 1100 行的高密度业务逻辑必须被分解为以下独立的执行阶段：

### 阶段 0：作用域搜集与策略排序 (Scope & Strategy)
在进入扫描之前，系统必须先拉取 4 个维度的世界书，并将它们按特定策略融合成一个扁平的待扫描数组：
1. **Chat Lore (聊天书)**：与当前聊天绑定的世界书（绝对优先）。
2. **Persona Lore (人设书)**：与当前玩家 Persona 绑定的世界书。
3. **Character Lore (角色书)**：读取角色卡 `extensions.world` 以及关联的 `extraBooks` 附加书。
4. **Global Lore (全局书)**：被用户在界面中勾选开启的全局世界书（对应 `selected_world_info` 数组）。
*   **组装策略 (`world_info_character_strategy`)**：支持 3 种模式（混合排序 `evenly`，角色优先 `character_first`，全局优先 `global_first`）。聊天书与人设书始终强制排在最前面。

### 阶段 1：预处理与上下文注入 (Pre-processing)
*   **Include Names (开关)**：如果启用了“包含角色名称”，原版扫描器并不是单独把名字提出来匹配，而是在构建扫描的大海 (Haystack / `depthBuffer`) 时，把每一条文本强行变为 `${x.name}: ${x.mes}`。这样角色名称本身就会成为合法触发点。

### 阶段 2：粗筛与绝对过滤 (Pre-filtering)
在这个阶段，如果不满足条件，条目直接抛弃：
1.  **触发类型 (Triggers)**：只在匹配的生成类型 (如 normal, continue) 触发。
2.  **绑定隔离 (Character/Tag Filters)**：条目会判定当前的对话角色名字或标签是否在包含/排除名单中。如果被排除，直接判定死亡。
3.  **递归深度阀门 (Recursion Delay & Exclude)**：包含 `preventRecursion` (阻止自身的内容被再次扫描), `excludeRecursion` (在递归循环中直接装死), 以及 `delayUntilRecursion` (硬性要求必须在第 N 层扫描时才允许出场)。
4.  **冷却与延迟限制 (Cooldown & Delay)**：计算当前聊天消息数 `chat.length`，若在冷却期内或延迟层数不够，禁止触发。

### 阶段 3：强制激活与豁免 (Force Activation)
1.  **黏性 (Sticky)**：如果一个条目因为触发或常驻，被标记为了 Sticky，那么它在接下来的指定回合内会**无视一切触发词、优先级甚至是概率骰子 (Probability)**，永远被强制激活。
2.  **常驻 (Constant) 与 外部修饰符 (`@@activate`)**：强制激活且不需要过匹配阶段。

### 阶段 4：宏展开与关键字匹配 (Macro & Matching)
**核心大坑：** 匹配之前，系统必须先用宏引擎 (Macro Engine) 去清洗触发词 (`substituteParams(key)`)。这意味着带有 `{{char}}` 等动态触发词的条目会在此时被展开真实名字。
*   **匹配算法**：支持纯正则、大小写转换。当使用精确匹配 (`matchWholeWords`) 时，如果是单词会用边界正则 `(?:^|\W)关键词(?:$|\W)`；如果是**多个词（带空格），则直接退化为简单的 `includes` 子串匹配**。
*   **四象限逻辑 (`selectiveLogic`)**：对于次要关键字，分为 AND_ANY (任意命中), NOT_ALL (并非全命中), NOT_ANY (全不命中), AND_ALL (全命中) 四种匹配条件。

### 阶段 5：权重死斗与概率检定 (Inclusion Groups & Probability)
所有在第 4 阶段匹配存活下来的条目，将在落盘前进行最后两道“大清洗”：
1.  **同组死斗 (Inclusion Groups)**：相同 `group` 名称的条目会被集中。如果有霸权标记 (`groupOverride`) 则直接吃鸡。否则所有条目将根据 `groupWeight` 放入奖池，进行 `Math.random() * totalWeight` 随机抽奖，**同组只会活下来一个**。
2.  **命运之骰 (Probability)**：对每一个存活下来的条目（除非是 Sticky 状态），执行一次 `Math.random() * 100 <= entry.probability` 的判定。只有丢出大成功的条目，才能被塞进最后的输出列表。

### 阶段 6：排序与发车 (Sorting & Positioning)
存活的最终赢家，进行最终的 `Macro` 替换生成 `content`，然后：
*   **同层排序**：所有条目根据 `b.order - a.order` 降序重排。
*   **阵地分发**：根据 `position` 使用 `unshift` 推入各自深度的栈内（如 Before、After、ANTop、AtDepth、EMEntries 等），最终交由 `PresetAssembler` 执行深度的拼接！

### 阶段 7：落盘结算 (Finalization)
*   **Token 预决算**：UI 层与核心层依赖于 `getTokenCountAsync` 调用所选 API 的计算器（如果配置为 `openai`，会回退到内置的 tiktoken 近似算法），从而扣除世界书的 `world_info_budget` 预算。
*   **UID 生成**：如果在运行期间需要创建或注入新条目，原版通过一个硬编码的扫描函数 (`getFreeWorldEntryUid`) 遍历 0 到 1,000,000，寻找第一个未被占用的数字分配为 UID。

---
*上次更新时间：2026-07-15 17:35*
*当前逆向进度：已彻底打通了 数据读取 -> 线性骨架映射 -> 深度插队 -> 压榨合并 的预设大盘管线。同时完成了 10MB 级复杂方舟角色卡（含巨型内嵌世界书与海量分支）的底层脱壳解析。TauriTavern 的世界书扫描器黑盒已被拆解为 6 大阶段。接下来需攻克基于正则表达式和占位符的 Macro (宏) 解析引擎，为世界书的管线提供清洗服务。*