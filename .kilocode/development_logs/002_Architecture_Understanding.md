# 架构理解备忘录 (Architecture Understanding Memo)

**日期**: 2026-01-08
**背景**: 针对用户对代码架构可维护性与数据持久化策略的指导，特此记录核心理解，作为后续开发遵循的准则。

## 1. Schema 的独立性与标准性 (Schema Independence & Standardization)
*   **原则**: 变量结构定义必须清晰、独立，完全符合 MVU 标准，且便于用户维护或直接复制使用。
*   **实现方式**:
    *   创建独立的脚本文件（如 `src/ARK_STATUSBAR/logic/mvu_schema.ts`）。
    *   严格包含 `import { registerMvuSchema } ...`。
    *   显式定义 `export const Schema`。
    *   在 `$(() => registerMvuSchema(Schema))` 中注册。
*   **禁忌**: 严禁将 Schema 定义隐晦地打包进主 bundle 中，导致用户无法查看或修改。

## 2. 设置的“伪本地文件”持久化 (Quasi-Local Persistence via Worldbook)
*   **原则**: UI 设置（如主题、开关）应实现“全局且永久”的保存，模拟本地配置文件的效果，而不应混入跟随消息流动的游戏状态。
*   **实现方式 (长远愿景)**:
    *   通过 **Worldbook Injection** 机制存储设置。
    *   **读取**: UI 初始化时扫描特定 Worldbook 条目（如 `ARK_SETTINGS`）。
    *   **写入**: 设置变更时，使用 `updateWorldbookWith` 直接修改该条目内容。
*   **当前阶段 (Phase 1)**:
    *   暂时使用 **浏览器存储 (localStorage/sessionStorage)** 实现简易持久化，避免引入 MVU 或复杂依赖。

## 3. MVU 的正确位置 (Role of MVU)
*   **原则**: MVU (Message Variables) 应专注于管理 **游戏状态** (Game State)。
*   **范围**: 剧本进度、解锁状态、角色数值等随剧情发展而变化的数据。
*   **区分**: 游戏状态 (MVU) vs 系统设置 (Worldbook/Local)。