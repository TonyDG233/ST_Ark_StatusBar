# 06 数据脱节清算与事件驱动同步架构升级 (06_data_sync_architecture_upgrade.md)

## 1. 架构偏航的背景与问题诊断 (Background & Problem Diagnosis)

在 `05_frontend_architecture_master_plan.md` 的指导下，我们成功地将庞大的 `GlobalStatusBar.vue` 垂直切分为四个自治的业务分页（Tab1-4）。为了解决拆分后组件间的“状态胶水”问题，我们引入了 `shared_ui_state.ts`（Level 2 跨页状态胶水）。

**但在这里，我们犯下了一个严重的架构设计错误：**
我们将 `worldbookEntriesCache` 作为一个“静态的缓存对象”存放在了共享中心。
这导致所有子组件在向酒馆底层发送修改指令后（例如 Tab3 批量撤销修改、Tab1 拦截器临时关闭条目），不得不**手动去遍历并覆写这个 Cache**。

### 1.1 “自欺欺人”的同步带来的四大灾难
1. **职责越界与高耦合**：Tab1（拦截器）、Tab3（历史）为了更新状态，内部充斥着本该属于 Tab2（世界书列表）的数据结构预测逻辑。
2. **逻辑漏洞百出**：在批量操作（如快照恢复、恢复基准线、批量撤销）中，开发者极易忘记编写同步补丁，导致底层数据库已变更，但 UI 依然显示旧数据（死锁、假死）。
3. **彻底丧失外部响应能力**：如果用户绕过插件，直接在酒馆原生的侧边栏编辑了世界书条目，我们的缓存会完全失效，变成了“睁眼瞎”。
4. **违背单向数据流原则**：UI 组件既是数据的消费者，又试图成为数据的直接修改者，造成了经典的数据撕裂（Tearing）。

---

## 2. 架构升级目标：零幻觉、单向数据流、外部响应 (The Architectural Upgrade)

本次小型架构升级的目标，是彻底废除“前端组件手动修补全局 Cache”的陈旧模式。
我们将 `shared_ui_state.ts` 从一个“被动挨打的僵尸变量堆”升级为**拥有主动订阅和自动更新能力的“智能响应式数据总闸” (Reactive Data Hub)**。

### 2.1 核心原则
*   **组件自治原则 (Level 3 制约)**：所有的 Tab 子组件（View/ViewModel）**绝对禁止**任何直接对 `worldbookEntriesCache` 等全局共享数据进行赋值、修改或遍历覆盖的行为。它们只能发起底层命令 (`manager.xxx()`)，然后静静等待数据的变化。
*   **唯一的真实数据源 (Single Source of Truth)**：`worldbookEntriesCache` 必须永远是酒馆原生底层数据的一对一“倒影”。
*   **事件驱动拉取 (Event-Driven Re-fetching)**：数据总闸通过监听原生事件或底层黑盒发出的自定义事件，主动触发真实数据的拉取与覆盖，进而驱动全 UI 的响应式重绘。

---

## 3. 具体实施方案与职责划分 (Implementation Plan & Responsibilities)

### 3.1 核心改动 1：彻底清理各组件中的“同步补丁” (Clean up the ViewModel)
我们将遍历 `WorldbookTab.vue`、`HistoryTab.vue` 和 `InterceptorTab.vue`，删除所有形如以下的代码：
```typescript
// 必须被彻底删除的反模式代码：
const cacheEntries = worldbookEntriesCache.value[targetWorldbook];
if (cacheEntries) {
  const cached = cacheEntries.find(e => e.uid === entry.uid);
  if (cached) cached.enabled = entry.enabled;
}
```
**组件的任务简化为：仅仅抛出对 manager 底层的修改调用。**

### 3.2 核心改动 2：强化 `shared_ui_state.ts` 为“智能数据总闸” (The Reactive Data Hub)
原本 `shared_ui_state.ts` 仅仅是一堆 `ref` 导出。现在，我们要在这个文件内部，或者在其同级的初始化函数（例如专门暴露一个 `initializeSharedState()` 给外壳调用）中，**封入事件监听和数据重载的逻辑**。

这里明确指出了外壳与信息中心的职责边界：
*   **外壳 (`GlobalStatusBar.vue`)**：负责初始化环境（如判断系统开关），并在挂载时调用信息中心的初始化方法。它不涉及具体数据的维护。
*   **信息中心 (`shared_ui_state.ts`)**：作为数据总闸，它自己**内部**挂载并维护对酒馆原生事件的监听。

**具体的内部监听机制设计：**

1.  **挂载原生事件监听 (The Ultimate Fallback)**：
    利用 `@types/iframe/event.d.ts` 中的接口，监听 `tavern_events.WORLDINFO_UPDATED` 和 `WORLDINFO_ENTRIES_LOADED`。
    这是最坚固的底线：只要酒馆自身认定世界书改变了（无论是因为我们的操作，还是用户在外部的编辑），我们都能捕获到。

2.  **挂载内部黑盒抛出的事件 (The Fast-Track)**：
    如果原生事件在某些极端情况下没有如期触发，我们需要在 `StatusBarManager` 的写库方法（如 `updateWorldbookWith`）完成后，向 `document` 派发 `ark-worldbook-data-changed` 的补救事件。
    信息中心同样监听这个事件。

3.  **触发重载 (The Smart Re-fetch)**：
    当上述任意监听器捕获到“某本世界书发生变动”的信号时，信息中心执行以下核心判断：
    ```typescript
    // shared_ui_state.ts 中的核心同步逻辑骨架
    export const refreshWorldbookCache = async (wbName: string) => {
        // 如果当前 UI 并没有展示这本书（既没有展开手风琴，也不是主书），则跳过，节省性能
        if (!expandedWorldbooks.value.includes(wbName) && currentPrimaryWorldbook.value !== wbName) return;

        try {
            // 直接向酒馆底层请求真实数据
            const entries = await getWorldbook(wbName);
            // 过滤系统内置条目后覆盖 Cache
            worldbookEntriesCache.value[wbName] = entries.filter(e => 
                !(e.name && e.name.startsWith(CONFIG_ENTRY_PREFIX)) &&
                !(e.comment && e.comment.startsWith(CONFIG_ENTRY_PREFIX))
            );
        } catch (e) {
            console.error(`[ARK_UI_STATE] Failed to refresh cache for ${wbName}`, e);
        }
    };
    ```

### 3.3 核心改动 3：外壳层的初始化职责修正 (Initialize in GlobalStatusBar)
在 `GlobalStatusBar.vue`（外壳退化层）的 `onMounted` 钩子中，我们需要剥离那些原本写死在这里的、不属于外壳的拦截器判定逻辑。
外壳只需要在挂载时，调用一次信息中心暴露的 `setupGlobalListeners()` 方法，激活事件总线即可。

---

## 4. 预期收益 (Expected Outcomes)
1. **代码大幅瘦身**：三大 Tab 组件将减去上百行的、极其脆弱的手动缓存同步代码。
2. **逻辑绝对坚固**：不论是单条修改、批量撤销、快照恢复、开局剧情应用，甚至是用户手贱在界面外改了设置，全链路统一汇聚到一处，强制刷新真实数据，彻底告别死锁和脱节。
3. **架构完全贴合 05 总纲**：真正实现了 `Level 2`（跨页状态胶水）应有的高度：**它不是被组件玩弄的静态对象，而是主动监听世界并分发倒影的智能生命。**

## 5. 执行顺序清单 (Checklist for Execution)
1. 在 `shared_ui_state.ts` 中封装 `refreshWorldbookCache` 方法和 `setupGlobalListeners` 监听池。
2. 在 `GlobalStatusBar.vue` 初始化时调用 `setupGlobalListeners`。
3. 清理 `WorldbookTab.vue` 中 `toggleEntry` 和 `toggleEntryType` 里的 Cache 修改补丁。
4. 清理 `HistoryTab.vue` 中所有涉及重置、撤销、屏蔽单字后的强制刷新或 Cache 补丁。
5. 清理 `InterceptorTab.vue` 中所有为了模拟 Tab2 状态而写的数据拼贴逻辑。
6. 测试并确认通过原生酒馆面板修改世界书时，我们的插件能做到毫秒级同步变色。