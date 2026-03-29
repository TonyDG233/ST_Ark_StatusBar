# 000 终极架构宪法预案：从敏捷单体到深度解耦微服务的演进 (000_ultimate_architecture_evolution_contingency.md)

## 1. 预案背景与触发阈值 (Context & Triggers)

本项目在开发早期至中期（代码量 < 5000 行，且核心业务处于高频迭代与 PoC 验证阶段），采用了**“直接 Import 类的平级 Facade 模式”**。
*   **当前优势**：排错直觉极高。当底层 Service 的 API 发生变更或损坏时，TypeScript 的报错会直接定位在 Facade 的调用现场。这在迅捷开发、模块功能高度不稳定需要反复 Debug 时，提供了最高效的修复路径。
*   **当前局限**：随着系统体量可能突破 5000-10000 行，以及如 `Story Engine V2` 等双轨复杂业务的接入，直接引用的强耦合会导致：牵一发而动全身；UI 与后端逻辑无法进行独立的 Mock 测试；未来如果本项目需要作为基础生态，为下游其他插件提供 API 暴露时，缺乏稳定的契约。

**【触发阈值】**：
当出现以下任意一种情况时，必须启动本预案，将当前架构平滑升维至**“彻底接口化模式”**：
1.  代码总量逼近或突破 10000 行。
2.  项目内同一类业务出现了两种及以上的底层实现机制（例如：基于大模型的剧情嗅探器 vs 基于本地正则的剧情嗅探器），且需要支持动态热插拔。
3.  项目需要作为基础底层，向下游其他独立扩展提供稳定的 `window.ArkStatusBarAPI` 暴露调用。
4.  模块功能已经极度成熟，Bug 发生率极低，系统开始追求组件的绝对自治，不再需要通过 Facade 作为报错交汇点来进行“案发现场”式的低级排查。

---

## 2. 演进方向：从“直接调用”到“契约组装” (The Paradigm Shift)

### 2.1 当前敏捷模式 (Agile Monolith)
*   **形态**：`StatusBarManager`（Facade）内部直接 `import { entryService } from './entry_service'`，并调用 `entryService.resetToBaseline()`。
*   **依赖关系**：门面强依赖于具体实现类的存在及其全部细节（包括私有状态的潜在影响）。

### 2.2 目标接口化模式 (Interface-Driven Decoupling)
*   **形态**：将 Facade 转为 **Interface_Constructor 注入模式**。
*   **依赖关系**：高层模块（UI、Facade）与底层模块（Services）之间，不再有物理引用。它们共同依赖于一个充当“宪法”的抽象接口（Interface）。

---

## 3. 重构实施路径与架构示例 (Refactoring Path)

当触发重构阈值时，按照以下三步建立绝对防线：

### 3.1 宪法颁布：定义全局 Interface 契约
在 `types/interfaces/` 目录下，为每一个对外提供服务的组件定义严密的 TypeScript Interface。这不仅仅是数据结构（DTO），更是行为准则。

```typescript
// types/interfaces/IWorldbookServices.ts
import type { ArkWorldbookEntry } from '../domain_models';

/**
 * 【世界书条目服务宪法】
 * 任何试图接管世界书读写能力的底层模块，必须绝对遵循此契约。
 */
export interface IEntryServiceAPI {
    /** 将指定世界书恢复至基准线 */
    resetToBaseline(worldbookName: string): Promise<void>;
    /** 获取并转译后的纯净世界书条目列表 */
    getCleanEntries(worldbookName: string): Promise<ArkWorldbookEntry[]>;
}
```

### 3.2 底层宣誓：具体 Service 贯彻实现 (Implements)
底层的具体业务类必须通过 `implements` 关键字向“宪法”宣誓效忠。如果它的方法签名与接口不符，TypeScript 将在**类定义的第一行**抛出致命错误，彻底将 Bug 拦截在底层，绝不会流窜到高层调用处。

```typescript
// logic/worldbook/tavern_entry_service.ts
import type { IEntryServiceAPI } from '../../types/interfaces/IWorldbookServices';
import type { ArkWorldbookEntry } from '../../types/domain_models';

export class TavernEntryService implements IEntryServiceAPI {
    // 编译器强制要求必须精确实现该方法
    public async resetToBaseline(worldbookName: string): Promise<void> {
        // ... 调用酒馆原生 API updateWorldbookWith 的脏活累活
    }
    
    public async getCleanEntries(worldbookName: string): Promise<ArkWorldbookEntry[]> {
        // ... 获取数据并调用 Mapper 转译
    }
}
```

### 3.3 门面升维：基于接口的组装与代理 (Interface Constructor)
`StatusBarManager` 将被掏空所有对底层具体类的直接 `import`，它只持有接口。

```typescript
// logic/statusbar_manager.ts
import type { IEntryServiceAPI } from '../types/interfaces/IWorldbookServices';

export class StatusBarManager {
    private entryService: IEntryServiceAPI;

    /**
     * @param service 任何实现了 IEntryServiceAPI 宪法的实例均可注入
     */
    constructor(service: IEntryServiceAPI) {
        this.entryService = service;
    }

    // 暴露给 Vue 调用的极简门面
    public async resetWorldbook(name: string) {
        await this.entryService.resetToBaseline(name);
    }
}
```

**组装中心（IoC Container / Entry Point）**：
在项目的最顶层入口（如 `index.ts`），完成具体实现与门面的绑定。
```typescript
// index.ts
import { TavernEntryService } from './logic/worldbook/tavern_entry_service';
import { StatusBarManager } from './logic/statusbar_manager';

// 注入！未来如果需要 Mock 测试，或者有了新的底层引擎，只需在这里把 TavernEntryService 换掉即可，其余万行代码一行不改。
export const systemManager = new StatusBarManager(new TavernEntryService());
```

---

## 4. 预案总结

本 `000` 预案文档作为项目的“架构备用胎”而存在。

在当下（代码量较小、迭代极快、重度依赖酒馆单一环境），我们清醒地选择保持“类直接调用”的敏捷模式，以换取最高效的“案发现场式 Debug”体验。我们用 `Type/Interface` 仅作数据结构的防腐清洗（DTO），而不去约束类的行为。

但在未来，当项目成长为参天大树，稳定性和组件替换的灵活性压倒了一切时，本预案中基于 `Interface_Constructor` 的深度解耦模式，将是维持系统不崩塌的唯一出路。