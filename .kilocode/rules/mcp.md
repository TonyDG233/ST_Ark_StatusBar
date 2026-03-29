---
alwaysApply: true
---

# MCP 与工具执行规范

## chrome-devtools: 自行阅读和操控酒馆网页

你应该用 chrome-devtools 连接我已经打开的浏览器, 从中读取或操纵连接到的酒馆网页 (其网址与 `.vscode/launch.json` 中配置的 `url` 一致), 来了解当前的界面、脚本情况, 如获取当前的 DOM 情况、实际显示情况、Console 情况、点击界面……

### 检查界面、脚本热重载

打开网页后, 你需要检查 `$('#extensions_settings')` 中的`酒馆助手-实时监听-允许监听`开关是否处于启用状态. 一旦启用, 则界面、脚本代码到酒馆网页的实时同步已经建立好了: 在代码变更后, 酒馆网页上将热重载新的脚本或界面代码, 因此你不需要刷新酒馆网页, 也不需要自己运行 `pnpm build` 来更新代码打包结果, 直接查看网页即可.

### 其他工具指南

当内置的 `edit_file` 或 `write_file` 等文件操作工具因换行符、不可见字符等原因频繁失败时，应当优先切换使用 `mcp-filesystem` 提供的对应工具（如 `mcp_filesystem_edit_file`），因其通常具有更好的鲁棒性。

### 🚨 终端执行命令最高警告 (Windows PowerShell 环境) 🚨

1. **绝对禁止使用 `&&` 拼接符**：
   在使用终端（PowerShell）执行命令时，**严禁**使用 `&&` 这种 cmd.exe/bash 的连接符！如果需要执行多条命令，请分次单独执行，或使用 PowerShell 专用的分号 `;`。
   *错误示例*：`git add . && git commit -m "..."`
   *正确示例*：`git add . ; git commit -m "..."`

2. **TypeScript 类型校验规范 (TS Check)**：
   本项目的原生接口（`@types/`）依赖极其庞大，直接运行 `tsc` 会报出大量外部定义错误。因此，当你修改完代码后想校验是否损坏了项目类型边界时，**必须使用如下专门的命令**以跳过库检查：
   `npx tsc --noEmit --skipLibCheck --project tsconfig.json`

3. **打包构建规范 (Build)**：
   开发测试完毕，确认要输出到 `dist/` 时，执行：
   `pnpm run build`
