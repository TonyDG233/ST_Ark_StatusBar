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

## 2. 模块结构划分 (当前：平级模块化微后端架构)
本项目已从单体应用彻底演进为五大平级模块，严禁反向依赖与层级污染：
*   **`src/ARK_STATUSBAR/types/` (系统契约与防腐层)**
    *   独立存放 `system_config.ts` (如 ArkConfig, ArkCommit)，作为跨模块流转数据的唯一合法接口契约（DTO）。
    *   (规划中) 包含数据清洗 Mapper，将原生黑盒数据转换为前端纯净类型，阻断原生 API 变动污染。
*   **`src/ARK_STATUSBAR/core/` (纯净核心基建)**
    *   包含响应式配置中心 (`config_store.ts`) 与纯内存事件总线 (`event_bus.ts`)。
    *   已移出所有具有写库副作用（如 `logger`）的业务代码，允许上层 UI 平级调用。
*   **`src/ARK_STATUSBAR/data/` (静态业务数据区)**
    *   只存放纯静态配置（如 `baseline.ts`, `scenarios.ts`），供业务逻辑单向读取。
*   **`src/ARK_STATUSBAR/logic/` (后端业务门面与服务)**
    *   **第一层 (Facade)**: `StatusBarManager.ts` 等统一对外接口类，封装底层杂乱的执行流，供前端组件单点调用。
    *   **第二层 (Domain Services)**: 按领域（如 `worldbook/`）垂直划分的底层服务，包含 `entry_service`, `snapshot_service`, `logger`, `interceptor`。它们唯一拥有直接操作宿主环境 (SillyTavern 原生世界书) 的权限。
*   **`src/ARK_STATUSBAR/components/` (微后端 UI 切片)**
    *   外壳 (`GlobalStatusBar.vue`) 仅做拖拽挂载，具体业务按功能分布至 `global_tabs/` 内。
    *   **响应式数据中枢 (`shared_ui_state.ts`)**: 通过监听 `worldbook:data_changed` 总线事件及 `WORLDINFO_UPDATED` 等原生事件，实现后端数据库（SSOT）到前端界面的单向数据自动刷新。严禁各 Tab 手动修改缓存！

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