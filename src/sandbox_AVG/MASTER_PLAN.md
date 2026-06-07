# PRTS 剧情引擎 V2 - 机械转译与重构主计划 (MASTER_PLAN)

## 0. 核心原则与绝对红线 (Absolute Red Lines)
1. **机械翻译，拒绝大模型幻觉**：面对庞大的遗留代码，大模型严禁在转译阶段进行任何“创造性优化”、“裁剪”或“自作主张的省略”。所有的坐标计算、魔法数字（如 `* 0.75`, `1.2` 缩放因子）、延时调用，都必须忠实转译为 TypeScript 格式。
2. **底层黑盒函数 1:1 保留**：遇到类似 `exFun.charPos(n, temp.ps)` 这种外部辅助函数，**必须**照抄调用签名，将其重写为纯函数。绝不允许通过传 0 或瞎猜来绕过。
3. **保留原版视图层作为过渡基准**：前端组件阶段，必须**原样照抄** `sandbox.html` 和 `arknights-scenario.css` 中的 DOM 结构和 ID/Class 名称。先让原始的 HTML 树结合 Vue 3 跑起来，之后再做“笨组件”拆分与局部的 SCSS 封装。不要凭空臆想 Vue 模板的层级！
4. **PreloadJS 的替代策略**：原版使用了 `preloadjs.min.js` 进行资产预加载。在 Vue 3 与现代浏览器环境中，将弃用此第三方老旧库。替代方案：在全局挂载前，编写基于原生 `Promise.all` 结合 `new Image().onload` 和 `Audio` 对象的新版预加载纯函数 `utils/preload.ts`。

---

## 1. 原工程物理文件与静态资产完整索引 (File & Assets Index)

全部核心参考代码与数据资产位于 `src/poc/prts_v3_sandbox/`。

| 文件/目录名 | 职责描述 | 处理策略 |
| :--- | :--- | :--- |
| `data/` (目录) | 包含所有剧情文本 (`datas_txt.txt`) 和核心索引字典 (`datas_char.json`, `datas_back.json`, `datas_audio.json`, `datas_link.json` 等)。 | **极度关键的底层数据库**：必须完整复制到 `public/data/` 目录下。交由 Loader 统一 `fetch` 并反序列化注入内存全局字典。原版严重依赖这些 JSON 与 `extend` 函数进行差分与 CDN 图片寻址，绝不能在前端代码中硬编码伪造假路径。 |
| `assets/ui/` (目录) | 包含引擎刚需的控制界面切图（如 `ui_speaker.png`, `ui_fullscreen.png`, `ui_playback.png` 等）。 | **必须**完整复制到 `public/assets/ui/` 目录下。这是原版 CSS 通过相对路径紧密调用的必要依赖，缺少会导致对话框和系统界面严重破相。 |
| `assets/fonts/` (目录) | 包含原版指定的字体文件（如 `NotoSans.ttf`）。 | **必须**完整复制到 `public/assets/fonts/` 目录下。确保跨浏览器渲染时的字体排版宽度与原版保持像素级绝对一致，防止打字机宽度计算错误与溢出。 |
| `sandbox.html` | 原版点火的**唯一 DOM 结构容器**。包含了严格的 `#sys_main`, `#sys_back`, `#sys_char` 等层级嵌套。 | 原封不动抄入 Vue 3 `App.vue` 或 `AVGContainer.vue`，作为初期跑通的基准模板。 |
| `loader.js` (L1-L52) | 利用 `fetch` 加载 `data/` 下的 JSON 并转化为引擎需要的字符串格式。 | 转译为 `utils/sandboxLoader.ts`，保留字符串转化逻辑，将其包装为异步函数返回字典对象。 |
| `prts_events.js` (L1-L52) | 负责绑定 jQuery 全局点击、全屏、重置等外围事件。 | 废除 jQuery 事件绑定，将其业务逻辑转写到 Vue 3 的 `@click` 等原生指令中。 |
| `prts_timer.js` (L1-L148) | 包含原版阻断时序的核心对象 `Timer()` 以及 Cookie 工具。 | 将 `Timer` 类 1:1 转译为 TypeScript 类 `core/TimerManager.ts`，保留其基于 `setInterval` 和 `requestAnimationFrame` 的调度机制，不做彻底推翻。 |
| `prts_scenario.js` (L1-L704) | 包含 `system` 状态单例定义，以及极度核心的 `scenario.extend` 函数库（坐标获取、文本替换）。 | 提取其 `extend` 里的所有功能函数（共 19 个），转译为 `core/utils/extend.ts` 纯函数库。其 `system` 变量定义转译为对应的 TS Interface 接口规范。 |
| `prts_analyze.js` (L1-L3707) | 包含 `txt_analyze`，处理正则解析与多达 68 种不同的 `switch (case)` 指令分支。 | 将其庞大的 `switch` 根据指令集切片，交由 SubAgent 并发进行无损 TypeScript 转译。 |
| `assets/krliov.toolbox.js` | 原型链扩展（如 `String.prototype.toObject`）。 | 取消对 `String.prototype` 的原型链污染，将其提取为全局导出的纯函数。 |
| `assets/arknights-scenario.css`| 原版所有界面的灵魂级 CSS 样式表。 | 在初期原样全局引入。等组件跑通后，再逐步解耦到各个“笨组件”的 `scoped style` 中。 |

---

## 2. 核心支撑函数完整映射表 (Support Functions Map)
*Agent 在处理依赖时，必须查阅并对应以下确切行数。*

**`prts_scenario.js` 扩展函数库**：
- `charLink` (L296) - 处理差分名
- `charFormat` (L358)
- `charPos` (L366) - **极度重要**，处理坐标与立绘缩放映射
- `replaceTxt` (L387)
- `formatTime` (L393)
- `formatTxt` (L400)
- `getAudioUrl` (L411)
- `serialize` (L416)
- `drawChar` (L434) - **极度重要**，处理 Canvas 黑影渲染，初期必须 1:1 用 Canvas API 转译
- `drawImage` (L456)
- `getFont` (L466)
- `getLen` (L469)
- `getUrl` (L478)
- `getRGBA` (L481)
- `log` (L499)
- `removeComma` (L537)

**其他工具函数**：
- `krliov.toolbox.js` -> `String.prototype.toObject` 等。

---

## 3. 指令集完整映射清单 (Exhaustive Case Map in `prts_analyze.js`)
*原版代码在不同的解析模式下重复注册了多次 case（详见行号）。Agent 转译时须重点参考第一遍的核心实现块（通常在 L34 - L1200 之间）。*

### 3.1 文本与 UI 交互 (Text & UI)
- `animtext` (L34, L3435), `animtextclean` (L1235, L2557)
- `dialog` (L754, L1236, L2062, L2558)
- `dialogsetting` (L2073, L2566)
- `multiline` (L958, L2309, L3557)
- `subtitle` (L1081, L1263, L2421, L2596)
- `sticker` (L1080, L2420, L3634), `stickerclear` (L1259, L2592)
- `header` (L770, L2089)
- `decision` (L710, L2018, L3513)
- `predicate` (L1023, L1252, L2376, L2581, L3590, L3675)

### 3.2 场景、背景与遮罩 (Scene & Blocker)
- `background` (L58, L1224, L1331, L2546, L3455)
- `backgroundtween` (L112, L1384, L3475)
- `gridbg` (L864, L1244, L2216, L2573, L3540)
- `verticalbg` (L865, L1245, L2217, L2574, L3541)
- `largebg` (L866, L1246, L2218, L2575, L3542), `largebgtween` (L930, L2282, L3477)
- `image` (L782, L1241, L2101, L2570, L3456)
- `imagetween` (L842, L2163, L3476)
- `largeimg` (L867, L1249, L2219, L2578, L3543), `largeimgtween` (L931, L2283, L3478)
- `imagerotate` (L829, L2150), `imgeffect` (L2102)
- `blocker` (L137, L1411)
- `masker` / `curtain` (L687, L1232, L1994, L2554)
- `video` (L1193, L2534, L3661)

### 3.3 摄像机控制 (Camera)
- `cameraeffect` (L155, L1429), `grayscale` (L171, L1445)
- `camerashake` (L179, L1453)

### 3.4 立绘表现 (Character)
- `character` (L207, L1227, L1482, L2549, L3488)
- `charslot` (L497, L1228, L1799, L2550, L3490) (含内置定位 `l`/`left`, `m`/`middle`, `r`/`right`)
- `characteraction` (L330, L1609) (含内置操作 `move`, `jump`, `rotate`, `shake`, `zoom`, `exit`)
- `charactercutin` (L399, L1701, L3489) (含内外扩特效 `horiz_expand_center` 等 6 种)

### 3.5 音频与其他逻辑 (Audio & Logic)
- `playmusic` (L987, L2340, L3577), `stopmusic` (L1073, L2413)
- `playsound` (L988, L2341, L3578), `stopsound` (L1074, L2414)
- `musicvolume` (L974, L2327), `soundvolume` (L975, L2328)
- `delay` (L706, L2014)
- `showitem` (L1031, L2387, L3457), `hideitem` (L772, L1255, L2091, L2584)
- `skipnode` (L1056), `skiptoend` (L2589)
- `timerclear` (L1154, L2495), `timersticker` (L1162, L2503)
- `focusout` (L765)
- `theater` (L1134, L2475)
- `interlude` (L2190)
- `playback` / `playback_all` / `pre` / `reset` 等系统级标记。

---

## 4. 任务执行流与验收标准 (SOP & Acceptance)

必须以**极其机械的转译**为主，严禁跳步：

### Step 1: 基础设施转译 (Infrastructure)
- 抓取 `prts_scenario.js` 及其依赖函数（见表 3.1）。
- **要求**：逐个重写为 TypeScript 纯函数。对于未定义的数据结构（如 `system.txt`），要求负责该任务的 Agent 必须在其返回中提供清晰的 TypeScript `Interface` 声明块，供主模型查阅与合并。
- **验收**：函数逻辑必须包含原有所有的乘减算子，绝不遗漏 `0.75` 或正则匹配等逻辑。

### Step 2: 独立 Case 切片与转移 (Case Slicing)
- 针对表 3.3 中巨大的 68 个 Case 群，按照职责领域切分给 SubAgent。
- **要求**：SubAgent（Role: CASE_SLICER）必须返回对该片段 100% 保留了原版 `switch` 内部逻辑的 JS/TS 函数，并标注它所发现的所需的局部状态（State Fields）。
- **验收**：由独立 SubAgent（Role: CODE_REVIEWER）进行双盲对比审计。如果发现生成的 TS 函数吃掉了某个原始变量的赋值，立刻抛出 REJECT 报告并要求人类介入。

### Step 3: 前端结构与样式的“冷启动” (Front-end Bootstrapping)
- 拿着转译好的 TS 数据，直接去对照 `sandbox.html` 里的 DOM 树（`<div id="sys_camera">` -> `<div id="sys_back">` 等等），建立基础的 Vue 3 Container。
- **要求**：在 `index.html` 或者根级组件里强行引用原始的 `arknights-scenario.css`。在样式没有“完美贴合、能够展示出原版视觉特效”之前，绝不允许去进行什么“笨组件拆分”或者“样式解耦”。
- **验收**：在浏览器中启动，不报样式 404 错误，并且原本的对话框与姓名框位置准确无误。

### Step 4: 渐进式微调与解耦 (Progressive Refactoring)
- 只有在前三步的“原味重构”完全跑通且不报错后，才能根据新项目的正式需求，将大泥球组件一步步拆解为更优美独立的 Vue 3 笨组件。
