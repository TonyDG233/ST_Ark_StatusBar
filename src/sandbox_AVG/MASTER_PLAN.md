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
| `data/` (目录) | 包含所有剧情文本 (`datas_txt.txt`) 和核心索引字典 (`datas_char.json`, `datas_back.json`, `datas_audio.json`, `datas_link.json` 等)。 | **极度关键的底层数据库**：必须完整复制到 `sandbox_AVG/data/` 目录下。交由 Loader 通过 Webpack raw/json loader 直接注入内存全局字典。彻底废弃原版依赖 DOM `innerHTML` 抓取的恶劣行为。 |
| `assets/ui/` (目录) | 包含引擎刚需的控制界面切图（如 `ui_speaker.png`, `ui_fullscreen.png`, `ui_playback.png` 等）。 | **必须**完整复制到 `sandbox_AVG/assets/ui/` 目录下。这是原版 CSS 通过相对路径紧密调用的必要依赖，缺少会导致对话框和系统界面严重破相。 |
| `assets/fonts/` (目录) | 包含原版指定的字体文件（如 `NotoSans.ttf`）。 | **必须**完整复制到 `sandbox_AVG/assets/fonts/` 目录下。确保跨浏览器渲染时的字体排版宽度与原版保持像素级绝对一致，防止打字机宽度计算错误与溢出。 |
| `sandbox.html` | 原版点火的**唯一 DOM 结构容器**。包含了严格的 `#sys_main`, `#sys_back`, `#sys_char` 等层级嵌套。 | 原封不动抄入 Vue 3 `AVGContainer.vue`，并为样式增加 `.arknights-avg-container` 隔离层，作为初期跑通的基准模板。 |
| `loader.js` (L1-L52) | 利用 `fetch` 加载 `data/` 下的 JSON 并转化为字符串注入 DOM 的中转脚本。 | **已废弃**。被重构为纯内存化挂载的 `DataLoader.ts` 替代。 |
| `prts_events.js` (L1-L52) | 负责绑定 jQuery 全局点击、全屏、重置等外围事件。 | 废除 jQuery 事件绑定，业务逻辑交由 Vue 3 容器的生命周期与 `@click` 管理。 |
| `prts_timer.js` (L1-L148) | 包含原版阻断时序的核心对象 `Timer()` 以及 Cookie 工具。 | 将 `Timer` 类 1:1 转译为 TypeScript 类 `core/timer.ts`，保留其基于 `setInterval` 和 `requestAnimationFrame` 的调度机制，不做彻底推翻。 |
| `prts_scenario.js` (L1-L704) | 包含 `system` 状态单例定义，以及极度核心的 `scenario.extend` 函数库（坐标获取、文本替换）。 | 提取其 `extend` 里的所有功能函数（共 19 个），转译为 `core/utils/extend.ts` 纯函数库。其 `system` 变量定义转译为对应的 TS Interface 接口规范。 |
| `prts_analyze.js` (L1-L3707) | 包含 `txt_analyze`，处理正则解析与巨量 `switch (case)` 指令分支。 | **已拆分为双版本备份文件** 存入 `src/sandbox_AVG/temp/`，等待按指令集进行合并切片和路由派发模式的无损 TypeScript 转译。 |
| `assets/krliov.toolbox.js` | 原型链扩展（如 `String.prototype.toObject`）。 | 取消对 `String.prototype` 的原型链污染，将其提取为 `utils/toolbox.ts` 中的全局导出纯函数。 |
| `assets/arknights-scenario.css`| 原版所有界面的灵魂级 CSS 样式表。 | 配合 `AVGContainer.vue` 引入，在组件样式未完全解耦前，原样提供支撑。 |

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
- `krliov.toolbox.js` -> `String.prototype.toObject` 等，现位于 `utils/toolbox.ts`。

---

## 3. 指令集完整映射清单 (Exhaustive Top-Level Case Map)
*经过严格对 `prts_analyze.js` 内部的 `txt_analyze` 及其派生版本 `txt_analyze_test` 进行顶层 Case 分析，得到以下**精确的 48 个**顶层指令（已排除内部嵌套的 `switch`，如立绘位置 `l/m/r` 及立绘动作 `move/jump/rotate` 等）。转译时必须以此为绝对边界进行剥离。*

### 3.1 文本与 UI 交互 (Text & UI)
- `animtext`
- `animtextclean`
- `dialog`
- `dialogsetting` (*test 版独有，控制打字机速度与颜色*)
- `focusout` (*原版独有，空逻辑*)
- `header`
- `multiline`
- `sticker`
- `stickerclear`
- `subtitle`

### 3.2 场景、背景与遮罩 (Scene & Blocker)
- `background`
- `backgroundtween`
- `blocker`
- `curtain`
- `gridbg`
- `image`
- `imagerotate`
- `imagetween`
- `imgeffect` (*test 版独有*)
- `interlude` (*test 版独有，遮罩层逻辑*)
- `largebg`
- `largebgtween`
- `largeimg`
- `largeimgtween`
- `verticalbg`
- `video` (*注意：test 版将此逻辑写残了，必须取用原版的播放器绑定逻辑*)

### 3.3 摄像机控制 (Camera)
- `cameraeffect`
- `camerashake`
- `grayscale`

### 3.4 立绘表现 (Character)
- `character`
- `charactercutin`
- `charslot`
- `characteraction`

### 3.5 音频与其他逻辑 (Audio & Logic)
- `decision`
- `delay`
- `hideitem`
- `musicvolume`
- `playmusic`
- `playsound`
- `predicate`
- `showitem`
- `skipnode` (*原版独有，防误触防御节点*)
- `skiptoend` (*test 版独有，自定义宏*)
- `stopmusic`
- `stopsound`
- `theater`
- `timerclear`
- `timersticker`

---

## 4. 任务执行流与验收标准 (SOP & Acceptance)

必须以**极其机械的转译**为主，严禁跳步：

### Step 1: 基础设施转译 (Infrastructure) [已完成]
- 抓取 `prts_scenario.js` 及其依赖函数。将工具类抽离，状态与变量提取为 Typescript 接口。

### Step 2: 静态数据本地直连化 (Data Loading Refactoring) [已完成]
- 将原版依赖 DOM `innerHTML` 挂载的恶劣写法彻底抛弃，使用 Webpack 特性直接 `import` 纯内存化的 JSON 和 TXT 数据。

### Step 3: 前端结构与样式的“冷启动” (Front-end Bootstrapping) [已完成]
- 原样照搬 `sandbox.html` 的巨型 DOM 结构进入 Vue 3 Container，严格隔离 CSS，搭好 `index.html` 和 `index.ts` 点火骨架。

### Step 4: 核心引擎分发器重构 (Analyzer Dissection)
- **要求**：绝不尝试将整个 3000 行的 `txt_analyze` 塞入一个文件。必须在 `core/analyzerCore.ts` 建立一个基于 Map 的 `CommandRegistry` 路由分发器。
- **排雷验收**：双版本脱节严重。在抽取具体指令（如上述 48 个 Top-Level Case）为专用的 Handler 时，必须人工查对双版本文件（`tmp_analyze.js` 和 `tmp_analyze_test.js`）。强制融合 Test 版的新特性（如 `rotate`、`interlude`）与原版的稳定性修补（如 `video`）。严禁保留上帝变量 `temp` 在不同 Handler 之间穿透。
- **返回机制**：保留原有的 0, 1, 2, -1, -2 状态码，2 代表挂起引擎交由 `globalTimer` 进行时序劫持（Time-Jacking）。

### Step 5: 渐进式微调与解耦 (Progressive Refactoring)
- 只有当前四个步骤“原味重构”完全跑通且在 Vue 下渲染出原版视觉效果后，才能将大泥球视图一步步拆解为更优美独立的 Vue 3 子组件。