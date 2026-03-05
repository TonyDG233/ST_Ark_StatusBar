# Phase 1 MVP 开发实施记录与 v2 迭代确认 (2026-03-05)

## 1. 今日完成的 MVP 开发动作记录

根据前期的 PoC 测试结果与架构规划，今日成功构建并集成了全局剧情/世界书状态栏的 MVP 版本（Primary MVP Implementation）：

### 1.1 核心状态与生命周期管理器 (`StatusBarManager`)
- **文件**: `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- **实现内容**: 
  - 构建了单例模式的 `StatusBarManager` 类。
  - 实现了脱离 `localStorage` 的纯净配置管理，自动在世界书中创建 `[ARK_SYS_CONFIG]` 隐藏条目并读写 JSON，将当前主题（Theme）、拦截器开关状态和“简易 Git 提交记录”全权托管于此。
  - 落地了前端物理 UI 劫持（Interceptor）：通过 `addEventListener` 在捕获阶段劫持 `#send_but` 和 `#send_textarea`。
  - 落地了“无痕预检”逻辑：在被拦截时，静默调用 `context.getWorldInfoPrompt(mockChat, 100000, false)` 获取将被激活的条目列表并派发全局自定义事件，随后由 UI 接管是否放行发送。
  - 落地了“防污染检查”：监听 `CHAT_CHANGED` 事件计算与基准线的 Diff 差异。

### 1.2 全局 Vue 状态栏组件 (`GlobalStatusBar.vue`)
- **文件**: `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
- **实现内容**:
  - 创建了独立且全局悬浮的面板 UI，避免依附于特定的聊天楼层。
  - 完整实装了四个核心功能页签（Tab）：
    - **拦截预警**: 列出将被送给大模型的词条，提供取消发送与确认放行按钮。
    - **全部条目**: 列表展示除系统配置外的全部词条，并支持使用原生的 Switch 拨动开关快速进行 Enable/Disable 状态切换。
    - **更新记录 (Git)**: 倒序排列渲染并展示存储在 `[ARK_SYS_CONFIG]` 中的历史 Commit 详情。
    - **设置**: 提供主题切换与一键清除所有历史并恢复 Baseline 的功能。

### 1.3 宿主原生系统集成 (`index.ts`)
- **文件**: `src/ARK_STATUSBAR/index.ts`
- **实现内容**:
  - 利用 TavernHelper 插件接口 `appendInexistentScriptButtons` 成功将系统级别的唤醒按钮（"📖 罗德岛终端"）无缝注入到原生 UI 侧栏区域。
  - 初始化了 `StatusBarManager` 的实例并完成了全局 DOM 节点的生成与 `GlobalStatusBarApp` 的独立挂载（`mount`）。

### 1.4 Baseline 与关键词匹配优化 (`WorldbookManager`)
- **文件**: `src/ARK_STATUSBAR/logic/worldbook_manager.ts`
- **实现内容**:
  - **废弃脆弱逻辑**：在 `applyScenario` 方法中，抛弃了原来直接对比 `entry.comment === keyword` 的易碎代码，重构为遍历检查 `entry.keys`（世界书词条的主关键字）是否包含触发关键词。此举大幅度提高了鲁棒性，规避了由于世界书条目名字变更或包含额外注释导致的失效。
  - **Git 追踪联动**：重构了 `applyScenario` 和 `toggleEntry` 操作，所有触发对世界书核心结构更改的动作都将自动同步记录到 `StatusBarManager` 的 commits 栈中，实现了全过程追踪。

### 1.5 传统组件解耦 (`StartupNavigator.vue`)
- **文件**: `src/ARK_STATUSBAR/components/StartupNavigator.vue`
- **实现内容**:
  - 将之前硬编码使用 `localStorage` 存储样式的代码剔除，转由 `StatusBarManager` 读取并应用 `currentConfig?.theme`，实现了统一的数据流管理。

---

## 2. 编译与检查状况
- **测试结果**: 运行 `pnpm run build:dev` 成功，Webpack 构建顺利。所有 Type 定义（含对 SillyTavern `@types` 环境的使用）经过调整后未产生 TS 错误。

---

## 3. 本轮开发后接到的 Feedback 与下一步 (v2) 迭代计划
今日向用户展示初步代码成果后，进行了细致的需求深化（详见 `feat_phase_1_addition_plan.md` 底部）：
- 需要在后续增强 UI 的拖拽功能、缩小常态尺寸（迷你状态）。
- 加强 Tab 2 的检索能力和**蓝绿灯设定修改能力**（同时要求修改动作被推入 Git 历史）。
- 根据与主维护者的最新共识：后续世界书不再需要手动排查人物设定，而是直接统一词条命名前缀（如 `[角色]`、`[设定]` 等）。因此接下来的重头戏是重构并挪动 `generate_baseline.mjs`，让其可以自动识别前缀分类以及蓝/绿灯属性。
- 强化侧栏的 Native Toggle 按钮功能，它将兼具**总控开关**的职责，UI 界面本身则保留最小化的折叠机制。
- **系统配置条目的优化**：后续修改中将 `[ARK_SYS_CONFIG]` 提取到顶层便于更改，采用如 `[SYS_CONFIG]系统配置文件请勿打开` 的命名，检索时只匹配前缀 `[SYS_CONFIG]`。并在脚本内部提供硬编码的系统初始状态预设以简化初始化流程。

这些细化需求已入档，将作为下一轮（v2 MVP 迭代）的首要任务。