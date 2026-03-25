# 08 胖组件重构战略 (GlobalStatusBar.vue 专项拆分解剖)

## 1. 惨痛教训总结：为什么一个 Vue 文件这么难拆？

在经历了第 5 次拆分失败后，我们必须彻底正视 `GlobalStatusBar.vue` 这个巨型容器所带来的架构陷阱。简单粗暴的物理切分（直接把代码复制到子组件）注定会导致四屏样式全毁，因为我们触碰了以下三个“隐形雷区”：

### 1.1 隐性样式依赖陷阱 (The Phantom CSS Trap)
`GlobalStatusBar.vue` 内部使用了诸如 `btn-success`, `btn-primary`, `switch`, `slider` 等样式类，但在其底部的 `<style scoped>` 中却**没有定义这些类**。
*   **真相**：这些样式是由宿主环境（酒馆原生系统）或外部资源隐式提供的全局 CSS。
*   **雷区**：AI 拆分代码时如果发现“类未定义”，会自作聪明地在子组件的 `<style scoped>` 中用通用的基础 CSS 补齐这些类。这立刻导致带有作用域哈希的高优先级“伪造样式”覆盖了宿主原本的全局精美样式，造成灾难性的 UI 崩坏。

### 1.2 DOM 层级与布局上下文破裂 (The Broken Layout Context)
在这个巨型组件中，四个 Tab 的内容全都依附于统一的父级包装容器：
`<div class="statusbar-content">`
这个容器赋予了所有内部元素 `padding: 15px` 和 `max-height` 滚动机制。
*   **雷区**：在抽出 `InterceptorTab`（需要处理迷你悬浮窗模式）时，如果草率地将其从 `<div class="statusbar-content">` 层级中平移出去，或者子组件内部遗漏了包装层，就会导致子组件瞬间失去内边距和网格约束。这就是为什么文本会紧贴边框，警告框的黄色背景会发生截断。

### 1.3 集中式状态的生命周期剥离 (The Reactive State Dilemma)
所有 Tab 共用了一个声明式环境：如 `pendingEntries`、`isTestMode`，以及全局事件监听器 (`document.addEventListener`)。
*   **雷区**：如果强行追求“每个 Tab 绝对自治”，将状态和监听器完全封装到子组件中，父容器（如需要显示拦截数字的 Mini-Title）将彻底丢失数据来源。反之，如果全靠冗长的 `emit` 管道维持通信，一旦遇到渲染竞态或异步事件，就会引发严重的 UI 状态撕裂。

---

## 2. 绝对安全的重构手术方案 (The Bulletproof Strategy)

接下来的重构，绝不容许任何形式的“重写”与“脑补”。我们必须采取**“手术刀级同构平移”**战术。

### 2.1 文件结构 (纯垂直切片)
创建高内聚目录，但杜绝过度嵌套：
```text
src/ARK_STATUSBAR/components/global_tabs/
├── InterceptorTab.vue    (预检拦截面板与干跑测试)
├── WorldbookTab.vue      (全部世界书挂载与启停)
├── HistoryTab.vue        (快照、基准线与修改记录)
└── SettingsTab.vue       (终端 UI 与开关设置)
```

### 2.2 防线一：DOM 结构 1:1 锚定
**铁律**：拆分后的子组件必须严格保持与原来在 `GlobalStatusBar.vue` 中一模一样的最外层 div 包裹关系。
*   `GlobalStatusBar.vue` 只负责保留拖拽、Mini 外壳和 `<div class="statusbar-content">` 容器。
*   子组件的内容就是从 `<div v-show="currentTab === 'xxx'">` 内部 **一字不差** 剪切过去的代码块，绝不允许增删任何嵌套 `div` 或改变 `class` 名称。

### 2.3 防线二：CSS 零添加原则
**铁律**：在新建立的 4 个子组件中，**绝对禁止**手动添加任何在原 `GlobalStatusBar.vue` 样式块中不存在的 CSS 类。
*   只需要将 `GlobalStatusBar.vue` 底部的对应样式按业务分发给子组件。
*   如果没有找到诸如 `.btn-success` 的样式定义，就顺其自然，绝不擅自补齐。依靠宿主的全局样式去渲染即可。

### 2.4 防线三：局部共享状态的提取 (Composable)
为解决父子组件状态撕裂问题，不再使用脆弱的 `props/emit` 管道进行深层业务通信。
*   **方案**：建立响应式代理或专属 Store（例如通过 `useInterceptorState()` composable）来管理 `pendingEntries`。
*   父组件与 `InterceptorTab` 均通过引用直接获取最新状态，彻底避免因传递滞后导致的 UI 撕裂。

## 3. 执行要求
本规划文件出具后，下一次对 `GlobalStatusBar.vue` 的手术必须完全基于此战略执行。任何偏离“1:1 同构平移”原则的代码输出都将被判定为违规并立即中止。