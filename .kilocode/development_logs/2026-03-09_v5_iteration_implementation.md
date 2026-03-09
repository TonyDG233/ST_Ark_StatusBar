# Phase 1 v5 迭代与稳定版本实施记录 (2026-03-09)

## 1. 核心需求与背景
在经历了一系列的 PoC 验证和错误探索后，本次迭代成功攻克了在世界书状态栏中一直存在的四个核心痛点：
1. **真实 Token 预估**：拦截并在“发送前”精确计算大模型即将消耗的 Token。
2. **防错位匹配**：世界书条目在 UI 中的映射极易因为重名或后缀发生错乱，导致禁用失败。
3. **临时单次阻断**：提供更轻量的防打扰功能，阻断发送一次后自动恢复，减轻手动开关的心智负担。
4. **安全的回车键拦截**：让习惯使用回车键发消息的用户自主决定是否开启预检。

---

## 2. 关键技术实现详情

### 2.1 实时精确 Token 计算 ("双轨并行"方案)
- **文件**: `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- **原错误路径反思**：早期试图强制修改单次拦截流以统一 `getWorldInfoPrompt` 和 `generate(..., true)`，但由于这两条原生管道互不相通，引发了彻底的崩溃。在随后的测试中，一度因错误的代理对象抓取（试图直接从 `window.parent` 和 `window` 上扒取带有助手特供方法的 `SillyTavern`）而导致 `n.getTokenCountAsync is not a function`。
- **最终解决**：
  - 确认并采用了助手原生的变量注入机制，直接调用环境中注入的 `SillyTavern.getTokenCountAsync` 和 `eventOnce`，并舍弃了所有带有隐患的 `import` 语句。
  - 在 `executeDualTrackDryRun` 中实现了稳定的双轨制：一轨无损调用 `getWorldInfoPrompt` 获取拦截清单，另一轨紧跟着执行 `context.generate('normal', {}, true)`，并拦截其发出的 `chat_completion_prompt_ready` 事件，从中解析组装好的 `fullText` 并喂给 Token 计算器。

### 2.2 UI 竞态修复与单次阻断功能
- **文件**: `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
- **原错误路径反思**：在早期的临时阻断逻辑中，UI 将所有 `tempDisabled` 的写入动作都积压到了点击“确认发送”按钮的瞬间。由于 `toggleEntrySilent` 是跨 iframe 的异步操作，这种集中写入直接引发了死锁级别的竞态条件——当原生引擎开始打包世界书发送时，修改请求还在路上，导致阻断彻底失效。
- **最终解决**：
  - 将世界书写入时机提前：**在用户点击【⏳ 单次】按钮的那一刻，直接触发世界书的禁用写入**，同时将 UID 推入管理器的暂存栈（`manager.tempDisabledUids`）。
  - 在 `StatusBarManager` 的生命周期中，注册监听原生酒馆事件 `tavern_events.GENERATION_ENDED`。当且仅当一次生成生命周期完全结束后，遍历暂存栈并无声恢复所有被禁用的条目。
  - 修复了 `togglePendingEntry` 在不同状态下的死角陷阱（防止临时阻断状态下点击“彻底阻断”反而将条目错误启用的 Bug）。

### 2.3 多相物理拦截器挂载
- **文件**: `src/ARK_STATUSBAR/logic/statusbar_manager.ts`
- **实现内容**：
  - 解决了“开启拦截后回车依然发送”的严重问题。由于 SillyTavern 原生框架在 `textarea` 上的响应非常复杂，仅拦截 `keydown` 无法彻底阻断。
  - 采用全面捕获（Capture Phase）策略，同时挂载了 `keydown`、`keypress` 和 `keyup` 的事件劫持。利用 `preventDefault` 和 `stopImmediatePropagation` 吃掉所有非预期的衍生事件，且仅在 `keydown` 时触发核心干跑，完美实现了拦截与放行的可控性。

### 2.4 防误触的视觉重构
- **文件**: `src/ARK_STATUSBAR/components/GlobalStatusBar.vue`
- **实现内容**：
  - 对阻断体系的按键施加了带有强烈语义的颜色轮廓（`border-color`）：
    - 绿色【✅ 开启 / ✅ 恢复】：安全的重新生效。
    - 橘色【⏳ 单次】：临时性的警告。
    - 红色【❎ 彻底】：永久禁用的危险操作。
  - 优化了 Token 提示的文本排版，通过 `<br/>` 防折叠，并在“主动检测”与“常规拦截”场景中进行了文本区分。

---

## 3. 编译与后续行动
- `pnpm run build:dev` 及 `pnpm run build` 已成功，所有前端组件、逻辑代码和类型声明的修改均无 TS Error 残留。
- 后续将配合 User 发布 v5 版本的更新文案，此阶段的 UI 交互及拦截底层宣告基本稳定，不再依赖盲目的 PoC 尝试。
