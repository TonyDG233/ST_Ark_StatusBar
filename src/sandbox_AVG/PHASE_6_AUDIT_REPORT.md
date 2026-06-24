# PRTS AVG 引擎重构排查报告 (Group 3 & Group 4)

## 排查背景与目标
针对 Phase 6 中剩余的 **Group 3 (渲染与媒体控制组)** 和 **Group 4 (基建与数据组)** 文件进行全面排查，核心目标是清除隐式全局依赖（`declare global`, `(window as any)`），识别出不再兼容或强耦合业务的代码并出具替换/删除意见。

## 排查详情

### 1. `core/uiController.ts` 
*   **状态**：🔴 **存在严重隐患！(外部黑盒依赖未清理)**
*   **问题所在**：
    *   `fun_report_to_developer` 函数包含大量对 `(window as any).mw` (MediaWiki 核心对象) 的直接调用，试图发起向 wiki 服务器的 CSRF API 请求（`new mw.Api()`, `api.get`, `api.post`）。
    *   同样的问题也体现在 `fun_report_toggle` 交互中。
*   **处理建议**：在转译至酒馆插件环境时，直接剥除这段上传业务逻辑（可以将其替换为空函数并输出一条 console.log "Report feature is disabled in Tavern Helper."），从而斩断 `mw` 依赖。

### 2. `core/audioController.ts`
*   **状态**：🟢 **安全**
*   **排查结论**：没有全局污染。底层正确引用了 `toolbox.ts` 中的 `audioFade` 纯函数。并且时间参数（秒）传递正确，保留了原版时序。

### 3. `core/visualEffects.ts`
*   **状态**：🟢 **安全**
*   **排查结论**：内部通过 `globalTimer` 进行渐变效果的计算更新，没有依赖外部扩展，不含有任何 DOM 破坏性代码或未预期的全局调用。

### 4. `core/PreloadService.ts`
*   **状态**：🟢 **安全**
*   **排查结论**：纯净的 Promise 预加载器实现，已完全取代了原有的 `window.preloadQueue`。

---

### 5. `core/events.ts` (等待后续处理)
*   **当前进展**：由于原先我的错误理解，该文件顶部的 `declare global { interface JQuery ... }` 污染尚未被完全根除。
*   **遗留问题**：目前存在着向 `JQuery` 原型上注入 `fadeToExit` 的废弃声明，这导致了 TS 类型系统的“掩耳盗铃”。
*   **前置依赖**：底层 `toolbox.ts` 的 `domFadeToExit` 工具现已修补完成。下一步即可在 `events.ts` 中移除该声明，并在各个使用到 `fadeToExit` 的 `handlers/*.ts` 中进行批量替换。

### 6. `core/systemInitializer.ts`
*   **状态**：🔴 **残留外部事件绑定**
*   **排查结论**：在文件末尾的 `fun_sys_init` 函数中，残留了大量的 `button_report` 和 `report_submit` DOM 事件绑定。且事件绑定内部再次出现了 `const mw = (window as any).mw;`。这与 `uiController.ts` 中的报错上报功能紧密耦合。
*   **处理建议**：应随同 `uiController.ts` 的改造，一并清理或精简此处无关的事件监听逻辑。

### 7. `core/DataLoader.ts`
*   **状态**：🟢 **安全**
*   **排查结论**：彻底改写为了基于 `?raw` loader 的 Webpack 静态加载模型。所有数据通过 `strToObject` 洗入 `avgState.ts`，不再依赖任何外部注入。

---

## 关于 core/utils 下文件的必要性说明
*   **`support.ts`**：已清理掉最后的原型链调用（`getPx`）和 `declare global`。目前承担着绘制 Canvas、格式化文本（计算文本像素长度）、RGB换算以及格式化系统 Log 的职责，这些都是渲染计算高度依赖的方法，**仍有强烈保留必要**。
*   **`toolbox.ts`**：已全面重构并修补了时间单位缺陷（包括核心弹药：`domFadeToExit`、`domFadeTo`），提供了 `strToObject` 和基于时间的毫秒级 DOM 淡入淡出替代方案，**作为原版 jQuery 操作的垫片，有绝对保留必要**。
*   **`scenario_extend.ts`**：保存着所有复杂的剧本文本替换、立绘缩放/位移矩阵计算规则，**不可或缺**。

## 后续核心战役 (提议)
接下来最大的动作是将 12 个 `core/handlers/` 中成百上千次的、受到类型系统蒙蔽的 `fadeToExit` 和 `fadeTo`（jQuery 扩展方法），彻底替换为 `toolbox.ts` 中的 `domFadeToExit` 和 `domFadeTo` 纯函数。