# PRTS Parser 重构沙盒工作计划 (PRTS Sandbox Plan)

## 1. 背景与目标
面对 PRTS 原生 `prts_parser.js` 超过 120KB、高度耦合（4000多行“面条代码”）且包含 68 个复杂 `case` 分支的巨型上帝对象，直接在其上进行阅读和翻译已经超出了人类和工具的舒适处理极限。
本计划旨在利用“物理切割 + 分而治之”的策略，将原生 parser 在沙盒（`src/poc/prts/`）中进行拆解和清洗。提取出纯净的指令集与状态规则，为后续用 Vue3 + TS 构建独立的、强类型的、数据驱动的明日方舟剧情渲染引擎 (V2 Engine) 提供规范参考。

## 2. 核心工作流 (SOP)

### Phase 1: 沙盒环境准备与预处理 (当前)
1. 建立 `src/poc/prts` 专属沙盒目录，将所有抓取自 PRTS 的相关文件（`prts_parser.js`, `krliov.toolbox.js`, `prts_parser_readable.js` 等）迁移至此，实现物理隔离。
2. 针对 `prts_parser_readable.js` 现存的缩进混乱（大量转义符 `\n\t`）问题，编写 Node.js 脚本进行精准的格式化清洗。

### Phase 2: 巨型对象物理切块 (Split God Object)
1. 编写专门的切片脚本（Slicer Script）。
2. 解析清洗后的 `prts_parser_readable.js`，精准定位主 `switch (m1)` 语句中的每一个 `case` 节点。
3. 将包含 68 个指令的 `switch` 分支，物理切割为 68 个独立的小型 JS 文件，输出到 `src/poc/prts/legacy_cases/` 目录中。
   *示例：生成 `character.js`, `background.js`, `decision.js` 等。*
4. 保证每个独立切片文件的缩进和换行完全符合人类阅读习惯。

### Phase 3: 归档与后续研究准备 (Next Steps)
1. 完成切割后，我们将拥有一本“PRTS 引擎指令实现字典”。
2. **UI 元素与视觉溯源**：在后续开始 Vue3 组件开发时，我们将再次使用 `agent-browser` 访问 PRTS Wiki 的剧情模拟器，重点抓取其 CSS 样式、DOM 层级组合和动画过渡效果（如对话框样式、立绘遮罩等），将这些视觉素材与切割后的指令逻辑对应起来。
3. 逐步将每个 `legacy_case` 的原生 JS 操作映射并重写为无副作用的 TypeScript 纯函数（Handler）和 Vue 响应式状态。

## 3. 验收标准
- `src/poc/prts` 目录结构清晰，包含所有历史参考源码。
- `src/poc/prts/legacy_cases/` 目录下成功生成 68 个单独的 JS 逻辑切片文件。
- 随机抽查切片文件（如 `character.js`），代码缩进规范，无杂乱的转义符，具备极高的可读性。