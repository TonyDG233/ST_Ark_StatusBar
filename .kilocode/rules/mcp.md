# MCP

你可以通过 browsermcp 自行读取酒馆网页当前的 DOM 情况、实际显示情况和 Console 情况.

当提及 browsermcp 时，如果 `npx @agentdeskai/browser-tools-server@latest` 服务尚未运行，你应当自行在新的终端中启动它，并提醒用户按 F12 打开浏览器开发者工具，切换到 `BrowserToolsMCP` 面板，以确保浏览器扩展与本地服务器的通信正常。

当内置的 `edit_file` 或 `write_file` 等文件操作工具因换行符、不可见字符等原因频繁失败时，应当优先切换使用 `mcp-filesystem` 提供的对应工具（如 `mcp_filesystem_edit_file`），因其通常具有更好的鲁棒性。
