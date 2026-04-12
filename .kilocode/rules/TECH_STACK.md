# 项目技术与架构规范 (TECH_STACK)

本文档定义了项目中具象化的编码规范和技术选型约定，是对 `AGENTS_README.md` 的技术补充。所有 Agent 在编写相关逻辑时，必须严格遵守本文件中的约定。

## 1. 跨模块事件通信 (Event System)

### 1.1 原则与背景
为了打破历史遗留的自制 `ArkEventBus` 所带来的模型“知识盲区”并兼顾类型安全，项目已全面迁移至**基于强类型的原生 `CustomEvent`** 模型。

通过扩展全局 `DocumentEventMap` (见 `src/ARK_STATUSBAR/types/ark_events.d.ts`)，我们实现了利用浏览器原生 `document.addEventListener` 和 `document.dispatchEvent` 进行的模块间解耦通信，同时保证了 `TypeScript` 的编译期拦截能力。

### 1.2 强制规范 (MUST DO)

*   **禁止自造轮子**：绝对禁止引入或实现类似 `mitt` 或自己手写的 EventBus 实例。所有跨模块通信**必须**使用原生的 `CustomEvent`。
*   **必须在声明中注册**：在发送或监听任何一个全新的自定义事件前，**必须**先在 `src/ARK_STATUSBAR/types/ark_events.d.ts` 中的 `DocumentEventMap` 接口里添加带有完整注释的强类型定义。
    *   格式必须使用命名空间前缀 `ark:`，并在 `detail` 泛型中定义数据结构：
        ```typescript
        'ark:my-new-event': CustomEvent<{ foo: string; bar: number }>;
        ```
*   **发送事件**：
    必须严格包裹在 `CustomEvent` 对象中并使用 `detail` 承载数据：
    ```typescript
    document.dispatchEvent(
      new CustomEvent('ark:log-debug', { detail: { message: 'hello', isDryRun: true } })
    );
    ```
*   **监听与解绑防漏**：
    由于原生 DOM 事件容易导致内存泄漏（特别是热重载或 Vue 组件销毁时），**必须遵循严格的配对解绑规范**。
    ```typescript
    // 正确的做法：将回调显式赋值给具备具体类型的变量，用于精准解绑
    let myListener: (e: CustomEvent) => void;

    onMounted(() => {
      myListener = (e: CustomEvent) => {
        console.log(e.detail.message);
      };
      // 直接作为 EventListener 传入
      document.addEventListener('ark:log-debug', myListener);
    });

    onUnmounted(() => {
      // 必须在这里解绑，防止热重载堆积！
      document.removeEventListener('ark:log-debug', myListener);
    });
    ```

---
*更多模块的具象规范将随工程进展补充于此...*
