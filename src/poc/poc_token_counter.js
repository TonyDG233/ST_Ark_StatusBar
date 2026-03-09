/**
 * POC: Token Counter
 * 目的是测试能否利用酒馆内置工具在前端主动检测当前内容的 Token 数量
 * 由于需要在酒馆环境中运行，你可以将此代码直接复制到浏览器控制台中运行。
 */

// 1. 获取酒馆全局对象
const st = window.SillyTavern || window.parent?.SillyTavern;
if (!st) {
    console.error("未找到 SillyTavern 对象，请确保在酒馆环境中运行此脚本。");
} else {
    console.log("找到 SillyTavern 对象:", st);
    
    // 2. 测试能否获取 Context 并构建 MockChat
    const context = st.getContext?.();
    if (!context) {
        console.error("无法获取 context。");
    } else {
        const rawChat = context.chat || [];
        const chatStrings = rawChat.map((msg) => {
            if (typeof msg === 'string') return msg;
            if (msg && msg.mes !== undefined) {
                let name = msg.name;
                if (!name && st) {
                    name = msg.is_user ? st.name1 : st.name2;
                }
                return name ? `${name}: ${msg.mes}` : String(msg.mes);
            }
            return String(msg);
        });
        
        // 模拟当前用户正在输入的内容
        const mockInput = "这是一段测试用的用户输入文本。";
        const userName = st.name1 || 'User';
        const mockChat = [...chatStrings, `${userName}: ${mockInput}`];
        
        console.log("构建的 MockChat (部分):", mockChat.slice(-3)); // 只打印最后几条
        
        // 3. 将 MockChat 拼接成字符串传递给 Tokenizer
        const chatString = mockChat.join("\n");
        
        // 4. 调用 getTokenCountAsync 计算 Token
        if (typeof st.getTokenCountAsync === 'function') {
            console.log("正在计算 Token...");
            st.getTokenCountAsync(chatString).then(count => {
                console.log(`%c[Token Counter POC] 成功! 计算出当前文本的 Token 数量约为: ${count}`, 'color: green; font-size: 14px; font-weight: bold;');
                console.log("请对比右下角的酒馆官方 Token 计数器，评估误差。");
            }).catch(err => {
                console.error("Token 计算失败:", err);
            });
        } else {
            console.error("找不到 st.getTokenCountAsync 方法。");
        }
    }
}
