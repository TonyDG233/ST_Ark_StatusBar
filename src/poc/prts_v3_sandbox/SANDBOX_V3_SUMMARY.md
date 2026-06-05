# PRTS V3 纯净沙盒与核心引擎逆向总结 (Sandbox V3 Summary)

**日期**: 2026-06-05
**目标**: 将拥有 7 年历史、高度耦合于 MediaWiki 框架的 PRTS 剧情模拟器（V1）提纯为一个完全独立、本地可运行、数据解耦的黑盒基准实例，为下一步开发 Vue 3 版本的新引擎 `<ArkVnPlayer>` 铺平道路。

---

## 1. 核心架构与“降维”发现

在两万多行的面条代码和巨大的 HTML 树中，我们成功提取并破解了引擎的核心运作法则：

### 1.1 数据驱动真相：巨型 `<pre>` 字典
引擎并不通过 API 获取资源，而是依赖埋藏在 HTML 内部的 6 个巨型字典。我们将它们成功剥离为标准的 JSON/TXT，彻底实现了**数据与逻辑的解耦**：
*   **`datas_char.json` / `datas_back.json`**: 记录上万个立绘与背景图片对应真实 CDN 下载地址的映射表。
*   **`datas_audio.json`**: 音效与 BGM 的索引库。
*   **`datas_link.json`**: 极其重要的【差分与物理渲染参数】字典。
*   **`story_data.txt`**: 纯文本的剧本文件。后续测试只需修改此文件即可实时在本地沙盒预览演出效果。

### 1.2 渲染指令破译：`#` 与 `$` 的法则
原版剧本中 `[charslot(name="avg_npc_2231_1#8$1")]` 的语法被完全破解：
*   **`Base ID`** (如 `avg_npc_2231_1`): 角色基础骨架。
*   **`$` (Skin / Variant)**: 角色的大型形态差分，如穿衣/脱衣、持武器/空手。
*   **`#` (Expression)**: 在当前形态下的面部表情数组索引。
*   **物理锚点 (`pos` & `size`)**: `datas_link.json` 中保留了官方调优后的坐标和分辨率，这规避了我们在 V2 引擎中手动对齐万张图片的灾难。

### 1.3 语义标注与资产降维管线
通过对进场指令 `[charslot]` 与对话指令 `[name=]` 的上下文关联分析，我们验证了可以利用脚本全自动地为原本毫无意义的 `avg_npc_xxx` 代号打上“真名”与“情绪标签”。这为未来由大语言模型（LLM）直接驱动方舟立绘演出提供了完美的语义化词典。

---

## 2. Sandbox V3 纯净运行环境构建纪实

为了让庞大的引擎能够在本地离线环境（或 Live Server）顺畅“点火”，我们执行了严格的剥洋葱手术：

### 2.1 物理级外壳切除 (Physical Excision)
*   彻底移除了 L53~L24800 之间混杂的所有 MediaWiki 导航栏 (`#mw-navigation`)、底部表格 (`table.wikitable`)、页脚以及冗余的警告框。
*   斩断了产生 `403 Forbidden` 与跨域拦截的监控脚本（Sentry, Google Analytics, DisplayController）。

### 2.2 静态资源本地化与 0 CORS 改造
*   将依赖库 `jQuery`、`PreloadJS` 以及原版工具库 `krliov.toolbox.js`、`arknights-scenario.css` 全部下载至本地 `assets/` 目录。
*   把 CSS 内部的防盗链图库和字体替换为无拦截的公共 CDN (jsDelivr / Google Fonts) 及相对路径。

### 2.3 逻辑拆解与时序修复 (Engine Decoupling)
*   将原本杂糅在 HTML 里的 JS 代码按职责切分为 `prts_timer.js`、`prts_analyze.js` (4000行核心)、`prts_scenario.js` (配置与变量)、`prts_events.js` (事件绑定)。
*   **解除封印**：拆除了 MediaWiki 特有的 `window.RLQ` 异步等待队列，释放了核心动画函数 `$.prototype.fadeToExit`。
*   **动态装载 (loader.js)**：编写了现代化的 `fetch` 装载器。它会先将 `data/` 目录下的 JSON 拉入内存并复原为引擎所需的 `<pre>` 和 CSV 字符串结构，待数据完全就位后，再按严格的层级顺序同步注入四大引擎脚本，最后触发 IIFE 自执行完成点击事件的绑定。

---

## 3. 下一步计划 (Next Steps)

当前 `sandbox.html` 已是一个完美可交互、0 报错的 V1 黑盒基准（Baseline）。
后续重构不必再死磕其内部的 jQuery 面条代码，可直接采取**状态机抽取策略**：
1. 分析 4000 行 `txt_analyze` 中提取出的正则表达式集合。
2. 结合纯净的 JSON 数据字典，在 Vue 3 项目中创建全新的状态更新机制（Pinia）。
3. 用原生 CSS Transition 替代旧版的 `Timer` 与 `jQuery.animate`，彻底完成 `<ArkVnPlayer>` 现代化重构。