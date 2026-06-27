# 沉浸式 AI 同人沙盒客户端 (代号: Project Infinite) - Phase 2 企划书

## 1. 核心定位 (Executive Summary)
- **软件形态**: 独立的本地化客户端应用（基于 Unity 或 Godot），完全摆脱浏览器与网页版 SillyTavern（酒馆）的束缚。
- **核心体验**: **“无限自由度的沉浸式 AI 视觉交互”**。这不是一个带有严格规则限制的传统“跑团”游戏，而是一个动态响应玩家任何行为的“全息同人模拟器”。
- **开发目标**: 将 Phase 1 在 Web 端踩坑积累的“状态机”、“语义宏转译”与逆向解耦的“无头酒馆 Prompt 引擎”整合到原生游戏引擎中，解锁被 WebGL 封印的原生级视听表现力（Spine、粒子特效、高级 Shader）。

## 2. 设计哲学：反“传统跑团”架构 (Design Philosophy)
传统跑团（TRPG）倾向于用规则、骰子和硬性选项来**框限**玩家的交互，而本项目致力于打造**绝对的沉浸感与自由度**：
1. **数值是沉浸的具象，而非行为的枷锁**：
   - 传统游戏：体力为 0，弹出“无法探索”的系统提示。
   - 本项目：理智/体力降至极低时，MVU 状态机会向大模型注入 `[Status: Exhausted/Hallucinating]` 的隐性 Prompt。玩家仍然可以自由输入任何指令，但 AI 会自然生成充满幻觉、脚步踉跄的凄惨剧情，配合原生的 `CameraShake` 和压抑的 `bgeffect` 粒子遮罩，让玩家**切身感受到**极限状态，而不是被 UI 挡住。
2. **拒绝“选项式”交互**：
   - 交互界面回归最纯粹的自然语言输入框。大模型结合庞大的明日方舟 Worldbook（世界书），动态推演环境细节与 NPC 反应，实现真正意义上的“凡所想，皆可为”。

## 3. 核心体验管线 (Core Experience Pipeline)
1. **输入与情绪捕获**：玩家输入文字或动作。
2. **无头引擎装配 (Headless Context Assembly)**：
   - C# 编写的本地引擎瞬间提取当前的 MVU 状态（人物羁绊、场景坐标、隐藏危机值）。
   - 扫描正则与 Worldbook，将背景设定与历史记忆精准组装为 Token 优化的系统级 Prompt。
3. **语义宏生成 (Semantic Macro Generation)**：
   - LLM 输出高质量的同人剧情文本，并在后台附带极其简练的语义宏（如 `{"SetScene": "Rhodes_Island_Bridge", "VFX": "Warning_Red", "Emotion": "Shock"}`）。
4. **原生视听降维打击 (Native Rendering)**：
   - 客户端捕获宏指令，直接调用 Unity/Godot 的原生系统。瞬间加载原版 `.ab` 粒子特效（彻底解决 Web 端无法渲染 `eb_oripathy` 的痛点）、触发屏幕震动、无缝切换高音质无损 BGM，完成好莱坞级别的 AVG 演出。

## 4. 技术架构重塑 (Architecture Restructuring)
- **解耦与逆向 (SillyTavern 脱壳)**：
   - 不再依赖庞大的 Node.js 体系。用 C# 原生重写一套兼容 V2 角色卡（解析 PNG EXIF）、JSON 世界书的轻量级解析器。
   - 将这套解析器打包成 DLL 或核心系统模块，成为未来一切 AI 游戏通用的“大脑”。
- **表现层升维**：
   - 彻底废弃受限的 HTML/CSS DOM 渲染。重写 `analyzerCore.ts` 为 C# 原生脚本。
   - 原版 PRTS 的指令流将在这里获得新生，能够完美控制材质、光影混合模式（Blend Modes）和 Z-Index 层级。

## 5. 长期价值转换 (Value to Phase 3)
这一阶段看似是在“做一个极其精美的明日方舟同人播放器”，但它的本质是**为未来的商业化独立游戏（Project Landship）锻造引擎**。
当这个“能完美管理海量文本设定、能让 AI 动态修改游戏数值、能根据状态自动调配视听特效”的 C# 客户端彻底跑通时，我们只需剥离方舟的美术皮套，换上自己独立游戏的 3D 资产与生存系统，一款划时代的商业化 AI 游戏底层框架便已然就绪。