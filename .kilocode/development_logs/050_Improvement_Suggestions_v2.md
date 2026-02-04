# 开发日志 050 (修订版): 改进意见说明书 v2

**日期**: 2026-01-29
**状态**: 撰写中
**核心思想**: **放弃对抗，学会“冲浪”**。我们不再试图与环境的不确定性对抗，而是采用一种新的架构，在这种不确定性之上“冲浪”，利用它，并将其隔离在安全区之外。

---

## 1. 战略转向：从“事件驱动”到“状态驱动轮询”

**根本问题**: 我们不能再信任任何外部触发的事件，尤其是 `VARIABLE_UPDATE_ENDED`。

**新战略**: **将系统的心跳从外部事件切换为内部定时器**。我们将实现一个可控的、周期性的**轮询（Polling）循环**，它将成为系统唯一的“主时钟”。

```typescript
// a new file: src/ARK_STATUSBAR/logic/mainLoop.ts (伪代码)

const LOOP_INTERVAL = 1000; // 每秒检查一次
let lastProcessedState = {}; // 存储上次处理过的状态

async function mainLoop() {
  // 1. 获取当前最新状态
  const currentState = Mvu.getMvuData(...);

  // 2. 状态比较 (核心)
  // 通过深度比较，确定自上次循环以来状态是否真的发生了变化
  if (!isEqual(currentState.stat_data, lastProcessedState)) {
    console.log("State change detected. Processing updates...");
    
    // 3. 执行所有业务逻辑 (这是一个同步的、确定性的过程)
    const nextState = await runAllUpdaters(currentState, lastProcessedState);
    
    // 4. 将最终计算出的新状态一次性写回
    await Mvu.replaceMvuData(nextState, ...);
    
    // 5. 更新本地缓存，为下一次循环做准备
    lastProcessedState = cloneDeep(nextState.stat_data);
  }
}

export function startSystem() {
  // 从一个干净的状态开始
  lastProcessedState = Mvu.getMvuData(...).stat_data;
  setInterval(mainLoop, LOOP_INTERVAL);
  console.log("System started with Polling main loop.");
}
```

**收益**:
1.  **确定性**: 我们的逻辑只在我们想让它运行时运行，彻底摆脱“事件风暴”。
2.  **效率**: 通过 `isEqual` 检查，我们在99%的时间里什么都不做，只有在真正需要时才进行计算，性能开销极低。
3.  **健壮性**: 无论外部环境如何“疯狂”地触发更新，我们的主循环都能“以不变应万变”，只在数据真正落地并稳定后才进行处理。

---

## 2. 战术调整：适配“状态驱动”的新模式

### **建议 2.1: 重构 `global.ts` - 从“事件监听器”到“状态处理器”**

-   **旧模式**: `global.ts` 监听外部事件，被动触发。
-   **新模式**: `global.ts` (或者一个新的 `updaters/index.ts`) 将导出一个单一的、纯粹的函数 `runAllUpdaters(newState, oldState)`。这个函数内部不再有任何事件监听。
    ```typescript
    // updaters/index.ts (伪代码)
    export async function runAllUpdaters(currentState, oldState) {
        // 创建一个可变副本，所有模块都将在这个副本上操作
        let mutableState = cloneDeep(currentState);

        // 按确定性顺序执行所有模块的逻辑
        mutableState = await processCharacterUpdates(mutableState, oldState);
        mutableState = await processPlayerUpdates(mutableState, oldState);
        mutableState = await processChronicleUpdates(mutableState, oldState);
        mutableState = await processGlobalInternalUpdates(mutableState, oldState); // 处理内部计数等

        return mutableState;
    }
    ```
-   **收益**: 业务逻辑与事件监听彻底解耦，所有模块的执行顺序变得明确、可控。

### **建议 2.2: 净化 EJS - 让 LLM 成为纯粹的“函数”**

-   **旧模式**: EJS 承担业务逻辑，决定“做什么”。
-   **新模式**: TS 代码将决定“做什么”，EJS 和 LLM 只负责“怎么做”。
    -   **任务生成 (TS)**: 后端 `character.ts` 在 `runAllUpdaters` 内部检测到 `player` 档案为空，它不再只是往 `task_queue` 推一个任务就完事，而是**直接在 EJS 的上下文中注入一个明确的指令**。
    -   **指令执行 (EJS/LLM)**: `任务执行器.ejs` 不再需要复杂的 `if/else` 来读取任务队列。它只会检查 TS 代码是否给它注入了“当前任务”，如果有，就渲染对应的指令模板。LLM 的角色被简化为一个“接受指令、返回数据”的纯函数。
-   **收益**: 系统的“大脑”回归到 TS 代码中，LLM 的行为变得更可预测、更易于控制。

### **建议 2.3: 重构 `init` 逻辑 - 单一入口，幂等启动**

-   **旧模式**: 复杂的、依赖外部事件的 `initializeBackendLogic`。
-   **新模式**: `index.ts` 将只做一件事：调用 `startSystem()`。所有初始化逻辑，包括检查是否为新聊天、是否需要创建初始任务等，都应被整合到 `startSystem` 或其调用的初始化模块中。这个启动过程必须是**幂等**的（即多次调用也只会生效一次），彻底杜绝重复初始化。

---

## 3. 新的SOP：拥抱现实，建立“防御性开发”流程

### **建议 3.1: 将“环境勘探 (PoC)”作为 SOP 的第一步**

-   在进行任何新功能的设计前，强制要求创建一个 `poc_*.ts` 文件，用最少的代码去验证与该功能相关的宿主环境行为。例如，在决定使用某个新的 `tavern_events` 之前，必须先写一个 PoC 来记录它在不同场景（启动、刷新、`swipe`）下的真实触发规律。
-   **产出**: PoC 的代码和一份记录其行为的 markdown 文档。

### **建议 3.2: 建立“架构防火墙”设计评审**

-   在正式的功能设计文档中，必须包含一个“**风险与隔离**”章节。
-   该章节需要明确识别出功能所依赖的**所有外部不稳定因素**（如：LLM的输出格式、特定的API调用时序、用户操作等），并详细阐述用于**隔离这些不确定性**的“防火墙”设计（如：对LLM的输出进行Zod校验和修复、使用轮询替代事件监听、对用户输入进行防抖处理等）。

### **建议 3.3: 引入“日志驱动开发”**

-   **理念**: 在这个难以 Debug 的环境中，日志是我们唯一的眼睛。
-   **行动**:
    1.  规范化日志格式：`[模块名] [函数名] - 消息内容`。
    2.  在所有关键逻辑的入口、出口、重要分支点，都必须添加详细的日志。
    3.  在开发一个功能时，首先要思考“我需要哪些日志才能判断它是否在正确工作”，而不是事后添加。

---

## 4. 总结与路线图

我知道这份建议意味着大量的重构，甚至推翻了我们之前许多共同努力的成果。但请相信，这是基于对问题根源的更深刻理解后，提出的唯一能将项目带出泥潭的战略。这不再是打补丁，而是为大厦更换一个坚实的地基。

**建议路线图**:

1.  **[暂停]** 暂停所有现有功能的修复和开发。
2.  **[重构核心]** **(最高优先级)**
    a. 创建 `mainLoop.ts`，实现基于 `setInterval` 和 `isEqual` 的状态驱动主循环。
    b. 创建 `updaters/index.ts`，将所有 `updater` 文件的逻辑重构为可被 `mainLoop` 调用的纯函数。
    c. 重构 `index.ts`，实现单一、幂等的 `startSystem()` 入口。
3.  **[功能迁移]**
    a. 逐一将旧的业务逻辑（如初始化任务生成、内存总结任务生成）迁移到新的 `updater` 函数中。
    b. 净化所有 EJS 模板，移除所有业务逻辑判断。
4.  **[建立SOP]** 我们共同更新 `AGENTS_README.md`，将新的SOP固化下来。
5.  **[恢复开发]** 在这个全新的、稳固的架构上，重新开始新功能的开发。

这一次，我们的每一步都将踩在坚实的地面上。请您审阅这份战略调整方案。