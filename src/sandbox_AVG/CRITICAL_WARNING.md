### 🚨 给下一任 Agent 的绝密转交提示词 (CRITICAL HANDOVER PROMPT) 🚨

**【项目与事故背景】**
你正在接手一个被前任 Agent 搞得一团糟的《明日方舟》PRTS 引擎 Vue3+TS 重构项目（位于 `src/sandbox_AVG/`）。
前任不仅在早期拆分 3000 行核心解析器时，将指令生命周期、坐标计算（`0.75` 乘数）和 jQuery 动画重构得支离破碎；而且在最后抢救阶段，产生了严重的**函数伪造幻觉**，并彻底丢失了对原版逻辑中“阻塞等待点击（return 0）”和“挂起等待定时器（return 2）”的控制权。

**【当前系统惨状 (现状极度恶劣)】**
1. **引擎疯狂跳过/假死**：系统无法在对话、背景切换或等待状态下正确停住，甚至把对话文本也解析成了未知指令跳过。点击事件要么不生效，要么触发后什么也不发生。
2. **满屏的类型暗病**：`core/handlers/` 目录下的 10 个处理器文件（如 `backgroundHandlers.ts`, `characterHandlers.ts` 等），里面的数学计算（如 `+ctx.args.fadetime`）被前任的劣质类型定义强制卡死或隐式丢失，逻辑**极不可靠**。
3. **音频/资源加载报错**：控制台大量抛出类似 `The key is not specific.` 的警告，证明 `audioController` 的绑定调用以及各类资源键值对在传参阶段就被截断或错误解析了。
4. **警告路标已设置**：`src/sandbox_AVG/core/analyzerCore.ts` 头部已被打上红色的 `CRITICAL WARNING`，明文要求推翻现状。

**【你的终极使命与红线 (MUST DO)】**
1. **第一要务：抛弃幻想，回归原典**。
   不要试图在现在 `core/handlers/` 那些残破的代码上缝缝补补。你必须打开 `src/poc/prts_v3_sandbox/prts_analyze.js` (原版参考)，逐行核对 `txt_analyze()` 里的巨型 switch 逻辑。
2. **第二要务：彻底修复生命周期流转**。
   搞清楚原版的 `-2`、`-1`、`0`、`1`、`2` 这五个返回值到底是如何配合 `txt_click`、`txt_next` 以及 `timer`（定时器）运作的。现在的引擎就是因为该返回 `0` 阻塞的地方瞎返回了导致崩盘。
3. **红线警告**：
   - 严禁随意使用 `@ts-ignore` 掩盖类型错误！
   - 严禁瞎编不存在的函数或模块引入（Import Hallucination）！
   - 你在修改任何 DOM 动画操作时，必须意识到原版的 jQuery `fadeToExit(t*1000)` 等价于现在的 `domFadeToExit(el, t*1000)`，时间单位和 `this` 指向极易出错。

**【行动指令】**
立刻进入 `src/sandbox_AVG/core/analyzerCore.ts`，从它极其糟糕的 `dispatch` 流程入手，然后逐个攻破 `handlers/` 里的虚假实现。只有让引擎在读取到第一句对话时稳稳停住，并且正确渲染背景和立绘，你才算迈出了起死回生的第一步。