# 开发日志 046：修复后端任务队列注入失败问题

**日期**: 2026-01-27
**作者**: Kilo Code
**状态**: 方案设计 - 待审批

---

## 1. 问题描述 (Symptom)

在 Phase 3 的后端逻辑修复中，尽管 `session_started` 旗标机制成功激活了 `VARIABLE_UPDATE_ENDED` 事件监听器，并且日志明确显示 `[ARK_Character]` 模块正在 "Pushing new task"，但最终的 `stat_data.task_queue` 数组始终为空。这表明由后端逻辑生成的任务未能被正确地持久化到 MVU 变量中。

## 2. 根本原因分析 (Root Cause Analysis)

经过对 MVU 框架规则、接口定义以及 `global.ts`, `character.ts`, `player.ts`, `chronicle.ts` 的源码进行联合分析，根本原因被定位在 `src/ARK_STATUSBAR/logic/updaters/global.ts` 的主事件循环处理逻辑中。

**核心错误**：**错误地使用了 `cloneDeep`，破坏了 MVU 事件监听器的引用传递机制。**

详细流程如下：

1.  **事件触发**: `VARIABLE_UPDATE_ENDED` 事件被触发，并向回调函数传递了 `newVariables` 和 `oldVariables` 两个对象。根据 MVU 的设计，`newVariables` 对象是**可变的 (mutable)**，框架期望监听器直接修改这个对象的属性来应用额外的逻辑变更。

2.  **致命的克隆**: 在 `global.ts` 的第 123 行，代码执行了 `const mutableVariables = cloneDeep(newVariables);`。此操作创建了 `newVariables` 的一个**全新深拷贝副本**。从这一刻起，`mutableVariables` 和 `newVariables` 指向了内存中完全不同的两个对象。

3.  **在副本上操作**: 随后，这个副本 `mutableVariables` 被传递给了 `processCharacterUpdates` 等所有子模块。子模块（如 `character.ts`）忠实地执行了任务，将新的 `task` 对象 `push` 到了它们接收到的变量对象的 `task_queue` 数组中。然而，它们修改的是**副本的 `task_queue`**。

4.  **原始对象未变**: 在此期间，原始的 `newVariables` 对象从未被触及，其 `task_queue` 依然为空。

5.  **无效的写回**: 代码在第 131 行尝试通过 `Mvu.replaceMvuData(mutableVariables);` 将修改后的**副本**写回系统。这不仅是多余的，而且是无效的。`VARIABLE_UPDATE_ENDED` 事件处理是一个原子操作，当回调函数执行完毕后，MVU 框架会继续处理**原始的、被修改过的 `newVariables` 对象**。在这个回调内部发起一个新的 `replaceMvuData` 调用，无法影响当前正在进行的更新流程。

**结论**: 所有后端任务都被成功地添加到了一个临时的、注定被销毁的变量副本中，导致了任务注入的完全失败。

## 3. 解决方案 (Solution)

解决方案的核心是回归 MVU 的设计初衷：**直接、原地修改 (in-place mutation) 由事件监听器传入的 `newVariables` 对象**。

### 3.1 核心修改 (`global.ts`)

在 `src/ARK_STATUSBAR/logic/updaters/global.ts` 的 `eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, ...)` 回调函数内部：

1.  **【移除】** 删除 `const mutableVariables = cloneDeep(newVariables);`。
2.  **【移除】** 删除 `Mvu.replaceMvuData(mutableVariables);`。
3.  **【修改】** 将所有对 `mutableVariables` 的调用，全部改为直接使用 `newVariables`。

**修改后代码示例 (`global.ts`):**
```typescript
// ...
eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async (newVariables, oldVariables) => {
  // Main Gate: ... (gate logic remains the same)

  console.log(`${LOG_PREFIX} Main Backend Loop Triggered.`);
  
  // 直接在 newVariables 上操作
  await processCharacterUpdates(newVariables, oldVariables);
  await processPlayerUpdates(newVariables, oldVariables);
  await processChronicleUpdates(newVariables, oldVariables);
  await processGlobalUpdates(newVariables, oldVariables);

  console.log(`${LOG_PREFIX} Main Backend Loop Finished.`);
});
// ...
```

### 3.2 代码优化与健壮性提升 (所有 `updater` 子模块)

为了确保代码的清晰性和一致性，并消除潜在的副作用，对所有子模块 (`character.ts`, `player.ts`, `chronicle.ts`) 的 `process...Updates` 函数进行以下优化：

1.  **【移除】** 移除函数内部创建局部 `taskQueue` 变量的逻辑，如 `let taskQueue = get(newVariables, 'stat_data.task_queue', []);`。
2.  **【移除】** 移除函数末尾多余的 `set(newVariables, 'stat_data.task_queue', taskQueue);` 写回操作。

**修改后代码示例 (`character.ts`):**
```typescript
// ...
export async function processCharacterUpdates(newVariables, oldVariables) {
  console.log(`${LOG_PREFIX} Processing character updates...`);

  // 直接获取 task_queue 的引用
  const taskQueue = get(newVariables, 'stat_data.task_queue', []);

  // ... (模块内部逻辑不变, 像 initializeNewCharacters(newVariables, taskQueue) 这样的调用依然有效)
  
  initializeNewCharacters(newVariables, taskQueue);
  
  // ... 其他逻辑 ...

  // 移除末尾的 set 操作，因为对 taskQueue 的所有修改已经直接作用于 newVariables
  // set(newVariables, 'stat_data.task_queue', taskQueue);

  console.log(`${LOG_PREFIX} Character update cycle finished.`);
}
// ...
```
这个优化是可选的，但强烈推荐。因为 `taskQueue` 是 `newVariables.stat_data.task_queue` 的引用，`pushTask(taskQueue, ...)` 已经直接修改了 `newVariables`。移除 `set` 可以让代码意图更清晰。

## 4. 潜在问题与风险分析 (Potential Issues & Risk Analysis)

根据您的要求，我对本次修改可能导致的潜在问题进行了深入思考：

1.  **风险：意外的副作用 (Unintended Side Effects)**
    *   **描述**: 移除 `cloneDeep` 意味着现在所有模块都在同一个对象上操作。如果某个模块的逻辑有缺陷（例如，错误地删除了一个不该删除的属性），这个缺陷会立刻影响到后续所有模块的执行，甚至可能污染最终的变量状态。`cloneDeep` 在之前无意中起到了一个“沙箱”的作用，隔离了各个模块。
    *   **缓解措施**:
        *   **严格的函数签名**: 确保所有 `process...Updates` 函数都明确只接收 `newVariables` 和 `oldVariables`，并且其文档注释清晰地说明了它们会直接修改 `newVariables`。
        *   **最小化修改范围**: 每个模块应只修改其负责的变量部分（例如，`character.ts` 只修改 `stat_data.characters` 和 `stat_data.task_queue`）。
        *   **代码审查**: 在应用修改后，需要仔细审查每个子模块的逻辑，确保没有“越界”修改其他模块数据的行为。

2.  **风险：竞争条件 (Race Conditions) - 低风险**
    *   **描述**: 虽然 `VARIABLE_UPDATE_ENDED` 的回调是异步的 (`async`)，但 JavaScript 的事件循环机制保证了在 `await` 之外的代码是同步执行的。这意味着在单个事件回调的生命周期内，各个 `process...` 函数是按顺序 (`await`) 执行的，它们之间不存在竞争条件。
    *   **缓解措施**: 风险较低，当前的设计（顺序 `await` 调用）已经避免了此问题。需要注意的是，未来如果引入了并行的 `Promise.all` 等操作，则需要仔细评估模块间的依赖关系。

3.  **风险：对 `oldVariables` 的意外修改 - 中风险**
    *   **描述**: 之前由于 `cloneDeep` 的存在，`oldVariables` 相对安全。现在，开发人员可能会不小心将 `oldVariables` 误传给某个期望修改变量的函数，或者在逻辑中错误地修改了 `oldVariables` 的属性。虽然 `oldVariables` 在概念上是只读的，但代码层面并没有强制约束。
    *   **缓解措施**:
        *   **命名约定**: 严格遵守 `newVariables` (可写) 和 `oldVariables` (只读) 的命名，并在团队内强调这一约定。
        *   **类型系统**: 在 TypeScript 中，可以考虑使用 `Readonly<T>` 类型来标记 `oldVariables`，让编译器辅助检查意外的修改。`eventOn(..., (newVars: MvuData, oldVars: Readonly<MvuData>) => ...)`。
        *   **防御性编程**: 在各个子模块的开头，可以考虑对 `oldVariables` 进行一次 `cloneDeep`，如果确实需要基于它进行复杂的计算，以防止意外污染。但目前来看，非必要。

**总结**: 核心风险在于从“隐式沙箱”切换到“共享状态”后，对代码质量和开发规范的要求更高了。只要确保每个模块都遵守“最小权限原则”，只修改自己负责的数据，这次重构就是安全且高效的。

## 5. 审批请求

请求您审阅此份开发日志。如果方案获得批准，我将立即着手实施代码修改。
