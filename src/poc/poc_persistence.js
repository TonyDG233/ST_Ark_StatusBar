/**
 * @name PoC v4 - 偏好配置持久化到世界书
 * @description 验证将 UI 配置（或其他需要长期保存的用户偏好）直接存入世界书条目内容中，脱离 localStorage。
 * 
 * 测试方法：
 * 1. 在酒馆环境（主窗口或 iframe）控制台执行此脚本。
 * 2. 脚本会自动寻找或创建一个名为 `[ARK_SYS_CONFIG]` 的特殊条目。
 * 3. 尝试在其中读写 JSON 数据并进行持久化。
 */

(async function() {
    console.log("[PoC v4] 开始测试持久化到世界书...");

    // 1. 获取酒馆原生函数和当前绑定的世界书名称
    // 提示：我们不“编造函数”，全部使用 @types 中明确定义的辅助函数
    let targetWorldbook = null;
    try {
        const result = await getCharWorldbookNames('current');
        if (result.primary) targetWorldbook = result.primary;
        else if (result.additional && result.additional.length > 0) targetWorldbook = result.additional[0];
        
        if (!targetWorldbook) {
            console.error("[PoC v4] 找不到当前绑定的世界书。请确保当前角色卡绑定了世界书。");
            return;
        }
        console.log(`[PoC v4] 目标世界书: ${targetWorldbook}`);
    } catch (e) {
        console.error("[PoC v4] 获取世界书名称失败:", e);
        return;
    }

    const CONFIG_ENTRY_NAME = "[ARK_SYS_CONFIG]";

    // 2. 查找是否存在该条目
    let entries = await getWorldbook(targetWorldbook);
    let configEntry = entries.find(e => e.name === CONFIG_ENTRY_NAME);

    // 如果不存在，新建一个
    if (!configEntry) {
        console.log(`[PoC v4] 未找到 ${CONFIG_ENTRY_NAME}，正在创建...`);
        const initConfig = {
            _desc: "这是ARK_STATUSBAR的自动备份条目，请勿手动修改",
            theme: "dark",
            hiddenEntries: [],
            lastUpdateTime: Date.now()
        };
        
        // 使用标准的 createWorldbookEntries
        const createResult = await createWorldbookEntries(targetWorldbook, [{
            name: CONFIG_ENTRY_NAME,
            comment: CONFIG_ENTRY_NAME,
            content: JSON.stringify(initConfig, null, 2),
            enabled: false, // 设置为 false，防止被当作常规提示词拼接到上下文中
            constant: false // 同样不需要常驻
        }]);
        console.log("[PoC v4] 创建成功:", createResult);
        
        // 重新获取一下
        entries = await getWorldbook(targetWorldbook);
        configEntry = entries.find(e => e.name === CONFIG_ENTRY_NAME);
    } else {
        console.log(`[PoC v4] 找到现有的 ${CONFIG_ENTRY_NAME} 条目，UID: ${configEntry.uid}`);
    }

    // 3. 读取内容并进行修改 (对于 JSON 格式的解析)
    let parsedConfig = {};
    try {
        parsedConfig = JSON.parse(configEntry.content);
        console.log("[PoC v4] 读取到的原有配置:", parsedConfig);
    } catch (e) {
        console.warn("[PoC v4] JSON 解析失败，可能格式错误或这是个自然语言条目。将使用正则尝试提取或直接覆盖。");
        // 这里如果是类似于 YAML 的缩进自然语言，比如 "主题: 暗色"
        // 我们可以用正则： configEntry.content.match(/主题:\s*([^\n]+)/) 
    }

    // 执行修改：模拟用户在 UI 上将主题切到了 light，并把某个单字干员加入隐藏列表
    parsedConfig.theme = parsedConfig.theme === "dark" ? "light" : "dark"; // 切换主题
    parsedConfig.lastUpdateTime = Date.now();
    if (!parsedConfig.hiddenEntries) parsedConfig.hiddenEntries = [];
    if (!parsedConfig.hiddenEntries.includes("年")) {
        parsedConfig.hiddenEntries.push("年");
    }

    const newContent = JSON.stringify(parsedConfig, null, 2);

    // 4. 将修改写回世界书
    console.log("[PoC v4] 准备写回新的配置:", parsedConfig);
    try {
        await updateWorldbookWith(targetWorldbook, (wbEntries) => {
            const entryToUpdate = wbEntries.find(e => e.name === CONFIG_ENTRY_NAME);
            if (entryToUpdate) {
                entryToUpdate.content = newContent;
                // 确保它不会被发给 AI
                entryToUpdate.enabled = false; 
            }
            return wbEntries;
        });
        console.log("[PoC v4] 成功！配置已持久化保存进世界书中。");
        alert(`[PoC v4 测试成功]\n配置已成功保存至条目 ${CONFIG_ENTRY_NAME}！\n主题已切换为: ${parsedConfig.theme}\n请查看酒馆的世界书管理面板，确认该条目的 content 内容。`);
    } catch (e) {
        console.error("[PoC v4] 写回配置失败:", e);
    }
})();
