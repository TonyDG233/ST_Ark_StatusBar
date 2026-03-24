# 07 架构重构失败反思与最终校准规划 (07_failure_reflection_and_new_arch.md)

## 1. 痛点：为什么要写这份规划？

在阅读了之前的 `03` 到 `06` 规划后，我深刻反省到了我在之前执行过程中产生的巨大偏差。

### 1.1 `06` 规划里的理想与现实的脱节
在 `06` 规划中，我们提出：**“前端解耦原则：组件自治：每个 Tab 组件自己去 import 对应的 logic/* 服务。自己触发方法，自己获取结果。”** 
这句话原本的意图是：既然要在 Vue 层面拆分子组件（把几千行的胖容器拆成 4 个 Tab），那这些 Tab 自己管好自己的局部状态和对应的数据请求逻辑就行，不要什么脏活累活都往最顶层的容器（如 `GlobalStatusBar.vue` 或后端的 `StatusBarManager`）塞。

**但我执行时产生的偏差是：**
我把这个理解成了**“为了解耦，所以我们要把后端的两个 manager 彻底炸掉，拆成一堆细碎的 TS 文件，并且让所有还没拆分的前端组件全部强行改 `import` 去一对一连接这些碎文件。”**

这种**极端且错误的理解**，导致：
1. 原先封装完好的门面被我亲手砸碎，原有的 `manager.saveConfig` 这种安全接口直接被删掉。
2. 满地的 P2P 网状依赖，前端组件找不到方法直接编译崩溃。
3. 试图用 Node.js 正则强行替换全盘文本，越改错越多。

### 1.2 真正符合目前项目体量的解耦是什么？

正如用户所批评的：
> 如果还是直接的引用关系那么不用塞到统一的后端文件夹了，直接一个 tab 一个文件夹然后里面一个 scss,一个 ts，一个 vue 不就完了？

这句批评一针见血！**对于前端展示逻辑的拆解，最高效、最符合直觉的内聚方式，就是把相关的东西（Vue、专属的 TS 逻辑、专属样式）放在同一个目录下。**
而对于后端，**核心数据和核心流程（如读写配置、世界书状态维护），必须通过一个统一的入口（交汇点）来交互，绝不能让前端越过大管家去直接指挥底层的细分模块。**

---

## 2. 全新且务实的架构规划 (The True Pragmatic Architecture)

我们将回到面向对象的经典设计原则：**Facade 模式（门面模式）与前端的高内聚组件化。**

### 2.1 后端结构：保留门面，内部拆分解耦

`StatusBarManager` 和 `WorldbookManager` 仍然是项目的**绝对中枢与交汇点**。
前端 Vue 永远只能 `import` 并调用这两个 Manager 的公开接口。

但是，为了解决这俩 Manager 文件体积庞大（上帝类）的问题，我们将把内部具体干脏活的代码剥离：

```text
src/ARK_STATUSBAR/logic/
├── statusbar_manager.ts        <-- (门面) 负责整体初始化、暴露配置存取、派发事件、对接全局拦截
├── worldbook_manager.ts        <-- (门面) 负责世界书读取、快照读写、开局应用暴露
│
├── core/                       <-- (被隐藏的底层干活类)
│   ├── config_store.ts         (独立管理配置和 localStorage/extensionSettings，被 manager 代理调用)
│   └── logger.ts               (处理调试日志异步世界书写入，被 manager 调用)
│
└── interceptor/
    └── send_interceptor.ts     (承接原本几百行的双轨干跑 Token 计算逻辑，被 manager 调用)
```

**关键执行准则**：
- 在重构后端时，**绝不允许修改前端调用方的代码**。如果拆走了一个方法，原 Manager 里必须留一个同名的方法做转发。

### 2.2 前端结构：基于业务的本地高内聚 (Vertical Slicing)

针对 `GlobalStatusBar.vue` 胖容器的拆解，不再执着于把逻辑强行抽离到遥远的 `src/logic/` 中。而是按照业务切片：

```text
src/ARK_STATUSBAR/components/global_tabs/
├── interceptor/
│   ├── InterceptorTab.vue       <-- 拦截器 UI，内部包含自身倒计时、选中项的 state
│   └── interceptor.scss         <-- 仅针对拦截器的样式
├── worldbook/
│   ├── WorldbookTab.vue         <-- 抽屉 UI、本地的 filterText、展开状态 state
│   └── worldbook.scss
├── history/
│   ├── HistoryTab.vue           <-- 快照历史渲染、撤回操作处理
│   └── history.scss
└── settings/
    ├── SettingsTab.vue          <-- 宽度、字体滑动条 UI
    └── settings.scss
```

各个 Tab 内部，需要修改配置时，依然通过 `import { StatusBarManager }` 去调它的方法，**交汇点依然是单一的。**

---

## 3. 分步执行纠偏计划 (Corrective Actions)

由于我刚才的严重失误（包括强制 Node 正则替换和错误删减代码），整个重构工作回到了原点。
在此，我列出极其严格、稳妥的重启步骤：

### 📌 Step 1: `config_store` 的安全剥离与代理 (Backend)
- 动作：将 `StatusBarManager` 中配置读取和保存的部分移动到新建的 `core/config_store.ts`。
- **强制防线**：在 `StatusBarManager` 中**保留** `loadOrInitConfig`、`saveConfig` 和 `currentConfig` 的签名，内部全部 `return configStore.saveConfig(...)`。

### 📌 Step 2: `logger` 与 `send_interceptor` 的安全剥离 (Backend)
- 动作：将庞大的 `executeDualTrackDryRun` 和 `logDebug` 移出到专用文件。
- **强制防线**：同样在 `StatusBarManager` 保留对应的外露接口。
- **验收**：执行 `npx tsc --noEmit`，确保在此阶段没有任何一个 Vue 文件报错。

### 📌 Step 3: Vue 组件体系的高内聚拆分 (Frontend)
- 动作：建立类似 `global_tabs/worldbook/` 的深层级高内聚目录。
- 动作：将原先 `GlobalStatusBar.vue` 里的各个 `v-show="currentTab === '...'"` 块剪切到各自的 `.vue` 文件中。
- 动作：将对应的响应式状态（如 `filterText`, `expandedWorldbooks`）从父容器搬进对应的 Tab 组件中独立闭环。

---
这份 07 规划已经彻底屏弃了 06 中的教条主义错误，真正响应了“设置交汇点防线”以及“业务代码本地内聚”的核心诉求。在获得您的审批后，我将依此稳步推进。
