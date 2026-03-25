// src/poc/poc_cross_worldbook_update.js

/**
 * PoC 脚本：验证在前端环境中，跨世界书的多维度精确修改是否安全。
 *
 * 背景：
 * 当前的发送拦截器会捕获 `world_info_activated` 事件，该事件会抛出带有 `.world` 属性的 raw entries。
 * 过去的代码仅依据 `raw.uid` 强行到当前角色绑定的主世界书中进行映射。这会导致：
 * 1. 跨世界书（Global Mount）条目在主世界书中找不到，直接丢弃状态或显示错误。
 * 2. 如果碰巧多个世界书存在相同 UID 的条目，则会发生误伤。
 *
 * 验证目标：
 * 1. 如何直接利用 `raw.world` 属性进行路由，将更新操作 (updateWorldbookWith) 定向发送到所属的世界书。
 * 2. 在执行更新时，验证能否利用 uid + name + comment 组成复合索引，防止跨书碰撞。
 * 3. 获取并打印目标世界书前后的条目状态变化，确保没有误伤主世界书。
 *
 * 使用方法：
 * 在酒馆控制台粘贴全部代码执行。
 */

// 模拟从拦截器获取到的 raw_entry
const mockTriggeredEntry = {
    uid: 5,
    world: '测试用附加世界书', // 这是一个跨挂载的世界书
    name: '[设定] 跨书测试条目',
    comment: '跨书测试条目',
    enabled: true,
};

async function pocCrossWorldbookUpdate() {
    console.info('[PoC_CrossWB] 开始执行跨世界书修改验证...');

    // 1. 获取当前主世界书
    let primaryWb = null;
    try {
        const charResult = await getCharWorldbookNames('current');
        primaryWb = charResult.primary || null;
        console.info(`[PoC_CrossWB] 1. 当前主世界书识别为: ${primaryWb}`);
    } catch (e) {
        console.warn(`[PoC_CrossWB] 1. 无法获取当前主世界书 (环境未准备好?): ${e}`);
    }

    // 2. 模拟路由分发逻辑
    // 如果 entry.world 存在，则操作该 world；否则回退到主世界书。
    const targetWb = mockTriggeredEntry.world || primaryWb;

    if (!targetWb) {
        console.error('[PoC_CrossWB] 错误：无法确定要操作的目标世界书。');
        return;
    }
    console.info(`[PoC_CrossWB] 2. 路由确定的目标世界书为: ${targetWb}`);

    // 3. 模拟状态切换 (Toggle Enabled) 的多维度匹配写入
    const newState = !mockTriggeredEntry.enabled;
    console.info(`[PoC_CrossWB] 3. 尝试将目标条目 [UID:${mockTriggeredEntry.uid}] 的 enabled 状态修改为: ${newState}`);

    try {
        // 由于是测试，如果不小心写错世界书名会抛错，这可以模拟找不到附加书的情况
        await updateWorldbookWith(targetWb, (entries) => {
            // 核心逻辑验证：不仅比对 UID，还要比对 name 或 comment。
            // 酒馆内部有时候 name 就是 comment，所以做 OR 逻辑。
            const foundEntry = entries.find(
                (x) =>
                    x.uid === mockTriggeredEntry.uid &&
                    (x.name === mockTriggeredEntry.name || x.comment === mockTriggeredEntry.comment)
            );

            if (foundEntry) {
                console.info(`[PoC_CrossWB] -> 成功在后端找到目标条目: ${foundEntry.name || foundEntry.comment}`);
                foundEntry.enabled = newState;
            } else {
                console.warn(`[PoC_CrossWB] -> 警告：在目标世界书 ${targetWb} 中未能精确匹配到该条目。`);
            }
            return entries;
        });

        console.info(`[PoC_CrossWB] 4. updateWorldbookWith 异步调用完成。`);
    } catch (e) {
        console.error(`[PoC_CrossWB] 核心修改逻辑抛出异常:`, e);
    }
    
    console.info('[PoC_CrossWB] PoC 执行完毕。');
}

// 暴露到全局方便测试
window.runArkCrossWorldbookPoC = pocCrossWorldbookUpdate;

// 自动执行一次
pocCrossWorldbookUpdate();