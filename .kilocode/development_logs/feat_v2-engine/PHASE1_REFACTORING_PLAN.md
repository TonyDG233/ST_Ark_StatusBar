# ARK_STATUSBAR 架构演进与游戏化总规划 (Phase 1 Refactoring)

## 1. 核心愿景
基于对现有代码深耦合与用户正向反馈的重新审视，放弃“推翻重写（暴力重启）”的思路，转而**在当前 `ARK_STATUSBAR` 架构上进行深度重构与微调**。
目标是：明确“世界书管理器”的界限，重塑前端工程化目录结构，引入全新的“手机 OS”级全局 UI 框架，并最终在这个更健壮的底座上开发“早期剧情系统”。

## 2. 第一阶段：基底重构与模块化分离 (Infrastructure & Modularity)
这是我们接下来需要一步步落实的核心三步走：

### 1. 重新调整项目结构 (Project Structure Normalization)
纠正早期不规范的前端架构设计，向标准 Web 工程靠拢：
- [ ] **拆分 `index.ts`**：剥离 `index.ts` 中堆砌的逻辑。
  - 将相关的 Hook 功能抽出放入新建的 `src/ARK_STATUSBAR/hooks` 文件夹。
  - 将判断方舟角色等辅助函数移入 `src/ARK_STATUSBAR/utils`（原 `tools` 重命名）。
- [ ] **配置解耦 (Config Storage Split)**：调整 Config 存储模式，将保存修改记录（History/Commits）的条款单独存入一个**共用的 title (键值)** 底下。确保其他插件/模块读取历史数据时，无需处理额外的 UI 配置信息，避免因为误操作导致配置脏写。
- [ ] **挂载与开关解耦**：确认 `index.ts` 中世界书管理器的挂载逻辑是独立的。为除后台逻辑外的每个组件单独设置开关，实现“默认通用插件”与“默认角色卡专属插件”的预设切换能力。这为当组件规模过大后，通过简单的代码复制与删减即可打包出独立的世界书管理器插件铺平道路。

### 2. 前端构造升级 (Status Bar Portal Architecture)
彻底重构 UI 体系，放弃霸占屏幕的“手机大窗/大面板”模式，回归极致精简的“状态栏（Status Bar）”核心理念：
- [ ] **目录更名与语义化**：
  - 将目前实际充当页面的 `components` 目录更名为 `views` (或 `pages`)。
  - 新建 `components` 目录，专用于存储**真正可复用的、跨业务的 UI 基础组件**（如方舟风格的按钮、模态框、折叠面板）。
  - `data` 目录专职存储静态文本内容，新建 `assets` 目录存储内置图像资源。
  - 在 `components/styles` 中集中管理可调节的主题变量，以便通过 AI 一键套用官方游戏 UI 风格。
- [ ] **重铸真正的微型状态栏 (ArkStatusBar.vue)**：作为全局唯一常驻的悬浮组件，平时收起于屏幕边缘。展开后仅提供极少量核心数据（如：当前剧情节点、理智值等简明状态）和一套**应用快捷网格（App Launcher）**。
- [ ] **抽离业务为独立弹窗 (App Windows)**：将现有的“世界书”、“操作记录”、“预检拦截”等臃肿的 Tab 页面，彻底从原先的面板中抽出，转变为独立的**大尺寸模态窗/全屏遮罩**。玩家点击状态栏的入口图标时才弹出，用完即焚，绝不干扰酒馆底层的正常聊天阅读。
- [ ] **物理与机制挂载转移**：边缘拖拽碰撞、气泡化机制继续绑定在状态栏主体上。
- [ ] **微型消息通知系统 (Notification Center)**：设计类似于游戏内系统的广播提醒。底层模块（如拦截器）触发重要事件时，在屏幕顶部或状态栏侧边弹出横幅（Toast），点击消息可直接唤出对应的全屏管理窗。

### 3. 早期剧情系统开发 (Early Story System MVP)
在新的状态栏与弹窗 OS 框架内，开发一个独立的新视图用于剧情推演：
- [ ] **核心业务流**：结合酒馆助手变量注入、Zod 变量维护、世界书控制系统，并配合 JSON 化的提示词（Prompt）驱动 AI 执行变量注入与管理。
- [ ] **插件联动**：基于 AI 输出的提示，插件自动开启对应的世界书条目推进剧情。
- [ ] **隔离控制台**：上述剧情逻辑将全部集成进一个**新的 App** 中，与原有的“世界书控制台”在 UI 与 Hook 挂载逻辑上彻底区分。
- [ ] **后端架构升级**：在 `src/ARK_STATUSBAR/logic/` 中为上述新 Service 建立新的文件夹（更名为 `services/` 以正视听），并编写全新的 Facade 门面进行调度。

### 4. 渐进式重构与样式优化 (Progressive Refactoring)
鉴于现存的业务分页文件极多（`history`, `worldbook`, `interceptor` 等目录下数十个文件），**拒绝一刀切的“大爆炸式重构”**，采取稳妥的渐进式策略：
- [ ] **试点工程**：先以后续的“手机 OS 外壳”、“物理 Hooks”以及“状态信息枢纽 (`shared_ui_state.ts` 改造)”作为首批试点，跑通现代组件化和 Hook 化模式。期间涉及的文件移动和引入路径批量修改，在跑通后进行测试。
- [ ] **逐个击破**：试点成功并确认思路可行后，再按模块（一个 Tab 接一个 Tab）地将原先堆在 `.vue` `<script>` 里的长逻辑抽离到专门的 Hook 中。
- [ ] **样式去重打包优化**：在渐进重构过程中，顺手解决目前多个分页组件重复调用定制样式（`import scss`），导致打包时样式冗余、插件体积膨胀的问题，将公用主题样式统一在顶层（或 `components/styles`）集中处理。

## 3. 后续待定方向 (TBD)
- [ ] **开局 UI 改造**：目前列表式的开局 UI 过于干涩，如何使其更加生动、方便使用（如引入剧情节点树状图、立绘交互等），需在人类提供 UI 原型/草图后进一步讨论并明确方案。

## 4. 下一步行动纲领
优先执行**第 1 步（项目结构调整与 index.ts 拆分）**：
先将脏乱的 `index.ts` 拆解干净，确立 `hooks` 和 `utils` 的合理边界；然后再动手调整 `system_config.ts` 的存储模式和挂载开关。等底层干净了，再利用 Stitch 或 Figma 重绘出“硬核游戏状态栏”的全新 UI。

---

## 附录 A：`index.ts` 拆分与挂载解耦落地清单 (Appendix A: index.ts Refactoring Checklist)
基于上述“重新调整项目结构”的方针，针对臃肿的 `index.ts` 执行以下精确的剥离手术：

1. **抽离到 `utils/` (纯函数与辅助工具)**：
   - 将 `getCurrentCharacterName()` 鉴定判断逻辑抽离为纯粹的工具函数 `checkIsArknights()`。
2. **抽离到 `inject/` (宿主环境侵入层)**：
   - 将向酒馆 UI 强行插入控制按钮的 `injectTavernControls()` 作为独立集成脚本剥离至 `src/ARK_STATUSBAR/inject/tavern_injector.ts`。
3. **抽离到 `hooks/` (组合式环境观测)**：
   - 将 `startMountingLoop` 中用 `setInterval` 寻找第 0 楼 DOM 的环境观测逻辑，封装为 `hooks/useChatMonitor.ts`。
   - **注意红线**：Hook 仅负责向外抛出“就绪”或“消失”的事件回调，**绝对不能**在 Hook 内部执行 Vue 组件的实例化或挂载动作。
4. **雷打不动地保留在 `index.ts` (生命周期总管)**：
   - 声明所有 Vue 实例变量 (`startupApp`, `globalStatusBarApp` 等)。
   - 在 `bootstrap()` 启动序列中引入上面的 Utils 和 Injectors。
   - 监听 Hooks 传回的回调，在 `index.ts` 内部亲自执行 `createApp().mount()`。
   - 在 `pagehide` 时统一执行 `app.unmount()` 安全回收内存。
   - 引入配置挂载开关，在顶层实现“通用世界书模式”与“方舟专属模式”的灵活切换。

## 附录 B：V2 引擎架构与物理防线规范 (Appendix B: V2 Architecture Standard)
为配合我们独有的 MVU 核心架构和高可用的单向管线防线，绝对禁止用传统的 Vue 习惯去颠覆现有的平级模块化架构。以下是各个目录严苛的职责防线与边界，后续开发必须无条件遵守：

*   **`src/ARK_STATUSBAR/views/` (页面级视图层)**：装载占据主要视野的大模块（原 `components/global_tabs`），如 `WorldbookTab.vue`。它们负责与底层数据交互，并拼装下方的小组件。
*   **`src/ARK_STATUSBAR/components/` (通用基础组件层)**：装载纯粹、可复用的 UI 积木（如 `<ArkButton>`）。这类通用组件可通过 `props` 接收渲染数据，极个别纯展示交互可使用 `emit`，但严禁包含重度引擎层业务逻辑。
*   **`src/ARK_STATUSBAR/utils/` (纯函数辅助工具层)**：纯净的数据加工厂或无副作用判定，如 `checkIsArknights()`。
    *   **红线**：不使用响应式，完全不依赖 Vue 环境。
*   **`src/ARK_STATUSBAR/hooks/` (副作用与组合式响应层)**：封装具有副作用的特定逻辑，如 `useChatMonitor`（观测环境并抛出事件），以及诸如 `useTavernControls` 这种专门对宿主环境原生 DOM 进行视觉层注入的控制端点。
    *   **红线**：只处理边缘副作用，绝对不允许侵入或代理发包核心业务。
*   **`src/ARK_STATUSBAR/services/` (核心业务拦截与服务层 / 原 `logic/`)**：引擎跳动的心脏。处理诸如 `send_interceptor` 的强力数据流劫持、执行 AST 解析或 JSON 变异、以及挂载最终的 Zod 防线落盘。它负责执行真正的“黑盒破坏与接管”。
*   **`src/ARK_STATUSBAR/store/` (全局状态与配置枢纽)**：同时管理前端和后台环境的唯一真相源。
    *   **UI 共享状态 (`ui_state_store`)**：使用业界标准的 Pinia Store 模式专门给上层的 `views` 与 `components` 供血，保证组件内存同频。
    *   **后端配置状态 (`config_store`)**：坚持使用 `单例类 (Singleton) + CustomEvent 事件总线` 模式。实现与 Vue 上下文彻底解耦，专供底层纯 TS 脚本（如 `send_interceptor`）高速无感读写。
*   **`src/ARK_STATUSBAR/types/` (系统契约与防腐层)**：存放全部核心 TypeScript Interface（如 `ArkConfig`, `ArkCommit`）以及 `ark_events.d.ts` 中的全局原生事件强定义，是系统避免类型崩溃的钢筋。