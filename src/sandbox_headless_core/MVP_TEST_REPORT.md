# 明日方舟状态栏 RPG 引擎 - 无头酒馆核心 (Headless Tavern Core) MVP 联调测试报告

## 一、 测试背景与核心目标

在完成底层无头宏引擎、世界书、预设装配器等模块的逆向与数据清洗防线（ACL）之后，本项目进入了沙盒实况大盘联调阶段。
本轮测试的核心目标是：**在全模拟的无头沙盒环境（Sandbox）下，物理跑通从用户输入、世界书激活、预设拼装、物理大模型流式请求（含思维链），到返回消息渲染的完整闭环。**

最终，MVP 联调取得圆满成功！**消息发送成功、消息流式接收正常、世界书激活列表真实无误**，各子系统在没有依赖浏览器 DOM 的情况下，纯净、完美地完成了联调。

---

## 二、 核心验证细节与技术成果

### 1. 角色卡解析与预设装配
*   **二进制 PNG 脱壳器 (`CharacterParser.ts`)**：成功利用纯 TypeScript 实现了可在浏览器无缝运行的 `CharacterParser`。完美解析 PNG 字节流中的 `chara` 块，获取包裹在 V2 外层协议（`{ spec: "chara_card_v2", data: { ... } }`）内的真实角色数据。
*   **预设拼装流水线 (`PresetAssembler.ts` / `ContextBuilder.ts`)**：
    *   以 `prompt_order` 为主循环，精准将 `system_prompt == true` 的提示词合并入 `Context.systemPrompt`。
    *   将历史消息映射入 `Context.messages`，同时完美保留原生 `<think>` 思维链。
    *   实现了在消息末尾根据 `prompt_order` 排序追加不固定标签块的线性拼装，解决了提示词缺失导致的黑盒偏差问题。

### 2. 世界书动态激活与 Token 独立计算
*   **真实的世界书扫描与激活机制**：
    *   在消息发送阶段，扫描全盘历史记录（及当前输入），根据关键词自动匹配并激活世界书（Worldbook）。
    *   在沙盒前端 `SandboxTerminal.vue` 中，**激活列表展示完全真实且带有权重与触发词高亮**，验证了世界书的双轨机制（常开蓝灯 vs 触发绿灯）。
*   **Token 独立计算与容错 (`calculateContextTokens`)**：
    *   重构了上下文 Token 计算逻辑，将 Token 统计工具函数与触发内容解耦。
    *   修复了历史 Assistant 消息缺失 `usage` 或存在空指针时的崩溃逻辑，保证大盘计算的极高鲁棒性。

### 3. 物理流式发包与代理对接 (`AgentEngine.ts`)
*   **流式代理跑通**：
    *   成功对接真实大模型（如 Gemini / OpenAI）的物理流式发包。
    *   在沙盒页面流式输出文本，响应时间与流式阻尼感极佳，流式接收成功。
*   **物理密钥安全解耦**：
    *   彻底移除了任何前端硬编码的敏感 API Key 与 Endpoint。
    *   所有配置统一从安全的 `src/sandbox_headless_core/config.yaml` 动态脱水注入，在开发与测试中实现了完美的物理安全防线。

---

## 三、 历史避坑指南与关键修复复盘（开发防线）

在本次联调中，我们攻克了以下数个由底层契约不一致导致的致命崩溃：

### 1. 挂载全局 `window.z` 桥接 Zod
*   **问题现象**：控制台报错 `Uncaught ReferenceError: z is not defined`。
*   **根本原因**：外部依赖在沙盒中通过 UMD CDN 引入后，默认挂载在 `window.Zod` 上，而部分核心模块在打包时或原生运行时默认期望访问全局简写 `z`。
*   **解决对策**：在沙盒模板 `index.html` 的 UMD 注入点后，插入 `window.z = window.Zod` 的黄金桥接，完美解决依赖断裂问题。

### 2. 补齐 `pi-ai` 所需的 Assistant 消息块契约
*   **问题现象**：在通过 `pi-ai` 格式化助手（assistant）消息发包时，抛出 `Cannot read properties of undefined (reading 'length')` 致命崩溃，发包中断。
*   **根本原因**：`pi-ai` 内部的 `openai-completions.js` 转换器中，针对 `assistant` 角色，强行对 `msg.content` 进行了 `.filter(isTextContentBlock)` 的数组过滤操作。我们最初将 `msg.content` 格式化为了纯文本 string，导致其无法调用数组方法。
*   **解决对策**：在 `AgentEngine.ts` 发送前，判断当 role 为 `assistant` 时，强制将其 `content` 封装为 Block 数组格式：`[{ type: "text", text: content }]`，同时注入补齐的 `usage: { totalTokens: 0 }` 占位块，完美顺畅过检。

### 3. 开局多版本滑动锁定
*   **问题现象**：大模型由于首条开局随机度高，难以在测试时形成完全一致的输出控制。
*   **解决对策**：在沙盒界面最上方集成了快速滑动切换器（`◀` / `▶`），支持在大模型真实的多版本开局（First Message）中进行滑动，默认锁定到第 2 条，提升了测试的确定性。

---

## 四、 下阶段演进方向与规划

1.  **世界书与宏引擎深度集成**：进一步验证 `{{setvar}}` 等宏替换在世界书触发后流转至上下文时的准确度，并在无头环境下做剥离 DOM 依赖的纯净化测试。
2.  **流式楼层界面迁移**：利用 `mountStreamingMessage` 将此沙盒无头核心正式对接回 SillyTavern 的消息展示楼层，实现极致流畅的《明日方舟》状态栏 RPG 体验。
3.  **多分支断点保存 (Save/Load) 机制**：结合聊天级变量机制，提供沙盒大盘的对话多分支快照与一键回滚。

---

> **致谢**：本轮 MVP 的完美跑通，彻底证明了在无 DOM 依赖下纯净化逆向 SillyTavern 数据总线与 `pi` 框架发包管道的可行性，为项目的正式收尾与产品化落地奠定了极度坚实的代码防线！
