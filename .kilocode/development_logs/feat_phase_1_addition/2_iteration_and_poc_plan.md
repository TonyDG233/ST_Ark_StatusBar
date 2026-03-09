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
1. 探索酒馆 `window.SillyTavern.getTokenCountAsync(string, padding)` API。
2. 触发一次假生成 (Dry Run)。
3. 将计算结果展现在 Tab 1 (拦截预警) 的 UI 中。
**PoC 结论 (通过):**
*   经 `poc_token_counter_v6.ts` 反复验证，利用助手封装好的 `generate('normal', {}, true)` 配合监听 `tavern_events.CHAT_COMPLETION_PROMPT_READY`（或普通文本事件）可以安全触发官方的 DryRun 流程。
*   从载荷 (`data.chat` 或 `data.prompt`) 中提取拼接出的纯文本，喂给 `SillyTavern.getTokenCountAsync` 后，得出的 Token 数与酒馆原生统计精确一致。

---

## 执行步骤 (Action Items)

1. [x] 编写独立的 `poc_token_counter` 脚本并在控制台测试 Token 计算的准确性与性能。
2. [x] 编写独立的 `poc_temp_disable` 脚本测试 `GENERATION_ENDED` 事件监听及世界书状态恢复。
3. [x] 编写独立的 `poc_match_state` 脚本测试回传数据与本地状态的吻合度。
4. [x] 根据 PoC 结果出具报告 (已更新至本文档)。
5. [ ] 在获得绿灯后，开始重构 `GlobalStatusBar.vue` 和 `statusbar_manager.ts` 落实上述 4 个需求。
