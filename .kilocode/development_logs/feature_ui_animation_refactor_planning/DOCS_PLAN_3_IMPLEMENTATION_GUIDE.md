# 详细规划 3：拦截器性能重构与 UI 监听解耦

**日期：** 2026-04-13
**背景：** 在解决了全局生命周期竞态问题后，系统最大的痛点落在发信拦截阶段 (`send_interceptor.ts`) 以及 UI 对此结果的处理上 (`GlobalStatusBar.vue`)。核心问题表现为：
1. **性能卡顿诱发“静默放行”**：Token 计算开销大，导致干跑超时（默认 8 秒），超时后代码直接判定为 `entries.length === 0` 并自动放行了未检测完的数据，产生严重漏拦。
2. **闭包幽灵事件（重复冒出同名条目）**：干跑超时后取消了监听器，但酒馆原生的耗时管线还在跑。当下一次发信时，残留的 `world_info_activated` 事件与新事件叠加，造成 UI 上同一词条出现多次。
3. **UI 越界仲裁**：`GlobalStatusBar.vue` 越权监听拦截结果，并在其内部过滤 constant 条目甚至直接调用 `releaseInterceptAndSend()`，破坏了 MVC 边界。

---

## 重构目标

### 1. 监听器的物理剥离与职责重置 (Decoupling Listeners)
*   **清理 `GlobalStatusBar.vue`**：
    *   **删除** `ark-interceptor-triggered` 监听。UI 不应参与业务过滤和放行仲裁。
    *   **删除** `ark-config-updated` 和 `ark:system-chat-changed` 内部加载世界书数据的逻辑（如 `loadPrimaryWorldbookName()`）。
    *   **保留** 纯视觉响应事件（如 `ark:system-toggle`, `resize`, `ark:worldbook-baseline-diff-detected` 等警告通知）。
*   **下沉数据请求至 `shared_ui_state.ts`**：
    *   将 Vue 中删除的 `loadWorldbookLists` 和 `loadPrimaryWorldbookName` 挪至此，作为响应式逻辑（当配置或环境变动时，它自动去请求数据并刷新自己的 `ref`）。
*   **建立 `InterceptorController` (或并入 `send_interceptor.ts`)**：
    *   由专门的控制器负责抛出 `ark-interceptor-triggered` 前的业务逻辑：包括过滤掉不需要警告的 constant 条目，如果过滤后列表为空，**由后端直接** `releaseInterceptAndSend()`；如果不为空，才通过事件将干净的列表送给 `shared_ui_state`，供 UI 绑定展示。

### 2. 拦截管线性能容忍与显式阻断 (Performance & Explicit Timeout)
*   **请求流水号防穿透 (Request ID Guard)**：
    在 `send_interceptor.ts` 的 `executeDualTrackDryRun` 顶部，生成一个唯一的 `runId = Date.now()`。在监听 `world_info_activated` 和 `chat_completion_prompt_ready` 的回调内，如果发现传入的数据属于上一个超时的 `runId`，**直接 `return` 丢弃**。彻底掐断由于卡顿引起的事件叠加。
*   **拉长最大超时与强制告警**：
    *   将原先苛刻的 5s/8s 超时时间适当拉长（如 8s/15s）。
    *   **严禁静默放行**！当遇到真正的 `timeoutError` 时，必须调用 `toastr.error('世界书检测超时，请检查配置或稍后重试。')` 强制挂起系统，让用户明确知道为什么没发出去，绝对不能直接执行 `releaseInterceptAndSend()`。

### 3. 提供性能优化选项与开关 (Opt-in Token Calculation)
由于 Token 计算的性能开销极高，必须将其从必选项降级为可选项。
*   **新增系统配置项**：在 `system_config.ts` (或现有的 `ArkConfig` 接口) 中新增 `enableTokenCalculator: boolean`（默认可设为 `false`）。
*   **控制管线短路**：在 `executeDualTrackDryRun` 中：
    ```typescript
    if (config.enableTokenCalculator) {
        // 执行第二轨：Token 假生成计算
        await executeTokenTrack();
    } else {
        tokenCount = '计算已关闭';
    }
    ```
*   这不仅极大改善了低配终端或手机端用户的发信体验，也为后续探索更轻量级的 `getTokenCountAsync` 等 API 方案留下了干净的隔离空间。

---

## 执行拆解 (Action Plan for Code Mode)

1. **Step 1: 修改配置与拦截器核心逻辑**
   - 更新 `src/ARK_STATUSBAR/types/system_config.ts`，加入 `enableTokenCalculator`。
   - 打开 `src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts`，引入 Request ID 防范闭包泄漏，重写 catch 逻辑实现超时强阻断，并在第二轨逻辑外包上配置开关。
2. **Step 2: 收回仲裁权与处理返回逻辑**
   - 仍在 `send_interceptor.ts` 的末尾（统合抛出预警结果处）：进行 Constant 条目的过滤。如果最终拦截列表为 0，在此文件内直接执行 `this.releaseInterceptAndSend()`。否则，再抛出事件。
3. **Step 3: 净化 Vue 视图**
   - 削减 `src/ARK_STATUSBAR/components/GlobalStatusBar.vue` 中的越权监听，仅保留对 `pendingEntries` 的被动观测（watch）。
   - 将必要的数据加载初始化逻辑转移到 `src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts`。