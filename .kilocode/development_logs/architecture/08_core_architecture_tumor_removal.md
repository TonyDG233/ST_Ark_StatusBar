# 08 核心架构毒瘤切除：数据规范防线与事件监听解耦 (08_core_architecture_tumor_removal.md)

## 1. 核心问题诊断与认知矫正 (Critical Diagnosis & Paradigm Shift)

在经过深度的代码研读与探讨后，我们发现之前的架构规划陷入了严重的“教条主义”误区（试图在业务门面 Facade 中强塞无意义的 Interface 与依赖注入）。这对于一个以浏览器为唯一宿主、以酒馆原生 API 为唯一底层生态的前端插件而言，是纯粹的脱裤子放屁。

我们必须回归务实，重新定义当前架构中真正危害系统健康的两大毒瘤：

### 1.1 毒瘤一：数据防腐转译层 (Data Mapper & DTO) 缺失导致 `any` 泛滥与 AI 幻觉
*   **现状**：目前系统从酒馆（SillyTavern）底层拉取的原生数据（如 `WorldbookEntry`）极度庞大、且不同版本之间存在字段错位（如 `keys` 和 `key`）。由于缺乏转译，这些脏数据带着大量的 `any` 直接流窜到了我们的 Vue 组件（`shared_ui_state`）和业务逻辑（`snapshot_service`）中。
*   **致死风险**：
    1.  业务层被迫写满了 `(e as any).strategy = {}` 和 `(e as any).constant = true` 这种强行干预酒馆原生数据结构的暴民代码，极易在保存时引发底层崩溃。
    2.  **大模型幻觉的温床**：如果没有在 `types/` 目录下用 Interface/Type 严格定义内部数据的形状，大模型在编写代码时会凭空捏造不存在的属性，这才是引发不可控 Bug 的根源。

### 1.2 毒瘤二：Facade（门面）的畸形与职责越界
*   **现状**：目前的 `StatusBarManager.ts` 名为门面，实则在 `init()` 方法中塞满了一百多行关于 `GENERATION_ENDED` 后恢复临时屏蔽条目、校验 Baseline 差异的原生事件监听与业务逻辑。
*   **致死风险**：它既当“前台”，又干着“暗中监控”的脏活。当未来引入 `Story Engine V2` 这种包含无数复杂事件监听的庞大模块时，这个门面将迅速膨胀为不可维护的 3000 行屎山。

---

## 2. 务实的切除方案与架构蓝图 (Pragmatic Solution)

我们抛弃无意义的门面接口，确立以下务实的架构防线：

### 2.1 方案一：强类型数据规范与转译防线 (Typed DTO & Translation Layer)
**这是本次重构的最高优先级任务。**
作用就如同 ARM 跑 x86 软件时的 Rosetta 2 转译器，绝不让复杂的外部结构污染内部高效的系统。

1.  **契约先行 (Interface as Data Contract)**：
    *   在新建的 `types/domain_models.ts` 中，使用 `export interface` 严格定义内部业务所需的纯净数据结构（如 `ArkWorldbookEntry`）。
    *   **架构意义**：这套类型定义将作为所有非 private 函数的参数结构参考，成为一份不依赖外部项目文件就能学习调用的**核心参考文档**（类似 `@types` 的作用）。强迫 AI 与开发者在动工前明确数据结构，彻底规避幻觉。
2.  **转译器拦截 (The Mapper)**：
    *   在 `logic/` 的业务入口处（如 `entry_service` 获取 `getWorldbook()` 后），**必须通过转译器将原生脏数据清洗、适配为上述的纯净结构**。
    *   **原则**：需要获取数据时，从转译层拉取（`fromRaw`）；需要修改酒馆数据时，必须在转译层闭环里，谨慎对照原生对象进行推送（`toRaw` 局部覆盖）。

### 2.2 方案二：门面去业务化与独立事件监听器 (Decoupled Automators)
让门面重回极简的路由本职。

1.  **门面绝对纯净化**：`StatusBarManager` 必须彻底退化为一个**毫无具体业务逻辑的 API 路由集线器**。它内部只负责暴露底下独立 Service 的方法。
2.  **抽离世界书专属自动化监听器 (Worldbook Event Automator)**：
    *   将所有关于原生事件监听、自动状态补偿的暗中守护逻辑（如 `GENERATION_ENDED` 恢复条目），**全部剥离**到一个独立的 `logic/worldbook/worldbook_automator.ts` 中。
    *   门面在初始化时，只需极其优雅地调用一句 `automator.startWatching()`。

---

## 3. 修改规模与核心重构指令 (Refactoring Instructions)

预计修改规模：新增纯粹的数据定义与转译文件，对现有 `StatusBarManager` 做大规模的代码物理剥离。业务逻辑本身保持不变。

1.  **设立净水器 (Types & Mappers)**：
    *   创建 `types/domain_models.ts`，定义系统内部通用的 `ArkStatusItem` 或类似结构。
    *   在 `logic/worldbook/` 下（或专门的 mapper 目录）建立转译逻辑，清洗掉 `any` 和诸如 `strategy.type` 带来的历史包袱。
2.  **清理 `shared_ui_state.ts` 和业务逻辑中的 `any`**：
    *   将 `pendingEntries` 等响应式缓存声明为严格的内部接口类型。
3.  **切除门面毒瘤 (Extract Automator)**：
    *   创建 `logic/worldbook/worldbook_automator.ts`，将 `StatusBarManager` 中从 142 行开始的 `setupEvents` 连同其依赖的回调逻辑，完整剪切过去。
    *   在 `StatusBarManager` 的 `init()` 方法中补充 `worldbookAutomator.startWatching()`。

## 4. 实施重构的涉及文件、工作量与风险预案

预计修改规模：新增纯粹的数据定义与转译文件，对现有 `StatusBarManager` 做大规模的代码物理剥离。业务逻辑本身保持不变，修改代码行数约 300 行。

### 4.1 核心物理重构指令与涉及文件
1.  **设立净水器 (Types & Mappers)**：
    *   **涉及文件**: `types/domain_models.ts` (新增), `types/mappers/worldbook_mapper.ts` (新增)
    *   **动作**: 创建 `domain_models.ts`，定义系统内部通用的 `ArkWorldbookEntry` 结构。在 mapper 目录下建立转译逻辑 `toDomain()` 和用于保存时的局部覆盖回写参考逻辑，清洗掉 `any` 和诸如 `strategy.type` 带来的历史包袱。
2.  **清理 `shared_ui_state.ts` 和业务逻辑中的 `any`**：
    *   **涉及文件**: `components/global_tabs/shared_ui_state.ts`, `logic/worldbook/entry_service.ts`, `logic/worldbook/snapshot_service.ts`
    *   **动作**: 将 `pendingEntries` 等响应式缓存声明为严格的内部接口类型 `ArkWorldbookEntry[]`。在 Service 接收到原生数据时强制调用 Mapper。
3.  **切除门面毒瘤 (Extract Automator)**：
    *   **涉及文件**: `logic/statusbar_manager.ts`, `logic/worldbook/worldbook_automator.ts` (新增)
    *   **动作**: 创建独立监听组件，将 `StatusBarManager` 中从 142 行开始的 `setupEvents` (关于 `GENERATION_ENDED` 恢复临时屏蔽、`CHAT_CHANGED` 差异校验) 连同其依赖的私有方法，完整剪切过去。在 `StatusBarManager` 的 `init()` 方法中补充 `worldbookAutomator.startWatching()`。

### 4.2 预计风险与可能解决方向 (Risks & Mitigations)
1.  **风险：强类型改造导致 Vue 模板大面积报错 (Type Mismatch in Templates)**
    *   **原因**：原先 UI 组件直接使用了酒馆原生的复杂层级（如 `entry.strategy.type`）。经过 Mapper 清洗后，DTO 中已将其扁平化为纯净业务字段（如 `strategyType`）。此时，Vue 模板中的旧字段将全部飘红。
    *   **解决方向**：先写好 `ArkWorldbookEntry` DTO 和 Mapper。随后全局搜索 `.vue` 文件中涉及被抛弃原生字段的地方，手动将模板里的变量名替换为新名字。最后**必须运行 `npx tsc --noEmit --skipLibCheck --project tsconfig.json`**，逐个修复直至 TS 编译完全通过，绝不放过任何一个 `any` 的漏网之鱼。
2.  **风险：双向绑定断裂与“魔改原生属性”带来的回写失败**
    *   **原因**：在清洗数据后，如果 UI 或业务逻辑试图直接把转译后的（缺失原生底层必须字段的）对象塞回给酒馆 API 去存库，将导致数据结构损坏。或者像以前那样，强行 `(e as any).constant = true` 往原生对象里塞私货导致系统无法识别。
    *   **解决方向**：坚决掐断直接回写权。UI 和上层业务只能传递**业务指令**（例如：`entry_service.toggleEntryStatus(uid, true)`）。在底层的写库回调（`updateWorldbookWith`）中，根据 `uid` 去找到原生的那个复杂脏数据对象，**仅修改其特定字段**（如 `entry.enabled = true`），然后再原封不动地塞回给酒馆保存。

---

## 5. 给 Agent 的最高开发规范：新增功能的强制 4 步走
(本段规范将同步更新至 `07` 总架构图中)

以后任何 Agent 在本项目下新增涉及后端数据的功能时，必须严格遵守以下流转顺序：
1.  **【定义数据结构】**：在 `types/` 目录下用 `interface` 注册新功能所需的数据结构（作为大模型防幻觉参考文档）。
2.  **【编写底层转译与服务】**：在 `logic/` 下新建 Service。如果涉及读取/修改酒馆数据，必须在此处完成“原生数据 $\leftrightarrow$ 内部接口结构”的转译映射。
3.  **【注册专属监听器】**：如果功能包含对原生事件（如 `CHAT_CHANGED`）的长期监控反应，必须将其写在专属的 `automator` 中，严禁塞入门面。
4.  **【暴露给门面并被前端调用】**：在 `StatusBarManager` 等 Facade 中仅仅暴露一个极简的调度函数。Vue 前端直接调用，享受纯净的数据。