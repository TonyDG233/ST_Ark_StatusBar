# 详细规划 1: 事件系统的强类型化与原生化重构

**日期：** 2026-04-13
**所属主规划：** `SYSTEM_REFACTOR_MASTER_PLAN.md` -> 阶段 1

---

## 1. 核心目标与工作内容

当前项目使用的 `src/ARK_STATUSBAR/core/event_bus.ts` 虽然实现了跨模块解耦，但它作为一个“非标”的自制轮子，导致了以下严重问题：
1. 大模型在面对自制事件总线时存在认知盲区，容易写出没有解绑的原生事件。
2. 缺乏强类型约束，甚至部分组件内已经混用了原生的 `CustomEvent`（如 `GlobalStatusBar.vue` 中的 `ark-interceptor-triggered`）。

**工作内容：**
1. **全局类型声明定义**：新增或在现有的 `.d.ts` 文件中，通过扩展全局 `DocumentEventMap` 接口，定义项目中所有的跨模块通信事件。
2. **替换发布逻辑**：将所有的 `ArkEventBus.emit('event', payload)` 替换为标准的 `document.dispatchEvent(new CustomEvent('ark:event', { detail: payload }))`。
3. **替换订阅逻辑**：将所有的 `ArkEventBus.on('event', callback)` 替换为 `document.addEventListener('ark:event', (e) => { ... })`。
4. **强制生命周期解绑审计**：针对所有 `document.addEventListener`，必须检查并在对应的销毁环节（Vue 的 `onUnmounted`，或单例类的 `destroy()` 方法中）添加 `removeEventListener`。

---

## 2. 涉及的文件与修改规模评估

通过全面的代码库检索（`search_files` 验证），当前受影响的代码分布如下：

**待删除文件（1个）：**
- 🗑️ `src/ARK_STATUSBAR/core/event_bus.ts` （约 106 行）

**待新增/修改定义文件（1个）：**
- 🆕 `src/ARK_STATUSBAR/types/ark_events.d.ts`（用于承载 `declare global { interface DocumentEventMap { ... } }`）

**需要机械性替换的发信/收信端（约 10 个逻辑文件，约 40 处调用）：**
- `src/ARK_STATUSBAR/index.ts`
- `src/ARK_STATUSBAR/core/config_store.ts`
- `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- `src/ARK_STATUSBAR/logic/worldbook/entry_service.ts`
- `src/ARK_STATUSBAR/logic/worldbook/worldbook_automator.ts`
- `src/ARK_STATUSBAR/logic/worldbook/logger.ts`
- `src/ARK_STATUSBAR/logic/worldbook/send_interceptor.ts`
- `src/ARK_STATUSBAR/logic/worldbook/snapshot_service.ts`
- `src/ARK_STATUSBAR/components/global_tabs/shared_ui_state.ts`

**需要重点审计防内存泄漏的 Vue/UI 文件：**
- `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
  *(已知问题：当前在 `onMounted` 中挂载了 `ark-interceptor-triggered` 和 `ark-config-updated`，但在 `onUnmounted` 中未执行 `removeEventListener`，必须在此次一并修复。)*

**修改规模评估：** 中等。逻辑极其简单直接（纯查找替换与类型补充），但波及范围广。

---

## 3. 风险评估与防范措施

### ⚠️ 风险 1: TypeScript 编译报错与类型不匹配
由于我们将 `ArkEventBus` 的多参数传递（如 `ArkEventBus.emit('log:debug', message, isDryRun)`）转换为 `CustomEvent`，原生事件只允许传递单个 `detail` 对象。
**防范措施**：在定义 `DocumentEventMap` 时，必须将原先的多个参数打包为一个 `detail` 对象。例如：
```typescript
'ark:log-debug': CustomEvent<{ message: string; isDryRun?: boolean }>;
```
替换时，必须同步将发送端改为 `{ detail: { message: "...", isDryRun: true } }`。

### ⚠️ 风险 2: `this` 上下文与回调函数引用的丢失
在将 `ArkEventBus.on` 改为 `document.addEventListener` 时，如果不使用箭头函数，或者在 `removeEventListener` 时无法提供完全相同的函数引用，会导致解绑失败。
**防范措施**：
对于类中的监听器，强制在类中声明形如 `private handleMyEvent = (e: CustomEvent) => { ... }` 的箭头函数属性，确保 `add` 和 `remove` 传入的函数引用绝对一致。

### ⚠️ 风险 3: 命名空间冲突
**防范措施**：所有事件名强制加上 `ark:` 前缀（例如：`ark:system:toggle`，`ark:worldbook:data_changed`），以此与酒馆原生事件彻底隔离开来，并且可以在搜索代码时一眼识别。