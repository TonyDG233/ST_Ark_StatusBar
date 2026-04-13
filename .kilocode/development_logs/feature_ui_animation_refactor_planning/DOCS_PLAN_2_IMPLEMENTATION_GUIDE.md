# 重构排查与落地指南：回归显性管线与模块内聚

**日期：** 2026-04-13
**背景：** 之前的规划中，Agent 试图建立一个虚幻的“统一事件注册网关”或者“强行禁止前端监听宿主事件”，这导致了过度设计与架构漂移。根据与开发者的深度对齐，我们认识到：
1. **模块应当高内聚**：UI 模块就该有自己监听 UI 变动的 Listener；后端模块就该有自己监听业务数据的 Listener。**各司其职，不跨界，不代发号施令。**
2. **需要一个人类可读的架构说明与显式管线**：让开发者能一眼看懂这个插件到底是怎么启动的，Bug 到底出在哪里，以及想加延时或手动重载时应该改哪里。

---

## 1. 架构透视：谁该做什么？(What each module actually does)

在动手修改前，必须先理清当前的“史山”中，谁越了权，谁该接手：

*   **`src/ARK_STATUSBAR/index.ts` (理应是：主板/引导器)**
    *   **现状：** 乱七八糟。用 `setInterval` 死循环去找 DOM 挂载 UI；主动去调用 `StatusBarManager.init()`；还在里面注入酒馆原生按钮。
    *   **目标：** 必须将其改造成一个线性、串行的 `async bootstrap()` 函数。先等环境就绪，再调配置，再调业务后端，最后挂 UI。
*   **`src/ARK_STATUSBAR/logic/statusbar_manager.ts` (理应是：业务大盘的入口与门面)**
    *   **现状：** 它的 `setupEvents` 是导致“首发不拦”竞态的核心病灶。它在监听到 `CHAT_CHANGED` 时，没等真正的业务处理完毕，就急匆匆地 `dispatchEvent('ark:worldbook-data-changed')` 催促 UI 刷新。
    *   **目标：** 剥夺它在 `setupEvents` 中监听环境事件的权利，甚至直接删掉这个方法。它只应作为一个被 `index.ts` 或前端组件调用的**静态工具合集**。
*   **`src/ARK_STATUSBAR/logic/worldbook/worldbook_automator.ts` (理应是：世界书业务的大管家)**
    *   **现状：** 已经有了自己的 Listener 监听 `CHAT_CHANGED` 和 `GENERATION_ENDED` 并处理业务逻辑，但它干完活后经常“一声不吭”，或者通知被 `manager` 抢了风头。
    *   **目标：** 强化它。当它监听到 `CHAT_CHANGED` 并**彻底完成**耗时的差异比对与数据加载后，**由它**来统一抛出 `ark:worldbook-data-changed`，通知 UI：“我的脏活干完了，现在你们可以安全刷新了。”
*   **`src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts` (理应是：UI 状态中枢)**
    *   **现状：** 监听了 `WORLDINFO_UPDATED` 等事件。
    *   **目标：** **保持现状**。这是合理的！它监听到酒馆发出的“某条世界书被用户手动改了”的信号后，去刷新自己的数据，这完全属于 UI 展现的职责。

---

## 2. 动刀三步走 (The 3-Step Refactoring Plan)

### Step 1: 斩断竞态乱源 (清理 `statusbar_manager.ts`)
*   打开 `statusbar_manager.ts`。
*   找到 `setupEvents()` 函数（大约在第 143-177 行）。
*   将里面对 `eventOn(tavern_events.CHAT_CHANGED, ...)` 和 `eventOn(tavern_events.GENERATION_ENDED, ...)` 的直接监听与 `dispatchEvent` 的抛出逻辑**彻底删除或转移**。
*   确保 `statusbar_manager` 不再充当瞎指挥的调度员。

### Step 2: 赋予 Automator 正确的通知权 (强化 `worldbook_automator.ts`)
*   打开 `worldbook_automator.ts`。
*   找到它监听 `CHAT_CHANGED` 和 `GENERATION_ENDED` 的地方。
*   在其业务逻辑（例如 `this.checkBaselineDiff(targetWorldbook)`）执行 **完毕且 `await` 结束** 之后。
*   加上那句原本在 manager 里的通知代码：`document.dispatchEvent(new CustomEvent('ark:worldbook-data-changed', { detail: { worldbookName: targetWorldbook } }));`。
*   这样，UI 就只会收到“成熟”的数据刷新信号，彻底告别竞态死锁。

### Step 3: 重建显式引导管线 (清理 `index.ts`)
*   打开 `index.ts`。
*   废除丑陋的 `startMountingLoop`（那个用 `setInterval` 找 DOM 的怪物）。
*   新建一个极其直白的 `async function bootstrap()` 启动函数：
    ```typescript
    async function bootstrap() {
      // 1. 等待核心环境就绪 (可以适当 delay 或用更优雅的酒馆钩子)
      // 2. 初始化核心后勤 (ConfigStore 等)
      // 3. 唤醒并挂载业务模块 (比如 manager.init(), 唤醒拦截器等)
      // 4. 寻找并挂载前端 Vue UI (将原有的挂载逻辑整理到这里，只执行一次)
    }
    
    $(() => {
      bootstrap(); // 唯一的启动入口
    });
    ```
*   这部分需要我们一起仔细斟酌，因为完全废除 `setInterval` 轮询可能意味着我们需要找到更可靠的原生事件（比如 `APP_READY` 或者依赖 `CHAT_CHANGED` 作为触发器）来决定何时挂载 UI。

---

## 3. 下一步行动提示 (For the next Agent)

接手的 Agent 必须明白，本阶段的最高指令是 **“让架构变得人类可读”**。
请严格按照上述的三步走计划执行，不要再凭空捏造任何 `Registry` 或 `Bus` 文件。
你的任务就是像梳理一团乱麻的电线一样，拔掉插错的线，接回到正确的插座上，并理出一条清晰的主线。