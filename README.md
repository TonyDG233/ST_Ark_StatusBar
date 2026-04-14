# ARK_STATUSBAR Project

> 这是一个基于 SillyTavern（酒馆）和 Tavern Helper（酒馆助手）的高级前端扩展插件项目，旨从管理世界书视角服务于《明日方舟》角色卡的游玩体验。

## 📅 项目背景
本插件项目起源于对“明日方舟”角色卡在酒馆中沉浸式体验的追求。由于长期以来角色卡世界书的体量问题，容易导致非必要的世界书条目被误触与token消耗过高，以及影响LLM输出表现等情况。为了手动检测并控制世界书状态，提升LLM表现，本插件项目应运而生
## 🚀 核心功能与特性
1.  **PRTS 风格 开局UI**：复刻 PRTS 终端的视觉风格，提供包含全局世界书状态、开局切换等信息的常驻动态悬浮窗状态栏。
2.  **世界书拦截机制**：通过 UI 交互实现对世界书 (Worldbook) 条目的精确控制，支持主动检测/发送消息时被动检测当前上下文触发的世界书条目功能，允许**永久屏蔽**世界书条目与无竞态死锁的**临时单次阻断**条目。
3.  **便捷世界书管理**：提供比酒馆原生更加便捷的管理世界书挂载，蓝灯/绿灯状态，禁用/启用等属性的服务
4.  **世界书快照机制**: 为世界书的当前状态提供保存/还原快照机制，兜底每一次的世界书条目调整。
5.  **操作记录与回滚**：插件会记录UI上的每一个世界书调整操作，允许你针对其中的任意操作进行回滚，或是删除对应记录。

## 🛠️ 技术栈
*   **Core**: TypeScript, Vue 3, TailwindCSS
*   **Build**: Webpack (打包为酒馆助手可直接加载的脚本与界面)
*   **Runtime**: SillyTavern + Tavern Helper 

## 📂 目录结构
```text
src/
├── ARK_STATUSBAR/          # 项目核心开发主目录 (平级模块化架构)
│   ├── types/              # 【独立模块】系统级契约实体与数据清洗防线 (如 system_config.ts)，供所有模块合法平级调用
│   ├── core/               # 【独立模块】核心纯净基建层 (事件总线、状态库)，不含写库逻辑，供平级调用
│   ├── data/               # 【独立模块】静态业务数据存放区 (baseline, scenarios 等)，仅供单向读取
│   ├── logic/              # 【独立模块】业务逻辑层，包含外层门面入口和内部领域服务
│   │   ├── statusbar_manager.ts # 统一业务门面 (Facade)，封装一切操作并暴露给 UI
│   │   └── worldbook/      # 世界书领域相关服务 (包含 entry, snapshot, logger, interceptor)
│   ├── components/         # 【独立模块】纯净的 UI 渲染层与微后端视图逻辑 (包含 shared_ui_state 数据中枢)
│   ├── index.ts            # 入口文件 (挂载UI及后端初始化)
│   └── tools/              # 本地构建与代码生成工具
├── poc/                    # PoC (概念验证) 独立勘探区。用于在黑盒环境中写测试脚本排雷 (极度重要！)
└── util/                   # 共享工具函数箱 (mvu.ts, script.ts)
```

## 🛠️ 本地构建与开发指南
本项目使用 `pnpm` 作为包管理器，并通过 Webpack 进行打包。

### 1. 环境准备
请确保你的电脑上已经安装了 [Node.js](https://nodejs.org/) (推荐 LTS 版本) 和 [pnpm](https://pnpm.io/zh/installation)。

### 2. 安装依赖
克隆本仓库到本地后，在项目根目录运行以下命令安装依赖：
```bash
pnpm install
```

### 3. 构建打包 (Build)
当你在本地修改了代码，需要生成最终给酒馆助手使用的文件时，运行：
```bash
pnpm run build
```
构建成功后，所有产物将会输出到根目录的 `dist/` 文件夹中。你只需要将 `dist/ARK_STATUSBAR` 中的文件（如 `index.js`）导入到酒馆助手即可使用。

### 4. 类型检查 (TypeScript Check)
在提交代码前，建议进行类型检查以确保代码质量（跳过外部库的严格检查）：
```bash
npx tsc --noEmit --skipLibCheck --project tsconfig.json
```

## 📝 贡献与维护
本项目由 **Kilo Code** (AI Agent) 协助开发。
所有 Agent 在参与开发前，**必须** 阅读根目录下的 `AGENTS_README.md`。

---
*Last Updated: 2026-03-19*