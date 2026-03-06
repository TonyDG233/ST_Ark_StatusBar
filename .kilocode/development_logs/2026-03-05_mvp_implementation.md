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

## 2026-03-05 - MVP v2 Bugfixes and Final Polishing
- 修复了 GlobalStatusBar 中 Toggle Switch 和蓝绿灯按钮对不齐的样式问题。
- 增加了关闭条目时的半透明虚化效果（`opacity: 0.4`），提升状态辨识度。
- 修复了历史记录 (Git Tab) 中“开启/关闭”与“蓝绿灯状态”文字混淆的问题。
- 在 `GlobalStatusBar.vue` 增加了移动端和跨浏览器的边界约束 (checkBounds) 与 ResizeObserver：
  - UI 挂载时强制校验并拽回屏幕，防止移动端初始渲染在屏幕外。
  - 增加 `SAFE_TOP = 70` 缓冲区避开酒馆顶部 Navbar，确保头部拖拽区域永远可用。
  - 通过 ResizeObserver 解决由于 bottom 锚定导致切换大 Tab 时 UI 向上溢出的问题，触发高度变化时自动将 UI 推向下侧。
  - 双击头部支持重置 UI 坐标到默认态。

## MVP v2 最终确认修复 (修复 "Unknown" 条目与拦截预警问题)
- **修复 `world_info_activated` 事件拦截的数据缺失问题**：由于酒馆抛出的事件数据是不含 `enabled` 和 `strategy` 的阉割版拷贝，导致拦截预警面板大量显示 "Unknown" 并带有错误的红/绿灯状态。
- **解决方案**：在 `GlobalStatusBar.vue` 接收到拦截事件后，将其与全量的 `allEntries` 进行匹配（优先使用 `uid`，若缺失则降级使用 `name` 和 `comment` 模糊匹配），从而还原完整的世界书条目信息。
- **蓝灯过滤**：由于蓝灯（Constant 状态）一定会触发，不需要人工干预，在匹配逻辑中增加了 `.filter(entry => getEntryType(entry) !== 'constant')`，将蓝灯条目从预警面板中剔除，保持面板整洁。
- **透明主题 Logo 修复**：在 `StartupNavigator.vue` 为 `.transparent-theme .arknights-logo` 增加了 `filter: invert(1)` 反色处理，确保黑色 Logo 在透明/深色背景下清晰可见。
- **自动刷新修复**：修复了在酒馆切换聊天或角色时，"全部条目"列表未自动刷新的问题。通过在 `StatusBarManager` 中监听 `CHAT_CHANGED` 并抛出 `ark-chat-changed` 信号，让 `GlobalStatusBar.vue` 自动重载当前世界书状态。

## MVP v2 进一步打磨 (2026-03-06)
- **Mini-Mode 极致折叠与快照功能**：
  - 彻底修复了缩小模式（Mini-Mode）未隐藏内容区导致在移动端遮挡屏幕的问题（修正了 `v-show` 的遗漏）。
  - 新增 `lastTriggeredEntries` 记录上一轮发送时触发的词条（“快照”功能）。在缩小模式下，如果存在快照，将紧凑地展示最近一轮的触发词条（限制显示高度，带状态小圆点，超长文本自动 `...` 省略，使用 `.disabled-entry` 样式对禁用项进行置灰）。
  - 移除了缩小状态中针对字体大小的硬编码（`0.85em`），现在 UI 设置中的字体大小可以按比例完美影响缩小胶囊的大小。调整最大宽度至 200px。
- **拦截预警空状态优化**：
  - 在“拦截预警”面板没有当前触发项时，如果在 `lastTriggeredEntries` 中有上一轮的快照记录，会在下方以只读列表的形式追加展示上一轮的发送情况。
- **世界书偏好置顶 (Pin) 功能**：
  - 在“全部条目”页签为每个世界书词条新增了“偏好置顶”（📌）按钮。
  - 置顶数据 (`pinnedEntries`) 被持久化保存在 `[SYS_CONFIG]` 系统配置中，不污染原有的世界书条目结构。
  - 在所有列表渲染（包括全部条目、拦截预警、快照列表）中，被置顶的条目都会优先排在最上方。
  - 设置页签新增了“清空所有偏好置顶”的快捷按钮。
- **分类排序优化**：在下拉筛选中，特殊分类 `[未分类]` 现已固定沉底排列。

## 2026-03-06: Manual Intercept Test Feature
- **可行性与上下文分析**：
  - 经分析确认，SillyTavern 原生的 Worldbook 触发检测，深度完全依赖于世界书条目自身配置中的 `Search Range` 参数。
  - 我们传递了全量上下文。为了绝对确保后端不截断，将传递给 `getWorldInfoPrompt` 的 `maxContextTokens` 由 `100000` 再次拔高至 `1000000`。
- **功能实装**：
  - 在 `StatusBarManager` 新增 `runManualTest()` 暴露干预入口，并在事件流中附加 `{ isManualTest: true }`。
  - 在 `GlobalStatusBar.vue` 界面（拦截预警 Tab）中新增了 `[🔍 主动检测]` 按钮。
  - UI 针对测试模式（`isTestMode`）做了隔离渲染，隐去“确认/取消发送”等动作按钮，提供专用的“清除测试结果”操作，防止污染正常发送生命周期。
