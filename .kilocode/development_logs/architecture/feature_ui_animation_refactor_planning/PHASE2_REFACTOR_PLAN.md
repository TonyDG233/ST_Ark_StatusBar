# 第二阶段架构与交互重构白皮书 (Phase 2 Refactoring Master Plan)

## 背景与痛点复盘

基于第一阶段 `GlobalStatusBar.vue`
动画重构失败及稳定版遗留问题的深度诊断，本项目在 UI 交互与架构层面暴露出以下核心痛点：

1. **事件系统失控 (Event Sprawl)**：原生 `document.addEventListener`、`CustomEvent` 与自建的 `ArkEventBus`
   相互杂糅，缺乏统一调度与强类型约束。这导致事件流转如“幽灵调用”，难以追踪与维护。
2. **状态与物理引擎冲突 (Physics vs.
   Rendering)**：现有的物理拖拽引擎与 CSS 视觉动画在单一 DOM 节点上强耦合。当触发状态变更（如拦截预警强制展开）时，尺寸突变（180px
   -> 400px）导致组件的生长方向不可控，进而将 UI 顶出视窗外，造成用户无法操作（稳定版的致命缺陷）。
3. **气泡窗逻辑撕裂 (Asymmetric
   Animation)**：由于底层挂靠点（`right: 0`）与中心坐标系的错误融合，左侧吸附回弹的动画逻辑与右侧完全不一致，难以兼顾原生 CSS 的缩放表现。
4. **文档体系滞后 (Doc Debt)**：架构图与设计理念散落在随意的日志中，缺乏像大型开源项目那样“实时反映项目真实架构”的
   `docs` 体系，导致新成员（或未来的自己）无法快速理清脉络。

## 核心重构目标 (The Four Pillars)

为了从根本上解决上述问题，确立本项目可长期维护的“护城河”，本次重构将围绕以下四大支柱展开：

### 1. 统一且强类型的事件系统优化 (Event System Unification)

- **目标**：彻底收拢事件的入口与出口，消灭魔法字符串和 `any` 类型。
- **策略**：
  - **原生类型扩展**：新增 `types/ark_dom_events.d.ts`，利用 TypeScript Declaration Merging
    (`declare global { interface DocumentEventMap { ... } }`)，将所有与宿主通信的 `ark-*`
    原生自定义事件强制注册，消除底层通信时的 `(e: CustomEvent)` 强转操作。
  - **前台视图层聚合门面 (Event Facade Hook)**：构建单一的 `useArkSystemEvents`
    生命周期钩子。严禁 UI 组件（`.vue`）直接操作散落的 `document.addEventListener` 或
    `ArkEventBus.on`。UI 层只能使用此钩子传入对象订阅事件，由钩子内部统一绑定与销毁，根绝内存泄漏和“幽灵调用”。
  - **后台领域层防腐代理 (Automator/Service Domain)**：对于像 `worldbook_automator.ts`
    这样的纯后台逻辑模块，不使用 Vue 的 Hook。它们应当维持 Class/单例模式，内部使用安全的强类型原生监听与
    `ArkEventBus.emit` 进行分发，作为连接酒馆宿主环境与内部状态的“防腐层 (Anti-Corruption Layer)”。
  - **内网总线净化**：`ArkEventBus` 维持其 `ArkInternalEvents`
    泛型映射字典不变，确立其作为**纯粹的内部模块指令通道**的地位，严禁与外部宿主原生事件混用。

### 2. 梳理页面状态逻辑与状态机编排 (State Machine Orchestration)

- **目标**：解决“拦截触发时强行展开导致 UI 顶出视窗”的恶性 Bug，彻底理清气泡吸附、拖拽与点击展开之间的状态干涉。
- **策略**：
  - **废除布尔值地狱**：移除 `isMiniMode`、`isSnappedToEdge` 等容易产生逻辑冲突的散落布尔值。引入唯一真相源（Single
    Source of Truth）—— **UI 状态机枚举 (`UiMode: FULL | MINI | SNAPPED_LEFT | SNAPPED_RIGHT`)**。
  - **统一调度枢纽 (`switchMode`)**：任何改变 UI 形态的操作（点击按钮、拖拽松手、拦截器底层触发），都必须经过统一的调度函数进行状态转移，并在内部处理互斥逻辑。
  - **内容与按钮的动态替换**：基于当前
    `UiMode`，通过 Vue 的条件渲染（或组件动态切换）来实现头部栏图标、标题、内容的平滑替换，彻底抛弃基于 CSS
    `display: none` 的粗暴隐藏方案。
  - **展开防溢出预检 (Pre-Expand Bounds Check)**：在执行状态转移（如从小尺寸 `MINI` 膨胀到大尺寸
    `FULL`）前，状态机必须获取目标形态的**预估物理尺寸**。通过纯数学计算当前坐标是否会导致溢出。如果预测会溢出屏幕，则在触发视觉形变动画的**同一帧**内，对物理外壳的 X/Y 坐标进行瞬时的逆向安全补偿，确保无论在屏幕何处展开都绝对不会“穿模”或顶出视窗。

### 3. 样式与页面逻辑的极致解耦 (Dual-DOM Decoupling)

- **目标**：彻底告别“由于挂载点导致左右动画不对称”和“拖拽与动画打架”的黑暗时代。
- **现状分析 (从稳定版面条代码到沙盒实验)**：
  - 在目前的稳定版中，`GlobalStatusBar.vue` 承担了所有的坐标计算(`transformX/Y`)、边界检查(`checkBounds`)、拖拽判定(`onDrag`) 和原生 DOM 事件的挂载卸载。导致它异常臃肿（500多行），且拖拽物理逻辑与 UI 的显隐状态强行揉捏在一起。
  - 在沙盒版的探索中，我们已经成功提取出了 `useDraggablePhysics.ts`。其中最核心的妥协在于**绝对物理防御原则**：无论动画如何，物理外壳永远受数学限制，绝对不能超出 `viewportWidth` 与 `viewportHeight` 的边界。
- **最终策略 (Dual-DOM 架构)**：
  - **物理外壳层 (Physical Shell)**：提取出纯粹的 JS 控制层（即完全重构版的 `useDraggablePhysics.ts`）。这个外壳通过 `transform: translate` 进行 0 延迟拖拽跟手。**其上绝对禁止绑定任何 CSS `transition`。** 这个外壳负责锚定位置并死守边界防御。
  - **视觉内壳层 (Visual Panel)**：实际渲染的 Vue 组件内容容器。内壳只响应业务逻辑（比如被折叠、触发了拦截）。动画通过改变内壳自身的 `width`、`opacity`、`border-radius` 等进行过渡（配合 `transition`）。
  - **动态锚定冲突解法**：基于 `right: 0` 的基准进行坐标换算，如果在左侧贴边（胶囊模式），则通过 `isSnappedToEdge === 'left'` 将内部包裹体的 Flex 或者绝对定位原点反转。在松手弹开瞬间（越过拉扯阈值），先以无动画形式跳跃到外壳的新计算物理坐标，随后再执行内壳展开的 CSS 动画。这样彻底割裂物理层位移和视觉层形变，从而消灭撕裂。

### 4. 构建实时反应架构的大型文档体系 (Living Documentation)

- **目标**：让架构设计不只是“写给机器看”的日志，而是真正的开发者向导。参考 erArk 游戏系统中极其优秀的文档分类形式。
- **策略**：
  - **建立统一的 Docs 索引**：不再把日志丢在 `architecture/` 下的杂乱命名文件夹里，而是在 `.kilocode/docs/` 下建立类似 erArk 的 `README.md`，对文档进行分类导航（如：基础架构、UI组件、业务逻辑层、MVU数据流向）。
  - **为核心模块出具独立说明 (Module-Specific Docs)**：就像 erArk 拆分出《事件系统.md》《结算系统.md》一样，本项目必须为核心机制建立专项文档：
    - 《世界书防腐机制.md》：详细说明数据清洗和读写边界。
    - 《UI物理引擎与动画.md》：详述双层 DOM 以及安全墙碰撞逻辑。
    - 《拦截与拦截器流程.md》：梳理预警弹窗的数据来源和打断机制。
  - **使用代码注释到文档的映射机制**：保证文档的演进与代码重构强绑定。重要函数的实现原理直接指引向对应的模块文档，做到“无文档不重构”。

---

*注：本文档将作为后续重构的蓝图。后续将根据具体实施情况与讨论，逐步补齐实施细节与校验标准。*
