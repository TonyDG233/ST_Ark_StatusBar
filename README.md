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
│   ├── views/              # 【页面级视图层】装载大型功能模块
│   ├── components/         # 【通用基础组件层】装载可高度复用的 UI 积木
│   ├── utils/              # 【纯函数辅助工具层】纯净数据加工厂
│   ├── hooks/              # 【副作用与组合式响应层】Vue 相关的复用逻辑
│   ├── services/           # 【核心业务拦截与服务层】核心数据流转的中枢
│   ├── store/              # 【全局状态与配置枢纽】集中管理状态与配置
│   ├── types/              # 【系统契约与防腐层】TypeScript 接口定义
│   ├── data/               # 【静态数据存放区】业务数据存放区 (baseline, scenarios 等)
│   ├── styles/             # 【样式文件存放区】全局样式表
│   ├── assets/             # 【静态资源存放区】图片等媒体资源
│   ├── tools/              # 本地构建与代码生成工具
│   └── index.ts            # 入口文件 (挂载UI及后端初始化)
├── poc/                    # PoC (概念验证) 独立勘探区。用于在黑盒环境中写测试脚本排雷 (极度重要！)
└── util/                   # 共享工具函数箱 (mvu.ts, script.ts)
```

## 📦 插件使用
请前往本项目的 [Releases](https://github.com/TonyDG233/ST_Ark_StatusBar/releases) 页面，下载最新版本的 `.json` 插件包。下载完成后，打开酒馆（SillyTavern）- 扩展页面中的“酒馆助手”界面，在脚本页面使用导入功能导入最新发布的 json 文件即可直接使用。

## 🛠️ 本地开发与构建指南（简易）
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
*Last Updated: 2026-06-01*