# 剧情引擎 V2：次级 API 嗅探器 PoC 测试报告

## 1. 测试基础信息
*   **测试日期**：2026-03-22
*   **测试目标**：验证独立于主聊天的“次级小模型”能否根据剧情节点上下文，稳定输出带有判定结果的 JSON（防废话、防脱轨）。
*   **测试环境**：SillyTavern 注入脚本执行 (`src/poc/story_api_test/story_api_test.js`)
*   **模型选型**：Gemini 1.5 Flash (通过 OpenAI 格式的反代服务器，`/v1` 端点)。

## 2. 测试结果摘要：✅ 成功
*   **系统拦截与请求发起**：通过自定义组装 `generateRaw` 参数，成功实现了静默生成，没有污染主聊天页面。
*   **格式化防抖 (NoThinking Trick)**：借用 MVU 的截断技巧，在提示词数组末尾人为注入 `</thi`（用于对抗模型强制输出思考链），迫使模型第一句话就吐出 JSON。测试证明此招在 Gemini Flash 上 100% 生效。
*   **输出质量 (导演建议)**：
    *   *AI 原文输出*：“由于当前观测到的对话记录为空或未包含有效决策，判定剧情仍停留在起始点。请以旁白或阿米娅的视角，进一步描述整合运动逼近的脚步声与通信中的杂音，强调此时只有博士的指挥能带来转机，引导玩家做出第一个战术指令。”
    *   *评价*：完美符合了“不代写台词”、“给出客观演绎动向”的系统指令约束，且成功解析出了 `targetNode: RI1`。

## 3. 技术发现与 MVU 源码解析 (重点)

在本次 PoC 之后，针对持久化配置的难点，我深入研读了本地 `MagVarUpdate_Ark` (MVU) 的源码（尤其是 `store.ts`），并纠正了之前对于前端脚本配置的认知盲区。

### 3.1 关于 API 格式的兼容性
本次测试使用的 `https://xxxx.com/v1` 是 OpenAI 的兼容格式。
酒馆内建的 `generateRaw` (及其背后的 `custom_api` 字段) 实际上是由 Node.js 后端代理处理的。当你传入一个自定义 URL 并且带上 OpenAI 的 `/v1` 路径时，酒馆后端会自动使用 OpenAI 的 Payload 格式去包裹那些系统提示词。**因此，只要是提供了 OpenAI 兼容层的反代 API（无论是转接 Gemini 还是 Claude），它都是 100% 兼容这套管线的。** 
这也是 MVU 在代码里只暴露出“模型名称、URL、温度”等字段的原因，它默认利用了酒馆对 OpenAI 格式的普适兼容。

### 3.2 脚本级永久化存储：MVU 的真面目
MVU **并没有**使用我们在 `StatusBarManager` 中那种向世界书写入隐藏条目的繁重方式。它极度聪明地“白嫖”了酒馆原生的【扩展设置 API】。

**原理解析**：
1. 酒馆原生提供了一个庞大的全局对象 `SillyTavern.extensionSettings`，后端在每次保存时会将其以 JSON 形式写进硬盘（`data/default-user/settings.json`）。
2. MVU 在启动时执行了：
   `const settings = ref(Settings.parse(_.get(SillyTavern.extensionSettings, 'mvu_settings', {})));`
3. 也就是说，它在这个原本给正式插件用的巨大 JSON 字典里，**私自开辟了一个专属的 `mvu_settings` 键值对**，并且用 Lodash (`_.set`) 和 Pinia (`watch`) 实现了数据的响应式绑定。
4. 每当配置变更，它就调用 `SillyTavern.saveSettingsDebounced()`，让酒馆后端顺手把自己的数据存到了本地文件里。

**启发与我们的 V2 改造**：
这是一种降维打击！这意味着只要我们保证自己起的名字（如 `st_ark_statusbar_config`）不与别人冲突，我们就可以完全舍弃在世界书里塞 `[SYS_CONFIG]` 这种容易被用户误删、且极其占用资源的蠢办法，**转而拥抱与 MVU 完全一致的高性能、永久化本地存储！**

## 4. 下一步行动项
在开始后续流程前，必须完成一次重构与对齐：
1. 重构主项目的 `StatusBarManager`，将其存储机制从世界书条目平滑迁移为类似 MVU 的 `SillyTavern.extensionSettings['ark_statusbar_settings']` 方案。
2. 将本次 PoC 中的“次级 API URL、Key、Model 配置项”纳入统一的新版存储设置中。