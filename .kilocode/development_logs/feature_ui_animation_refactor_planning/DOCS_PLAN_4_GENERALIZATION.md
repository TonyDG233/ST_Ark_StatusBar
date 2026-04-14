# 插件泛用化适配规划 (Generalization Plan)

## 目标与背景
经过前几轮的重构，核心的挂载管线与数据拦截已经趋于稳定。但目前的某些功能强耦合于《明日方舟》定制角色卡（尤其是开局设定 UI、返回按钮，以及历史标签页的 Baseline 一键重置）。
为提升该酒馆助手的泛用性，我们需要让它对普通角色卡“隐身”，或者只暴露非破坏性的功能（如世界书快照保存）。

---

## 核心实现思路

### 1. 角色卡鉴别逻辑 (`shared_ui_state.ts` & `index.ts`)
*   **实现方式**: 利用原生接口 `@types/function/character.d.ts` 中的 `getCurrentCharacterName()`。
*   **状态维护**: 在 `shared_ui_state.ts` 中新增一个响应式引用 `isArknightsCard`。每次调用 `loadPrimaryWorldbookName()`（切换聊天时会触发）时同步更新该状态。

### 2. 管线阻断: 开局 UI 与 返回按钮 (`src/ARK_STATUSBAR/index.ts`)
*   **修改点**: `startMountingLoop`。
*   **执行逻辑**: 在获取第 0 楼信息后，判断 `getCurrentCharacterName()`。如果不包含 `"明日方舟"`，则**拦截后续的挂载逻辑**。
*   **兜底卸载**: 当用户从“明日方舟角色”切换到“普通角色”时，如果当前楼层残留了 `STARTUP_CONTAINER_CLASS` 或 `RETURN_BTN_CONTAINER_CLASS` 的 DOM，则触发强制卸载和移除，确保普通角色卡不显示任何专属 UI。
*   **注意**: `GlobalStatusBar.vue`（全局顶部状态栏）由于承载了快照、配置等泛用功能，不应该被完全屏蔽，所以不在此处拦截它的注入。

### 3. 危险操作的物理屏蔽 (`HistoryTab.vue`)
*   **修改点**: 针对 `<!-- 危险操作区域 (白细框包围) -->`。
*   **执行逻辑**: 引入 `isArknightsCard` 状态，对该外层容器施加 `v-if="isArknightsCard"`。
*   **效果**: 对于非明日方舟角色，“恢复初始状态 (Baseline)” 和 “屏蔽所有单字干员” 这两个强耦合特定配置的按钮将完全消失，防止误触导致世界书逻辑崩溃。

### 4. 无 Baseline 保护警告与快照引导 (`HistoryTab.vue`)
*   **实现方式**: 增加一个计算属性 `hasSnapshotForPrimary`，实时检测 `currentConfig.snapshots` 中是否存在当前主书的快照。
*   **渲染逻辑**: 在快照管理面板上方新增一个警告框 (`v-if="!isArknightsCard && !hasSnapshotForPrimary && currentPrimaryWorldbook"`)。
*   **文案提示**: “检测到当前角色卡世界书尚无快照。在您首次操作世界书前，强烈建议您拍摄一张快照，以便在需要时无损回滚。”

---

## 预期效果
1.  切换到非“明日方舟”角色卡时，开局 UI 和剧情模式的“返回按钮”均不再渲染。
2.  顶部的全局控制台照常运行。
3.  打开控制台的“历史”页面，危险的 Baseline 重置按钮将隐藏。
4.  如果没有为当前角色的主世界书拍摄过快照，将出现醒目的红框提示，引导用户主动存盘。

---
*规划编写完毕，下一步将进行试探性代码注入。*