# 剧情状态机补全 × Web 完整化路线图 (COMPLETION_ROADMAP)

> 关联文档：`MASTER_PLAN.md`（机械转译红线）、`../poc/prts_v3_sandbox/SANDBOX_V3_SUMMARY.md`（V1 逆向结论）、`LONG_TERM_VISION.md`（长期路线）。
> 本文档回答两个问题：
> 1. **怎么把剧情状态机补全**（全量语料 → 状态清单 → 与原版 legacy 播放器逐一比对 → 修复优化）；
> 2. **怎么把这个沙盒规范成一个完整 Web 软件**（可打包成 App、可内置素材也可在线拉取、可直接塞进酒馆扩展、**不依赖 Unity**）。
>
> 红线：不引入 Unity / 不塞 Unity 运行时（酒馆是浏览器扩展环境，塞不进去也没必要）；不反编译 IL2CPP 代码；所有效果以「解包资源 + 重实现播放器」的方式在 Web 端复现；素材版权归鹰角，仅限非商业同人使用。

---

## 0. 目标与非目标

### 目标
- **剧情状态机 100% 覆盖**：全量剧本语料里出现的任何指令/参数组合都不得崩溃、不得静默跳过；覆盖率有量化报告。
- **效果器高覆盖率**：`effect / bgeffect` 等命名特效通过「解包 → 中间格式(effect-spec) → 通用播放器」批量落地，导出失败的有兜底，剧本永不卡死。
- **完整 Web 软件**：引擎与视图解耦、可测试、可增量升级语料、可离线内置、可在线拉取、可打包（SillyTavern 扩展 / Tauri / Capacitor）。
- **零 Unity 依赖**：Web 端只用 PIXI/GSAP/CSS/WebAudio 等已有依赖。
- **参照层级（验收口径）**：可见效果的真相源是**官方录像**（C.7 流水线）；客户端解包资源是参数/素材真相；legacy V1 播放器只是"可执行、可批量"的**语义下限参照**——对齐它正确的地方，超越它残缺的地方，"还原 legacy" 从来不是目标。

### 非目标
- 不做逐特效像素级 1:1（自定义 shader / 后处理只做近似，记录在案）。
- 不修改 / 不绕过官方客户端，不做账号登录相关操作；解包环节离线匿名。
- 不把整包美术塞进 JS bundle（素材走 lazy load + 缓存 / 外部数据目录）。

---

## 1. 现状盘点（起点）

| 资产 | 位置 | 状态 |
| --- | --- | --- |
| V1 legacy 引擎逆向基准 | `src/poc/prts_v3_sandbox/`（`prts_analyze.js` 3707 行、`prts_scenario.js`、`prts_timer.js`、`sandbox.html`） | 可运行，作为语义唯一参照 |
| Vue3 迁移骨架 | `src/sandbox_AVG/`（`analyzerCore.ts` 路由注册、`core/handlers/*`、`store/avgState.ts`） | 已注册 ~40+ 命令；`effect/bgeffect` 走 `handleUnimplemented`（`analyzerCore.ts:103-104`） |
| 数据字典 | `src/sandbox_AVG/data/datas_*.json/txt` | 仅 359 行样例（不是全量语料） |
| 文本层 | `core/handlers/textHandlers.ts` | 打字机居中靠 `getLen()+paddingLeft` 宽度猜测（根因缺陷）；`animtext` 简陋 |
| 依赖 | 父工程 package.json | 已有 `pixi.js@8`、`gsap`、`vue3-pixi`、`pinia`、`@playwright/test` → 效果器与测试不需要新重型依赖 |
| 解包参考 | `D:\LLM\self_programming\Stronghold-Protocol\tools\local-extract\`（`extract.py`、`aklz4.py`、`requirements.txt`） | 已验证「UnityPy 解 AB → 中间格式 → Web 渲染」管线（材料/网格/prefab/贴图），但**尚未导出 ParticleSystem** |

**关键认知**：
- 「状态机」不在引擎代码里，而在**全量剧本命令流**里；引擎语义（每条指令怎么演）来自 V1 逆向，这是你已经有的那一半。
- 效果器 = 资源 + 行为两层；资源可从客户端 AB 解出，行为（粒子模块/曲线/shader）分批转换或近似。

---

## 2. 总体架构（目标形态）

```
┌───────────────────── 数据层（可插拔 DataSource）─────────────────────┐
│  本地内置包(zip/目录)   │  PRTS 静态镜像(torappu/static)  │  MediaWiki API │
│            └──────→ 统一 IMDB 接口 + IndexedDB/Cache 缓存 ←──────┘    │
└──────────────────────────────────────────────────────────────────────┘
┌───────────────────── 引擎层（纯 TS，无 DOM 依赖）────────────────────┐
│  Analyzer（48+ 指令路由）  Timer 语义  txt 状态机  decision/predicate │
│  效果调度器 → effect-spec 解释器（PIXI）                              │
└──────────────────────────────────────────────────────────────────────┘
┌───────────────────── 视图层（Vue3 薄壳）─────────────────────────────┐
│  AVGContainer（DOM 舞台） + UI 控件 + 无 jQuery 事件桥                │
└──────────────────────────────────────────────────────────────────────┘
┌───────────────────── 打包层 ─────────────────────────────────────────┐
│  A. SillyTavern 扩展（iframe + postMessage）                          │
│  B. 独立应用（Tauri 优先 / Capacitor 移动端 / Electron 备选）         │
└──────────────────────────────────────────────────────────────────────┘
```

**贯穿性原则**：引擎输出「可序列化的状态时间线」，视图只是渲染器 → 这才有 golden replay 测试和跨壳复用（扩展/App 同源）。

---

## 3. 工作流 A：全量语料与状态清单（先把地图画出来）

### A.1 拿到全量语料（三选一，按可行性排序）

1. **PRTS 同源数据（最快）**
   - V1 模拟器的 6 个字典（`datas_txt/datas_char/datas_back/datas_audio/datas_link/datas_override`）就是语料本体；你的 `data/` 里只是 359 行样例。
   - 从 V1 页面/其数据源把**完整版**抽出一次（沿用 SANDBOX_V3_SUMMARY.md 的剥离方法），落盘到 `data/full/`。
   - 若走 MediaWiki：**用 API 拿原始 wikitext / 内嵌数据块，不要爬渲染 HTML**：
     `https://prts.wiki/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=<页面>`
     限速（≥1s/req）、一次性本地镜像、之后只读本地。
2. **社区数据 dump**（交叉校验用，作为 A.1 的备胎）。
3. **客户端 AB 解包**（最全最准，见工作流 C 的环境搭建；AVG 剧本一般是 bundle 里的 TextAsset，先全量枚举再筛）。

### A.2 语料规范化

- 统一转 UTF-8（Windows 下注意 GBK 源文件）；统一换行；按 `[HEADER(key=...)]` 切成独立剧本单元。
- 产出 `data/full/index.json`：`{ pageId, title, file, hash, charCount }`，便于增量更新与断点差分。

### A.3 扫描器（新增 `tools/avg-scan.mjs`，Node，无依赖）

职责：把语料编译成**覆盖报告**，这是「有多少状态、缺哪些」的唯一答案来源。

```
输入：data/full/**.txt
解析：
  1) 行级拆分：/^\[([A-Za-z]+)\s*(.*?)\]\s*(.*)$/   → { command, paramStr, trailing }
  2) 对话行：[name="xxx"]正文…                      → dialog 事件（含 name）
  3) 行内标签：<p=\d+>…</>、<br/>                  → inline 标签统计
  4) 参数：k=v 分词（处理引号内逗号，如 pos="-400,-200"）
输出（coverage/ 目录）：
  commands.json   { name: { count, params: { k: valueDomain[] }, pages } }
  effects.json    { name: { count, layers: {1:n,3:n}, firstPages } }   ← effect/bgeffect 专用
  unknown.md      数据里出现、但 registry 未注册的指令（按次数排序）
  unimplemented.md 注册为吸收/未实现的指令
  param-gaps.md   已实现指令的未处理枚举值（如 pos/action/style/focus/screenadapt/fit_mode）
  coverage.md     总览：指令人次覆盖 %、效果名 Top-N 表
```

### A.4 注册表单一事实源

把 `analyzerCore.ts` 的注册清单外化为 `core/registry.json`（或 `registry.ts` 导出常量），扫描器与引擎共用，避免两处漂移。

### A.5 验收标准

- `unknown.md` 为空（全量语料下）。
- `effects.json` 每个名字都有去向：`spec | archetype | fallback`（L 列见 C.6）。
- 报告可重复生成（CI 以新语料跑一次，diff 不得出现意外新增）。

### A.6 客户端侧剧情脚本解包（校验源；"状态机"的原始形态）

语料主源可以用 PRTS 字典，但**必须与官方原文交叉校验、并拿齐脚本引用的资源路径**，这一步从客户端 AB 解（环境同 C.2，共用一次搭建）：

1. 写 `tools/avg-effects/extract_avg_scripts.py`：
   - 遍历 AB 目录逐个 `UnityPy.load(path)`；**不猜 bundle 名**，对所有对象按 `obj.type.name == 'TextAsset'`（或 `ClassIDType.TextAsset`）筛选；
   - 读 `m_Name` + `m_Script` 字节；按 `utf-8 → gbk` 回退解码；
   - 用内容签名判定是否为 AVG 剧本：`\[(HEADER|charslot|Background|PlayMusic|Dialog|animtext)` 命中 ≥2 类才算，写入 `data/client-avg/<m_Name>.txt`；
   - 产出 `data/client-avg/manifest.json`（name、来源文件、字节数、sha1、客户端版本）。
2. 归一化到沙盒格式：`tools/avg-scan/normalize.mjs`（去 BOM / 统一换行 / 统一引号；若客户端格式与 PRTS 格式有差异，转换规则写在脚本注释并在 manifest 记 `converted: true`）。
3. 与 PRTS 语料比对：`tools/avg-scan/compare_corpus.mjs` 按脚本名/标题 join，做归一化 diff，产出 `coverage/corpus-diff.md`，分三类列条目：**只在客户端**、**只在 PRTS**、**双方都有但不一致**（PRTS `datas_override.txt` 造成的差异单独标注）。
4. 验收：corpus-diff 生成；每条差异有结论（PRTS 修正 / 客户端版本新 / 提取错误）；脚本与客户端版本号一并记录，客户端更新后重跑并 diff。

---

## 4. 工作流 B：指令语义对齐（状态机补全的"逐一修复"）

### B.1 行为卡方法（每条指令一份）

对 48 条顶层指令逐一建档，字段固定：

```md
## [camerashake]
- legacy 参照: prts_analyze.js L____ ~ L____（记行号；test 版差异另记）
- 输入: 参数键、值域、省略时的默认值
- 可观察行为: DOM 变化 / system 状态变化 / 计时（挂起=2 的时序）/ 音频
- skip 模式: 原版行为（抹除 / 立即完成 / 不生成）
- auto/click 交互: 是否可被点击加速、是否阻塞
- 我方实现: core/handlers/xxx.ts:___
- 差异与待办: …（逐条勾掉）
- 测试: fixtures/xxx.txt + 期望时间线 replay/xxx.json
```

存放：`docs/behaviors/<command>.md`（新目录，放 `src/sandbox_AVG/docs/`）。

### B.2 Golden Replay 测试台（防回归的核心）

1. **夹具**：`fixtures/*.txt` —— 每个含少量指令的短剧本（含 skip/auto 两个模式）。
2. **运行器**：跑引擎，输出**状态时间线 JSON**（每 tick 的 `{ dialog, chars, bg, blocker, audio, effect, timer }` 快照）。
3. **比对**：与 `golden/*.json` 逐字段 diff；首次人工确认后固化为基准。
4. **视觉抽检**：Playwright（已装）截关键帧，存 `screenshots/`，做像素差阈值报警（不要求 1:1，只看大破相）。
5. **奖励**：任何 handler 改动必须先跑全套 replay。这就是「修了不知道多久又改坏」的终结者。

### B.3 已知缺陷修复队列（按优先级）

1. **打字机：居中 + 从左到右出现（根治）**
   - 现状根因：`textHandlers.ts:251-261` 用 `getLen()` 预估宽度算 `paddingLeft`，整句中心与逐字揭示互相打架，多行必然错位。
   - 方案（span 预布局 + 可见性切换）：
     - `system.txt.now` 赋值时一次性把文本 token 化：可见字符 → `<span class="tw">`（初始 `visibility:hidden`）；`<br/>`、格式化标签原样保留；
     - 容器用**真实布局**居中（固定 width + `text-align:center` 或 flex），删除所有 `getLen`/`paddingLeft` 居中逻辑；
     - 每 tick 只把前 N 个 span 改为 `visible`；`txt.over()`/skip 一次性全显；`now_index` 仍是进度；
     - `animtext` 的 `<p=x>` 多行（`textHandlers.ts:38`）复用同一渲染器。
   - 验收：中/英文字体、长句换行、`multiline` 连缀、点击加速、auto 模式全部通过 replay + 截图。
2. **animtext（地点印章等）**：从"写进 dialog_output"改为独立组件 + GSAP 时间线（`group_location_stamp` 是贝塞尔弹框+旋转菱形）。
3. **sticker/subtitle**：删掉宽度猜测，真实布局定位；淡入/淡出语义与 legacy 对齐。
4. **curtain/masker/camera**：从 10ms `setInterval` 改 DOM 字符串迁移到 CSS transition/rAF（保留 `globalTimer` 时序语义与挂起码 2）。
5. **decision/predicate/skipnode/timer\***：用 fixture 覆盖分支路径；把变量语义文档化。
6. **video**：以 V1 原版播放器绑定为准（test 版实现残缺，勿抄）。

### B.4 legacy 差异对照台账

- 维护 `docs/LEGACY_DIFF.md`：每行 `指令 | legacy 行为 | 我方行为 | 差异等级(A/B/C/I) | 处置(修复 / 有意超越 / 有意忽略) | 参照依据(legacy/录像/客户端资源) | 提交号`。
- 双版本问题（`tmp_analyze.js` vs `tmp_analyze_test.js`）：以 MASTER_PLAN.md 排雷要求为准，逐条登记取用哪边、为什么。

### B.5 逐一比对作业循环（Dual-Run：把 legacy 当黑盒同台跑）

B.1 / B.2 / B.4 是产物，本节定义**产出这些产物的固定作业流程**。工具放 `tools/dual-run/`：

- `legacy.html`：包装页，加载 `src/poc/prts_v3_sandbox/`，支持 `?fixture=<name>`；在 loader 把 fixture 文本注入 `datas_txt` 的 `<pre>` 之后再启动引擎（**不改 legacy 本体**，注入点在脚本启动前）。
- `runner.mjs`（Playwright，已安装）：同时打开 legacy 页与新引擎页，喂同一 fixture；按固定步长/点击事件推进；分别抓**状态时间线 JSON**（`{tick, dialog, name, chars, bg, blocker, audio, effect, timers}`）与固定 tick 截图。
- `diff.mjs`：时间线字段级 diff + 截图对比，产物 `dual-out/<command>/{legacy.json,new.json,diff.md,shots/}`。

**对比的定位（先读这条）**：legacy 是**语义下限参照**——它是唯一"可执行、可批量"的官方行为记录，用来抓机械转写过程中的漂移与缺漏；它**不是质量上限**。你已经在做、而 legacy 做不到的效果与修正（血迹、打字机修正、以后解包出来的命名特效等）一律登记为**有意超越（I 级）**，以录像 / 客户端资源为参照继续完善，**任何情况下不得回退成 legacy 行为**。

每次处理一条指令，固定 6 步（不做例外）：

1. 从 `coverage/commands.json` 按出现人次取下一条指令；
2. 从全量语料抽取覆盖该指令**全部参数分支**的片段做 fixture（每分支 ≥1 例；含正常 / skip / auto 推进模式）；
3. `runner.mjs` 双跑，产出时间线 + 截图；
4. `diff.mjs` 出差异条目，逐条定级：
   - **A = 可见演出/时序差**；**B = 状态/DOM 差**；**C = 实现方式差但表现一致**；
   - **I = 有意超越**：新引擎比 legacy 更对/更全（legacy 吞掉的指令、你已修好的效果、按录像补全的演出）。
5. 处置（三选一，必须登记进 `docs/LEGACY_DIFF.md`，带提交号）：
   - legacy 表现正确 → **修新引擎**（吸收 legacy 的正确语义）；
   - legacy 错/缺而你已更好 → **标 I，保持并继续拔高**；
   - 实现不同但表现一致 → 标 C，写明理由。
6. 将该 fixture 固化为 golden replay（B.2），跑全量回归。

验收：48 条指令每条都有 `dual-out/` 记录；A/B 级差异清零或全部登记为「修复 / 有意超越 / 有意忽略」；**I 级条目只增不减（禁止回退）**；任何新提交不得让既有 replay 变红。legacy 只作黑盒：
注入 fixture 用包装页完成，不去修它的面条代码（找参照时看行号即可，`prts_analyze.js` 顶层 `switch/case` 即"状态机"的实现在处）。

**"legacy"到底指谁（消除歧义）**：指你硬盘上那份 `src/poc/prts_v3_sandbox/` —— **V1 旧网页播放器存档**（社区逆向、可本地运行）。比对全程零账号、零登录、零联网、不需要游戏客户端；不是拿官方游戏比。只有效果器素材的解包（A.6/C.1）才涉及客户端文件，也同样是离线文件操作。

**legacy 本身简陋/有错时，参照优先级阶梯（用于差异仲裁）**：
1. 本地 V1 沙盒（可执行、可批量）——指令语义的默认参照；
2. 官方录像（剧情视频/赛事录像）——A 级（可见演出/时序）差异的最终仲裁者，逐帧对照；
3. 现网 prts.wiki 模拟器 / 其他社区播放器——抽查参照，结论需注明版本差异；
4. 客户端解出的脚本与资源（A.6/C.3）——参数语义的真相源。
即：**legacy 用于"跑得起来的大面积比对"，录像用于"legacy 也说不清的少数仲裁"**。

---

## 5. 工作流 C：效果器解包与 Web 转换（不依赖 Unity）

### C.1 安装明日方舟 PC 端（一次性）

- 从官方渠道安装 PC 客户端（鹰角启动器 / 官方 PC 版）。**解包环节不需要账号**；账号只可能出现在启动器下载客户端这一步。
- 目标目录（任意版本都应存在）：
  `<安装目录>\Arknights_Data\StreamingAssets\AB\Windows`
  （Stronghold-Protocol 的 `extract.py` 已验证此结构并内置 macOS/CrossOver 候选路径。）
- 已有客户端目录/官方完整包/社区 dump 都可以替代本机安装；效果 prefab 建议以客户端 AB 为准。

### C.2 Python 解包环境（沿用已验证管线）

```powershell
# 在 ST_Ark_StatusBar 根目录
py -3 -m venv .venv-extract
.\.venv-extract\Scripts\pip install UnityPy Pillow lz4
# 复用 Stronghold-Protocol 的自定义压缩解码器（LZ4AK）：
#   D:\LLM\self_programming\Stronghold-Protocol\tools\local-extract\aklz4.py
#   注意：该仓库代码为 GPL-3.0-or-later，复制需保留许可与出处说明
```

### C.3 效果名索引器（`tools/avg-effects/index_effects.py`）

```python
# 目标：全量扫描 AB 目录，建立「资源名 → 文件/对象路径」索引
# 1) 遍历 *.ab，UnityPy.load(path)
# 2) 枚举 container / objects，收集 name 以 '$e_'、'$eb_' 开头的对象
#    （AVG 的 effect(name=...) 在资源侧就是同名 prefab）
# 3) 输出 index.json: { '$eb_oripathy': { file, pathId, deps: {textures, materials, meshes} } }
```

- 同时输出 `missing.json`：语料中被引用、但 AB 里找不到的效果名（这批直接进兜底名单）。
- **版本钉死**：记录客户端版本号；游戏更新后重跑索引器并 diff。

### C.4 中间格式：`effect-spec.json`（一次性定 schema，所有导出/播放围绕它）

```jsonc
{
  "id": "$eb_oripathy",
  "duration": 3.0, "loop": true, "layer": 1, "blend": "additive",
  "emitters": [{
    "shape": { "type": "box", "size": [960, 540], "emitFrom": "edge" },
    "rateOverTime": [ { "t": 0, "v": 24 }, { "t": 3, "v": 0 } ],
    "bursts": [{ "t": 0, "count": 30 }],
    "lifetime": [ { "t": 0, "v": 1.2 }, { "t": 1, "v": 2.0 } ],
    "startSpeed": [ { "t": 0, "v": 40 } ],
    "startSize": [ { "t": 0, "v": 24 }, { "t": 1, "v": 48 } ],
    "startColor": [ { "t": 0, "rgba": [1,1,1,0.2] }, { "t": 1, "rgba": [0.8,0.2,0.2,0.6] } ],
    "velocityOverLifetime": null,
    "colorOverLifetime": [ { "t": 0, "rgba": [1,1,1,0.8] }, { "t": 1, "rgba": [1,1,1,0] } ],
    "rotationOverLifetime": [ { "t": 0, "v": 0 }, { "t": 1, "v": 90 } ],
    "textureSheet": { "cols": 4, "rows": 4, "fps": 30, "cycles": 1 },
    "renderMode": "billboard",           // billboard | stretched | mesh | none
    "texture": "textures/eb_oripathy_01.png",
    "subEmitters": []
  }]
}
```

- **曲线采样**：AnimationCurve 关键帧导出为 `[{t,v,inSlope,outSlope,pre,post}]`，播放器按同规则采样；Gradient 同理（colorKeys + alphaKeys + modes）。
- **色彩空间**：记录 Unity 工程色彩空间（Linear/Gamma）与混合模式，播放器统一在线性空间计算再输出。

### C.5 导出器与通用播放器

- **导出器**（`export_spec.py`，UnityPy）：读 prefab 的 ParticleSystem 序列化字段（emission/shape/各 over-lifetime 模块/renderer/textureSheet/sub-emitter）+ 引用贴图/材质/网格 → 写 `effect-spec` + 拷贴图。
  - 解析难点预期：`m_Modules` 嵌套、AnimationCurve/Gradient 编码、TypeTree 缺失时需回退 `read_typetree` 或按版本 dump 原始字段，逐项解决并记录。
- **播放器**（`src/sandbox_AVG/core/effects/ParticlePlayer.ts`，PIXI 8）：
  - 确定性模拟（固定步长 + 种子随机）→ 可 replay、可截图比对；
  - 支持 billboard/stretched、additive/alpha 混合、多 emitter、sub-emitter、sprite-sheet；对象池 + `ParticleContainer`；
  - 层叠：按 `layer` 参数映射到舞台 compositing 层（与 blocker/curtain 的 z 序统一定义）。
- **特例档**：
  - 序列帧 → sprite-sheet 播放器；视频 → `<video>`/解码帧；
  - 自定义 shader / 后处理 → 人工近似（清单化，每个记录「原效果截图 + 实现 + 差异等级」）；
  - 全部失败 → 静帧/淡入淡出兜底 + 日志（**绝不阻塞剧本**）。

### C.6 映射表与覆盖率

`effects.map.json`：`{ "<name>": { kind: "spec"|"archetype"|"shader-manual"|"fallback", ref: "<file|archetypeId>", note } }`。
工作循环：扫描器 Top-N → 索引器定位 → 导出 spec → 播放器播 → 与录像/截图比对 → 更新映射表 → 覆盖率上升。
**覆盖率按"出现人次"加权**，优先做高频原型（尘土/烟雾/火花/治疗光/雨/暗角/闪烁叠加），长尾兜底。

### C.7 官方录像与 AI 辅助评审流水线（可见效果的真相源）

**目标口径**：可见演出的验收参照是**官方录像**（剧情实况/赛事录像），不是 legacy 播放器。解包负责"能自动的部分"，本流水线负责"解包拿不到、只能看的部分"（地点印章、转场、滤镜类演出等）。

1. **录像采集与入库**（本地个人研究用，遵守来源平台条款）：
   - 检索：`<活动名/章节名> 剧情 实况`、日服对应名；优先 1080p 无遮挡（不压对话框/特效区域）的录像；
   - 本地存档工具（如 `yt-dlp`）落盘 → `refs/videos/<storyId>_<来源>.mp4`；
   - 登记 `refs/videos/index.json`：`{ storyId, file, t0, note }`，`t0` = 剧本第 1 行出现的视频时刻；
   - **对齐锚点**：用对话框文本 OCR 或黑场切分定位 `t0`（人工标定一次即可），之后按指令序号对齐时间轴。
2. **帧采样与接触表（双方同基）**：
   - 官方：`ffmpeg -i in.mp4 -vf "fps=10,scale=1920:1080" official/f_%05d.png`；效果细节区间补抽 `fps=30`；烧时间码（`drawtext=text='%{pts\:hms}'`）防错位；
   - 接触表：`ffmpeg -vf "fps=2,scale=480:-1,tile=5x4"` 或 ImageMagick `montage` → `official/sheet_%03d.png`（10 帧/行 + 时间码）；
   - 我方：`tools/dual-run/runner.mjs` 固定虚拟帧步进 + Playwright 截图，产出 `ours/sheet_*.png`，与官方**同分辨率、同裁切框、同时间基**。
3. **AI 评审包（标准化，否则多模态模型比不出东西）**：
   - 约定（写入 `refs/README.md`）：1920×1080、坐标原点、裁切框、帧率、时间起点必须固定；
   - 每个效果生成 `review/<effect>/{official.png, ours.png, side_by_side.png, spec.json, questions.md}`；
   - `questions.md` 固定八问：①出现/消失时刻差 ②位置差 ③缩放差 ④旋转/运动路径差 ⑤颜色/透明度差 ⑥层叠顺序差 ⑦循环/节奏差 ⑧其他可见差异；
   - AI 的结论**只回填参数**（effect-spec 字段或 GSAP 时间线数值），不直接改代码；每轮修复后重出同基截图，闭环迭代。
4. **不可解包效果的逐帧还原（例：`group_location_stamp` 地点印章）**：
   - 官方帧 → 裁出目标区域 → OpenCV 逐帧运动追踪 → `track.json`：每帧 `{t, x, y, scale, rot, alpha}`；
   - 关键帧抽稀 + 缓动拟合 → 转 GSAP timeline 或 effect-spec 动画段；
   - 你现在的图标动画版本作为 **I 级基线**，之后只是"逼近官方"的迭代，不推倒重来、也不追求解包意义上的 1:1。
   - 工具骨架 `tools/ref-lens/track.py`：
     ```python
     # 输入: refs/<effect>/official/crop/*.png 序列
     # 输出: refs/<effect>/track.json
     # 1) cv2.matchTemplate(手选首帧模板) 逐帧定位中心/尺寸
     # 2) ORB/SIFT 特征点估旋转与缩放
     # 3) 中值滤波去抖 → RDP/最小二乘抽关键帧 → 输出 {t,x,y,scale,rot,alpha}
     ```
5. **验收**：每个 A 档效果必须有 official/ours 接触表 + review 报告；I 级条目的每次改善以"八问差评项减少"记录在案；第三方录像来源与版本差异写进 `refs/videos/index.json` 的 `note`。

---

## 6. 工作流 D：工程化与打包（把它变成完整 Web 软件）

### D.1 引擎 / 视图解耦（进行中，收尾）

- 目标：`core/` 不 import 任何 DOM/jQuery；`AVGContainer.vue` 只做「状态 → DOM」渲染。
- 现状技术债：多处 `$("#id")`（`textHandlers.ts`、`engineActions.ts` 等）与 `system.txt.dynamic` 直写 DOM。过渡策略：先加 `ViewBridge` 接口（`showDialog/clearDialog/appendChar/setBg/...`），jQuery 实现留在 bridge 内，后续逐个替换为 Vue 响应式。
- 禁止新增 `innerHTML` 拼接（安全 + 性能）；统一走 bridge。

### D.2 数据源适配器（内置 / 静态镜像 / MediaWiki 实时）

```ts
interface StoryDataSource {
  list(): Promise<StoryMeta[]>;
  load(pageId: string): Promise<ScriptUnit>;
  assetUrl(rel: string): Promise<string>; // 立绘/BGM 等
}
// 实现：
// EmbeddedSource —— 内置 zip/目录 / <input type=file> 导入
// StaticMirrorSource —— system.sourceUrl / assetUrl（torappu/static.prts.wiki）
// MediaWikiSource —— prts.wiki api.php（raw wikitext；限速 ≥1s；可选）
// CachedSource —— 装饰器：IndexedDB/CacheStorage 命中优先，离线可用
```

- **CORS 现实**：远程源能否直连取决于对方响应头；不能直连时自动降级为「导入本地包」，并在 UI 明示。不要做 `no-cors` 自欺。
- **素材与文本分离缓存**：文本小（MB 级）可全量缓存；美术按需 LRU（配额上限 + 清理策略）。

### D.3 打包形态

| 形态 | 技术 | 注意 |
| --- | --- | --- |
| SillyTavern 扩展（近期主目标） | 现有 webpack 产物 + `manifest.json`（UI extension），iframe 内挂 `AVGContainer`，`postMessage` 桥接 | 无 Node 运行时；全部依赖打进 bundle；CSS 必须限制在 `.arknights-avg-container` 作用域；数据走导入/缓存 |
| 桌面 App | **Tauri**（首选，体积小、系统 WebView） / Electron（备选，重） | 内置资源目录 + 本地缓存路径；文件系统能力用于「导入数据包」 |
| 移动 App | Capacitor（复用同一 Web 产物） | 触摸事件桥接（legacy 只有鼠标事件，需补 touch） |

### D.4 测试与 CI

- `typecheck` + `lint`（已有 eslint）门禁。
- `avg-scan` 覆盖率报告作为 CI 产物（新增 unknown 直接 fail）。
- Golden replay（B.2）全量跑；Playwright 截图抽检。
- 性能预算：首屏（不含素材）JS/CSS 上限；粒子播放 60fps@1080p 基准场景；内存上限与泄漏检查（长剧本连续播放 30min）。

### D.5 安全与版权

- 仅非商业同人；发布页/README 声明素材版权与代码许可（复用 Stronghold-Protocol 的 GPL 组件时保留出处）。
- 不内置任何需要登录/破解才能获得的资源；解包说明仅面向自有客户端的个人使用。

---

## 7. 里程碑与验收（建议按此顺序推进）

### M0 · 语料与清单（先把地图画出来）
- [ ] `data/full/` 全量语料落盘（含 `index.json`）
- [ ] `tools/avg-scan.mjs` + `coverage/` 报告生成
- [ ] `core/registry.json` 单一事实源接入引擎与扫描器
- [ ] （校验源，可与 M2 并行）客户端 AVG 脚本解包（A.6）→ `corpus-diff.md`
- ✅ 验收：`unknown.md` 空；effects Top-N 表产出；报告可重复生成

### M1 · 文本层根治（先拔掉最疼的钉子）
- [ ] 打字机 span 预布局改造（B.3.1 全部验收项）
- [ ] animtext 组件化（GSAP；地点印章等无法解包的动画走 C.7.4 逐帧轨道）
- [ ] sticker/subtitle 定位重构
- ✅ 验收：居中+逐字、多行、skip/auto、点击加速全绿；replay + 截图

### M2 · 指令全量对齐
- [ ] 48 条行为卡建档完毕
- [ ] dual-run（B.5）记录覆盖全部 48 条指令，A/B 级差异清零或登记为「修复 / 有意超越 / 有意忽略」
- [ ] `LEGACY_DIFF.md` 全部条目有处理结论
- [ ] Golden replay 覆盖全部指令
- ✅ 验收：全量语料 unknown=0、崩溃=0；legacy 正确语义全部对齐（A/B 清零），I 级（有意超越）只增不减

### M3 · 效果器管线 v1
- [ ] 解包环境 + 效果索引器（C.1–C.3）
- [ ] effect-spec 导出器 + PIXI 播放器（C.4–C.5）
- [ ] 映射表 + 兜底策略接入引擎（C.6）
- [ ] 录像参照流水线（C.7）：采集→抽帧→接触表→AI 评审包，跑通第一个效果
- [ ] 首个"不可解包效果"逐帧还原（C.7.4，如 `group_location_stamp`）产出 `track.json` 并接入
- ✅ 验收：高频 Top-20 效果可播；未覆盖的 100% 有兜底不卡死；A 档效果有 official/ours 接触表与 review 报告

### M4 · 工程化收尾
- [ ] ViewBridge 替换（去 jQuery 直操作）
- [ ] 数据源适配器 + 缓存 + 导入 UI
- [ ] CI 全链路（typecheck/lint/replay/scale）
- ✅ 验收：引擎层零 DOM 引用；断网可播已缓存剧本；CI 绿

### M5 · 打包发布
- [ ] SillyTavern 扩展包（manifest + 构建产物 + 使用说明）
- [ ] Tauri 桌面包（内置资源目录 / 首次导入向导）
- [ ] 版本钉死与升级脚本（客户端更新后重跑索引器）
- ✅ 验收：酒馆加载无冲突；桌面 App 离线可完整播放内置剧本；在线模式可拉新剧本

---

## 8. 风险与红线

| 风险 | 对策 |
| --- | --- |
| 自定义 shader 无法自动转换 | 清单化人工近似；差异等级记录；必要时接受降级 |
| 客户端更新改变 AB 布局/TypeTree | 版本钉死 + 索引器可重跑 + diff 报告 |
| 远程源 CORS/限速 | 本地优先 + 导入兜底；MediaWiki 走 API 且限速 |
| 长尾效果吞噬工期 | 以「出现人次加权覆盖率」为指标；长尾一律兜底 |
| legacy 代码语义本身有 bug | 以录像/官方为准修正，差异记入 LEGACY_DIFF.md |
| 版权 | 非商业同人声明；不随包分发未授权素材（由用户导入自有数据） |

### 8.1 已知不确定性（还没踩、但大概率遇到的坑）

- **A.6 剧本枚举可能不全**：TextAsset 可能分布在非预期容器/被切分，客户端解包只作校验源；主语料仍以 PRTS 全量字典为准。
- **ParticleSystem 导出器**：部分 Unity 版本缺 TypeTree，曲线与模块嵌套字段读不全是常态；导出器必须有"原始字段 dump + 人工补"的降级路径，别把 100% 自动当成前提。
- **在线模式的 CORS**：prts 静态源不一定给 CORS 头；MediaWiki 模式要限速且可随时降级为"导入本地包"，不要设计成强依赖在线。
- **录像仲裁有噪声**：不同实况有剪辑/加速/UI 遮挡/版本差异，`t0` 对齐可能需人工多次校准；A 级效果尽量找两个来源互证。
- **AI 评审不可全信**：多模态对粒子时序/透明度的判读不稳定，"八问"结论必须人工复核后再回填参数。
- **legacy 注入夹具的启动时序**：V1 依赖 jQuery/全局脚本的加载顺序，`?fixture=` 注入可能要多试几次才稳定；test 版与原版不一致处按 MASTER_PLAN 排雷原则处理。
- **性能是真实风险**：DOM 舞台 + PIXI 粒子 + 录像对照截图三者叠加时的帧率与内存，M1/M3 就要设预算与压测，不能留到最后优化。
- **宿主环境差异**：SillyTavern iframe、Tauri WebView、移动端 WebView 的 CSS/字体/触摸行为不一致；D.3 的验收要在真实宿主里跑，不能只在 Chrome 过。

---

## 9. 附录

### 9.1 路径速查
- V1 基准：`src/poc/prts_v3_sandbox/`
- 引擎：`src/sandbox_AVG/core/`（`analyzerCore.ts`、`handlers/`、`visualEffects.ts`、`timer.ts`）
- 数据：`src/sandbox_AVG/data/`（样例）→ 目标 `data/full/`
- 解包参考：`D:\LLM\self_programming\Stronghold-Protocol\tools\local-extract\`
- 客户端 AB：`<安装目录>\Arknights_Data\StreamingAssets\AB\Windows`

### 9.2 首批要做的三件事（Executive Summary）
1. **全量语料 + 扫描器**（一天级）：没有全量清单，一切覆盖率都是拍脑袋。
2. **打字机根治**（一天级）：`span 预布局 + visibility 揭示`，删掉 `getLen` 居中，replay 固化。
3. **效果索引器先行**（周级）：先不追求播放，先把 `$e_/$eb_` 名字→prefab→依赖索引建成，再看哪些能自动、哪些要人工。

> 记住验收哲学：**状态机看覆盖率与回归测试；效果看"官方录像对照 + 永不卡死 + 加权覆盖率"**。
> 不设「全特效像素级 1:1」这种无底洞验收——那是项目猝死的原因；无法解包的少数（如地点印章）走录像逐帧轨道（C.7.4），按"八问差评项递减"迭代。