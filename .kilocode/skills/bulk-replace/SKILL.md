---
name: bulk-replace
description: 批量且精准地在多个文件中搜索并替换指定的字符串。当涉及到跨模块的依赖路径修改、接口名称变更、或者清理遗留魔法字符串时，使用此 skill 以确保操作的一致性和安全性。
---

# Bulk Replace (批量文本替换) 指南

当项目经历了如重命名目录、提取 Interface 等重构时，需要修改散落在多个文件中的 `import` 路径或类型声明。为了避免人眼核对的遗漏，请使用内置的 Node.js 脚本来执行精准的批量替换。

## 核心原则
1.  **安全第一**：在执行批量替换前，必须先使用 `list_files` 或 `search_files` 确认目标模式的覆盖范围。
2.  **正则精确**：替换脚本必须能准确区分单词边界和特殊的相对路径符号（如区分 `../core` 和 `../../core`），避免误伤。
3.  **脚本化执行**：通过在项目根目录调用本 skill 提供的 Node 脚本进行批量处理，留下可审计的痕迹。

## 执行方法

本 Skill 在 `.kilocode/skills/bulk-replace/scripts/bulk_replace.mjs` 提供了一个健壮的批量替换脚本，支持过滤常见的排除目录（如 `node_modules`, `dist`）。

### 用法
在终端中执行：
`node .kilocode/skills/bulk-replace/scripts/bulk_replace.mjs <directory> <regex_pattern> <replacement_string> [extensions...]`

### 参数说明
1.  `directory`: 必须。要扫描的根目录，通常是 `src/ARK_STATUSBAR`。
2.  `regex_pattern`: 必须。用于匹配的正则表达式字符串（注意在 shell 中执行时的转义问题）。
3.  `replacement_string`: 必须。替换后的字符串内容。
4.  `extensions`: 可选。要扫描的文件后缀名列表。默认值包含 `.ts`, `.vue`, `.js`, `.scss`, `.md`。

### 执行示例

假设我们要把 `src/ARK_STATUSBAR/components` 目录下所有 `.vue` 和 `.ts` 文件中的 `import { logger } from '../../logic/core/logger'` 统一替换为 `import { logger } from '../../core/logger'`。

由于正则表达式在命令行中直接输入比较复杂且容易出错，**极度推荐你（Agent）先在当前目录写一个临时桥接脚本 `run_replace.mjs`**：

```javascript
// run_replace.mjs (临时桥接文件示例)
import { execSync } from 'child_modules'; // 或直接用 fs 逻辑包裹

// 其实最安全的方法是直接运行一段专门定制的替换脚本。但为了复用上面的工具，可以这样：
```

**[更安全的推荐做法]**：
如果替换规则复杂（比如包含多个分组 `(...)` 或者需要动态计算路径层级），直接利用本 skill 的理念：**新建一个一次性的 `.mjs` 脚本文件，把上述逻辑写死在里面运行，运行确认无误后删除。** 
这比强行拼凑单行 Shell 正则命令要可靠一万倍。

如果只是简单的纯文本路径替换，则可以直接执行：
```bash
node .kilocode/skills/bulk-replace/scripts/bulk_replace.mjs "src/ARK_STATUSBAR/components" "logic/core/config_store" "core/config_store" ".vue" ".ts"
```

## 执行流程
1. 根据你的具体替换需求，评估是直接调用 `bulk_replace.mjs` 还是写一个一次性的临时脚本。
2. 申请切换至 **Code** 模式（Architect 无法执行脚本）。
3. 使用 `execute_command` 运行替换脚本。
4. 运行完毕后，**必须**使用 `git diff` 或 `search_files` 检查修改是否符合预期。