# 系统架构与防线规约 (ARCH)

## 1. 技术栈选型
*   **宿主环境**: SillyTavern (酒馆)
*   **依赖扩展**: Tavern Helper (酒馆助手)
*   **前端框架**: Vue 3 (Composition API) + TypeScript
*   **构建工具**: Webpack (打包成单一 JS/HTML，直接被宿主 `load` 执行)
*   **状态与数据**: 
    *   全局与界面配置：持久化存储于原生环境的 `SillyTavern.extensionSettings['ark_statusbar_settings']`，彻底取代原先的 `[SYS_CONFIG]` 隐藏世界书条目机制（正在重构迁移中）。
    *   调试导出：日志数据限长后写入 `[SYS_DEBUG]` 世界书。
    *   *(规划中)* 剧情进度坐标：存储于 `@types/function/variables.d.ts` 中的**聊天级变量 (Chat-scoped Variables)**。

## 2. 模块结构划分 (当前)
*   **`src/ARK_STATUSBAR/index.ts` (核心挂载与入口)**
    *   负责全局 CSS 样式的 Teleport 提升，防止 iframe 样式污染。
    *   启动 `startMountingLoop` 轮询检查聊天楼层状态：
        *   当 `swipeId === 0` 时，在第一条 AI 消息上挂载 **开局跳转 UI (StartupNavigator)**。
        *   当 `swipeId > 0` 时，替换挂载 **回溯按钮 (ReturnButton)**。
    *   初始化并挂载独立于消息楼层的 **世界书管理器 (GlobalStatusBar)** 悬浮窗，并通过酒馆原生扩展 API 注册开启/关闭按钮。
*   **`src/ARK_STATUSBAR/logic/statusbar_manager.ts` (配置与拦截中枢)**
    *   封装对 `[SYS_CONFIG]` 和 `[SYS_DEBUG]` 的读写。
    *   维护历史操作数组 (Commits)，处理撤销逻辑。
    *   **发送拦截器**: 绑定对酒馆 `Send` 按钮或回车键的物理监听。当检测到拦截条件（例如存在未经用户确认的 Baseline 差异）时，阻断原生点击事件，拉起 UI 警告窗。
*   **`src/ARK_STATUSBAR/logic/worldbook_manager.ts` (剧本状态调度)**
    *   读取 `config/baseline.ts`。
    *   提供一键应用预设场景 (STARTUP_SCENARIOS)、关闭所有单字干员等核心原子操作。
    *   判断当前世界书状态 (Original / Modified)。
*   **`src/ARK_STATUSBAR/components/GlobalStatusBar.vue` (主控面板外壳)**
    *   已重构为纯拖拽外壳容器，仅提供 Tabs 导航。
    *   具体业务全部分离至 `src/ARK_STATUSBAR/components/global_tabs/` 内部的独立子组件中（微后端垂直切片）。
    *   **响应式数据中枢**: 使用 `shared_ui_state.ts` 作为前端跨组件的状态胶水与数据管道。它通过监听自建的 `worldbook:data_changed` 总线事件及原生酒馆事件（如 `WORLDINFO_UPDATED`），实现后端数据库（SSOT）到前端缓存的单向数据流自动刷新，彻底杜绝了各 Tab 组件手动修改本地缓存导致的数据撕裂。
*   **`src/ARK_STATUSBAR/components/StartupNavigator.vue` & `ReturnButton.vue` (开局与回溯 UI)**
    *   `StartupNavigator.vue`: 在新聊天（首条消息）区域挂载，提供可视化的开局剧本（Scenarios）注入与初始化界面。
    *   `ReturnButton.vue`: 在非初始刷新的页面提供跳转/返回的按钮入口，方便在不同剧情分支间导航。

## 3. 防线规约 (Redlines & Guardrails)

### 3.1 宿主生态安全防线
*   **避免污染 DOM/全局**: 组件挂载时必须指定唯一的类名容器（如 `ark-global-statusbar-mount-point`），卸载 (`pagehide`) 时必须清理残留样式与监听器。
*   **“初始化风暴”防御**: 酒馆的 MVU 或全局脚本极易在页面刷新、多次 Swipe 时被重复调用，导致陷入死循环。对于全局状态读取（例如 `getWorldbook` 和初始化后端配置），应当加锁或者通过 `turn === 0` 等机制保护。
*   **防呆拦截器**: 使用 `removeEventListener` 时，必须结合 `finally` 代码块确保一定会执行解绑（如我们在 `executeDualTrackDryRun` 升级中所做的那样）。
*   **原生 API 假死保护**: 调用宿主异步 API（如 `worldInfoFn` 或 `generateFn`）时，**必须套上一层 `Promise.race` 超时锁**，以防在移动端或弱网环境下导致永久卡死。

### 3.2 剧情引擎 V2 架构防线 (规划中)
*   **解耦防线**: 
    *   **严禁**将大量的“节点关系图谱”或长篇幕间设定直接塞入主模型的系统提示词中。
    *   **严禁**要求用户手动修改酒馆本体的预设来适配本插件。
*   **存储防线**:
    *   **剧情的坐标（节点 ID）** 绝不允许写入全局 `sys_config`。必须存储于与“当前聊天会话”强绑定的酒馆变量中。这是保证用户随意切换聊天、Swipe 回滚时，进度能 100% 自动同步的**唯一方法**。
    *   **剧情的分析“思路 (CoT)”** 绝不允许直接暴露在用户的渲染层。必须利用酒馆扩展 API，在即将向主模型发起请求的最终时刻，幽灵注入（Inject）或将文本存入带有隐藏标签的不可见包裹块中，并且确保屏蔽规则要在数据库插件等其他拦截器之前生效。
*   **小模型（次级 API）自由度收束**:
    *   小模型的系统提示词必须包含“演绎建议清单”，只能给出客观推导方向（如：“建议推进至撤退环节”），**严禁**替主模型直接编写角色台词与具体动作。