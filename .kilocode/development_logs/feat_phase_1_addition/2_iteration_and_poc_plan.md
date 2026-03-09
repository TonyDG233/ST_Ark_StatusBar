# Phase 1 迭代与 POC 计划 (Iteration & PoC Plan)

**日期:** 2026-03-09
**状态:** PoC 验证全面完成，准备实施重构

基于社区反馈和项目现状，本次迭代目标是在不进行全局彻底重构的前提下，修复现有 Bug 并引入部分高频需求功能。所有新功能均已通过独立脚本的 PoC 验证。

## 需求 1: 利用回传数据精确渲染与本地状态校验
**背景:** 当前代码使用模糊匹配，容易导致不同世界书间相同 UID 或相似名字产生张冠李戴的 UI Bug。
**计划:**
1. 修改 `GlobalStatusBar.vue` 监听 `ark-interceptor-triggered` 事件的逻辑。
2. **过滤：** 仅截留 `world === this.targetWorldbook` 的条目（保持单书管理的边界，避免越界修改）。
3. **渲染：** 直接使用回传数据的名字、UID 渲染列表，放弃本地的模糊降级匹配。
**PoC 结论 (通过):**
*   经 `poc_match_state.ts` 验证，利用酒馆事件回传的条目列表可以直接过滤外部世界书（如排除“玛莉娅临光 (6)”）。
*   回传条目的 `disable` 状态与本地解析出的 `enabled` 状态完全一致（且相反），不存在状态不同步现象，可完全信任回传数据用于渲染。

## 需求 2: 临时禁用 (单次阻断)
**背景:** 用户希望仅对“下一次发送”禁用某个条目，而在发送完成后自动恢复，免去手动再开的麻烦。
**计划:**
1. **UI 侧:** 拦截列表的按钮由“阻断 / 开启” 变更为 “禁用 / 临时禁用”。
2. **逻辑侧:** 
   - 临时禁用：将该条目写回世界书为关闭状态，同时在 `[SYS_CONFIG]` 或内存中打上特殊标记 `tempDisabledEntries`。
   - 恢复：监听酒馆原生的 `tavern_events.GENERATION_ENDED` 事件。在此节点，统一将带标记的条目状态还原为开启。
**PoC 结论 (通过):**
*   经 `poc_temp_disable_v2.ts` 验证，监听 `GENERATION_ENDED` 并调用 `updateWorldbookWith` 恢复世界书状态能够完美运行。
*   操作时机安全，未干扰酒馆原生的聊天保存逻辑 (未触发崩溃或报错)。

## 需求 3: 可配置的回车键拦截检测
**背景:** 用户常常使用回车键换行，开启本插件后，取消酒馆自带的回车发送功能时，插件却仍在拦截回车。
**计划:**
1. 在 `ArkConfig` 中新增布尔型配置 `enableEnterToIntercept` (默认 `false`)。
2. 拦截器逻辑中，只有在该配置为 `true` 且按下回车时，才执行 Dry Run。
3. 在 UI Tab 4 (设置) 中增加一个带警告注释的 Checkbox 以供用户手动开启。
**可行性:** 逻辑改动简单，直接实施。

## 需求 4: 主动扫描时的 Token 计算展示
**背景:** 用户希望利用该插件不仅能预览条目，还能预估消耗的 Token，以便控制上下文。
**计划:**
1. 探索获取 Token 计算的正确接口（不依赖编译器的虚拟类型引入）。
2. 在触发拦截时，设法安全地计算预期的 Token 消耗。
**PoC 结论 (已通过):**
*   【警告】先前的所有 PoC（包括 v6 到 v9）由于混淆了局部代理对象、伪造 import 路径以及异步时序问题，均被判定为无效且具有误导性。
*   【最终真相】Tavern Helper 在脚本执行时，直接在全局沙盒中注入了名为 `SillyTavern` 的代理对象。**绝对禁止**使用任何 `import` 语句，也**绝对禁止**从 `window` 或 `window.parent` 上裸抓取 `SillyTavern`。
*   经 `poc_token_counter_v10.js` 验证，直接使用 `SillyTavern.getTokenCountAsync` 并直接调用 `SillyTavern.getContext().generate('normal', {}, true)`，能够完美干跑流水线并算出 Token（257518）。双轨并行策略证实可行。

---

## 执行步骤 (Action Items)

1. [x] 编写独立的 `poc_temp_disable` 脚本测试 `GENERATION_ENDED` 事件监听及世界书状态恢复。
2. [x] 编写独立的 `poc_match_state` 脚本测试回传数据与本地状态的吻合度。
3. [x] [重制] 编写真正的 `poc_token_counter_v10.js`，验证全局注入对象的存在，并在干跑中成功获取 Token（结果与原生一致）。
4. [x] 根据新的 PoC 结果出具详细报告 (本文档已更新)。
5. [ ] 在获得绿灯后，开始重构 `GlobalStatusBar.vue` 和 `statusbar_manager.ts` 落实上述需求：
       - **Vue端**：将临时阻断逻辑改为“点击按钮即时写入关闭，并计入待恢复列表；生成结束后恢复”。
       - **TS端**：清除虚假的全局对象抓取，直接利用项目已声明的全局代理 `SillyTavern` 和 `eventOnce` 实现双轨检测。
