/**
 * POC: Temporary Disable Worldbook Entry
 * 目的是测试：在记录一个临时禁用的世界书条目后，能否通过监听 GENERATION_ENDED 事件，
 * 在安全的时间节点将其恢复开启，从而实现“单次拦截，用完即扔”的效果。
 * 由于需要在酒馆环境中运行，你可以将此代码直接复制到浏览器控制台中运行。
 */

// 1. 获取全局事件绑定方法
const globalEventOn = window.eventOn || window.parent?.eventOn;
const globalEventOff = window.eventOff || window.parent?.eventOff;

if (!globalEventOn) {
    console.error("未找到 eventOn 方法，请确保在酒馆环境中运行此脚本。");
} else {
    console.log("找到事件绑定方法，开始注册 POC 事件监听...");

    // 2. 模拟一个内存中的临时存储区
    // 在真实代码中，这个可能存在 ArkConfig 中或 Manager 的类属性里
    let tempDisabledEntries = [
        { world: "昨夜圆车v22", uid: 2, comment: "[角色]:魔王（与特蕾西娅选一开）" }
    ];

    console.log("当前记录的待恢复条目:", tempDisabledEntries);

    // 3. 定义回调函数
    const onGenerationEnded = (message_id) => {
        console.log(`%c[Temp Disable POC] 捕获到 GENERATION_ENDED 事件! message_id: ${message_id}`, 'color: blue; font-weight: bold;');
        
        if (tempDisabledEntries.length > 0) {
            console.log(`%c[Temp Disable POC] 开始执行状态回滚...`, 'color: green; font-weight: bold;');
            
            // 模拟遍历并恢复
            tempDisabledEntries.forEach(entry => {
                console.log(`=> 正在恢复世界书 [${entry.world}] 中 UID为 [${entry.uid}] 的条目: ${entry.comment}`);
                // 在真实代码中这里会调用 updateWorldbookWith 方法把 disable 设回 false
            });

            // 清空列表
            tempDisabledEntries = [];
            console.log(`%c[Temp Disable POC] 回滚完成，待恢复列表已清空。`, 'color: green; font-weight: bold;');
        } else {
             console.log("[Temp Disable POC] 没有需要恢复的条目。");
        }
        
        // 验证完毕后清理监听，避免污染环境
        console.log("POC 验证完毕，解绑事件。");
        globalEventOff('generation_ended', onGenerationEnded);
    };

    // 4. 绑定事件 (在 @types/iframe/event.d.ts 中定义的 tavern_events.GENERATION_ENDED 为 'generation_ended')
    globalEventOn('generation_ended', onGenerationEnded);
    console.log("事件监听已挂载。请尝试在酒馆发送一条正常的消息触发生成，观察控制台输出。");
}
