# Phase 1.2: UI/UX Refinements & Feature TODOs

基于第一阶段 UI 重构后的效果反馈，现确立 Phase 1.2 的微调与功能预研任务清单。

## 1. 整体视觉调整 (Global Theme & Styling)

### 1.1 亮色主题配色优化
- **问题描述**：在 `light` 主题（终末地风格）下，黄色的文本（原 primary 色 `#ffe600`）在白色或浅灰背景上极其刺眼，对比度严重不足。
- **调查与实施方案**：
  1. **加深主色调**：在 `theme.scss` 的 `.light-theme` 中，将 `--color-primary` 从明黄 `#ffe600` 稍微调暗至更具阅读性的金黄色（如 `#d4b800` 或 `#cca300`），保证依然有终末地的感觉但能看清。
  2. **加深底色**：将 `--color-background` 从 `#f5f5f5` 改为偏冷的浅灰色（如 `#e0e2e5` 或 `#e5e5e5`），将 `--color-surface` 从 `#ffffff` 降为 `#ececec`。

### 1.2 亮色背景材质优化
- **问题描述**：亮色模式下，作为背景的“等高线图”未正常生效。并且纯白背景加剧了视觉疲劳。
- **调查与实施方案**：
  - 目前等高线图片仅在 `.ark-panel-v2` 类中生效，而在第一阶段重构中，我们大量使用了原生的 Flex 容器和普通的 `bg-surface`，导致全局没有水印。
  - **解决方案**：在 `src/sandbox/App.vue` 的最外层大壳子（或在 `tailwind.scss` 中定义全局的 `.app-container-bg`）上挂载 `--bg-watermark`，并设置较低的 opacity（如 10% 到 15%），使得无论处于什么 Tab 都能看到全局的等高线纹理。

---

## 2. 组件微调与功能标注 (Component Tweaks & TODOs)

### 2.1 拦截队列列表 (`InterceptorQueueItem.vue`)
- **问题描述**：
  1. 单次阻断状态下的“灰色”提示不够明显，未能与将要发送的状态形成足够反差。
  2. 彻底阻断与将要发送的底色区分度不高。
  3. “TEMP_HOLD / 临时阻断”与“ACTIVE / 将被发送”标签配色一致没有区分度。
- **实施方案**：
  - **彻底阻断 (Violation)**：使用红色（`bg-error/10`）辅以倾斜条纹（`repeating-linear-gradient`）作为背景。
  - **单次阻断 (Temp Hold)**：使用深灰色或中性色（`bg-outline-variant/30`）辅以条纹背景，并且标签颜色改为灰色系（不使用黄色 primary）。
  - **允许发送 (Active)**：保持清爽的纯色底板。

### 2.2 迷你拦截气泡 (`BubbleWindow.vue` / Interceptor alert state)
- **视觉优化实施方案**：
  1. 顶部标题栏增加**总 Token 消耗显示**（如 `拦截面板 ~546 tok`）。
  2. 列表项使用 `min-w-0 break-words` 允许长条目名换行，并在右侧固定宽度区域显示 Token（如 `~184 tok`）。
  3. 同步 2.1 的改动，为小窗里的条目项增加红斜线（彻底拦截）或灰斜线（单次拦截）背景。
- **功能标注 (TODO)**：
  - 在 `App.vue` 或 `BubbleWindow.vue` 顶部加入注释，提醒后续 Agent 接入真实的“被动触发自动展开”和“发送后自动收缩”逻辑。

### 2.3 主页近期触发记录 (`DashboardTab.vue`)
- **功能标注 (TODO)**：
  - 在代码中引入 `<!-- TODO: [Phase 2] 持久化缓存近20次触发记录... -->` 的详尽多行注释。明确要求使用类似 localStorage 的机制存储记录。

### 2.4 多功能页面 (`ToolsTab_Design.vue` 预留)
- **实施方案**：
  - 创建 `ToolsTab_Design.vue`。
  - 内部中央显示简单的 `<WipMask text="多功能扩展模块开发中" />` 或直接写入居中的文字提示。
  - 在 `App.vue` 中挂载该路由。

### 2.5 遮罩透明度 (`WipMask.vue`)
- **实施方案**：
  - 修改 `WipMask.vue` 的背景色，从 `bg-surface/80` 降低为 `bg-surface/50` 或 `bg-background/40`，让底层组件透出。

### 2.6 世界书编辑面板 Token 计算 (`LoreEntryEditor.vue`)
- **实施方案**：
  - 移除硬编码的 `/ 2000 TOKENS` 字样。
  - 增加 Todo 注释：`// TODO: [Phase 2] 探索 SillyTavern 实时文本 Token 估算 API，若无则整块移除`。

### 2.7 悬浮窗内容逻辑 (`MiniWindow.vue`)
- **功能标注 (TODO)**：
  - 在 `MiniWindow` 内新增 Todo 注释，指示其平常状态应展示基于 2.3 功能的“触发记录概览”，而不是特定条目的细节。

---

## 附录：关于图片资源动态解析与统一加载的未来规划 (TODO)
在目前的沙盒预览阶段，我们在 `tailwind.scss` 中硬编码了含有特定 Commit Hash 的 jsDelivr 外部直链，以此来验证 UI 上的等高线背景效果。但这并不是最终的架构形态。

**未来发布时的操作指南与重构建议：**
1. **替换为 @latest 发布流**：
   在代码准备合入 `master` / `main` 并打 Tag 发布前，需要将 `tailwind.scss` 里的外链 URL 中的 `@a633c71` 修改回 `@latest`，并确保 `bundle.yaml` 会保留历史 Tag。这能保证生产环境中的用户永远拉取到最新的压缩资产，且不会因为我们开发分支上的资源变动而导致 404。
2. **构建全局 AssetManager (推荐方案)**：
   如果未来有新增干员头像、阵营 Logo 等更多图片的诉求，硬编码 CSS 链接将极难维护。
   **建议引入以下架构重构**：
   - 在 `assets.ts` 中维护一个 `ASSETS_DICT`。
   - 写一个初始化函数 `initThemeAssets()`，在整个 `App` 挂载时，一次性解析字典中的图片链接（内部仍可以使用 `@latest` 或相对路径回退逻辑）。
   - 将解析好的背景图片等资源通过 `document.documentElement.style.setProperty('--ark-bg-light', url)` 的方式动态注入到全局 `:root` 的 DOM 中。
   - 这样在 CSS 和组件中就能实现真正解耦的 `var(--ark-bg-light)` 调用，彻底摆脱具体组件（如 `App.vue`）和生硬的 URL 打包依赖。
