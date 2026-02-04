# Phase 2: Rhodes Island Terminal - 架构规划

**日期**: 2026-01-12
**状态**: 规划中

## 1. 核心目标 (Core Objectives)
本阶段旨在构建核心的“罗德岛终端”系统，实现从“开局纯UI”到“动态交互式HUD”的跨越。
重点在于打通 **Frontend (UI)** <-> **Backend (Script)** <-> **MVU (State)** 的完整数据流。

---

## 2. 架构模块拆解 (Architecture Breakdown)

### 2.1 前端设计 (Frontend Design)
前端将从单纯的开局导航器扩展为常驻的**状态仪表盘 (Status HUD)**。

*   **视觉风格**:
    *   严格遵循《明日方舟》UI 设计语言。
    *   **核心元素**: 顶部理智条 (Sanity Bar)、龙门币/合成玉计数、干员状态卡片、基建通知栏。
    *   **功能预留**: 为 Phase 3 的“通讯终端”和“Wiki 资料库”预留 Tab 入口或浮动按钮位置。

*   **技术栈**:
    *   **Vue 3**: 组件化开发。
    *   **Pinia**: 用于管理 MVU 变量的响应式状态（这是前端与 MVU 交互的桥梁）。
    *   **SCSS**: 复杂的方舟风格样式（斜角、模糊、半透明）。

*   **挂载策略 (Mounting Strategy)**:
    *   **核心逻辑**: 摒弃简单的 `setInterval` 轮询，采用更精准的消息更新监听。
    *   **挂载点**: 依托 MVU 插件自动生成的 `<StatusPlaceHolderImpl/>` 钩子，确保 UI 始终渲染在 AI 回复的底部。
    *   **冲突处理**: 必须保留对 `message_id === 0` 的特殊检查，防止覆盖 Phase 1 的开局导航器。

    *参考实现代码 (待整合入 `src/ARK_STATUSBAR/index.ts`)*:
    ```typescript
    // Reference: user provided snippet
    async function handleMessageUpdate(message_id) {
        // ... (省略基础检查)

        // 冲突避让: 如果是第0楼且包含开局UI标签，则让路
        if (message_id === 0 && msg.message && (msg.message.includes(SCENARIO_SELECTION_UI_TAG))) {
            return;
        }

        // 挂载检测: 寻找 MVU 自动生成的钩子
        if (msg.message && msg.message.includes('<StatusPlaceHolderImpl/>')) {
            const textContainer = $(`#chat > .mes[mesid="${msg.message_id}"]`).find('.mes_text');
            // 执行挂载...
            mountUIPanel(textContainer);
        }
    }
    ```

### 2.2 后端设计 (Backend Design)
后端脚本 (`src/ARK_STATUSBAR/index.ts` 及其扩展) 将转型为**逻辑处理中心**。

*   **MVU 交互逻辑**:
    *   **监听器**: 利用 `@types/iframe/exported.mvu.d.ts` 提供的 `Mvu.events`。
        *   `VARIABLE_UPDATE_ENDED`: 监听变量变化，触发后端计算（如：理智自然恢复计算、基建产出结算）。
    *   **数据流**:
        1.  用户在 UI 点击“基建排班”。
        2.  UI 修改 Pinia 状态 -> 同步到本地 MVU 变量。
        3.  后端监听 `VARIABLE_UPDATE_ENDED` 检测到变化。
        4.  后端执行复杂逻辑运算（产出计算）。
        5.  后端调用 `Mvu.replaceMvuData` 写回结果。
        6.  UI 自动更新显示。

*   **特殊处理**:
    *   **时间/地点格式化**: 在后端统一处理时间戳转换为“泰拉历”格式，供前端直接显示。
    *   **系统交互**: 预留接口处理 UI 发起的系统级请求（如背景切换、BGM 变更）。

### 2.3 MVU 集成 (MVU Integration)
*这是 Phase 2.1 的重点，此处仅做架构定位。*

*   **变量结构 (Zod Schema)**:
    *   文件位置: `src/ARK_STATUSBAR/mvu/schema.ts` (需新建)
    *   作用: 定义“罗德岛终端”所有可显示、可交互的数据模型。
*   **提示词工程 (Prompt Engineering)**:
    *   采用 **MVU Zod Dual-LLM** 策略（原生支持）。
    *   世界书条目需严格拆分为：
        *   `[mvu_update]变量更新规则`
        *   `[mvu_plot]剧情思维链` (可选)
    *   利用额外 LLM 专门解析剧情更新变量，主 LLM 专注剧情演绎。

---

## 3. 分阶段实施规划 (Implementation Stages)

### Phase 2.1: MVU 核心构建 (The Soul)
*   **任务**:
    1.  设计 Zod Schema (`schema.ts`)：定义理智、资源、干员状态等核心字段。
    2.  编写 MVU 提示词：初始化变量 (`initvar.yaml`)、更新规则 (`[mvu_update]`)。
    3.  配置世界书：确保条目命名符合 Dual-LLM 解析要求。
*   **参考**: `.kilocode/rules/mvu*.md`, `@types/iframe/exported.mvu.d.ts`

### Phase 2.2: 后端逻辑适配 (The Brain)
*   **任务**:
    1.  改造 `src/ARK_STATUSBAR/index.ts`，引入 `handleMessageUpdate` 挂载逻辑。
    2.  实现 `Mvu.events` 监听器，处理基础的变量联动逻辑。
    3.  对接 Phase 1 的开局数据，确保开局选择能正确初始化 MVU 变量。

### Phase 2.3: 前端 UI 实现 (The Skin)
*   **任务**:
    1.  创建 `StatusPanel.vue` 组件及其子组件 (SanityBar, OperatorCard)。
    2.  使用 Pinia (`defineMvuDataStore`) 对接 MVU 变量。
    3.  实现 UI 交互（点击反馈）与后端的数据同步。

---

## 4. 参考资源索引 (References)
*   **API 定义**: `@types/iframe/exported.mvu.d.ts` (MVU 接口核心)
*   **规则文档**: `.kilocode/rules/mvu变量框架.md`, `.kilocode/rules/mvu角色卡.md`
*   **旧代码参考**: `references/参考_旧剧情模块前端项目_学习挂载逻辑/unified_script.js` (挂载逻辑)