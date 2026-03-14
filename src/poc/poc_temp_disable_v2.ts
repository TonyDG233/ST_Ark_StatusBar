import { eventOnce, tavern_events } from '../../../@types/iframe/event';

/**
 * POC: Temp Disable v2 (TypeScript / TavernHelper script environment)
 * 
 * 测试目标：
 * 1. 使用真实的世界书修改 API (updateWorldbookWith)。
 * 2. 监听真正的 `tavern_events.GENERATION_ENDED` 事件。
 * 3. 验证在此事件触发时，去执行世界书写操作是否会与酒馆自带的聊天保存产生竞态崩溃。
 */

async function testTempDisable() {
    // 获取当前绑定的世界书
    const result = await getCharWorldbookNames('current');
    const targetWorldbook = result.primary || (result.additional && result.additional.length > 0 ? result.additional[0] : null);

    if (!targetWorldbook) {
        console.error("当前角色没有绑定世界书，无法测试。");
        return;
    }

    console.log(`[Temp Disable POC] 目标世界书: ${targetWorldbook}`);

    // 1. 随机选一个处于开启状态的条目作为实验品
    const entries = await getWorldbook(targetWorldbook);
    const activeEntry = entries.find(e => e.enabled === true);

    if (!activeEntry) {
        console.warn("[Temp Disable POC] 没找到开启状态的条目，请随便在世界书里开一个。");
        return;
    }

    const testUid = activeEntry.uid;
    console.log(`[Temp Disable POC] 选定测试条目: UID=[${testUid}] 名字=[${activeEntry.comment || activeEntry.name}]`);

    // 2. 模拟将其临时禁用 (写入世界书为关)
    console.log(`[Temp Disable POC] 正在执行【临时禁用】... 写回世界书。`);
    await updateWorldbookWith(targetWorldbook, (wbEntries) => {
        const e = wbEntries.find(x => x.uid === testUid);
        if (e) e.enabled = false;
        return wbEntries;
    });
    console.log(`[Temp Disable POC] 已禁用。你可以打开世界书面板确认它关掉了。`);

    console.log(`[Temp Disable POC] 挂载 GENERATION_ENDED 监听器，请在酒馆里发送一条正常消息...`);

    // 3. 监听生成完毕事件并恢复
    eventOnce(tavern_events.GENERATION_ENDED, async (message_id) => {
        console.log(`%c[Temp Disable POC] 捕获到 GENERATION_ENDED (message_id: ${message_id})`, 'color: blue; font-weight: bold;');

        try {
            console.log(`[Temp Disable POC] 正在恢复 UID=[${testUid}] 的条目...`);
            // 执行真实写入恢复
            await updateWorldbookWith(targetWorldbook, (wbEntries) => {
                const e = wbEntries.find(x => x.uid === testUid);
                if (e) e.enabled = true;
                return wbEntries;
            });
            console.log(`%c[Temp Disable POC] 恢复完成! 请检查世界书面板是否重新开启，以及酒馆聊天是否有报错。`, 'color: green; font-weight: bold;');
        } catch (error) {
            console.error(`[Temp Disable POC] 恢复过程中发生错误，可能存在冲突：`, error);
        }
    });
}

$(() => {
    // 创建触发按钮
    const btn = $('<button style="position:fixed;top:60px;left:10px;z-index:9999;padding:10px;background:orange;color:black;">测试临时禁用</button>');
    btn.on('click', testTempDisable);
    $('body').append(btn);
    console.log("【临时禁用测试按钮】已添加到页面左上角，点击以开始流程。");
});
